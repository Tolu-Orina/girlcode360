import type { APIGatewayProxyEvent } from "aws-lambda";
import { json, schedulerKind } from "../http";
import { runNotificationTick } from "../store/notify";
import { dispatch } from "./dispatch";

export const handler = async (event: APIGatewayProxyEvent) => {
  const kind = schedulerKind(event);
  if (kind === "notifications") {
    return json(200, await runNotificationTick());
  }
  if (kind) return json(400, { error: "unknown_schedule" });
  return dispatch(event, (path) => path === "/v1/notifications/tick");
};
