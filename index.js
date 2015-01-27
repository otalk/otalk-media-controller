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

        this.localScreens = new SubCollection(this.localStreams, {
            where: {
                isScreen: true
            }
        });

        this.localVideoStreams = new SubCollection(this.localStreams, {
            where: {
                isVideo: true
            }
        });

        this.localAudioOnlyStreams = new SubCollection(this.localStreams, {
            where: {
                isAudio: true
            }
        });

        this.remoteStreams = new SubCollection(this.streams, {
            filter: function (stream) {
                return !stream.ended && stream.isRemote;
            },
            watched: ['ended']
        });

        this.remoteVideoStreams = new SubCollection(this.remoteStreams, {
            where: {
                isVideo: true
            }
        });

        this.remoteAudioOnlyStreams = new SubCollection(this.remoteStreams, {
            where: {
                isAudio: true
            }
        });

        this.claimedRemoteStreams = new SubCollection(this.remoteStreams, {
            where: {
                claimed: true
            }
        });

        this.claimedRemoteVideoStreams = new SubCollection(this.remoteVideoStreams, {
            where: {
                claimed: true
            }
        });

        this.claimedRemoteAudioOnlyStreams = new SubCollection(this.remoteAudioOnlyStreams, {
            where: {
                claimed: true
            }
        });

        this.audioSources = new SubCollection(this.sources, {
            filter: function (source) {
                return source.kind === 'audio' || source.kind === 'audioinput';
            }
        });

        this.videoSources = new SubCollection(this.sources, {
            filter: function (source) {
                return source.kind === 'video' || source.kind === 'videoinput';
            }
        });

        this.localStreams.bind('add remove reset', function () {
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
        });

        this.localScreens.bind('add remove reset', function () {
            self.capturingScreen = !!self.localScreens.length;
        });

        this.streams.bind('change:ended', function (stream) {
            if (stream.ended) {
                self.streams.remove(stream);
            }
        });

        this.audioSources.bind('add remove reset', function () {
            if (self.audioSources.length) {
                self.micAvailable = true;
            }
        });

        this.videoSources.bind('add remove reset', function () {
            if (self.videoSources.length) {
                self.cameraAvailable = true;
            }
        });

        this.unknownSources = true;
        this._collectSources();

        // Gather sources again once we have permission so we can see the
        // device labels.
        this.on('change:cameraPermissionGranted change:micPermissionGranted', this._collectSources.bind(this));

        this.screenSharingAvailable = webrtcsupport.screenSharing;
    },

    props: {
        useAudioWhenAvailable: ['boolean', true, true],
        useVideoWhenAvailable: ['boolean', true, true],
        defaultOptionalAudioConstraints: ['array', true],
        defaultOptionalVideoConstraints: ['array', true],
        detectSpeaking: ['boolean', true, true],
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
        cameraAccess: {
            type: 'string',
            values: ['granted', 'denied', 'pending', 'dismissed', '']
        },
        micAccess: {
            type: 'string',
            values: ['granted', 'denied', 'pending', 'dismissed', '']
        }
    },

    derived: {
        cameraPermissionGranted: {
            deps: ['cameraAccess'],
            fn: function () {
                return this.cameraAccess === 'granted';
            }
        },
        micPermissionGranted: {
            deps: ['micAccess'],
            fn: function () {
                return this.micAccess === 'granted';
            }
        },
        cameraPermissionDenied: {
            deps: ['cameraAccess'],
            fn: function () {
                return this.cameraAccess === 'denied';
            }
        },
        micPermissionDenied: {
            deps: ['micAccess'],
            fn: function () {
                return this.micAccess === 'denied';
            }
        },
        cameraPermissionPending: {
            deps: ['cameraAccess'],
            fn: function () {
                return (this.cameraAccess === 'pending') || this.cameraPermissionDismissed;
            }
        },
        micPermissionPending: {
            deps: ['micAccess'],
            fn: function () {
                return (this.micAccess === 'pending') || this.micPermissionDismissed;
            }
        },
        cameraPermissionDismissed: {
            deps: ['cameraAccess'],
            fn: function () {
                return this.cameraAccess === 'dismissed';
            }
        },
        micPermissionDismissed: {
            deps: ['micAccess'],
            fn: function () {
                return this.micAccess === 'dismissed';
            }
        },
    },

    collections: {
        streams: StreamCollection,
        sources: SourceCollection
    },

    addLocalStream: function (stream, isScreen, opts) {
        opts = opts || {};

        if (stream.isState) {
            stream.origin = 'local';
            stream.isScreen = isScreen;
            stream.session = opts.session;
            this.streams.add(stream);
        } else {
            this.streams.add({
                origin: 'local',
                stream: stream,
                isScreen: isScreen,
                session: opts.session,
                audioMonitoring: {
                    detectSpeaking: this.detectSpeaking
                }
            });
        }
    },

    addRemoteStream: function (stream, opts) {
        opts = opts || {};

        if (stream.isState) {
            stream.origin = 'remote';
            stream.session = opts.session;
            stream.peer = opts.peer;
        } else {
            this.streams.add({
                origin: 'remote',
                stream: stream,
                session: opts.session,
                peer: opts.peer
            });
        }
    },

    start: function (constraints, cb) {
        var self = this;

        cb = cb || function () {};

        this._startStream(constraints, function (err, stream) {
            if (!err) {
                self.addLocalStream(stream);
            }

            cb(err, stream);
        });
    },

    startScreenShare: function (cb) {
        var self = this;

        cb = cb || function () {};

        getScreenMedia(function (err, stream) {
            if (!err) {
                self.addLocalStream(stream, true);
            }

            cb(err, stream);
        });
    },

    startPreview: function (constraints, cb) {
        var self = this;

        cb = cb || function () {};

        this.stopPreview();

        this._startStream(constraints, function (err, stream) {
            if (err) {
                return cb(err);
            }

            self.preview = new Stream({
                origin: 'local',
                stream: stream,
                isScreen: false,
                audioMonitoring: {
                    detectSpeaking: self.detectSpeaking
                }
            });

            cb(null, stream);
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

    acceptPreview: function () {
        if (this.preview) {
            this.addLocalStream(this.preview);
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

    findStream: function (mediaStream) {
        var matches = this.streams.filter(function (stream) {
            return stream.stream === mediaStream;
        });
        return matches[0];
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
            constraints = {
                audio: this.useAudioWhenAvailable && this.micAvailable,
                video: this.useVideoWhenAvailable && this.cameraAvailable
            };
        }

        if (constraints.audio === true && webrtcsupport.prefix === 'webkit') {
            constraints.audio = {
                optional: JSON.parse(JSON.stringify(this.defaultOptionalAudioConstraints))
            };

            if (this.preferredMic) {
                constraints.audio.optional.push({
                    sourceId: this.preferredMic
                });
            }
        }

        if (constraints.video === true && webrtcsupport.prefix === 'webkit') {
            constraints.video = {
                optional: JSON.parse(JSON.stringify(this.defaultOptionalVideoConstraints))
            };

            if (this.preferredCamera) {
                constraints.video.optional.push({
                    sourceId: this.preferredCamera
                });
            }
        }

        return constraints;
    },

    _startStream: function (constraints, cb) {
        var self = this;

        constraints = this._prepConstraints(constraints);

        var wantMicAccess = !!constraints.audio;
        var wantCameraAccess = !!constraints.video;

        if (wantMicAccess) {
            this.micAccess = 'pending';
        }
        if (wantCameraAccess) {
            this.cameraAccess = 'pending';
        }

        this._permissionCheck(constraints);

        getUserMedia(constraints, function (err, stream) {
            clearTimeout(self.permissionTimeout);

            if (err) {
                return self._handleError(err, constraints, cb);
            }

            if (stream.getAudioTracks().length > 0) {
                self.micAvailable = true;
                self.micAccess = 'granted';
            } else if (wantMicAccess) {
                if (self.audioSources.length) {
                    self.micAccess = 'denied';
                } else {
                    self.micAccess = '';
                }
            }
            if (stream.getVideoTracks().length > 0) {
                self.cameraAvailable = true;
                self.cameraAccess = 'granted';
            } else if (wantCameraAccess) {
                if (self.videoSources.length) {
                    self.cameraAccess = 'denied';
                } else {
                    self.cameraAccess = '';
                }
            }

            cb(err, stream);
        });
    },

    _permissionCheck: function (constraints) {
        var self = this;
        if (this.permissionTimeout) {
            return;
        }

        var wantMicAccess = !!constraints.audio;
        var wantCameraAccess = !!constraints.video;

        this.permissionTimeout = setTimeout(function () {
            if (wantMicAccess && !self.micPermissionGranted && !self.micPermissionDenied) {
                self.micAccess = 'pending';
            }
            if (wantCameraAccess && !self.cameraPermissionGranted && !self.cameraPermissionDenied) {
                self.cameraAccess = 'pending';
            }
            self.permissionTimeout = undefined;
        }, 100);
    },

    _handleError: function (err, constraints, cb) {
        var wantMicAccess = !!constraints.audio;
        var wantCameraAccess = !!constraints.video;

        switch (err.name) {
            case 'PermissionDeniedError':
                if (wantCameraAccess) {
                    this.cameraAccess = 'denied';
                }
                if (wantMicAccess) {
                    this.micAccess = 'denied';
                }
                break;
            case 'PermissionDismissedError':
                if (wantCameraAccess) {
                    this.cameraAccess = 'dismissed';
                }
                if (wantMicAccess) {
                    this.micAccess = 'dismissed';
                }
                break;
            case 'DevicesNotFoundError':
                if (wantCameraAccess) {
                    this.cameraAvailable = false;
                    this.cameraAccess = 'denied';
                }
                if (wantMicAccess) {
                    this.micAvailable = false;
                    this.micAccess = 'denied';
                }
                break;
            case 'ConstraintNotSatisfiedError':
                if (wantCameraAccess) {
                    this.cameraAccess = '';
                }
                if (wantMicAccess) {
                    this.micAccess = '';
                }
                break;
            case 'NotSupportedError':
                this.unknownSources = false;
                this.cameraAvailable = false;
                this.micAvailable = false;
                this.cameraAccess = '';
                this.micAccess = '';
                break;
        }
        return cb(err);
    },

    _collectSources: function () {
        var self = this;

        // Check what kinds of input devices, if any, we have
        // FIXME: This device detection process will be changing in M38 to
        //        use enumerateDevices() instead (along with a new event).
        var cb = function (sources) {
            self.sources.reset(sources);

            // Because subcollections don't proxy the 'reset' event
            self.videoSources.trigger('reset');
            self.audioSources.trigger('reset');
        };
        if (window.MediaStreamTrack && window.MediaStreamTrack.getSources) {
            self.unknownSources = !self.cameraPermissionGranted && !self.micPermissionGranted;
            window.MediaStreamTrack.getSources(cb);
        } else {
            // fake things
            self.unknownSources = true;
            window.setTimeout(cb, 0,
                [
                    { label: '', facing: '', kind: 'audio', id: 'defaultMicrophone' },
                    { label: '', facing: '', kind: 'video', id: 'defaultCamera' },
                ]
            );
        }
    }
});
