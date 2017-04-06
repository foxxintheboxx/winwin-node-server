const DSClient = require('./ds-server.js');

DSClient.login({ username: "nodeserver", password: "1234" }, (sucess, data) => {
    console.log(sucess)
    console.log(data)
    DSClient.setup(data.uid)
});
