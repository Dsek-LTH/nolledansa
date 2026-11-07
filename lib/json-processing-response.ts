/** Keep proxies from treating a long-running upload as an idle connection.
 * Leading JSON whitespace preserves the existing response.json() contract.
 * Once headers are sent, processing failures are returned as { error } at HTTP 200.
 */
export function jsonProcessingResponse(
  process: () => Promise<unknown>,
  errorMessage: (error: unknown) => string,
  heartbeatMs = 10_000,
): Response {
  const encoder = new TextEncoder();
  let closed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("\n"));
      timer = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode("\n"));
      }, heartbeatMs);
      void (async () => {
        let result;
        try {
          result = await process();
        } catch (error) {
          result = { error: errorMessage(error) };
        } finally {
          clearInterval(timer);
        }
        if (!closed) {
          closed = true;
          controller.enqueue(encoder.encode(JSON.stringify(result)));
          controller.close();
        }
      })();
    },
    cancel() {
      closed = true;
      clearInterval(timer);
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  } });
}
