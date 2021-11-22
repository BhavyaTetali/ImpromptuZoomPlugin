var express = require('express');
var router = express.Router();
const request = require('request')
const { pgp, db } = require('../routes/db');
const axios = require('axios'); // to do requests via await/async.

var authorize = async function (req, res, next) {
    console.log("inside authorize function. Authorization code " + req.query.code)

    let params = { grant_type: "authorization_code", code: req.query.code, redirect_uri: process.env.redirect_uri };

    var data = ""
    try {
        let axios_res = await axios.post('https://zoom.us/oauth/token/', null, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from(process.env.zoom_client_id + ':' + process.env.zoom_client_secret).toString('base64')
            }, params: params
        });
        data = axios_res.data;
    } catch (error) {
        console.log(error.response.data)
    }

    console.log("retrieving user id for access token: " + data.access_token)
    // Get user id using access token.
    var user_id = ""
    try {
        const config = {
            method: 'get',
            url: 'https://api.zoom.us/v2/users/me',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + data.access_token
            }
        }
        let axios_res2 = await axios(config);
        user_id = axios_res2.data.id
        console.log("Successfully retrieved user id:", user_id)
    }
    catch (error) {
        console.log(error.response.data)
    }

    // Insert access token details into DB.
    console.log("inserting access token details into db")
    const insert_result = await db.any(
        'INSERT INTO oauth_tokens (user_id, access_token, refresh_token, expires_on)  VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET access_token = $2, refresh_token = $3, expires_on = $4',
        [user_id, data.access_token, data.refresh_token, (new Date().getTime() / 1000) + data.expires_in - 60]
    )

    res.redirect('https://zoom.us/launch/chat?jid=robot_' + process.env.zoom_bot_jid)
}

router.get('/', authorize);
module.exports = router;