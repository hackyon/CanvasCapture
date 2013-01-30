/**
 * CanvasCapture v0.1.0 
 *
 * CanvasCapture is a library for recording HTML5 canvas animations as
 * videos. Frames are sampled from the canvas and sent to the server
 * for rendering with ffmpeg.
 *
 * Distributed under the terms of the MIT License.
 */
(function(scope) {
  /**
   * Detected if the browser supports the necessary HTML5 features to
   * record canvas animations. Exit immediately if there is no support
   * since there is no point in doing more work.
   */
  var canvas = document.createElement('canvas');
  if (!(canvas.getContext && canvas.getContext('2d'))) {
    return false; // No support for canvas
  }
  var data = canvas.toDataURL('image/png');
  if (data.indexOf('data:image/png') !== 0) {
    return false; // No support for toDataURL
  }


  /**
   * Simple helper for sending AJAX requests.
   */
  var send = function (method, url, data, headers, callback) {
    if (typeof data === 'object') { 
      // Serialize the data argument if it is an object
      var fields = [];
      for (var f in data) {
        fields.push(encodeURIComponent(f) + '=' + encodeURIComponent(data[f]));
      }
      data = fields.join('&');
    }

    var request = new XMLHttpRequest();
    request.open(method, url, true);
    if (typeof headers === 'object') {
      for (var h in headers) {
        request.setRequestHeader(h, headers[h]);
      }
    }
    request.send(data);

    // Register the callback if it is available
    if (callback) {
      request.onreadystatechange = function() {
        if(request.readyState === 4){
          //request.responseXML -- DOM
          //request.responseText
          callback(request);
        }
      };
    }
    return request;
  };
  
  var STATES = { 
    READY:     1,
    CAPTURING: 2,
    RENDERING: 3,
    DOWNLOAD:  4
  };


  /****************************************************************
   * Public methods
   ****************************************************************/

  /**
   * CanvasCapture maintains the state of capture.
   */
  var CanvasCapture = function(canvas, prefix) {
    this._canvas  = canvas;
    this._context = canvas.getContext("2d");

    this._prefix  = '';
    if (prefix) {
      if (prefix.slice(-1) !== '/') {
        prefix += '/';
      }
      this._prefix = prefix;
    }

    this._frameN    = 0;
    this._captureId = null;
    this._frameQueue = [];    // Queues up frames

    this._duration  = 0;      // Duration of capture
    this._previousTime = 0;   // Time of previous frame
    this._renderProgress = 0; // Last known progress of the rendering

    this._durationListeners = [];
    this._renderProgressListeners = [];

    this._state = STATES.READY;

    this._initWithServer();
  };

  /**
   * Starts capturing the canvas.
   */
  CanvasCapture.prototype.start = function() {
    if (this._state === STATES.READY) {
      this._state = STATES.CAPTURING;
      this._captureFrame();
      return true;
    }
    return (this._state === STATES.CAPTURING);
  };

  /**
   * Stops the capturing.
   */
  CanvasCapture.prototype.stop = function() {
    if (this._state === STATES.CAPTURING) {
      this._state = STATES.READY;
      this._previousTime = 0;
      return true;
    }
    return false;
  };

  /**
   * Renders the captured video. Ongoing captures are forcefully stopped.
   */
  CanvasCapture.prototype.render = function() {
    this.stop();
    if (this._state === STATES.RENDERING) {
      return true;
    } else if (this._state !== STATES.READY) {
      return false;
    }

    this._state = STATES.RENDERING;

    var data = {
      fps: this._frameN / (this._duration / 1000)
    };
    var url = this._prefix + 'capture/' + this._captureId + '/render';
    send("POST", url, data, { 'Content-Type': 'application/x-www-form-urlencoded' });

    var self = this;
    setTimeout(function() {
      self._updateRenderProgress();
    }, 500);
  };

  /**
   * Subscribe to changes in the duration (as frames are captured).
   */
  CanvasCapture.prototype.addDurationListener = function(listener) {
    this._durationListeners.push(listener);
  };

  /**
   * Subscribe to updates in the rendering progress.
   */
  CanvasCapture.prototype.addRenderProgressListener = function(listener) {
    this._renderProgressListeners.push(listener);
  };

  /**
   * Duration of the captured video.
   */
  CanvasCapture.prototype.getDuration = function() {
    return this._duration;
  };

  /**
   * Last known progress of the rendering. This number is periodically 
   * polled from the server and there may be some latency.
   */
  CanvasCapture.prototype.getRenderProgress = function() {
    return Math.min(this._renderProgress, 100);
  };

  /**
   * The download URL for the rendered video.
   */
  CanvasCapture.prototype.getDownloadURL = function() {
    return this._prefix + 'capture/' + this._captureId + '/canvas.mp4';
  };


  /****************************************************************
   * Private methods
   ****************************************************************/

  var requestAnimFrame = (function(){
    return window.requestAnimationFrame       || 
           window.webkitRequestAnimationFrame || 
           window.mozRequestAnimationFrame    || 
           window.oRequestAnimationFrame      || 
           window.msRequestAnimationFrame     || 
           function (callback) {
             window.setTimeout(callback, 1000 / 60); // Default to 60fps
           };
  })();

  /**
   * Initializes with the server by fetching a new captureId.
   */
  CanvasCapture.prototype._initWithServer = function() {
    var self = this;
    var url = this._prefix + "capture";
    send("GET", url, null, null, function(response) {
      self._captureId = response.responseText;
      for (var i = 0; i < self._frameQueue.length; i++) {
        var frameN = self._frameQueue[i].frameN;
        var data   = self._frameQueue[i].data;
        
        var url    = self._prefix + 'capture/' + self._captureId + '/frame/' + frameN;
        send("POST", url, data, { 'Content-Type': 'image/png' });
      }
    });
  };

  /**
   * Captures a frame of the canvas.
   */
  CanvasCapture.prototype._captureFrame = function() {
    if (this._state !== STATES.CAPTURING) {
      return;
    }
   
    // Setup the next frame capture
    var self = this;
    requestAnimFrame(function() { self._captureFrame(); });

    // Track how much time has passed
    var time = (new Date()).getTime();
    if (this._previousTime !== 0) {
      this._duration += time - this._previousTime;
    }
    this._previousTime = time;

    // Capture the canvas as a PNG
    var data = this._canvas.toDataURL("image/png");
    data = data.substring(22); // Extract the base64 data

    if (this._captureId) {
      // Send the frame if captureId has been received
      var url = this._prefix + 'capture/' + this._captureId + '/frame/' + this._frameN;
      send("POST", url, data, { 'Content-Type': 'image/png' });

    } else {
      // Queue up the frame if captureId has not been received
      this._frameQueue.push({
        frameN: this._frameN,
        data:   data
      });
    }

    this._frameN += 1;

    for (var i = 0; i < self._durationListeners.length; i++) {
      var listener = self._durationListeners[i];
      listener(self._duration);
    }
  };

  /**
   * Polls the server for the rendering progress every 0.5s.
   */
  CanvasCapture.prototype._updateRenderProgress = function() {
    if (this._state !== STATES.RENDERING) {
      return;
    }

    setTimeout(function() { self._updateRenderProgress(); }, 500);

    var self = this;
    var url  = this._prefix + 'capture/' + this._captureId + '/render-progress';
    send("GET", url, null, null, function(response) {
      self._renderProgress = parseInt(response.responseText, 10);
      if (self._renderProgress >= 100) {
        self._state = STATES.DOWNLOAD;
      }

      for (var i = 0; i < self._renderProgressListeners.length; i++) {
        var listener = self._renderProgressListeners[i];
        listener(self._renderProgress);
      }
    });
  };

  scope.CanvasCapture = CanvasCapture;
})(window);

