import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { connect } from "../src/connect.ts";

describe("connect function", () => {
  it("should create a new WebSocket connection with the correct URL", async () => {
    const url = new URL(
      "/consumer/speech/synthesize/readaloud/edge/v1",
      "wss://speech.platform.bing.com"
    );

    const searchParams = new URLSearchParams({
      TrustedClientToken: "6A5AA1D4EAFF4E9FB37E23D68491D6F4",
    });

    url.search = searchParams.toString();

    const outputFormat = "audio-16khz-128kbitrate-mono-mp3";
    const ws = await connect(outputFormat);
    expect(ws.url).toBe(url.toString());

    // Cleanup, need to await for the connection to close
    ws.close();
    const { promise, resolve } = Promise.withResolvers<void>();
    ws.addEventListener("close", () => resolve());

    await promise;
  });

  it("should throw an error if the output format is not provided", () => {
    expect(connect).toThrow();
  });
});
