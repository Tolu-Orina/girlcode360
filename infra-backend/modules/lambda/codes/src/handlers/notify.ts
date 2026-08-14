import type { APIGatewayProxyEvent } from "aws-lambda";
import { dispatch, under } from "./dispatch";

export const handler = (event: APIGatewayProxyEvent) =>
  dispatch(
    event,
    (path) =>
      (under(path, "/v1/notifications") &&
        path !== "/v1/notifications/tick") ||
      under(path, "/v1/in-app"),
  );
