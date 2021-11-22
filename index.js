require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const axios = require('axios');

var authorizeRouter = require('./routes/authorize');
var topicRouter = require('./routes/topic');
var meetingRouter = require('./routes/meeting');
var chatBotAccessTokenRetriever = require('./routes/chatbotAccessToken'); 
var oAuth2AccessTokenRetriever = require('./routes/oAuth2AccessToken'); 

const app = express()
const port = process.env.PORT || 4000

app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send('Hello! This is a test API for Impromptu Zoom Chatbot!')
})

app.use('/authorize', authorizeRouter)

app.get('/support', (req, res) => {
  res.send('See Zoom Developer Support  for help.')
})

app.get('/privacy', (req, res) => {
  res.send('The impromptu Chatbot for Zoom does not store any user data.')
})

app.get('/terms', (req, res) => {
  res.send('By installing the impromptu Chatbot for Zoom, you are accept and agree to these terms...')
})

app.get('/documentation', (req, res) => {
  res.send('Try typing "island" to see a photo of an island, or anything else you have in mind!')
})

app.get('/zoomverify/verifyzoom.html', (req, res) => {
    res.send(process.env.zoom_verification_code)
  })

app.post('/deauthorize', (req, res) => {
  if (req.headers.authorization === process.env.zoom_verification_token) {
    res.status(200)
    res.send()
    request({
      url: 'https://api.zoom.us/oauth/data/compliance',
      method: 'POST',
      json: true,
      body: {
        'client_id': req.body.payload.client_id,
        'user_id': req.body.payload.user_id,
        'account_id': req.body.payload.account_id,
        'deauthorization_event_received': req.body.payload,
        'compliance_completed': true
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(process.env.zoom_client_id + ':' + process.env.zoom_client_secret).toString('base64'),
        'cache-control': 'no-cache'
      }
    }, (error, httpResponse, body) => {
      if (error) {
        console.log(error)
      } else {
        console.log(body)
      }
    })
  } else {
    res.status(401)
    res.send('Unauthorized request to impromptu Chatbot for Zoom.')
  }
})

app.use('/meeting', meetingRouter)

app.use(chatBotAccessTokenRetriever)
app.use(oAuth2AccessTokenRetriever)

app.use('/impromptu', topicRouter)

app.listen(port, () => console.log(`Impromptu Chatbot for Zoom listening on port ${port}!`))