import type { APIGatewayProxyEvent } from "aws-lambda";
import { dispatch, under } from "./dispatch";

export const handler = (event: APIGatewayProxyEvent) =>
  dispatch(
    event,
    (path) =>
      path === "/v1/health" ||
      under(path, "/v1/users") ||
      under(path, "/v1/consents"),
  );
