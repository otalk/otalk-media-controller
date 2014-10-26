# otalk-media-controller

A module for tracking all media streams in an app, both local and remote.

## Properties

- `capturingAudio` - `{Boolean}`
- `capturingVideo` - `{Boolean}`
- `capturingScreen` - `{Boolean}`
- `micAvailable` - `{Boolean}`
- `cameraAvailable` - `{Boolean}`
- `screenSharingAvailable` - `{Boolean}`
- `localStreams` - `{Collection}`
- `localScreens` - `{Collection}`
- `remoteStreams` - `{Collection}`
- `claimedRemoteStreams` - `{Collection}`
- `audioSources` - `{Collection}`
- `videoSources` - `{Collection}`
- `streams` - `{Collection}`
- `sources` - `{Collection}`
- `preferredMic` - `{String}`
- `preferredCamera` - `{String}`
- `preview` - `{Stream}`
- `permissionBlocked` - `{Boolean}`
- `permissionGranted` - `{Boolean}`
- `permissionPending` - `{Boolean}`

## Methods

- `addLocalStream(stream, isScreen, owner)`
- `addRemoteStream(stream, owner)`
- `start(constraints, cb)`
- `startScreenShare(cb)`
- `startPreview(cb)`
- `stop(stream)`
- `stopScreenShare(stream)`
- `stopPreview()`
- `pauseAudio()`
- `pauseVideo()`
- `resumeAudio()`
- `resumeVideo()`
- `ensureLocalStreams(constraints, cb)`
