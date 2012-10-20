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

  /**
   * CanvasCapture is available as middleware so you can plug it right
   * into an existing server. The capture URLs can be namespaced by
   * specifying a prefix for the middleware:
   *    app.use('/prefix', canvasCapture());
   *
   * The bodyParser and sesssion middlewares must be added before 
   * CanvasCapture.
   */
  app.use(express.bodyParser());
  app.use(express.session());

  var canvasCapture = require('./lib/canvasCapture');
  app.use(canvasCapture());


  app.use(require('less-middleware')({ src: __dirname + '/public' }));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('CanvasCapture v0.1.0')
  console.log('Running on port ' + app.get('port'));
  console.log();
});
