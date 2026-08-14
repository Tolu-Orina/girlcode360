/**
 * Node.js Lambda runtime global for InvokeWithResponseStream.
 * Not an npm import — provided by the Lambda execution environment.
 */
declare const awslambda: {
  streamifyResponse: (
    handler: (
      event: import("aws-lambda").APIGatewayProxyEvent,
      responseStream: NodeJS.WritableStream,
      context: import("aws-lambda").Context,
    ) => Promise<void>,
  ) => (
    event: import("aws-lambda").APIGatewayProxyEvent,
    context: import("aws-lambda").Context,
  ) => Promise<void>;
  HttpResponseStream: {
    from: (
      stream: NodeJS.WritableStream,
      metadata: {
        statusCode: number;
        headers?: Record<string, string>;
      },
    ) => NodeJS.WritableStream;
  };
};
