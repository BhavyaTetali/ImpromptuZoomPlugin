require('dotenv').config()

const initOptions = {
    // initialization options;
};

const pgp = require('pg-promise')(initOptions);

const cn = process.env.DATABASE_URL;
const db = pgp(cn);

module.exports = {
    pgp, db
};