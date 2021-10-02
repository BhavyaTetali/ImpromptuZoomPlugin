var express = require('express');
var router = express.Router();
const request = require('request')
const { pgp, db } = require('../routes/db');

var startedMeeting = async function (req, res, next) {
    console.log("inside startedMeeting")
    console.log(req.body);
    const queries = [
        {
            query: 'INSERT INTO meetings (meeting_id, meeting_name, account_id)  VALUES ($1, $2, $3) ON CONFLICT (meeting_id,account_id) DO NOTHING'
            , values: [req.body.payload.object.id.trim(), req.body.payload.object.topic.trim(), req.body.payload.account_id.trim()]
        }
    ];
    const sql = pgp.helpers.concat(queries);
    const [users_insert_result] = await db.multi(sql);
    console.log("Added/updated meeting entry in meetings table")
}

var joinedMeeting = async function (req, res, next) {
    console.log("inside joinedMeeting")
    const queries = [
        {
            query: 'INSERT INTO users (user_id, meeting_id)  VALUES ($1, $2) ON CONFLICT (user_id,meeting_id) DO NOTHING'
            , values: [req.body.payload.object.participant.id.trim(), req.body.payload.object.id.trim()]
        }
    ];
    const sql = pgp.helpers.concat(queries);
    const [users_insert_result] = await db.multi(sql);
    console.log("Added/updated user entry in users table")
}

var leftMeeting = async function (req, res, next) {
    console.log("inside leftMeeting")
    console.log(req.body);
}

var endedMeeting = async function (req, res, next) {
    console.log("inside endedMeeting")
    console.log(req.body);
}

router.post('/joined', joinedMeeting);
router.post('/left', leftMeeting);
router.post('/started', startedMeeting);
router.post('/ended', endedMeeting);
module.exports = router;