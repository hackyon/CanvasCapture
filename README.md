[CanvasCapture](http://canvascapture.hackyon.com)  - Record Canvas Animations
=============================================================================

CanvasCapture records HTML5 canvas animations. Animation frames on the canvas are captured and sent to a Node.js backend and rendered into a video with [ffmpeg](http://ffmpeg.org/). 

The project is still in its infant stages. The current release is considered to be an alpha build. With the current build, it is highly discouraged to capture from anywhere other than localhost or on the local network. There are currently no optimizations for streaming the frames to the server, and so an extremely fast upload connection is necessary.

Suggestions and contributions are encouraged.


Running the Demo on localhost
--------------------------------------
The best way to try out CanvasCapture is to run the demo on localhost. Here are step-by-step instructions:

1. [Install Node.js and npm](https://github.com/joyent/node/wiki/Installation)
2. [Install ffmpeg](http://ffmpeg.org/download.html)
3. ```git clone https://github.com/badassdon/CanvasCapture.git```
4. ```cd CanvasCapture/demo```
5. ```npm install```
6. ```node app.js```
7. See it in action at [http://localhost:3000](http://localhost:3000)


How It Works
--------------------------------------

### Client-side JavaScript
The client-side JavaScript library makes it easy for you to capture canvas animations. 

```javascript

var canvas = document.getElementById("canvas");
var canvasCapture = new CanvasCapture(canvas);

// Starts the capture
canvasCapture.start();

// Stops the capture
canvasCapture.stop()

// Renders the capture. No more recording can be added at this point.
canvasCapture.render()

// Listen for duration changes
canvasCapture.addDurationListener(function(duration) {
});

// Listen for rendering progress changes
canvasCapture.addRenderProgressListener(function(progress) {
});

```


### Server-side Node.js and Express.js
The server runs on Node.js using the Express.js framework. CanvasCapture is available as middleware under the Express.js framework. This means you can plug it right into an existing Express.js server.

The capture URLs can be namedspaced by specifying a prefix for the middleware (you will also have to specify a prefix on the client-side, too): ```app.use('/prefix', canvasCapture());```. The bodyParser middleware must be added before CanvasCapture.

The server saves the frames under the ```captures/[captureId]/``` directory (which will be created if it does not already exist). When the frames are rendered, the rendered video is saved as ```canvas.mp4``` in the same directory as the frames. Captures are deleted after the ```CLEAN_THRESHOLD``` has elapsed.


Build
--------------------------------------
The project is built with [Grunt](http://gruntjs.com/). Luckily, Grunt is available as a npm module, and so building is a breeze. Here are step-by-step instructions:

1. [Install Node.js and npm](https://github.com/joyent/node/wiki/Installation) if necessary
2. Go to the project directory (containing grunt.js)
3. ```npm install``` - this fetches the npm modules for the grunt build, but not the demo
4. ```grunt```

When you run grunt, the source code under src/ will be linted, minified, and copied to both dist/ and demo/. 

If you want to change the code, you can run ```grunt watch``` so that changes will be copied immedidately from src/ to dist/ and demo/. If you are working with server-side code, you may also need to restart the server (or use something like [nodemon](https://github.com/remy/nodemon)). 


Contributions
--------------------------------------
Contributions are welcomed. There are no guidelines for contributions at this moment, but some guidelines may be set up in the future. If you want to contribute and need help understanding the code, don't hesitate to contact me.


License
--------------------------------------
The source is freely available under the terms of the MIT License. 

Feel free to download, modify, and use for personal or commercial projects. I would appreciate a pingback if you find the project useful, but it's certainly not required. 


Credits
--------------------------------------

Created by [Donald Lau](http://www.badassdon.com).


Developer's Note
--------------------------------------
With the recent advancements in JavaScript efficiency and HTML5 support on modern browsers, I find it much easier to create animations and effects using HTML5 canvas than with other conventional programming languages (such as Java or C++). There are 2 major reasons for this: 

1. the entire setup, build, and publish (demo) process for JavaScript is as simple as it gets. Additionally, modern web browsers are readily available on any machine, and 
2. the flexiblity of JavaScript makes developing smaller animations, prototypes, or projects a breeze. 

As HTML5 and canvas animations become more mainstream, I hope more and more developers can find use in CanvasCapture.

