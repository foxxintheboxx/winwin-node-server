const deepstream = require('deepstream.io-client-js');
const _ = require("underscore");
const constants = deepstream.CONSTANTS

const client = deepstream(process.env.HOST).login({ username: "nodeserver", password:"1234" });
client.on( 'connectionStateChanged', ( connectionState ) => {
  if (connectionState === constants.CONNECTION_STATE.OPEN) {
    let count;
    let completed = 0;
    let lat0 = 41385985;
    let lat1 = 41391024;
    let lng0 = 2164719;
    let lng1 = 2196712;
    const div = Math.pow(10, 6);
    _.each( process.argv, (arg) => {
      const argArray = arg.split("=");
      const value = parseFloat(argArray[1])
      if (argArray[0] === "lat0") lat0 = value
      if (argArray[0] === "lat1") lat1 = value
      if (argArray[0] === "lng0") lng0 = value
      if (argArray[0] === "lng1") lng1 = value
    });
    for ( count = 0; count < 15; count++ ) {
      const lat = _.random(lat0, lat1)
      const lng = _.random(lng0, lng1)
      for ( let i = 0; i < 3; i++) {
        const _lat = _.random(lat - 30, lat + 30)
        const _lng = _.random(lng - 30, lng + 30)
        const recordName = "object/" + client.getUid();
        let record = client.record.getRecord(recordName);
        console.log("CREATING " + recordName);
        record.whenReady(() => {
          record.set({
            location: {
              type: "Point",
              coordinates: { lng: _lng / div, lat: _lat / div }
            },
            value: _.random(1, 5) * 10,
            owner: "",
            type: "coin"
          },err => {
            if (err) {
              console.log('Record set with error:', err)
            } else {
              console.log('Record set without error')
            }
            completed += 1;
            if (completed === 45) {
              client.close();
            }
          });
        });
      }
    }
    console.log("COMPLETE")
  }
});
