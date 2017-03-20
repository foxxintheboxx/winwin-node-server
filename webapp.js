const express = require('express');
const bodyParser = require('body-parser');

// Create Express web app
var app = express();

// Parse incoming form-encoded HTTP bodies
app.use(bodyParser.json());

// Export Express app
module.exports = app;
