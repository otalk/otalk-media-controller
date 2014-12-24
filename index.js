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
        this.on('change:permissionGranted', this._collectSources.bind(this));

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
        deviceAccess: {
            type: 'string',
            values: ['granted', 'blocked', 'pending', 'dismissed', '']
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
                return this.deviceAccess === 'pending' || this.deviceAccess === 'dismissed';
            }
        },
        permissionDismissed: {
            deps: ['deviceAccess'],
            fn: function () {
                return this.deviceAccess === 'dismissed';
            }
        }
    },

    collections: {
        streams: StreamCollection,
        sources: SourceCollection
    },

    addLocalStream: function (stream, isScreen, owner) {
        owner = owner || {};
        if (stream.isState) {
            stream.origin = 'local';
            stream.isScreen = isScreen;
            stream.owner = owner;
            this.streams.add(stream);
        } else {
            this.streams.add({
                id: stream.id,
                origin: 'local',
                stream: stream,
                isScreen: isScreen,
                session: owner.session,
                peer: owner.peer,
                audioMonitoring: {
                    detectSpeaking: this.detectSpeaking
                }
            });
        }
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

        this._startStream(constraints, function (err, stream) {
            if (err) {
                return self._handleError(err, cb);
            }

            self.addLocalStream(stream);
            cb();
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

        cb = cb || function () {};

        this.stopPreview();

        this._startStream(constraints, function (err, stream) {
            if (err) {
                return self._handleError(err, cb);
            }

            self.preview = new Stream({
                id: stream.id,
                origin: 'local',
                stream: stream,
                isScreen: false,
                audioMonitoring: {
                    detectSpeaking: self.detectSpeaking
                }
            });

            cb();
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

        this._permissionCheck();

        getUserMedia(constraints, function (err, stream) {
            clearTimeout(self.permissionTimeout);

            if (err) {
                return self._handleError(err, cb);
            }

            if (stream.getAudioTracks().length > 0) {
                self.micAvailable = true;
            }
            if (stream.getVideoTracks().length > 0) {
                self.cameraAvailable = true;
            }

            self.deviceAccess = 'granted';

            cb(err, stream);
        });
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
            self.permissionTimeout = undefined;
        }, 100);
    },

    _handleError: function (err, cb) {
        switch (err.name) {
            case 'PermissionDeniedError':
                this.deviceAccess = 'blocked';
                break;
            case 'PermissionDismissedError':
                this.deviceAccess = 'dismissed';
                break;
            case 'DevicesNotFoundError':
                this.deviceAccess = '';
                this.cameraAvailable = false;
                this.micAvailable = false;
                break;
            case 'ConstraintNotSatisfiedError':
                this.deviceAccess = 'granted';
                break;
            case 'NotSupportedError':
                this.unknownSources = false;
                this.cameraAvailable = false;
                this.micAvailable = false;
                this.deviceAccess = '';
                break;
        }
        return cb(err);
    },

    _collectSources: function () {
        var self = this;

        // Check what kinds of input devices, if any, we have
        // FIXME: This device detection process will be changing in M38 to
        //        use enumerateDevices() instead (along with a new event).
        if (window.MediaStreamTrack && window.MediaStreamTrack.getSources) {
            self.unknownSources = !self.permissionGranted;
            window.MediaStreamTrack.getSources(function (sources) {
                self.sources.reset(sources);

                // Because subcollections don't proxy the 'reset' event
                self.videoSources.trigger('reset');
                self.audioSources.trigger('reset');
            });
        }
    }
});
