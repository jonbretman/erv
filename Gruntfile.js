module.exports = function (grunt) {

    require('load-grunt-tasks')(grunt);

    grunt.initConfig({

        jshint: {
            src: [
                'src/**/*.js'
            ]
        },

        karma: {
            options: {
                reporters: ['mocha', 'coverage'],
                browsers: ['PhantomJS'],
                singleRun: true,
                autoWatch: false,
                preprocessors: {
                    'src/**/*.js': ['coverage']
                },
                coverageReporter: {
                    reporters: [
                        {
                            type: 'html',
                            dir: 'coverage-reports/html/'
                        }
                    ]
                }
            },
            web: {
                frameworks: ['mocha', 'expect', 'sinon'],
                files: [
                    {
                        pattern: 'src/erv.js',
                        included: true
                    },
                    {
                        pattern: 'test/**/*.js',
                        included: true
                    }
                ]
            }
        }

    });

    grunt.registerTask('test', ['karma']);
    grunt.registerTask('default', ['jshint', 'test']);

};
