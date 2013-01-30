/**
 * CanvasCapture v0.1.0 
 *
 * CanvasCapture is a library for recording HTML5 canvas animations as
 * videos. Frames are sampled from the canvas and sent to the server
 * for rendering with ffmpeg.
 *
 * Distributed under the terms of the MIT License.
 */

var fs      = require('fs')
  , path    = require('path')
  , async   = require('async')
  , crypto  = require('crypto')
  , rimraf  = require('rimraf')
  , ffmpeg  = require('fluent-ffmpeg')
  , express = require('express')
  , Router  = express.Router;

var BASE_DIR = '';

var CLEAN = true;
var CLEAN_THRESHOLD = 15 * 60 * 1000;

/**
 * Resolves the file path of the captured frames and videos.
 */
var resolvePath = function(captureId, filename) {
  return path.join(BASE_DIR, 'captures', captureId, filename);
};

/**
 * Saves a captured frame to disk.
 */
var saveFrame = function(captureId, frameN, buffer) {
  var root = path.join(BASE_DIR, 'captures');
  var dir  = resolvePath(captureId);
  var file = resolvePath(captureId, frameN + '.png');

  async.series([
    function(callback) {
      fs.exists(root, function(exists) {
        if (exists) return callback();
        fs.mkdir(root, function(err) {
          callback(); // Wrapper to ignore errors
        });
      });
    },
    function(callback) {
      fs.exists(dir, function(exists) {
        if (exists) return callback();
        fs.mkdir(dir, function(err) {
          callback(); // Wrapper to ignore errors
        });
      });
    },
    function(callback) {
      fs.writeFile(file, buffer, 'binary', function(err) { });
    }
  ]);
};

/**
 * Removes captured videos that have been around for too long.
 */
var clean = function() {
  if (!CLEAN) return;

  var root = path.join(BASE_DIR, 'captures');
  fs.readdir(root, function(err, files) {
    if (err) return;
    for (var i = 0; i < files.length; i++) {
      var file = path.join(BASE_DIR, 'captures', files[i]);
      
      fs.stat(file, function(err, stats) {
        if (err) return;
        if (stats.isFile()) return;

        var timeDiff = Math.abs((+new Date()) - stats.ctime.getTime());
        if (timeDiff > CLEAN_THRESHOLD) {
          rimraf(file, function() { } );
        }
      });
    }
  });
  setTimeout(clean, CLEAN_THRESHOLD);
};


module.exports = function() {
  // Bootstrap cleaning if enabled
  clean();

  // Resuse Router to dispatch requests
  var options = { caseSensitive: false, strict: false };
  var router = new Router(options);

  var appProxy = function() { 
  };

  var methods = ['get', 'post'];
  methods.forEach(function(method) {
    appProxy[method] = function(path, callback) {
      router.route(method, path, [callback]);
    };
  });

  /**
   * Generates and sends back a new captureId.
   */
  appProxy.get('/capture', function(request, response) {
    crypto.randomBytes(24, function(ex, buf) {
      var token = buf.toString('hex');
      response.end(token);
    });
  });

  /**
   * Receives a frame from the capture.
   */
  appProxy.post('/capture/:id/frame/:n', function(request, response) {
    // Verify Content-Type before proceeding
    var mime = request.headers['content-type'] || '';
    mime = mime.split(';')[0];
    if (mime.split(';')[0] !== 'image/png') {
      response.end();
      return;
    }

    var dataURL = '';
    request.setEncoding('utf8');
    request.on('data', function(chunk) {
      dataURL += chunk;
    });
    request.on('end', function() {
      var buffer = new Buffer(dataURL, 'base64');

      var id = request.params.id;
      var frameN = request.params.n;

      saveFrame(id, frameN, buffer);

      response.end();
    });
  });

  /**
   * Pipes the video for download.
   */
  appProxy.get('/capture/:id/canvas.mp4', function(request, response) {
    var filePath = resolvePath(request.params.id, 'canvas.mp4');
    try {
      var fileStream = fs.createReadStream(filePath);
      
      response.writeHead(200, { 
        'Content-Type':'video/mp4' 
      });
      fileStream.pipe(response);

    } catch (e) { 
      response.writeHead(404);
      response.end();
    }
  });

  /**
   * Triggers ffmpeg to render the captured frames into a video.
   */
  appProxy.post('/capture/:id/render', function(request, response) {
    var source = resolvePath(request.params.id, '%d.png');
    var dest   = resolvePath(request.params.id, 'canvas.mp4');
    var prog   = resolvePath(request.params.id, 'progress');

    var fps = request.body.fps || 60;

    var proc = new ffmpeg({ source: source, timeout: 30, priority: 0 })
    .withFpsInput(fps)
    .onProgress(function(report) {
      var progress = report.percent;
      fs.writeFileSync(prog, progress.toString());
    })
    .saveToFile(dest, function(retcode, error) {
      fs.writeFileSync(prog, '100');

      // Remove .png frames to free up space
      var dir = resolvePath(request.params.id);
      fs.readdir(dir, function(err, files) {
        if (err) return;
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          if (file.slice(-4) !== '.png') continue;

          var filePath = resolvePath(request.params.id, file)
          fs.unlink(filePath);
        }
      });
    });

    response.end();
  });

  /**
   * Sends an estimate of the render progress.
   */
  appProxy.get('/capture/:id/render-progress', function(request, response) {
    var prog = resolvePath(request.params.id, 'progress');
    fs.readFile(prog, function(err, data) {
      var progress = 0;
      if (!err && data) progress = data;
      response.end(progress.toString());
    });
  });

  return function(req, res, next) {
    // Redirect to the router
    router.middleware(req, res, next);
  };
};

