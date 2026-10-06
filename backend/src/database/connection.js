const { Pool } = require("pg");

const url = process.env.DATABASE_URL;

// La red interna de Railway (*.railway.internal) no usa SSL; el proxy publico si.
const usaSSL = !(url && url.includes(".railway.internal"));
const ssl = usaSSL ? { rejectUnauthorized: false } : false;

const pool = url
    ? new Pool({ connectionString: url, ssl })
    : new Pool({
        host: process.env.PGHOST,
        port: process.env.PGPORT,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl
    });

module.exports = pool;
