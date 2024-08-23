import { connect } from "./connect.ts";
import type { AudioMetadata, ParseSubtitleOptions } from "./subtitle.ts";
import { parseSubtitle } from "./subtitle.ts";

type GenerateOptions = {
  text: string;
  voice?: string;
  language?: string;

  outputFormat?: string;
  rate?: string;
  pitch?: string;
  volume?: string;

  subtitle?: Omit<ParseSubtitleOptions, "metadata">;
};

type GenerateResult = {
  audio: Blob;
  subtitle: ReturnType<typeof parseSubtitle>;
};

export async function generate(
  options: GenerateOptions
): Promise<GenerateResult> {
  const voice = options.voice ?? "en-US-AvaNeural";
  const language = options.language ?? "en-US";

  const outputFormat =
    options.outputFormat ?? "audio-24khz-96kbitrate-mono-mp3";
  const rate = options.rate ?? "default";
  const pitch = options.pitch ?? "default";
  const volume = options.volume ?? "default";

  const subtitle: Omit<ParseSubtitleOptions, "metadata"> = {
    splitBy: "sentence",
    count: 1,
    ...options.subtitle,
  };

  const socket = await connect(outputFormat);

  const requestId = globalThis.crypto.randomUUID();

  const requestString = `
  X-RequestId:${requestId}\r\n
  Content-Type:application/ssml+xml\r\n
  Path:ssml\r\n\r\n

  <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${language}">
    <voice name="${voice}">
      <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
        ${options.text}
      </prosody>
    </voice>
  </speak>
  `;

  const audioChunks: Array<Uint8Array> = [];
  const subtitleChunks: Array<AudioMetadata> = [];

  const { promise, resolve, reject } = Promise.withResolvers<GenerateResult>();

  socket.send(requestString);

  socket.addEventListener("error", reject);

  socket.addEventListener(
    "message",
    async (message: MessageEvent<string | Blob>) => {
      if (message.data instanceof Blob) {
        const separator = "Path:audio\r\n";

        const bytes = new Uint8Array(await message.data.arrayBuffer());
        const binaryString = new TextDecoder().decode(bytes);

        const index = binaryString.indexOf(separator) + separator.length;
        const audioData = bytes.subarray(index);

        return audioChunks.push(audioData);
      }

      if (message.data.includes("Path:audio.metadata")) {
        const jsonString = message.data.split("Path:audio.metadata")[1].trim();
        const json = JSON.parse(jsonString) as AudioMetadata;

        return subtitleChunks.push(json);
      }

      if (message.data.includes("Path:turn.end"))
        return resolve({
          audio: new Blob(audioChunks),
          subtitle: parseSubtitle({ metadata: subtitleChunks, ...subtitle }),
        });
    }
  );

  return promise;
}
