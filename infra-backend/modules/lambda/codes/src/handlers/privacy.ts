import type { APIGatewayProxyEvent } from "aws-lambda";
import { dispatch, under } from "./dispatch";

export const handler = (event: APIGatewayProxyEvent) =>
  dispatch(
    event,
    (path) => under(path, "/v1/privacy") && path !== "/v1/privacy/purge-tick",
  );
