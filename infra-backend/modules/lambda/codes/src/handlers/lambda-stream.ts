/// <reference path="../types/awslambda.d.ts" />
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { CORS, json } from "../http";

const STREAM_STARTED = Symbol("httpResponseStarted");

function wrapHttp(
  responseStream: NodeJS.WritableStream,
  statusCode: number,
  headers: Record<string, string>,
): NodeJS.WritableStream {
  const dest = awslambda.HttpResponseStream.from(responseStream, {
    statusCode,
    headers: {
      "Transfer-Encoding": "chunked",
      ...headers,
    },
  });
  (responseStream as NodeJS.WritableStream & { [STREAM_STARTED]?: boolean })[
    STREAM_STARTED
  ] = true;
  return dest;
}

function sseFrame(payload: unknown): Buffer {
  return Buffer.from(`data: ${JSON.stringify(payload)}\n\n`, "utf8");
}

/** JSON/error responses — pipeline so the runtime applies backpressure. */
export async function pipeProxyResult(
  responseStream: NodeJS.WritableStream,
  result: APIGatewayProxyResult,
): Promise<void> {
  const dest = wrapHttp(responseStream, result.statusCode, {
    ...CORS,
    ...(result.headers as Record<string, string> | undefined),
  });
  await pipeline(
    Readable.from([Buffer.from(result.body ?? "", "utf8")]),
    dest,
  );
}

/**
 * SSE chat — AWS documents `pipeline(Readable, HttpResponseStream)` so a slow
 * client pauses Bedrock chunk writes instead of buffering unbounded in Lambda.
 */
export async function pipeSse(
  responseStream: NodeJS.WritableStream,
  events: AsyncIterable<unknown>,
  statusCode = 200,
): Promise<void> {
  const dest = wrapHttp(responseStream, statusCode, {
    ...CORS,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  });
  async function* frames() {
    try {
      for await (const payload of events) {
        yield sseFrame(payload);
      }
    } catch (err) {
      console.error("sse frames", err);
      yield sseFrame({
        type: "done",
        reply: "Alena is unavailable right now. Try again in a moment.",
        crisis: false,
        stub: true,
      });
    }
  }
  await pipeline(Readable.from(frames()), dest);
}

export function streamify(
  fn: (
    event: APIGatewayProxyEvent,
    responseStream: NodeJS.WritableStream,
  ) => Promise<void>,
) {
  return awslambda.streamifyResponse(async (event, responseStream) => {
    try {
      await fn(event, responseStream);
    } catch (err) {
      console.error("stream handler", err);
      const started = (
        responseStream as NodeJS.WritableStream & { [STREAM_STARTED]?: boolean }
      )[STREAM_STARTED];
      if (started) return;
      try {
        await pipeProxyResult(
          responseStream,
          json(503, { error: "alena_unavailable" }),
        );
      } catch (e2) {
        console.error("stream handler failsafe", e2);
      }
    }
  });
}
