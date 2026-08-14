import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { CORS, json, pathOf } from "../http";
import { handler as routeHttp } from "./api";

export { under } from "../http";

export type PathAllow = (path: string) => boolean;

export async function dispatch(
  event: APIGatewayProxyEvent,
  allow: PathAllow,
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  const path = pathOf(event);
  if (!allow(path)) return json(404, { error: "not_found" });
  return routeHttp(event);
}
