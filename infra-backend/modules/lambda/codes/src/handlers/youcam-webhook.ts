import type { APIGatewayProxyEvent } from "aws-lambda";
import { dispatch } from "./dispatch";

export const handler = (event: APIGatewayProxyEvent) =>
  dispatch(event, (path) => path === "/v1/webhooks/youcam");
