var View = require('ampersand-view');
var MediaView = require('otalk-media-stream-view');
var gum = require('getusermedia');

window.MediaController = require('../index');

window.media = new window.MediaController();
window.gum = gum;

var MainView = View.extend({
    template: [
        '<body>',
        '<p data-hook="camera-permission-pending">Camera Permission Pending</p>',
        '<p data-hook="camera-permission-dismissed">Camera Permission Dismissed</p>',
        '<p data-hook="camera-permission-denied">Camera Permission Denied</p>',
        '<p data-hook="camera-permission-granted">Camera Permission Granted</p>',

        '<p data-hook="mic-permission-pending">Mic Permission Pending</p>',
        '<p data-hook="mic-permission-dismissed">Mic Permission Dismissed</p>',
        '<p data-hook="mic-permission-denied">Mic Permission Denied</p>',
        '<p data-hook="mic-permission-granted">Mic Permission Granted</p>',

        '<button data-hook="start-audio">Start Audio</button>',
        '<button data-hook="start-video">Start Video</button>',
        '<button data-hook="start-both">Start Both</button>',

        '<p data-hook="mic-available">Mic Available</p>',
        '<p data-hook="camera-available">Camera Available</p>',
        '<p data-hook="screenshare-available">Screensharing Available</p>',

        '<p data-hook="capturing-audio">Capturing Audio</p>',
        '<p data-hook="capturing-video">Capturing Video</p>',

        '<div data-hook="stream-container"></div>',
        
        '</body>'
    ].join(''),
    bindings: {
        'model.capturingVideo': {
            type: 'toggle',
            hook: 'capturing-video'
        },
        'model.capturingAudio': {
            type: 'toggle',
            hook: 'capturing-audio'
        },
        'model.micAvailable': {
            type: 'toggle',
            hook: 'mic-available'
        },
        'model.cameraAvailable': {
            type: 'toggle',
            hook: 'camera-available'
        },
        'model.screenSharingAvailable': {
            type: 'toggle',
            hook: 'screenshare-available'
        },
        'model.cameraPermissionGranted': {
            type: 'toggle',
            hook: 'camera-permission-granted'
        },
        'model.cameraPermissionDenied': {
            type: 'toggle',
            hook: 'camera-permission-denied'
        },
        'model.cameraPermissionPending': {
            type: 'toggle',
            hook: 'camera-permission-pending'
        },
        'model.cameraPermissionDismissed': {
            type: 'toggle',
            hook: 'camera-permission-dismissed'
        },
        'model.micPermissionGranted': {
            type: 'toggle',
            hook: 'mic-permission-granted'
        },
        'model.micPermissionDenied': {
            type: 'toggle',
            hook: 'mic-permission-denied'
        },
        'model.micPermissionPending': {
            type: 'toggle',
            hook: 'mic-permission-pending'
        },
        'model.micPermissionDismissed': {
            type: 'toggle',
            hook: 'mic-permission-dismissed'
        }
    },
    events: {
        'click [data-hook~="start-audio"]': 'startAudio',
        'click [data-hook~="start-video"]': 'startVideo',
        'click [data-hook~="start-both"]': 'startBoth',
    },
    render: function () {
        this.renderWithTemplate();
        this.renderCollection(this.model.streams, MediaView, this.queryByHook('stream-container'));
    },
    startAudio: function () {
        this.model.start({audio: true, video: false});
    },
    startVideo: function () {
        this.model.start({audio: false, video: true});
    },
    startBoth: function () {
        this.model.start({audio: true, video: true});
    }
});


window.view = new MainView({el: document.body, model: window.media});
window.view.render();
