module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    meta: {
      version: '0.1.0',
    },
    lint: {
      files: ['src/server/*.js'],
      files: ['src/client/*.js']
    },
    min: {
      dist: {
        src: ['src/client/canvasCapture.client.js'],
        dest: 'dist/client/canvasCapture.client.min.js'
      }
    },
    copy: {
      client: {
        src: ['src/client/canvasCapture.client.js'],
        dest: 'dist/client/canvasCapture.client.js'
      },
      server: {
        src: ['src/server/*'],
        dest: 'dist/server/'
      },
      democlient: {
        src: ['dist/client/*'],
        dest: 'demo/public/javascripts/'
      },
      demoserver: {
        src: ['dist/server/*'],
        dest: 'demo/'
      }
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: false,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        browser: true,
        loopfunc: true
      }
    },
    uglify: {}
  });

  // Default task.
  grunt.registerTask('default', 'lint min copy');

  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-contrib-copy');
};
