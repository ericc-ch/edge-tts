import { v4 as randomUUID } from "uuid"

import { processAudioChunk, toBlobLike } from "./lib/audio-processor"
import { createSocket } from "./lib/connection"
import { DEFAULT_OPTIONS } from "./lib/constants"
import { createSSMLString } from "./lib/ssml"
import { SynthesizeOptions } from "./types/synthesize"

/**
 * Creates an async generator that yields chunks of synthesized audio data.
 * Each chunk is automatically processed to remove metadata headers.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const generator = synthesizeStream({ text: "Hello world" });
 * for await (const chunk of generator) {
 *   // chunk is a Uint8Array of raw audio data
 *   // Process or save the chunk as needed
 * }
 *
 * // Combining all chunks into one array
 * const chunks: Uint8Array[] = [];
 * for await (const chunk of synthesizeStream({ text: "Hello world" })) {
 *   chunks.push(chunk);
 * }
 * // Now chunks contains all the audio data
 * ```
 *
 * @param options - Configuration options for speech synthesis
 * @param options.text - The text to synthesize
 * @param [options.voice] - Voice persona to use (default: 'en-US-AvaNeural')
 * @param [options.language] - Language code (default: 'en-US')
 * @param [options.outputFormat] - Audio format (default: 'audio-24khz-48kbitrate-mono-mp3')
 * @param [options.rate] - Speaking rate (default: 1)
 * @param [options.pitch] - Voice pitch (default: 1)
 * @param [options.volume] - Audio volume (default: 1)
 * @returns An async generator yielding processed Uint8Array chunks of audio data
 */
export async function* synthesizeStream(
  options: SynthesizeOptions,
): AsyncGenerator<Uint8Array> {
  const voice = options.voice ?? DEFAULT_OPTIONS.voice
  const language = options.language ?? DEFAULT_OPTIONS.language
  const outputFormat = options.outputFormat ?? DEFAULT_OPTIONS.outputFormat
  const rate = options.rate ?? DEFAULT_OPTIONS.rate
  const pitch = options.pitch ?? DEFAULT_OPTIONS.pitch
  const volume = options.volume ?? DEFAULT_OPTIONS.volume

  const socket = await createSocket(outputFormat)
  const requestId = randomUUID()

  const requestString = createSSMLString({
    requestId,
    text: options.text,
    voice,
    language,
    rate,
    pitch,
    volume,
  })

  // This is a new feature
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  const { promise: done, resolve, reject } = Promise.withResolvers<void>()

  const queue: Array<Blob> = []
  let isDone = false
  let error: Error | null = null

  socket.addEventListener("error", (err) => {
    error = err instanceof Error ? err : new Error("WebSocket error")
    reject(error)
  })

  socket.addEventListener(
    "message",
    ({ data }: MessageEvent<string | Blob>) => {
      if (typeof data === "string") {
        if (data.includes("Path:turn.end")) {
          socket.close()
          isDone = true
          resolve()
        }
      } else {
        queue.push(toBlobLike(data))
      }
    },
  )

  socket.send(requestString)

  try {
    // TypeScript just don't wanna work with me
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (!isDone || queue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error, @typescript-eslint/no-unnecessary-condition
      if (error) throw error

      if (queue.length > 0) {
        // We checked for this above
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const chunk = queue.shift()!
        const processed = await processAudioChunk(chunk)
        yield processed
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    await done
  } finally {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close()
    }
  }
}
