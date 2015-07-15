'use strict';
// This is a basic test file for use with testling.
// The test script language comes from tape.
/* jshint node: true */
var test = require('tape');
var MediaController = require('../index');

test('basic test', function (t) {
    var media = new MediaController();
    media.start({audio: true, video: true}, function (err, stream) {
        if (err) {
            t.fail('error: ' + err.toString());
        } else {
            t.pass('got stream');
            stream.getTracks();
            t.end();
        }
    });
});
