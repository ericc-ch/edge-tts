import { connect } from "./connect.ts";
import type { AudioMetadata, ParseSubtitleOptions } from "./subtitle.ts";
import { parseSubtitle } from "./subtitle.ts";

/**
 * Options that will be sent alongside the websocket request
 */
type GenerateOptions = {
  /** The text that will be generated as audio */
  text: string;

  /**
   * Voice persona used to read the message.
   * Please refer to [Language and voice support for the Speech service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
   *
   * Defaults to `"en-US-AvaNeural"`
   */
  voice?: string;

  /**
   * Language of the message.
   * Please refer to [Language and voice support for the Speech service](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
   *
   * Defaults to `"en-US"`
   */
  language?: string;

  /**
   * Format of the audio output.
   * Please refer to [SpeechSynthesisOutputFormat Enum](https://learn.microsoft.com/en-us/dotnet/api/microsoft.cognitiveservices.speech.speechsynthesisoutputformat?view=azure-dotnet)
   *
   * Defaults to `"audio-24khz-96kbitrate-mono-mp3"`
   */
  outputFormat?: string;

  /**
   * Indicates the speaking rate of the text.
   * Please refer to [Customize voice and sound with SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#adjust-prosody)
   *
   * Defaults to `"default"`
   */
  rate?: string;

  /**
   * Indicates the baseline pitch for the text.
   * Please refer to [Customize voice and sound with SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#adjust-prosody)
   *
   * Defaults to `"default"`
   */
  pitch?: string;

  /**
   * Indicates the volume level of the speaking voice.
   * Please refer to [Customize voice and sound with SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#adjust-prosody)
   *
   * Defaults to `"default"`
   */
  volume?: string;

  subtitle?: Omit<ParseSubtitleOptions, "metadata">;
};

type GenerateResult = {
  audio: Blob;
  subtitle: ReturnType<typeof parseSubtitle>;
};

/**
 * Asynchronously generates audio and subtitle data based on the provided options.
 *
 * @param options - The options for generating audio and subtitle data.
 * @return  A promise that resolves with the generated audio and subtitle data.
 */
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
      if (typeof message.data !== "string") {
        const blob = new Blob([message.data]);

        const separator = "Path:audio\r\n";

        const bytes = new Uint8Array(await blob.arrayBuffer());
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
