import type { APIGatewayProxyEvent } from "aws-lambda";
import { header, json, parseBody, pathOf } from "../http";
import { dispatch, under } from "./dispatch";
import { pipeProxyResult, pipeSse, streamify } from "./lambda-stream";
import {
  ALENA_DISCLAIMER,
  prepareGuestAlenaChat,
  streamGuestAlenaReply,
} from "../store/ai";
import { marketFromCountry } from "../lib/geo";
import type { Market } from "../types";

async function handle(event: APIGatewayProxyEvent, responseStream: NodeJS.WritableStream) {
  const path = pathOf(event);
  const method = event.httpMethod;

  if (method === "POST" && path === "/v1/guest/alena") {
    const body = parseBody<{ message?: string; market?: Market }>(event);
    if (!body.message?.trim()) {
      await pipeProxyResult(responseStream, json(400, { error: "message_required" }));
      return;
    }
    const msg = body.message.trim().slice(0, 500);
    const market: Market =
      body.market === "NG" || body.market === "GH" || body.market === "UK"
        ? body.market
        : marketFromCountry(
            header(event, "CloudFront-Viewer-Country") ??
              header(event, "cloudfront-viewer-country"),
          ) ?? "UK";
    const ip =
      header(event, "X-Forwarded-For")?.split(",")[0]?.trim() ||
      event.requestContext.identity?.sourceIp ||
      "unknown";
    const turn = await prepareGuestAlenaChat(msg, market, ip);
    await pipeSse(
      responseStream,
      (async function* () {
        if (turn.kind === "immediate") {
          yield {
            type: "done",
            reply: turn.reply,
            crisis: turn.crisis,
            stub: turn.stub,
            remaining: turn.remaining,
            disclaimer: ALENA_DISCLAIMER,
          };
          return;
        }
        for await (const chunk of streamGuestAlenaReply(turn)) {
          if (chunk.delta) yield { type: "delta", text: chunk.delta };
          if (chunk.done) {
            yield {
              type: "done",
              reply: chunk.reply,
              crisis: false,
              stub: chunk.stub,
              remaining: turn.remaining,
              disclaimer: ALENA_DISCLAIMER,
            };
          }
        }
      })(),
    );
    return;
  }

  const result = await dispatch(event, (p) => under(p, "/v1/guest/alena"));
  await pipeProxyResult(responseStream, result);
}

export const handler = streamify(handle);
