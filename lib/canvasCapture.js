var path  = require('path')
  , async = require('async')
  , fs = require('fs')
  , crypto = require('crypto')
  , rimraf = require('rimraf')
  , ffmpeg = require('fluent-ffmpeg');

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

var CanvasCapture = function() {
  // Bootstrap cleaning if enabled
  if (CLEAN) clean();

  return function(req, res, next) {
    var app = req.app;

    // TODO: fix this
    // Check path from request, and then run function

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

      var fps = request.body.fps || 60;

      var proc = new ffmpeg({ source: source, timeout: 30, priority: 0 })
      .withFpsInput(fps)
      .onProgress(function(progress) {
      })
      .saveToFile(dest, function(retcode, error) {
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
      var filePath = resolvePath(request.params.id, 'canvas.mp4');
      if (fs.existsSync(filePath)) {
        response.end('100');
      } else {
        response.end('50');
      }
    });

    next();
  };
};

module.exports = CanvasCapture;
