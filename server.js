const DSClient = require('./ds-server.js');

DSClient.login({ username: "nodeserver", password: "1234" }, (sucess, data) => {
    DSClient.setup(data.uid)
});
