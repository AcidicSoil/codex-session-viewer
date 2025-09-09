/**
 * Streaming line reader for Blob/File inputs using Web Streams.
 *
 * Pipeline:
 *   Blob.stream() -> TextDecoderStream() -> TransformStream(split on newlines)
 *
 * - Bounded memory: processes text incrementally without loading whole file.
 * - Preserves line order.
 * - Handles CRLF and trailing partial line at EOF.
 */
export function splitLinesTransform(): TransformStream<string, string> {
  let carry = "";
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      // Accumulate and split on newlines (handles \r\n and \n)
      const text = carry + chunk;
      const parts = text.split(/\n/);
      carry = parts.pop() ?? "";
      for (const line of parts) {
        // Normalize Windows CRLF by trimming trailing \r if present
        controller.enqueue(line.endsWith("\r") ? line.slice(0, -1) : line);
      }
    },
    flush(controller) {
      if (carry.length > 0) {
        // Emit final partial line if file does not end with newline
        controller.enqueue(carry.endsWith("\r") ? carry.slice(0, -1) : carry);
      }
    },
  });
}

/**
 * Async generator yielding text lines from a Blob/File.
 *
 * @param blob Blob or File to read
 * @param encoding Optional encoding label (default: 'utf-8')
 */
export async function* streamTextLines(
  blob: Blob,
  encoding: string = "utf-8",
): AsyncGenerator<string> {
  // Some environments may lack TextDecoderStream constructor; fallback via manual decoding
  const hasDecoderStream = typeof (globalThis as any).TextDecoderStream === "function";

  if (hasDecoderStream) {
    const decoded = blob
      .stream()
      // @ts-ignore: lib.dom.d.ts includes TextDecoderStream in TS >=4.8. Fallback guarded above.
      .pipeThrough(new TextDecoderStream(encoding))
      .pipeThrough(splitLinesTransform());

    // ReadableStream is async iterable per Streams spec
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const line of decoded as any as AsyncIterable<string>) {
      yield line;
    }
    return;
  }

  // Fallback: chunk manually and decode with TextDecoder
  const reader = (blob.stream() as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder(encoding);
  let carry = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const text = carry + chunk;
      const parts = text.split(/\n/);
      carry = parts.pop() ?? "";
      for (const line of parts) {
        yield line.endsWith("\r") ? line.slice(0, -1) : line;
      }
    }
    const last = decoder.decode();
    if (last) {
      const text = carry + last;
      const parts = text.split(/\n/);
      carry = parts.pop() ?? "";
      for (const line of parts) {
        yield line.endsWith("\r") ? line.slice(0, -1) : line;
      }
    }
    if (carry.length) {
      yield carry.endsWith("\r") ? carry.slice(0, -1) : carry;
    }
  } finally {
    reader.releaseLock();
  }
}
