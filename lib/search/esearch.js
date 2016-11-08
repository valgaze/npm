'use strict'

var npm = require('../npm.js')
var log = require('npmlog')
var mapToRegistry = require('../utils/map-to-registry.js')
var jsonstream = require('JSONStream')
var ms = require('mississippi')

module.exports = esearch

function esearch (include, exclude) {
  var stream = ms.through.obj()

  mapToRegistry('-/search', npm.config, function (er, uri, auth) {
    if (er) return stream.emit('error', er)
    uri +=
    createResultStream(uri, auth, include, exclude, function (err, resultStream) {
      if (err) return stream.emit('error', err)
      ms.pipeline.obj(resultStream, stream)
    })
  })
  return stream
}

function createResultStream (uri, auth, include, exclude, cb) {
  log.verbose('esearch', 'creating remote entry stream')
  var params = {
    timeout: 600,
    follow: true,
    staleOk: true,
    auth: auth,
    streaming: true,
    body: {
      text: include.join(' AND ') +
            (exclude.length ? ' AND NOT ' + exclude.join(' AND NOT ') : '')
    }
  }
  npm.registry.request(uri, params, function (er, res) {
    if (er) return cb(er)
    log.silly('esearch', 'request stream opened, code:', res.statusCode)
    // NOTE - The stream returned by `request` seems to be very persnickety
    //        and this is almost a magic incantation to get it to work.
    //        Modify how `res` is used here at your own risk.
    var entryStream = ms.pipeline.obj(
      res,
      ms.through(function (chunk, enc, cb) {
        cb(null, chunk)
      }),
      jsonstream.parse('results')
    )
    return cb(null, entryStream)
  })
}
