# otalk-media-controller

A module for tracking all media streams in an app, both local and remote.

## Properties

- `useAudioWhenAvailable` - `{Boolean}`
- `useVideoWhenAvailable` - `{Boolean}`
- `detectSpeaking` - `{Boolean}`
- `capturingAudio` - `{Boolean}`
- `capturingVideo` - `{Boolean}`
- `capturingScreen` - `{Boolean}`
- `localStreams` - `{Collection}`
- `localScreens` - `{Collection}`
- `localVideoStreams` - `{Collection}`
- `localAudioOnlyStreams` - `{Collection}`
- `remoteStreams` - `{Collection}`
- `remoteVideoStreams` - `{Collection}`
- `remoteAudioOnlyStreams` - `{Collection}`
- `claimedRemoteStreams` - `{Collection}`
- `claimedRemoteVideoStreams` - `{Collection}`
- `claimedRemoteAudioOnlyStreams` - `{Collection}`
- `streams` - `{Collection}`
- `preview` - `{Stream}`
- `defaultOptionalAudioConstraints` - `{Array}`
- `defaultOptionalVideoConstraints` - `{Array}`

## Methods

- `addLocalStream(stream, isScreen, opts)`
- `addRemoteStream(stream, opts)`
- `start(constraints, cb)`
- `startScreenShare([constraints,] cb)`
- `startPreview(constraints, cb)`
- `stop(stream)`
- `stopScreenShare(stream)`
- `stopPreview()`
- `acceptPreview()`
- `muteAudio()`
- `muteVideo()`
- `playAudio()`
- `playVideo()`
- `ensureLocalStreams(constraints, cb)`
