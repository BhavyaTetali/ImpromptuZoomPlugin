# Impromptu Zoom Plugin - SJSU Master's project

Below are setup instructions
- Install [Node js](https://nodejs.org/en/)
- Install PostgreSQL

      $ brew install postgresql
      
- Initialize DB and tables in PostgreSQL

    -  Enter PostgreSQL terminal

      $ brew services start postgresql
      $ psql postgres

    -  Create a database user called "me" with a password of "password"
    
      postgres=# CREATE ROLE me WITH LOGIN PASSWORD 'password';
      postgres=# ALTER ROLE me CREATEDB;
      postgres=# \q

    -  You have just added yourself as a user who has the create database permission. Now type this to connect to postgres as "me" user.
    
      $ psql -d postgres -U me

    -  Create database and tables
    
      postgres=> CREATE DATABASE zoom_chatbot;
      postgres=> \c zoom_chatbot
      zoom_chatbot=> CREATE TABLE chatbot_token (token TEXT, expires_on NUMERIC);
      zoom_chatbot=> INSERT INTO chatbot_token (token, expires_on)  VALUES ('', '1');
      zoom_chatbot=> CREATE TABLE oauth_tokens (user_id TEXT, access_token TEXT, refresh_token TEXT, expires_on NUMERIC, primary key(user_id));
      zoom_chatbot=> CREATE TABLE meetings (meeting_id TEXT, meeting_name TEXT, account_id TEXT, primary key(meeting_id, account_id));
      zoom_chatbot=> CREATE TABLE users (user_id TEXT, meeting_id TEXT , primary key(user_id, meeting_id));
      zoom_chatbot=> CREATE TABLE channels (channel_id TEXT, channel_name TEXT, channel_topic TEXT, channel_owner_id TEXT, meeting_id TEXT, primary key(channel_id, meeting_id));

-  OPTIONAL: Use the below command to reset the PostgreSQL tables


       $ psql -d postgres -U me
       postgres=> \c zoom_chatbot
       zoom_chatbot=> DELETE FROM chatbot_token; DELETE FROM oauth_tokens; DELETE FROM meetings ; DELETE FROM users ; DELETE FROM channels ; INSERT INTO chatbot_token (token, expires_on)  VALUES ('', '1');

-  Add .env file in the root repo, with the following variables

       zoom_client_id=
       zoom_client_secret=
       zoom_bot_jid=@xmpp.zoom.us
       zoom_verification_token=
       redirect_uri=<authorization redirect url>
       DATABASE_URL=<postgress database url>
