const app = require('./webapp');
const DSClient = require('./ds-server.js');

app.listen(6022);
DSClient.login({ username: "nodeserver", password: "1234" }, (sucess, data) => { DSClient.setup(data.uid) });
