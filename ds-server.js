const _ = require('underscore');


const deepstream = require('deepstream.io-client-js')
const MongoDBStorageConnector = require( 'deepstream.io-storage-mongodb' );

const Config = require('./config');

const client = deepstream(Config.host);
console.log(Config.db);
const db = new MongoDBStorageConnector( {
  connectionString: Config.db,
  splitChar: '/'
});

handleCoin = (object, user, response, userLocationAdmin, userUid) => {
  object.whenReady( o => {
    user.whenReady( u => {
      const objectData = o.get();
      const userData = u.get();
      if (!objectData.owner || true) {
        u.set('account', userData.account + objectData.value);
        o.set('owner', userUid);
        updateUserLocationAdmin(userLocationAdmin, true);
        response.send({ success: objectData.value });
      } else {
        response.send({ error: 'Coin already has an owner!' });
      }
    });
  });
};

handleCrumb = (object, user, response, userLocationAdmin) => {
  object.whenReady( o => {
    user.whenReady( u => {
      const objectData = o.get();
      const userData = u.get();
      u.set('exp', (userData.exp || 0) + 10);
      updateUserLocationAdmin(userLocationAdmin, false, objectData.path_uid, objectData.path_count);
      response.send({ success: userData});
    });
  });
};

updateUserLocationAdmin = (userLocation, isCoin, pathUid, pathCount) => {
  userLocation.whenReady(ul => {
    const ulData = ul.get();
    const newPathData = { path_count: pathCount, path_uid: pathUid };
    if (isCoin) {
      newPathData.path_count = 0;
      newPathData.path_uid = '';
    } else {
      newPathData.path_count = newPathData.path_count + 1
    }
    ul.set('path_data', newPathData);
  });
};

client.rpc.provide( 'pickup-object', ( data, response ) => {
  const objectUid = data.object;
  const userUid = data.uid;
  const objectsNearUser = client.record.getRecord( 'nearuser/' + userUid );
  const user = client.record.getRecord( 'users/' + userUid );
  const userLocationAdmin = client.record.getRecord( 'userlocationadmin/' + userUid);
  const objectName = 'object/' + objectUid
  client.record.has(objectName, (error, exists) => {
    console.log(objectUid);
    if (exists) {
      const object = client.record.getRecord(objectName);
      objectsNearUser.whenReady( r => {
        const data = r.get();
        if (data[objectName]) {
          object.whenReady( o => {
            const objectData = o.get()
            if (objectData.type === 'coin') {
              handleCoin(object, user, response, userLocationAdmin, userUid);
            } else if (objectData.type === 'crumb'){
              handleCrumb(object, user, response, userLocationAdmin);
            } else {
              response.send( { error: 'unknown' } );
              o.discard();
            }
           });
        } else {
          response.send( { error: 'this object is not near you location!' } );
          r.discard();
        }
      })
    } else {
      response.send( { error: 'Object doesnt exist!' } );
    }
  });
});

var lists = {};

const updateObjectsNearUser = (uid, coordinates, pathUid, pathCount) => {
  const lat = coordinates.lat;
  const lng = coordinates.lng;
  const collection = 'object';
  const query = {
    location: {
      $nearSphere: {
        $geometry: {
          type : 'Point',
          coordinates : [ lng, lat ]
        },
        $minDistance: 0,
        $maxDistance: 50000
      }
    },
    owner: ''
  };
  if (pathUid && pathUid !== '') {
    query.path_uid = pathUid;
    query.path_count = pathCount;
  } else {
    query.path_count = 0;
  }
  let objectsNearUser = client.record.getRecord('nearuser/' + uid);
  db.find( 'object', query, ( err, docs ) => {
      console.log(err);
      console.log(docs)
      const ids = _.reduce( docs.slice(0, 10), ( memo, doc ) => {
        memo['object/' + doc.ds_key] = true
        return memo
      }, {});
      objectsNearUser.set( ids );
  });
};

const userLocationDidChange = (uid) => {
  const userLocation = client.record.getRecord( 'userlocation/' + uid );
  const userLocationAdmin = client.record.getRecord('userlocationadmin/' + uid);
  userLocation.whenReady( record => {
    console.log(record.get());
    const data = record.get()
    if ( data.lng && data.lat ) {
      // change to subscribe only to path or make other parts of record unwritable
      console.log('subscribed to ' + uid);
      record.subscribe( data => {
          userLocationAdmin.set('location', { lng: data.lng, lat: data.lat });
      });
    }
  });
  userLocationAdmin.subscribe( data => {
    const loca = data.location || {lng: 0, lat: 0};
    const pathData = data.path_data || {path_uid: '', path_count: 0};
    updateObjectsNearUser(uid, loca, pathData.path_uid, pathData.path_count);
  });
};

// https://github.com/deepstreamIO/deepstream.io-client-js/issues/306
client.record.listen( 'nearuser/.*', ( match, isSubscribed, response ) => {
  const uid = match.split('/')[1];
  let updateParams = {}
  updateParams[uid] = true
  const serverId = { uid: client.uid }
  if (isSubscribed && typeof lists[ match ] === 'undefined') {
    const handleResp = () => {
      response.accept();
      db.update( 'servers', serverId, { $set : updateParams }, { upsert: true }, null )
      userLocationDidChange(uid);
      lists[match] = true
    };
    if (db.isReady) {
      handleResp();
    } else {
      db.on( 'ready', handleResp())
    }
  } else {
    // stop publishing data
    console.log('unsubscribed');
    if ( lists[ match ] ) {
      console.log('deleting ' + match)
      db.update( 'servers', serverId, { $unset : updateParams }, null, null )
      delete lists[ match ]
    }
  }
});

client.on('error', (error, event, topic) => {
  console.log(error, event, topic)
});

client.setup = (uid) => {
  client.uid = uid
  const serverId = { uid: client.uid }
  db.on( 'ready', () => { console.log("connected")});
  if (db.isReady) {
    db.findOne( 'servers', serverId, ( err, serverData ) => {
    if (serverData === null) return
    delete serverData.uid
    _.each( _.keys( serverData ), (userUid) => {
      lists['nearuser/' + userUid] = true
      userLocationDidChange(userUid)
    });
  });
  }
};

module.exports = client;
