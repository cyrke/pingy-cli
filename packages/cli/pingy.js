'use strict';

const path = require('upath');
const fs = require('fs');
const connect = require('connect');
const serveStatic = require('serve-static');
const instant = require('@pingy/instant');
const enableDestroy = require('server-destroy');
const autoprefixer = require('express-autoprefixer');
const scaffold = require('@pingy/scaffold-middleware');
const express = require('express');
const getPort = require('get-port');

function serveSite(sitePath, options) {
  const pingyMiddleware = require('@pingy/middleware');

  const server = connect();
  enableDestroy(server);

  const $instant = instant(sitePath);
  const $serveStatic = serveStatic(sitePath);
  const $pingy = pingyMiddleware(sitePath, options);

  if (options.autoprefix) {
    if (typeof options.autoprefix === 'string') {
      options.autoprefix = [options.autoprefix];
    } else if (options.autoprefix === true) {
      options.autoprefix = 'last 2 versions';
    }
    server.use((req, res, next) => {
      const cleanUrl = req.url.split('?')[0];
      if (path.extname(cleanUrl) === '.css') {
        const filePath = path.join(sitePath, cleanUrl);
        if (fs.existsSync(filePath)) {
          // Only run autoprefixer if it's vanilla css otherwise @pingy/compile will run it
          return autoprefixer({ browsers: options.autoprefix, cascade: false })(
            req,
            res,
            next
          );
        }
      }
      return next();
    });
  }
  server.use($instant);
  server.use($serveStatic);
  server.use($pingy);

  $pingy.events.on('fileChanged', $instant.reload);

  server.listen(options.port);
  const url = `http://localhost:${options.port}`;
  return {
    server,
    url,
    pingy: $pingy,
    instant: $instant,
  };
}

function serveScaffolder(scaffoldPath) {
  return getPort().then(freePort => {
    const app = express();

    const $serveStatic = serveStatic(scaffoldPath);

    app.use(scaffold.inject);
    app.use($serveStatic);
    let scaffoldComplete = new Promise(resolve => {
      app.use('/__pingy__', scaffold.api(resolve, scaffoldPath));
    });
    app.use('/__pingy__.js', scaffold.servePingyJs);

    let server = app.listen(freePort);
    enableDestroy(server);
    const scaffoldUrl = `http://localhost:${freePort}`;

    scaffoldComplete = scaffoldComplete.then(scaffoldJson => {
      server.destroy();
      server = null;
      return scaffoldJson;
    });

    return {
      scaffoldUrl,
      scaffoldComplete,
    };
  });
}

function exportSite(inputDir, outputDir, options) {
  return require('@pingy/export')(inputDir, outputDir, options);
}

module.exports = {
  serveSite,
  exportSite,
  serveScaffolder,
};
