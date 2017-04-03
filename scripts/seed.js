const _ = require("underscore");

const deepstream = require("deepstream.io-client-js");

const LatLon = require("../latlon-spherical");
const constants = deepstream.CONSTANTS
const Config = require("../config");

console.log(Config.host);
const client = deepstream(Config.host).login({ username: "nodeserver", password:"1234" });
client.on( "connectionStateChanged", ( connectionState ) => {
  if (connectionState === constants.CONNECTION_STATE.OPEN) {
    let count;
    let completed = 0;
    let clusters = 10;
    let lat0 = 41385985;
    let lat1 = 41401024;
    let lng0 = 2164719;
    let lng1 = 2196712;
    let directions = 3;
    let coinsPerCluster = 1;
    let minCrumbs = 0;
    let maxCrumbs = 0;
    let needed= clusters * coinsPerCluster + clusters * directions * minCrumbs;
    const callback = (err) => {
      if (err) {
        console.log("Record set with error:", err)
      } else {
        console.log("Record set without error")
      }
      completed += 1;
      if (completed === needed) {
        client.close();
      }
    };
    const pow = Math.pow(10, 6);
    _.each( process.argv, (arg) => {
      const argArray = arg.split("=");
      const value = parseFloat(argArray[1])
      if (argArray[0] === "lat0") lat0 = value
      if (argArray[0] === "lat1") lat1 = value
      if (argArray[0] === "lng0") lng0 = value
      if (argArray[0] === "lng1") lng1 = value
      if (argArray[0] === "dir") directions = value
    });
    for ( count = 0; count < clusters; count++ ) {

      // variables for this set of coins
      const point = new LatLon(_.random(lat0, lat1) / pow, _.random(lng0, lng1) / pow);
      const crumbs = _.random(minCrumbs, maxCrumbs);
      if (crumbs === 3) needed + 1;
      const opts = { color: getRandomColor() };
      const pathOpts = { uid: client.getUid() };
      const avgDistance = _.random(600, 650); // meters

      // variables for this set of crumbs
      if (crumbs > 0) {
        for (let d = 0; d < directions; d++) {
          const crumb0 = client.record.getRecord(objRecordName());
          const crumb1 = client.record.getRecord(objRecordName());
          const crumb2 = (crumbs > 2) ? client.record.getRecord(objRecordName()) : null;

          const bearingOffset = _.random(0, 100); // make  points for all crumbs
          const crumb0Point = point.destinationPoint(avgDistance, bearingOffset * (1 + d));
          const crumb1Point = point.intermediatePointTo(crumb0Point, _.random(40, 65) / 100);
          const crumb2Point = point.intermediatePointTo(crumb0Point, _.random(60, 75) / 100);

          let crumbObjs = [
            { r: crumb0, coor: crumb0Point},
            { r: crumb1, coor: crumb1Point},
            { r: crumb2, coor: crumb2Point}
          ];
          crumbObjs = _.filter(crumbObjs, c => { return c.r });

          crumbObjs.sort(( a, b ) => {
              const distA = point.distanceTo(a.coor);
              const distB = point.distanceTo(b.coor);
              if (distA === distB) return 0;
              if (distA > distB) return -1;
              return 1;
          });

          _.each(crumbObjs, (c, i) => {
            console.log("CREATING CRUMB");
            const crumbPathOpts = _.extend({ count: i }, pathOpts);
            const crumbOpts = _.extend({ pathOpts: crumbPathOpts }, opts);
            const type = "crumb";
            makeObject(c.coor.lat, c.coor.lon, c.r, callback, type, crumbOpts);
          });

        }
      }
      // make Coins
      for ( let i = 0; i < coinsPerCluster; i++) {
        const _lat = _.random(point.lat * pow - 30, point.lat * pow + 30) / pow;
        const _lng = _.random(point.lon * pow - 30, point.lon * pow + 30) / pow;
        const record = client.record.getRecord(objRecordName());
        const value = _.random(1, 5) * 10;
        const coinPathOpts = _.extend({ count: crumbs }, pathOpts);
        const coinOpts = _.extend({ value, pathOpts: coinPathOpts }, opts);
        const type = "coin";
        makeObject(_lat, _lng, record, callback, type, coinOpts);
        console.log("CREATING COIN" + count);
      }
    }
    console.log("COMPLETE")
  }
});

const objRecordName = () => "object/" + client.getUid();

const makeObject = (lat, lng, record, callback, type, opts) => {
   if (!opts.pathOpts) opts.pathOpts = { uid: "", count: 0 };
   if (!opts.contents) opts.contents = "";
   if (!opts.color) opts.color = "";
   if (!opts.value) opts.value = 0;
   record.whenReady(r => {
     r.set({
       location: {
         type: "Point",
         coordinates: { lng, lat }
       },
       type: type,
       value: opts.value,
       color: opts.color,
       owner: "",
       path_uid: opts.pathOpts.uid,
       path_count: opts.pathOpts.count,
     },err => callback(err)
     );
   });

}

const getRandomColor = () => {
   const letters = "0123456789ABCDEF";
   let color = "#";
   for (let i = 0; i < 6; i++ ) {
      color += letters[Math.floor(Math.random() * 16)];
   }
   return color;
}
