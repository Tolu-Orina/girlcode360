import type { APIGatewayProxyEvent } from "aws-lambda";
import { json, schedulerKind } from "../http";
import { runWalletPurge } from "../store/wallet";
import { runDeletionPurge } from "../store/privacy";
import { dispatch } from "./dispatch";

export const handler = async (event: APIGatewayProxyEvent) => {
  const kind = schedulerKind(event);
  if (kind === "purge") {
    return json(200, {
      purged: await runDeletionPurge(),
      wallet: await runWalletPurge(),
    });
  }
  if (kind) return json(400, { error: "unknown_schedule" });
  return dispatch(event, (path) => path === "/v1/privacy/purge-tick");
};
