var express = require('express');
var router = express.Router();
const request = require('request')
const axios = require('axios'); // to do requests via await/async.
sw = require('stopword')
const customStopwords = ['talk', 'discuss', 'discussion']
var WordPOS = require('wordpos'),
wordpos = new WordPOS();

const { pgp, db } = require('../routes/db');

async function handleTopic(req, res) {
    meeting_id = await getCurrentMeetingIdForUser(req)
    if (meeting_id == '') {
        // throw an error that user wasn't in any meeting right now!
        sendChatbotErrorMessage("Sorry, discussion feature is available for only those who are in a meeting!", req, res)
        return
    }
    console.log("User in following meeting: " + meeting_id)


    if (req.body.payload.hasOwnProperty('actionItem')) {
        console.log(req.body)
        await handleActionItem(req, res, meeting_id)
    }
    else if (req.body.payload.hasOwnProperty('cmd')) {
        await handleCmd(req, res, meeting_id)
    }
}

async function handleActionItem(req, res, meeting_id) {
    console.log("inside handleActionItem. Channel name: " + req.body.payload.actionItem.value)
    // TODO: check if the meeting is still active.

    // Create channel, if needed and get channel id.
    const [channel_id, channel_owner_id] = await getChannelInfo(req, res)
    if (channel_id == '') {
        await createChannel(req, meeting_id)
        await broadCastToAllUsersAboutChannel(req, meeting_id)
    } else {
        await addUserToChannel(req, req.body.payload.userId, channel_id, channel_owner_id)
    }
    deleteChatMessage(req, res)
}

async function getChannelInfo(req, res) {
    console.log("inside getChannelInfo")

    const channel_ids = await db.any('SELECT channel_id, channel_owner_id from channels where channel_name = $1 LIMIT 1', [req.body.payload.actionItem.value])
    if (channel_ids.length != 0) {
        return [ channel_ids[0]["channel_id"], channel_ids[0]["channel_owner_id"] ]
    }
    return ['', '']
}

async function createChannel(req, meeting_id) {
    let payload = { name: req.body.payload.actionItem.value, type: 2 };

    let res = await axios.post('https://api.zoom.us/v2/chat/users/' + req.body.payload.userId + '/channels', payload, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + req.body.oauth2_access_token
        }
    });

    let data = res.data;
    console.log("Successfully created channel:", data);

    // Insert details to DB.
    const insert_result = await db.any(
        'INSERT INTO channels (channel_id, channel_name, channel_topic, channel_owner_id, meeting_id)  VALUES ($1, $2, $3, $4, $5)',
        [data.id, data.name, getTopic(req.body.payload.actionItem.value), req.body.payload.userId, meeting_id]
    )
}

async function broadCastToAllUsersAboutChannel(req, meeting_id) {
    console.log("inside broadCastToAllUsersAboutChannel")
    let meeting_name = await getMeetingNameForMeetingId(meeting_id)
    if (meeting_name == '') {
        return;
    }

    let users = await getMeetingUsers(meeting_id, req.body.payload.userId)
    let message = `A new channel for below topic has been created in meeting ${meeting_name}`
    console.log(message)
    for (let ind in users) {
        let user_jid = users[ind] + "@xmpp.zoom.us"
        sendChatbotMessage(req, user_jid, getTopic(req.body.payload.actionItem.value), req.body.payload.actionItem.value, message)
    }
}

async function addUserToChannel(req, user_id, channel_id, channel_owner_id) {
    email = await getEmailForUser(req, user_id)
    if (email == '') {
        return
    }
    console.log("inviting user to channel. user_id: " + user_id + ", email: " + email + ", channel_id: " + channel_id + ", channel_owner_id: " + channel_owner_id)

    let payload = { members: [{email: email}] };
    try {
        let res = await axios.post('https://api.zoom.us/v2/chat/users/' + channel_owner_id + '/channels/' + channel_id + '/members', payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + req.body.oauth2_access_token
            }
        });
        console.log("Successfully invited user " + user_id + " to channel " + channel_id);
    }
    catch (error) {
        console.log(error.response.data)
    }
}

function deleteChatMessage(req, res) {
    console.log("inside deleteChatMessage. Message id: ", req.body.payload.messageId)
    request({
        url: 'https://api.zoom.us/v2/im/chat/messages/' + req.body.payload.messageId,
        method: 'DELETE',
        json: true,
        body: {
            'robot_jid': process.env.zoom_bot_jid,
            'account_id': req.body.payload.accountId
        },
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + req.body.chatbot_access_token
        }
    }, (error, httpResponse, body) => {
        if (error) {
            console.log('Error sending chat.', error)
        } else {
            console.log(body)
        }
    })
}

async function getMeetingUsers(meeting_id, except_userid) {
    console.log("inside getMeetingUsers. meeting_id: ", meeting_id)

    const result = await db.any('SELECT user_id from users where meeting_id = $1 and user_id != $2', [meeting_id, except_userid])
    console.log(result)
    const users = (result).map(x => x["user_id"]);
    return users
}

async function getMeetingNameForMeetingId(meeting_id) {
    console.log("inside getMeetingNameForMeetingId")

    const meeting_names = await db.any('SELECT meeting_name from meetings where meeting_id = $1 LIMIT 1', [meeting_id])
    if (meeting_names.length == 0) {
        return ''
    }
    return meeting_names[0]["meeting_name"]
}

function getTopic(button_value) {
    // Sample button value:-  "homework (72719657897)"
    return button_value.split(' (')[0].trim()
}

function removeStopWords(sentence) {
    const newString = sw.removeStopwords(sentence.split(' '), [...sw.en, ...customStopwords])
    return newString.join(' ')
}

async function handleCmd(req, res, meeting_id) {
    sentence = req.body.payload.cmd
    console.log("inside handleCmd. Cmd: " + sentence)

    sentence_without_stop_words = removeStopWords(sentence)
    console.log("inside handleCmd. Cmd: " + sentence_without_stop_words)
    wordpos.getNouns(sentence_without_stop_words, function(topics){
        console.log(topics);
        for (const topic of topics) {
            //button_value = topic + " (" + meeting_id + ")"
            button_value = topic
            sendChatbotMessage(req, req.body.payload.toJid, topic, button_value, "Would you like to join below channel?")
        }
    });
}

async function getCurrentMeetingIdForUser(req) {
    console.log("inside getCurrentMeetingIdForUser")

    const meeting_ids = await db.any('SELECT meeting_id from users where user_id = $1 LIMIT 1', [req.body.payload.userId])
    if (meeting_ids.length == 0) {
        return ''
    }
    return meeting_ids[0]["meeting_id"]
}

async function getEmailForUser(req, user_id) {
    console.log("inside getEmailForUser. user_id: " + user_id)
    try {
        const config = {
            method: 'get',
            url: 'https://api.zoom.us/v2/users/' + user_id,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + req.body.oauth2_access_token
            }
        }
        let axios_res2 = await axios(config);
        return axios_res2.data.email
    }
    catch (error) {
        console.log(error.response.data)
    }
    return ''
}

function sendChatbotMessage(req, toJid, buttonText, buttonValue, message) {
    console.log("inside sendChatbotMessage. toJid: " + toJid + ", buttonText: " + buttonText + ", buttonValue: " + buttonValue + ", message: " + message)

    request({
        url: 'https://api.zoom.us/v2/im/chat/messages',
        method: 'POST',
        json: true,
        body: {
            'robot_jid': process.env.zoom_bot_jid,
            'to_jid': toJid,
            'account_id': req.body.payload.accountId,
            'content': {
                "head": {
                    "type": "message",
                    "text": message
                },
                "body": [
                    {
                        "type": "section",
                        "sections": [
                            {
                                "type": "message",
                                "style": {
                                    "bold": true
                                },
                                "text": buttonText
                            },
                            {
                                "type": "actions",
                                "items": [
                                    {
                                        "value": buttonValue,
                                        "style": "Primary",
                                        "text": "Join"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        },
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + req.body.chatbot_access_token
        }
    }, (error, httpResponse, body) => {
        if (error) {
            console.log('Error sending chat.', error)
        } else {
            console.log("Successfully sent chat message with action buttons: ", body)
        }
    })
}

function sendChatbotErrorMessage(errorMessage, req, res) {
    request({
        url: 'https://api.zoom.us/v2/im/chat/messages',
        method: 'POST',
        json: true,
        body: {
            'robot_jid': process.env.zoom_bot_jid,
            'to_jid': req.body.payload.toJid,
            'account_id': req.body.payload.accountId,
            'content': {
                'body': [
                    {
                        'type': 'section',
                        'sidebar_color': '#D72638',
                        'sections': [{
                            'type': 'message',
                            'text': errorMessage
                        }]
                    }
                ]
            }
        },
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + req.body.chatbot_access_token
        }
    }, (error, httpResponse, body) => {
        if (error) {
            console.log('Error sending chat.', error)
        } else {
            console.log(body)
        }
    })
}

router.post('/', handleTopic);
module.exports = router;