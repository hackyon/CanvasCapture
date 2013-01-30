var express = require('express')
  , http = require('http')
  , path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.methodOverride());
  app.use(express.cookieParser('8jS/z3L/b8svoytzdOLzwqBCvsPsCF70kU8t2dwUieo='));
  app.use(express.static(path.join(__dirname, 'public')));

  /**
   * CanvasCapture is available as middleware so you can plug it right
   * into an existing server. The capture URLs can be namespaced by
   * specifying a prefix for the middleware (you will also have to specify
   * a prefix on the client-side too):
   *    app.use('/prefix', canvasCapture());
   *
   * The bodyParser middleware must be added before CanvasCapture.
   */
  app.use(express.bodyParser());

  var canvasCapture = require('./canvasCapture.server');
  app.use(canvasCapture());
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('CanvasCapture v0.1.0')
  console.log('Running on port ' + app.get('port'));
  console.log();
});
