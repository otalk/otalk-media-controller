var View = require('ampersand-view');

window.MediaController = require('./index');

window.media = new window.MediaController();

var MediaView = View.extend({
    template: '<div style="border: 1px solid black"><audio autoplay></audio><video autoplay muted></video></div>',
    bindings: {
        'model.videoURL': {
            type: 'attribute',
            name: 'src',
            selector: 'video'
        },
        'model.audioURL': {
            type: 'attribute',
            name: 'src',
            selector: 'audio'
        },
        'model.type': {
            type: 'class'
        }
    }
});


var MainView = View.extend({
    template: '<body><p data-hook="capturing-audio"></p><p data-hook="capturing-video"></p></body>',
    bindings: {
        'model.capturingVideo': {
            type: 'text',
            hook: 'capturing-video'
        },
        'model.capturingAudio': {
            type: 'text',
            hook: 'capturing-audio'
        }
    },
    render: function () {
        this.renderWithTemplate();
        this.renderCollection(this.model.streams, MediaView, this.el);
    }
});


window.view = new MainView({el: document.body, model: window.media});
window.view.render();
