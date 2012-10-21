var fs = require('fs')
  , crypto = require('crypto')
  ,ffmpeg  = require('fluent-ffmpeg');

var CanvasCapture = function() {
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
      var dataURL = '';
      request.setEncoding('utf8');
      request.on('data', function(chunk) {
        dataURL += chunk;
      });
      request.on('end', function() {
        var buffer = new Buffer(dataURL, 'base64');

        var id = request.params.id;
        var frameN = request.params.n;

        if (!fs.existsSync('captures/')) {
          fs.mkdirSync('captures/', 0777);
        }
        if (!fs.existsSync('captures/' + id + '/')) {
          fs.mkdirSync('captures/' + id + '/');
        }
        fs.writeFile('captures/' + id + '/'  + frameN + '.png', buffer, 'binary', function(err) {
        });
        response.end();
      });
    });

    /**
     * Pipes the video for download.
     */
    app.get('/capture/:id/canvas.mp4', function(request, response) {
      response.writeHead(200, { 
        'Content-Type':'video/mp4' 
      });

      var filePath = 'captures/' + request.params.id + '/canvas.mp4';
      var fileStream = fs.createReadStream(filePath);
      fileStream.pipe(response);
    });

    /**
     * Triggers ffmpeg to render the captured frames into a video.
     */
    app.post('/capture/:id/render', function(request, response) {
      var fps = request.body.fps || 60;
      var proc = new ffmpeg({
        source: 'captures/' + request.params.id + '/%d.png',
        timeout: 30,
        priority: 0
      })
      .withFpsInput(fps)
      .onProgress(function(progress) {
      })
      .saveToFile('captures/' + request.params.id + '/canvas.mp4', function(retcode, error) {
      });

      response.end();
    });

    /**
     * Sends an estimate of the render progress.
     */
    app.get('/capture/:id/render-progress', function(request, response) {
      if (fs.existsSync('captures/' + request.params.id + '/canvas.mp4')) {
        response.end('100');
      } else {
        response.end('50');
      }
    });

    next();
  };
};

module.exports = CanvasCapture;
