var fs     = require('fs')
  , path   = require('path')
  , async  = require('async')
  , crypto = require('crypto')
  , rimraf = require('rimraf')
  , ffmpeg = require('fluent-ffmpeg')
  , redis  = require('redis');

var BASE_DIR = '';

var CLEAN = true;
var CLEAN_THRESHOLD = 15 * 60 * 1000;

var resolvePath = function(captureId, filename) {
  return path.join(BASE_DIR, 'captures', captureId, filename);
};

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

var clean = function() {
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

var session = redis.createClient();

var CanvasCapture = function() {
  // Bootstrap cleaning if enabled
  if (CLEAN) clean();

  // It might just be easier to have a flag and add the stuff in
  // The "proper" way would be to grab the pathspec matching regex,
  // and run it for the matches, grab the params from the match, and run
  // it by the function

  // define app as a appProxy so it shows the same interface, kinda
  // note request.url is stripped

  return function(req, res, next) {
    var app = req.app;

    /**
     * Generates and sends back a new captureId.
     */
    app.get('/capture', function(request, response) {
      crypto.randomBytes(24, function(ex, buf) {
        var token = buf.toString('hex');
        response.end(token);
      });
    });

    /**
     * Receives a frame from the capture.
     */
    app.post('/capture/:id/frame/:n', function(request, response) {
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
    app.get('/capture/:id/canvas.mp4', function(request, response) {
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
    app.post('/capture/:id/render', function(request, response) {
      var source = resolvePath(request.params.id, '%d.png');
      var dest   = resolvePath(request.params.id, 'canvas.mp4');

      var sessionKey = 'render-progress-' + request.params.id;

      var fps = request.body.fps || 60;

      var proc = new ffmpeg({ source: source, timeout: 30, priority: 0 })
      .withFpsInput(fps)
      .onProgress(function(report) {
        var progress = report.percent;
        session.set(sessionKey, progress.toString());
      })
      .saveToFile(dest, function(retcode, error) {
        session.set(sessionKey, '100');
        session.expire(sessionKey, 15 * 60);

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
    app.get('/capture/:id/render-progress', function(request, response) {
      var sessionKey = 'render-progress-' + request.params.id;
      session.get(sessionKey, function(err, reply) {
        var progress = 0;
        if (reply) progress = reply;
        response.end(progress.toString());
      });
    });

    next();
  };
};

module.exports = CanvasCapture;
