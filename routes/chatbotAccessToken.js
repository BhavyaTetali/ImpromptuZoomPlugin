var express = require('express');
var router = express.Router();
const request = require('request')
const { Client } = require('pg')
const pg = new Client(process.env.DATABASE_URL)

pg.connect().catch((error) => {
  console.log('Error connecting to database', error)
})

var getAccessToken = function (req, res, next) {
    
    if (req.headers.authorization === process.env.zoom_verification_token) {
        // Return the response code with sucess but continue the processing further, so that if server wants to repond to chat bot, it can respond with another http request.
        res.status(200)
        res.send()
        pg.query(`SELECT * FROM chatbot_token`, (error, results) => {
          if (error) {
            console.log('Error getting chatbot access_token from database.', error)
          } else {
            if (results.rows[0].expires_on > (new Date().getTime() / 1000)) {
                // Set chatbot access token in request
                req.body.chatbot_access_token = results.rows[0].token
                next();
            } else {
              getTokenFromZoom(req, res, next)
            }
          }
        })
      } else {
        res.status(401)
        res.send('Unauthorized request to Chatbot for Zoom.')
      } 
}

function getTokenFromZoom (req, res, next) {
    request({
      url: `https://zoom.us/oauth/token?grant_type=client_credentials`,
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(process.env.zoom_client_id + ':' + process.env.zoom_client_secret).toString('base64')
      }
    }, (error, httpResponse, body) => {
      if (error || JSON.parse(body).error) {
        console.log('Error getting chatbot access_token from Zoom. ', error)
      } else {
        body = JSON.parse(body)
        // Store new token in DB.
        pg.query(`UPDATE chatbot_token SET token = '${body.access_token}', expires_on = ${(new Date().getTime() / 1000) + body.expires_in - 60}`, (error, results) => {
          if (error) {
            console.log('Error setting chatbot access_token in database. ', error)
          } else {
              // Set access token in request
              req.body.chatbot_access_token = body.access_token
              // Go to next module.
            next();

          }
        })
  
      }
    })
  }
  
module.exports = getAccessToken;