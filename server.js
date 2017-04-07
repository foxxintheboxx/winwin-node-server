const DSClient = require('./ds-server.js');
const express = require('express');
const http = require('http');

const server = http.createServer(express());
server.listen(process.env.PORT || 6023, () => {
  DSClient.login({ username: "nodeserver", password: "1234" }, (sucess, data) => {
    console.log(sucess)
    console.log(data)
    DSClient.setup(data.uid)
  });
});

