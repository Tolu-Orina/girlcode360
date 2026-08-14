/// <reference path="../types/awslambda.d.ts" />
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { CORS } from "../http";

function wrapHttp(
  responseStream: NodeJS.WritableStream,
  statusCode: number,
  headers: Record<string, string>,
): NodeJS.WritableStream {
  return awslambda.HttpResponseStream.from(responseStream, {
    statusCode,
    headers,
  });
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
    for await (const payload of events) {
      yield sseFrame(payload);
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
    await fn(event, responseStream);
  });
}
