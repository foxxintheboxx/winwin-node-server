const DSClient = require('./ds-server.js');

DSClient.login({ username: "nodeserver", password: "12934" }, (sucess, data) => {
    DSClient.setup(data.uid)
});
