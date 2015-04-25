var WebRTC = require('webrtcsupport');
var getUserMedia = require('getusermedia');
var getScreenMedia = require('getscreenmedia');

var State = require('ampersand-state');
var LodashMixin = require('ampersand-collection-lodash-mixin');
var Collection = require('ampersand-collection');
var FilteredCollection = require('ampersand-filtered-subcollection');
var SubCollection = FilteredCollection.extend(LodashMixin);

var Stream = require('otalk-model-media');
var DeviceManager = require('otalk-media-devices');



module.exports = State.extend({

    props: {
        defaultOptionalAudioConstraints: ['array', true],
        defaultOptionalVideoConstraints: ['array', true],

        capturingAudio: 'boolean',
        capturingVideo: 'boolean',
        capturingScreen: 'boolean',

        detectSpeaking: ['boolean', true, true],
        audioMonitoring: {
            type: 'object',
            required: true,
            default: function () {
                return {
                    threshold: -50,
                    interval: 100,
                    smoothing: 0.1
                };
            }
        },

        // Holding area for a local stream before adding it
        // to our collection. Allows for the creation of
        // "haircheck" preview UIs to let the user approve
        // of the stream before we start using it.
        preview: 'state',

        // The various categories of streams
        localStreams: 'collection',
        localScreens: 'collection',
        localVideoStreams: 'collection',
        localAudioOnlyStreams: 'collection',
        remoteStreams: 'collection',
        remoteVideoStreams: 'collection',
        remoteAudioOnlyStreams: 'collection',

        // For multi-party applications using remote streams,
        // we track "claimed" streams which are just streams
        // that have a peer assigned as an owner.
        claimedRemoteStreams: 'collection',
        claimedRemoteVideoStreams: 'collection',
        claimedRemoteAudioOnlyStreams: 'collection'
    },

    session: {
        _localAudioCount: 'number',
        _localVideoCount: 'number',
        _localScreenCount: 'number'
    },

    children: {
        devices: DeviceManager
    },

    collections: {
        streams: Collection.extend({ model: Stream })
    },

    initialize: function () {
        var self = this;

        this.initializeSubCollections();

        this.localVideoStreams.on('add remove reset', function () {

        });

        this.localStreams.bind('add remove reset', function () {
            var updates = {
                capturingAudio: false,
                capturingVideo: false,
                capturingScreeen: false
            };

            self.localStreams.forEach(function (stream) {
                if (stream.hasAudio) {
                    updates.capturingAudio = true;
                }
                if (stream.hasVideo && !stream.isScreen) {
                    updates.capturingVideo = true;
                }
                if (stream.isScreen && stream.hasVideo) {
                    updates.capturingScreen = true;
                }
            });

            self.set(updates);
        });

        this.localScreens.bind('add remove reset', function () {
            self.capturingScreen = !!self.localScreens.length;
        });

        this.streams.bind('change:isEnded', function (stream) {
            if (stream.isEnded) {
                process.nextTick(function () {
                    self.streams.remove(stream);
                });
            }
        });
    },

    initializeSubCollections: function () {
        this.localStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isLocal: true
            }
        });

        this.localScreens = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isLocal: true,
                isVideo: true,
                isScreen: true
            }
        });

        this.localVideoStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isLocal: true,
                isVideo: true,
                isScreen: false
            }
        });

        this.localAudioOnlyStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isLocal: true,
                isAudioOnly: true
            }
        });

        this.remoteStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isRemote: true
            }
        });

        this.remoteVideoStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isRemote: true,
                isVideo: true
            }
        });

        this.remoteAudioOnlyStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isRemote: true,
                isAudioOnly: true
            }
        });

        this.claimedRemoteStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isRemote: true,
                isClaimed: true
            }
        });

        this.claimedRemoteVideoStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isRemote: true,
                isVideo: true,
                isClaimed: true
            }
        });

        this.claimedRemoteAudioOnlyStreams = new SubCollection(this.streams, {
            where: {
                isEnded: false,
                isRemote: true,
                isAudioOnly: true,
                isClaimed: true
            }
        });
    },

    addLocalStream: function (stream, isScreen, opts) {
        opts = opts || {};

        if (stream.isState) {
            stream.origin = 'local';
            stream.isScreen = isScreen;
            stream.session = opts.session;
            return this.streams.add(stream);
        } else {
            return this.streams.add({
                origin: 'local',
                stream: stream,
                isScreen: isScreen,
                session: opts.session
            });
        }
    },

    addRemoteStream: function (stream, opts) {
        opts = opts || {};

        if (stream.isState) {
            stream.origin = 'remote';
            stream.session = opts.session;
            stream.peer = opts.peer;
            return this.streams.add(stream);
        } else {
            return this.streams.add({
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
            if (err) {
                return cb(err);
            }

            var localStream = self.addLocalStream(stream);
            if (self.detectSpeaking && localStream.hasAudio) {
                localStream.startVolumeMonitor(self.audioMonitoring);
            }

            cb(err, stream);
        });
    },

    startScreenShare: function (constraints, cb) {
        var self = this;

        if (arguments.length === 1) {
            cb = constraints;
            constraints = {};
        }
        cb = cb || function () {};

        constraints = this._prepConstraints(constraints);

        getScreenMedia(function (err, stream) {
            if (err) {
                return cb(err);
            }

            if (constraints.audio) {
                self._startStream({
                    audio: constraints.audio,
                    video: false
                }, function (err, audioStream) {
                    if (err) {
                        return cb(err);
                    }

                    stream.addTrack(audioStream.getAudioTracks()[0]);

                    var localStream = self.addLocalStream(stream, true);
                    if (self.detectSpeaking && localStream.hasAudio) {
                        localStream.startVolumeMonitor(self.audioMonitoring);
                    }

                    cb(null, stream);
                });
            } else {
                self.addLocalStream(stream, true);
                cb(err, stream);
            }
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
            });

            if (self.detectSpeaking && self.preview.hasAudio) {
                self.preview.startVolumeMonitor(self.audioMonitoring);
            }

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

    muteAudio: function () {
        this.localStreams.forEach(function (stream) {
            stream.muteAudio();
        });
    },

    muteVideo: function () {
        this.localStreams.forEach(function (stream) {
            stream.muteVideo();
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
                audio: this.useAudioWhenAvailable,
                video: this.useVideoWhenAvailable
            };
        }

        if (WebRTC.prefix !== 'webkit') {
            return constraints;
        }

        // Don't override if detailed constraints were explicitly given
        if (constraints.audio === true) {
            constraints.audio = {
                optional: JSON.parse(JSON.stringify(this.defaultOptionalAudioConstraints))
            };

            if (this.devices.preferredMicrophone) {
                constraints.audio.optional.push({
                    sourceId: this.devices.preferredMicrophone
                });
            }
        }

        // Don't override if detailed constraints were explicitly given
        if (constraints.video === true) {
            constraints.video = {
                optional: JSON.parse(JSON.stringify(this.defaultOptionalVideoConstraints))
            };

            if (this.devices.preferredCamera) {
                constraints.video.optional.push({
                    sourceId: this.devices.preferredCamera
                });
            }
        }

        return constraints;
    },

    _startStream: function (constraints, cb) {
        var self = this;

        constraints = this._prepConstraints(constraints);

        var transaction = {};

        if (!!constraints.audio) {
            transaction.wantMicrophoneAccess = true;
            transaction.microphoneAccess = self.devices.requestMicrophoneAccess();
        }

        if (!!constraints.video) {
            transaction.wantCameraAccess = true;
            transaction.cameraAccess = self.devices.requestCameraAccess();
        }

        getUserMedia(constraints, function (err, stream) {
            if (err) {
                return self._handleError(err, transaction, cb);
            }

            if (stream.getAudioTracks().length > 0) {
                transaction.microphoneAccess('granted');
            } else if (transaction.wantMicrophoneAccess) {
                transaction.microphoneAccess('error');
            }

            if (stream.getVideoTracks().length > 0) {
                transaction.cameraAccess('granted');
            } else if (transaction.wantCameraAccess) {
                transaction.cameraAccess('error');
            }

            cb(err, stream);
        });
    },

    _handleError: function (err, transaction, cb) {
        function handleError(response) {
            if (transaction.wantCameraAccess) {
                transaction.cameraAccess(response);
            }
            if (transaction.wantMicrophoneAccess) {
                transaction.microphoneAccess(response);
            }
        }

        switch (err.name) {
            case 'PermissionDeniedError':
                handleError('denied');
                break;
            case 'PermissionDismissedError':
                handleError('dismissed');
                break;
            case 'DevicesNotFoundError':
            case 'ConstraintNotSatisfiedError':
            case 'NotSupportedError':
            case 'NoMediaRequestedError':
                handleError('error');
                break;
        }

        return cb(err);
    }
});
