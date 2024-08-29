# Edge TTS

edge-tts is a package that allows you to use Microsoft Edge's online text-to-speech service from within your JS code.
Zero dependencies and you can use it anywhere! (Browser or Node or Deno or Bun or any modern JS environment)
Heavily inspired by [rany2/edge-tts](https://github.com/rany2/edge-tts) and [SchneeHertz/node-edge-tts](https://github.com/SchneeHertz/node-edge-tts)

```typescript
// Web

const { audio, subtitle } = await generate({
  text: "Hello, world!",
  voice: "en-US-JennyNeural",
  language: "en-US",
});

// Create an audio element and play the generated audio
const audioElement = new Audio(URL.createObjectURL(audio));
audioElement.play();

// Access subtitle data
console.log(subtitle);
```

```typescript
// Node.js
const { audio, subtitle } = await generate({
  text: "Hello, world!",
  voice: "en-US-JennyNeural",
  language: "en-US",
});

// Save the audio Blob to a file
const fs = require("fs");
const buffer = Buffer.from(await audio.arrayBuffer());
fs.writeFileSync("output.mp3", buffer);

// Access subtitle data
console.log(subtitle);
```
