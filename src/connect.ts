const searchParams = new URLSearchParams({
  TrustedClientToken: "6A5AA1D4EAFF4E9FB37E23D68491D6F4",
});

const url = new URL(
  "/consumer/speech/synthesize/readaloud/edge/v1",
  "wss://speech.platform.bing.com"
);

url.search = searchParams.toString();

/**
 *
 * Used to construct the WebSocket connection to MS Edge TTS Service
 *
 * @param outputFormat Please refer to {@linkcode GenerateOptions.outputFormat}
 * @returns The websocket connection instance
 */
export function connect(outputFormat: string) {
  const ws = new WebSocket(url.toString());

  const initialMessage = `
  Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n

  {
    "context": {
      "synthesis": {
        "audio": {
          "metadataoptions": {
            "sentenceBoundaryEnabled": "false",
            "wordBoundaryEnabled": "true"
          },
          "outputFormat": "${outputFormat}"
        }
      }
    }
  }
`;

  const { promise, resolve } = Promise.withResolvers<WebSocket>();

  ws.addEventListener("open", () => {
    ws.send(initialMessage);
    resolve(ws);
  });

  return promise;
}
