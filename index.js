var getUserMedia = require('getusermedia');
var getScreenMedia = require('getscreenmedia');
var Stream = require('otalk-model-media');
var State = require('ampersand-state');
var Collection = require('ampersand-collection');
var SubCollection = require('ampersand-subcollection');


var StreamCollection = Collection.extend({
    model: Stream
});


module.exports = State.extend({
    initialize: function () {
        var self = this;

        this.localStreams = new SubCollection(this.streams, {
            filter: function (stream) {
                return !stream.ended && stream.isLocal && !stream.isScreen;
            }
        });

        this.localScreens = new SubCollection(this.streams, {
            filter: function (stream) {
                return !stream.ended && stream.isLocal && stream.isScreen;
            }
        });

        this.remoteStreams = new SubCollection(this.streams, {
            filter: function (stream) {
                return !stream.ended && stream.isRemote;
            }
        });

        this.localStreams.bind('add remove reset', function () {
            // FIXME: Timeout won't be needed after https://github.com/AmpersandJS/ampersand-subcollection/pull/13
            setTimeout(function () {
                var updates = {
                    capturingAudio: false,
                    capturingVideo: false
                };

                console.log(self.localStreams.length);

                self.localStreams.forEach(function (stream) {
                    console.log(stream.hasAudio, stream.isVideo);
                    if (stream.hasAudio) {
                        updates.capturingAudio = true;
                    }
                    if (stream.isVideo && !stream.isScreen) {
                        updates.capturingVideo = true;
                    }
                });

                self.set(updates);
            }, 1);
        });

        this.localScreens.bind('add remove reset', function () {
            // FIXME: Timeout won't be needed after https://github.com/AmpersandJS/ampersand-subcollection/pull/13
            setTimeout(function () {
                self.capturingScreen = !!self.localScreens.length;
            }, 1);
        });

        this.streams.bind('change:ended', function (stream) {
            if (stream.ended) {
                self.streams.remove(stream);
            }
        });
    },

    props: {
        config: ['object', true, function () {
            return {
                media: {
                    audio: true,
                    video: true
                },
                audioMonitoring: {
                    detectSpeaking: true,
                    adjustMic: false
                }
            };
        }],
        capturingAudio: 'boolean',
        capturingVideo: 'boolean',
        capturingScreen: 'boolean'
    },

    collections: {
        streams: StreamCollection
    },

    addLocalStream: function (stream, isScreen, owner) {
        this.streams.add({
            id: stream.id,
            origin: 'local',
            stream: stream,
            isScreen: isScreen,
            owner: owner,
            audioMonitoring: this.config.audioMonitoring
        });
    },

    addRemoteStream: function (stream, owner) {
        this.streams.add({
            id: stream.id,
            origin: 'remote',
            stream: stream,
            owner: owner
        });
    },

    start: function (constraints, cb) {
        var self = this;
        constraints = constraints || this.config.media || {
            audio: true,
            video: true
        };

        getUserMedia(constraints, function (err, stream) {
            if (!err) {
                self.addLocalStream(stream);
            }
            if (cb) {
                return cb(err, stream);
            }
        });
    },

    startScreenShare: function (cb) {
        var self = this;
        getScreenMedia(function (err, stream) {
            if (!err) {
                self.addLocalStream(stream, true);
            }
            if (cb) {
                return cb(err, stream);
            }
        });
    },

    stop: function (stream) {
        var self = this;

        if (stream) {
            stream = this.streams.get(stream.id);
            if (stream) {
                stream.stop();
            }
        } else {
            var streams = this.localStreams.models;
            this.localStreams.models = [];

            streams.forEach(function (stream) {
                stream.stop();
                self.streams.remove(stream);
            });

            this.localStreams.trigger('reset');

            this.stopScreenShare();
        }
    },

    stopScreenShare: function (stream) {
        var self = this;

        if (stream) {
            stream = this.streams.get(stream.id);
            if (stream) {
                stream.stop();
            }
        } else {
            var streams = this.localScreens.models;
            this.localScreens.models = [];

            streams.forEach(function (stream) {
                stream.stop();
                self.streams.remove(stream);
            });

            this.localScreens.trigger('reset');
        }
    },

    pauseAudio: function () {
        this.localStreams.forEach(function (stream) {
            stream.pauseAudio();
        });
    },

    pauseVideo: function () {
        this.localStreams.forEach(function (stream) {
            stream.pauseVideo();
        });
    },

    resumeAudio: function () {
        this.localStreams.forEach(function (stream) {
            stream.playAudio();
        });
    },

    resumeVideo: function () {
        this.localStreams.forEach(function (stream) {
            stream.playVideo();
        });
    },

    getStream: function (id) {
        return this.streams.get(id);
    }
});
