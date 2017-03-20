const _ = require('underscore');

const deepstream = require('deepstream.io-client-js')
const MongoDBStorageConnector = require( 'deepstream.io-storage-mongodb' );

const client = deepstream(process.env.HOST)
const db = new MongoDBStorageConnector( {
  connectionString: process.env.DB,
  splitChar: '/'
});

client.rpc.provide( 'multiply-number', ( data, response ) => {
     const result = data.value * data.multiplier;
     response.send({ result, name:'digits/1'});
});

client.rpc.provide( 'pickup-coin', ( data, response ) => {
    const coinUid = data.coin
    const userUid = data.uid
    const coinsNearUser = client.record.getRecord( 'nearuser/' + userUid )
    const coin = client.record.getRecord( 'object/' + coinUid )
    const user = client.record.getRecord( 'users/' + userUid )
    console.log(data)
    coinsNearUser.whenReady( r => {
      const data = r.get()
      console.log("pickup 2")
      if (data[coinUid]) {
        coin.whenReady( c => {
          const coinData = c.get()
         console.log(coinData)
         console.log(coinUid)
         if (!coinData.type) {
            c.delete() // Get record will have created the coin. Lets delete it.
            response.send( { error: 'Coin doesnt exist!' } )
         } else if (coinData.type !== "coin") {
            c.discard()
            response.send( { error: 'Object not a coin!' } )
         } else if (!coinData.owner) {
            user.whenReady( u => {
              u.set('account', u.get().account + coinData.value)
              c.set('owner', userUid)
              response.send( { success: coinData.value } )
            coin.discard()
            })
          } else {
            response.send( { error: 'Coin already has an owner!' } )
            coin.discard()
          }
        })
      } else {
        response.send( { error: 'this coins is not near you location!' } )
        coin.discard()
      }
    })
});

var lists = {};

const userLocationDidChange = (uid) => {
  const userLocation = client.record.getRecord( 'userlocation/' + uid );
  userLocation.whenReady( record => {
    console.log(record.get());
    const data = record.get()
    if ( data.lng && data.lat ) {
      // change to subscribe only to path or make other parts of record unwritable
      console.log("subscribed to " + uid);
      record.subscribe( (data) => {
        const lat = data.lat;
        const lng = data.lng;
        const collection = 'object';
        const query = {
          location: {
            $nearSphere: {
              $geometry: {
                type : 'Point',
                coordinates : [ data.lng, data.lat ]
              },
              $minDistance: 0,
              $maxDistance: 4000
            }
          }
        };
        let objectsNearUser = client.record.getRecord('nearuser/' + uid);
        db.find( 'object', query, ( err, docs ) => {
            console.log(docs)
            const ids = _.reduce( docs, ( memo, doc ) => {
              memo[doc.ds_key] = true
              return memo
            }, {});
            objectsNearUser.set( ids );
        });
      });
    }
  });
};

// https://github.com/deepstreamIO/deepstream.io-client-js/issues/306
client.record.listen( 'nearuser/.*', ( match, isSubscribed, response ) => {
  const uid = match.split('/')[1];
  let updateParams = {}
  updateParams[uid] = true
  const serverId = { uid: client.uid }
  if (isSubscribed && typeof lists[ match ] === 'undefined') {
    response.accept();
    db.update( 'servers', serverId, { $set : updateParams }, { upsert: true }, null )
    userLocationDidChange(uid);
    lists[match] = true
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
  db.findOne( 'servers', serverId, ( err, serverData ) => {
    if (serverData === null) return
    delete serverData.uid
    _.each( _.keys( serverData ), (userUid) => {
      lists["nearuser/" + userUid] = true
      userLocationDidChange(userUid)
    });
  });
};

module.exports = client;
