import type { APIGatewayProxyEvent } from "aws-lambda";
import { json, schedulerKind } from "../http";
import { runMonthlyHealthLensTick } from "../store/ai";
import { dispatch } from "./dispatch";

export const handler = async (event: APIGatewayProxyEvent) => {
  const kind = schedulerKind(event);
  if (kind === "healthlens_monthly") {
    return json(200, await runMonthlyHealthLensTick());
  }
  if (kind) return json(400, { error: "unknown_schedule" });
  return dispatch(event, (path) => path === "/v1/healthlens/monthly-tick");
};
