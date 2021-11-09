var express = require('express');
var router = express.Router();
const request = require('request');
const { Client } = require('pg');
const pg = new Client(process.env.DATABASE_URL);

pg.connect().catch((error) => {
  console.log('Error connecting to database', error);
});

function IsRequestFromChatBot(req) {
  if (
    req.body.payload.hasOwnProperty('actionItem') ||
    req.body.payload.hasOwnProperty('cmd')
  ) {
    return true;
  }
  return false;
}

var getAccessToken = function (req, res, next) {
  if (
    req.headers.authorization === process.env.zoom_verification_token &&
    IsRequestFromChatBot(req)
  ) {
    // TODO: Add a check to make sure that all requests are from chatbot.
    let user_id = req.body.payload.userId;

    //pg.query(`SELECT * FROM oauth_tokens WHERE user_id = '${user_id}'`, (error, results) => {
    pg.query(
      `SELECT * FROM oauth_tokens WHERE user_id != '' LIMIT 1`,
      (error, results) => {
        if (error) {
          console.log(
            'Error getting oauth2 access_token from database.',
            error
          );
        } else {
          if (results.rows[0].expires_on > new Date().getTime() / 1000) {
            // Set oAuth2 access token in request
            req.body.oauth2_access_token = results.rows[0].access_token;
            req.body.oauth2_user = results.rows[0].user_id;
            next();
          } else {
            getFreshAccessTokenFromZoom(
              req,
              res,
              next,
              results.rows[0].refresh_token,
              results.rows[0].user_id
            );
          }
        }
      }
    );
  } else {
    next();
  }
};

function getFreshAccessTokenFromZoom(req, res, next, refresh_token, user_id) {
  request(
    {
      url:
        `https://zoom.us/oauth/token?grant_type=refresh_token&refresh_token=` +
        refresh_token,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          Buffer.from(
            process.env.zoom_client_id + ':' + process.env.zoom_client_secret
          ).toString('base64'),
      },
    },
    (error, httpResponse, body) => {
      if (error || JSON.parse(body).error) {
        console.log('Error getting oauth2 access_token from Zoom. ', error);
      } else {
        body = JSON.parse(body);
        // Store new refreshed token in DB.
        pg.query(
          `UPDATE oauth_tokens SET access_token = '${
            body.access_token
          }', refresh_token = '${body.refresh_token}', expires_on = '${
            new Date().getTime() / 1000 + body.expires_in - 60
          }' WHERE user_id = '${user_id}'`,
          (error, results) => {
            if (error) {
              console.log(
                'Error setting oauth2 access_token in database. ',
                error
              );
            } else {
              // Set access token in request
              req.body.oauth2_access_token = body.access_token;
              req.body.oauth2_user = user_id;
              // Go to next module.
              next();
            }
          }
        );
      }
    }
  );
}

module.exports = getAccessToken;
