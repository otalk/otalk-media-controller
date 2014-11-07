# otalk-media-controller

A module for tracking all media streams in an app, both local and remote.

## Properties

- `useAudioWhenAvailable` - `{Boolean}`
- `useVideoWhenAvailable` - `{Boolean}`
- `detectSpeaking` - `{Boolean}`
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
- `permissionDismissed` - `{Boolean}`
- `defaultOptionalAudioConstraints` - `{Array}`
- `defaultOptionalVideoConstraints` - `{Array}`

## Methods

- `addLocalStream(stream, isScreen, owner)`
- `addRemoteStream(stream, owner)`
- `start(constraints, cb)`
- `startScreenShare(cb)`
- `startPreview(constraints, cb)`
- `stop(stream)`
- `stopScreenShare(stream)`
- `stopPreview()`
- `acceptPreview()`
- `pauseAudio()`
- `pauseVideo()`
- `resumeAudio()`
- `resumeVideo()`
- `ensureLocalStreams(constraints, cb)`
