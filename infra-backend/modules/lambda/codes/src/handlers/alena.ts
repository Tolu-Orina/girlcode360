import type { APIGatewayProxyEvent } from "aws-lambda";
import { claims, json, parseBody, pathOf } from "../http";
import { dispatch, under } from "./dispatch";
import { pipeProxyResult, pipeSse, streamify } from "./lambda-stream";
import {
  ALENA_DISCLAIMER,
  prepareAlenaChat,
  streamAlenaReply,
} from "../store/ai";
import { getUser, latestConsentsByPurpose } from "../store/memory";
import { isWardrobeClimate } from "../../../../../../packages/domain/src/index";

function alenaActions(crisis: boolean) {
  return crisis
    ? [{ id: "emergency", label: "Use emergency numbers" }]
    : [{ id: "prep_card", label: "Generate appointment Prep Card" }];
}

async function handle(event: APIGatewayProxyEvent, responseStream: NodeJS.WritableStream) {
  const path = pathOf(event);
  const method = event.httpMethod;
  const alenaPath = path.startsWith("/v1/zara/")
    ? path.replace("/v1/zara/", "/v1/alena/")
    : path;

  if (method === "POST" && alenaPath === "/v1/alena/chat") {
    const user = claims(event);
    if (!user) {
      await pipeProxyResult(responseStream, json(401, { error: "unauthorized" }));
      return;
    }
    const profile = await getUser(user.sub);
    if (!profile) {
      await pipeProxyResult(responseStream, json(404, { error: "user_not_bootstrapped" }));
      return;
    }
    const body = parseBody<{
      message?: string;
      mode?: "context" | "anonymous";
      openedFrom?: string;
      moduleHint?: string;
      lat?: number;
      lng?: number;
      climate?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    }>(event);
    if (!body.message?.trim()) {
      await pipeProxyResult(responseStream, json(400, { error: "message_required" }));
      return;
    }
    const consents = await latestConsentsByPurpose(user.sub);
    const alena = consents.find(
      (c) => c.purpose === "ai_alena" || (c.purpose as string) === "ai_zara",
    );
    if (!alena?.granted) {
      await pipeProxyResult(responseStream, json(403, { error: "alena_consent_required" }));
      return;
    }
    const mode = body.mode === "anonymous" ? "anonymous" : "context";
    let turn: Awaited<ReturnType<typeof prepareAlenaChat>>;
    try {
      turn = await prepareAlenaChat(user.sub, body.message.trim(), mode, {
        openedFrom: body.openedFrom,
        moduleHint: body.moduleHint,
        history: Array.isArray(body.history) ? body.history : undefined,
        lat: typeof body.lat === "number" ? body.lat : undefined,
        lng: typeof body.lng === "number" ? body.lng : undefined,
        climate:
          typeof body.climate === "string" && isWardrobeClimate(body.climate)
            ? body.climate
            : undefined,
      });
    } catch (err) {
      console.error("prepareAlenaChat", err);
      await pipeProxyResult(
        responseStream,
        json(503, { error: "alena_unavailable" }),
      );
      return;
    }
    if (turn.kind === "error") {
      const status = turn.error === "quota_exceeded" ? 429 : 503;
      await pipeProxyResult(
        responseStream,
        json(status, { error: turn.error, quota: turn.quota }),
      );
      return;
    }
    await pipeSse(
      responseStream,
      (async function* () {
        if (turn.kind === "immediate") {
          yield {
            type: "done",
            reply: turn.reply,
            crisis: turn.crisis,
            stub: turn.stub,
            quota: turn.quota,
            disclaimer: ALENA_DISCLAIMER,
            actions: alenaActions(turn.crisis),
          };
          return;
        }
        let lastReply = "";
        for await (const chunk of streamAlenaReply(turn)) {
          if (chunk.delta) yield { type: "delta", text: chunk.delta };
          lastReply = chunk.reply;
          if (chunk.done) {
            yield {
              type: "done",
              reply: chunk.reply,
              crisis: false,
              stub: chunk.stub,
              quota: turn.quota,
              disclaimer: ALENA_DISCLAIMER,
              actions: alenaActions(false),
            };
          }
        }
        if (!lastReply) {
          yield {
            type: "done",
            reply: "",
            crisis: false,
            stub: true,
            quota: turn.quota,
            disclaimer: ALENA_DISCLAIMER,
            actions: alenaActions(false),
          };
        }
      })(),
    );
    return;
  }

  const result = await dispatch(
    event,
    (p) => under(p, "/v1/alena") || under(p, "/v1/zara"),
  );
  await pipeProxyResult(responseStream, result);
}

export const handler = streamify(handle);
