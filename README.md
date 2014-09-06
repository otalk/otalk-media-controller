# otalk-media-controller

A module for tracking all media streams in an app, both local and remote.

## Properties

- `capturingAudio` - `{Boolean}`
- `capturingVideo` - `{Boolean}`
- `capturingScreen` - `{Boolean}`
- `localStreams` - `{Collection}`
- `localScreens` - `{Collection}`
- `remoteStreams` - `{Collection}`
- `streams` - `{Collection}`

## Methods

- `addLocalStream(stream, isScreen, owner)`
- `addRemoteStream(stream, owner)`
- `start(constraints, cb)`
- `startScreenShare(cb)`
- `stop(stream)`
- `stopScreenShare(stream)`
- `pauseAudio()`
- `pauseVideo()`
- `resumeAudio()`
- `resumeVideo()`
