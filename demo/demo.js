var View = require('ampersand-view');
var MediaView = require('otalk-media-stream-view');

window.MediaController = require('../index');

window.media = new window.MediaController();

var MainView = View.extend({
    template: '<body><button data-hook="start-audio">Start Audio</button><button data-hook="start-video">Start Video</button><button data-hook="start-both">Start Both</button><p data-hook="mic-available">Mic Available</p><p data-hook="camera-available">Camera Available</p><p data-hook="screenshare-available">Screen Sharing Available</p><p data-hook="capturing-audio">Capturing Audio</p><p data-hook="capturing-video">Capturing Video</p></body>',
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
        }
    },
    events: {
        'click [data-hook~="start-audio"]': 'startAudio',
        'click [data-hook~="start-video"]': 'startVideo',
        'click [data-hook~="start-both"]': 'startBoth',
    },
    render: function () {
        this.renderWithTemplate();
        this.renderCollection(this.model.streams, MediaView, this.el);
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
