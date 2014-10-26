var webrtcsupport = require('webrtcsupport');
var getUserMedia = require('getusermedia');
var getScreenMedia = require('getscreenmedia');
var Stream = require('otalk-model-media');
var State = require('ampersand-state');
var Collection = require('ampersand-collection');
var SubCollection = require('ampersand-subcollection');


var Source = State.extend({
    props: {
        id: 'string',
        label: 'string',
        kind: 'string',
        facing: ''
    }
});

var StreamCollection = Collection.extend({
    model: Stream
});

var SourceCollection = Collection.extend({
    model: Source
});


module.exports = State.extend({
    initialize: function () {
        var self = this;

        this.localStreams = new SubCollection(this.streams, {
            filter: function (stream) {
                return !stream.ended && stream.isLocal;
            },
            watched: ['ended']
        });

        this.localScreens = new SubCollection(this.streams, {
            filter: function (stream) {
                return !stream.ended && stream.isLocal && stream.isScreen;
            },
            watched: ['ended']
        });

        this.remoteStreams = new SubCollection(this.streams, {
            filter: function (stream) {
                return !stream.ended && stream.isRemote;
            },
            watched: ['ended']
        });

        this.claimedRemoteStreams = new SubCollection(this.streams, {
            filter: function (stream) {
                return !stream.ended && stream.isRemote && stream.claimed;
            },
            watched: ['ended', 'claimed']
        });
            
        this.audioSources = new SubCollection(this.sources, {
            filter: function (source) {
                return source.kind === 'audio';
            }
        });

        this.videoSources = new SubCollection(this.sources, {
            filter: function (source) {
                return source.kind === 'video';
            }
        });

        this.localStreams.bind('add remove reset', function () {
            // FIXME: Timeout won't be needed after https://github.com/AmpersandJS/ampersand-subcollection/pull/13
            setTimeout(function () {
                var updates = {
                    capturingAudio: false,
                    capturingVideo: false
                };

                self.localStreams.forEach(function (stream) {
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

        this.audioSources.bind('add remove reset', function () {
            setTimeout(function () {
                if (self.audioSources.length) {
                    self.micAvailable = true;
                }
            }, 1);
        });

        this.videoSources.bind('add remove reset', function () {
            setTimeout(function () {
                if (self.videoSources.length) {
                    self.cameraAvailable = true;
                }
            }, 1);
        });


        this.unknownSources = true;
        this.on('change:permissionGranted', function () {
            if (!self.permissionGranted) {
                self.unknownSources = true;
            }

            // Check what kinds of input devices, if any, we have
            // FIXME: This device detection process will be changing in M38 to
            //        use enumerateDevices() instead (along with a new event).
            if (window.MediaStreamTrack.getSources) {
                self.unknownSources = false;
                window.MediaStreamTrack.getSources(function (sources) {
                    self.sources.set(sources);
                });
            }
        });

        this.screenSharingAvailable = webrtcsupport.screenSharing;
    },

    props: {
        config: ['object', true, function () {
            return {
                media: {
                    audio: true,
                    video: true
                },
                simulcast: true,
                audioMonitoring: {
                    detectSpeaking: true,
                    adjustMic: false
                }
            };
        }],
        preferredMic: 'string',
        preferredCamera: 'string',
        capturingAudio: 'boolean',
        capturingVideo: 'boolean',
        capturingScreen: 'boolean',
        micAvailable: 'boolean',
        cameraAvailable: 'boolean',
        screenSharingAvailable: 'boolean',
        unknownSources: ['boolean', true, false],
        preview: 'state',
        deviceAccess: {
            type: 'string',
            values: ['granted', 'blocked', 'pending', '']
        }
    },

    derived: {
        permissionGranted: {
            deps: ['deviceAccess'],
            fn: function () {
                return this.deviceAccess === 'granted';
            }
        },
        permissionBlocked: {
            deps: ['deviceAccess'],
            fn: function () {
                return this.deviceAccess === 'blocked';
            }
        },
        permissionPending: {
            deps: ['deviceAccess'],
            fn: function () {
                return this.deviceAccess === 'pending';
            }
        }
    },

    collections: {
        streams: StreamCollection,
        sources: SourceCollection
    },

    addLocalStream: function (stream, isScreen, owner) {
        owner = owner || {};
        this.streams.add({
            id: stream.id,
            origin: 'local',
            stream: stream,
            isScreen: isScreen,
            session: owner.session,
            peer: owner.peer,
            audioMonitoring: this.config.audioMonitoring
        });
    },

    addRemoteStream: function (stream, owner) {
        owner = owner || {};
        this.streams.add({
            id: stream.id,
            origin: 'remote',
            stream: stream,
            session: owner.session,
            peer: owner.peer
        });
    },

    start: function (constraints, cb) {
        var self = this;

        cb = cb || function () {};
        constraints = this._prepConstraints(constraints);

        this._permissionCheck();

        getUserMedia(constraints, function (err, stream) {
            clearTimeout(self.permissionTimeout);

            if (err) {
                self.deviceAccess = 'blocked';
                return cb(err);
            }

            var simulcastAvailable = false;
            if (webrtcsupport.prefix === 'webkit') {
                simulcastAvailable = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10) >= 37;
            }

            if (stream.getAudioTracks().length > 0) {
                self.micAvailable = true;
            }
            if (stream.getVideoTracks().length > 0) {
                self.cameraAvailable = true;
            }

            self.deviceAccess = 'granted';

            if (!!constraints.video && self.config.simulcast && simulcastAvailable) {
                constraints.audio = false;

                if (constraints.video === true) {
                    constraints.video = {
                        mandatory: {}
                    };
                } else if (!constraints.video.mandatory) {
                    constraints.video.mandatory = {};
                }

                constraints.video.mandatory.maxWidth = 160;
                constraints.video.mandatory.maxHeight = 120;
                constraints.video.mandatory.maxFrameRate = 12;

                getUserMedia(constraints, function (err, smallStream) {
                    if (!err) {
                        stream.addTrack(smallStream.getVideoTracks()[0]);
                    }
                    self.addLocalStream(stream);
                    return cb(null, stream);
                });
            } else {
                self.addLocalStream(stream);
                return cb(null, stream);
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

    startPreview: function (constraints, cb) {
        var self = this;

        this.stopPreview();

        cb = cb || function () {};
        constraints = this._prepConstraints(constraints);

        this._permissionCheck();

        getUserMedia(constraints, function (err, stream) {
            clearTimeout(self.permissionTimeout);

            if (err) {
                self.deviceAccess = 'blocked';
                return cb(err);
            }

            if (stream.getAudioTracks().length > 0) {
                self.micAvailable = true;
            }
            if (stream.getVideoTracks().length > 0) {
                self.cameraAvailable = true;
            }

            self.deviceAccess = 'granted';

            self.preview = new Stream({
                id: stream.id,
                origin: 'local',
                stream: stream,
                isScreen: false,
                audioMonitoring: self.config.audioMonitoring
            });

            return cb();
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
            this.stopPreview();
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

    stopPreview: function () {
        if (this.preview) {
            this.preview.stop();
            this.unset('preview');
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
    },

    ensureLocalStreams: function (constraints, cb) {
        var check = constraints || {};
        var existing = false;

        var wantAudio = !!check.audio;
        var wantVideo = !!check.video;

        for (var i = 0, len = this.localStreams.length; i < len; i++) {
            var stream = this.localStreams.at(i);
            if (!stream.isScreen && wantAudio === stream.hasAudio && wantVideo === stream.hasVideo) {
                existing = true;
                break;
            }
        }

        if (!existing) {
            this.start(constraints, cb);
        } else {
            process.nextTick(cb);
        }
    },

    _prepConstraints: function (constraints) {
        if (!constraints) {
            constraints = JSON.parse(JSON.stringify(this.config.media || {
                audio: true,
                video: true
            }));
        }

        if (constraints.audio === true && this.audioSources.get(this.preferredMic)) {
            constraints.audio = {
                optional: [
                    {sourceId: this.preferredMic}
                ]
            };
        }

        if (constraints.video === true && this.videoSources.get(this.preferredCamera)) {
            constraints.video = {
                optional: [
                    {sourceId: this.preferredCamera}
                ]
            };
        }

        return constraints;
    },

    _permissionCheck: function () {
        var self = this;
        if (this.permissionTimeout) {
            return;
        }

        this.permissionTimeout = setTimeout(function () {
            if (!self.permissionGranted  && !self.permissionBlocked) {
                self.deviceAccess = 'pending';
            }
        }, 100);
    }
});
