import { v4 as randomUUID } from "uuid"

import { createSocket } from "./lib/connection"
import { DEFAULT_OPTIONS } from "./lib/constants"
import { handleTTSConnection } from "./lib/socket-handler"
import { createSSMLString } from "./lib/ssml"
import { ParseSubtitleOptions } from "./types/subtitle"
import { SynthesizeOptions, SynthesizeResult } from "./types/synthesize"

/**
 * Asynchronously generates audio and subtitle data based on the provided options.
 *
 * @param options - The options for generating audio and subtitle data.
 * @return  A promise that resolves with the generated audio and subtitle data.
 */
export async function synthesize(
  options: SynthesizeOptions,
): Promise<SynthesizeResult> {
  const voice = options.voice ?? DEFAULT_OPTIONS.voice
  const language = options.language ?? DEFAULT_OPTIONS.language
  const outputFormat = options.outputFormat ?? DEFAULT_OPTIONS.outputFormat
  const rate = options.rate ?? DEFAULT_OPTIONS.rate
  const pitch = options.pitch ?? DEFAULT_OPTIONS.pitch
  const volume = options.volume ?? DEFAULT_OPTIONS.volume

  const subtitle: Omit<ParseSubtitleOptions, "metadata"> = {
    splitBy: options.subtitle?.splitBy ?? DEFAULT_OPTIONS.subtitle.splitBy,
    wordsPerCue:
      options.subtitle?.wordsPerCue ?? DEFAULT_OPTIONS.subtitle.wordsPerCue,
    durationPerCue:
      options.subtitle?.durationPerCue ??
      DEFAULT_OPTIONS.subtitle.durationPerCue,
  }

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

  const result = handleTTSConnection(socket, subtitle)

  socket.send(requestString)

  return result
}
