var config = {};

config.host = process.env.DS_HOST || process.env.HOST;
config.db = process.env.MONGODB_URI || process.env.DB;

module.exports = config;
