const FACTOR = 10_000;

const convertToMs = (duration: number) => Math.floor(duration / FACTOR);

interface WordBoundary {
  Type: "WordBoundary";
  Data: {
    Offset: number;
    Duration: number;
    text: {
      Text: string;
      Length: number;
      BoundaryType: "WordBoundary";
    };
  };
}

export interface AudioMetadata {
  Metadata: [WordBoundary];
}

export type ParseSubtitleOptions = {
  splitBy: "sentence" | "word" | "duration";
  count: number;

  /**
   * Each request will have multiple metadata.
   * We will send multiple requests in parallel.
   */
  metadata: Array<AudioMetadata>;
};

export type ParseSubtitleResult = {
  text: string;
  start: number;
  end: number;
  duration: number;
};

export function parseSubtitle({
  splitBy,
  count,
  metadata,
}: ParseSubtitleOptions): Array<ParseSubtitleResult> {
  const simplified = metadata.map((meta) => ({
    text: meta.Metadata[0].Data.text.Text,
    offset: convertToMs(meta.Metadata[0].Data.Offset),
    duration: convertToMs(meta.Metadata[0].Data.Duration),
  }));

  if (splitBy === "duration") {
    return simplified.reduce<Array<ParseSubtitleResult>>(
      (prev, curr, index) => {
        if (
          (prev.at(-1)?.duration ?? 0) + curr.duration > count ||
          index === 0
        ) {
          prev.push({
            text: curr.text,
            start: curr.offset,
            duration: curr.duration,
            end: curr.offset + curr.duration,
          });
        } else {
          prev[prev.length - 1].end = curr.offset + curr.duration;
          prev[prev.length - 1].text += ` ${curr.text}`;
          prev[prev.length - 1].duration =
            prev[prev.length - 1].end - prev[prev.length - 1].start;
        }

        return prev;
      },
      []
    );
  }

  if (splitBy === "word") throw new Error("Not implemented");
  if (splitBy === "sentence") throw new Error("Not implemented");

  throw new Error("Invalid splitBy option");
}
