# MOCK OPTIONS so CORS preflight never goes through Lambda response streaming.
# REST API CORS: https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html
# STREAM proxy must emit metadata+delimiter or API Gateway returns 500 with no CORS
# headers: https://docs.aws.amazon.com/apigateway/latest/developerguide/response-transfer-mode-lambda.html
# Gateway 4xx/5xx CORS: https://repost.aws/knowledge-center/api-gateway-cors-errors

variable "rest_api_id" {
  type = string
}

variable "resource_id" {
  type = string
}

locals {
  # Developer guide defaults plus Accept (guest Alena SSE) and our app headers.
  allow_headers = "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Idempotency-Key,idempotency-key,x-internal-key,X-Internal-Key,X-Girlcode-Youcam-Key"
  allow_methods = "DELETE,GET,HEAD,OPTIONS,PUT,POST,PATCH"
}

resource "aws_api_gateway_method" "options" {
  rest_api_id   = var.rest_api_id
  resource_id   = var.resource_id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  rest_api_id = var.rest_api_id
  resource_id = var.resource_id
  http_method = aws_api_gateway_method.options.http_method
  type        = "MOCK"
  # OpenAPI CORS example uses WHEN_NO_MATCH so a preflight with no Content-Type
  # still uses the JSON template. The CORS guide also lists NEVER (415 if unmapped).
  passthrough_behavior = "WHEN_NO_MATCH"
  content_handling     = "CONVERT_TO_TEXT"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options" {
  rest_api_id = var.rest_api_id
  resource_id = var.resource_id
  http_method = aws_api_gateway_method.options.http_method
  status_code = "200"
  response_models = {
    "application/json" = "Empty"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options" {
  rest_api_id = var.rest_api_id
  resource_id = var.resource_id
  http_method = aws_api_gateway_method.options.http_method
  status_code = aws_api_gateway_method_response.options.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'${local.allow_headers}'"
    "method.response.header.Access-Control-Allow-Methods" = "'${local.allow_methods}'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}

output "integration_id" {
  value = aws_api_gateway_integration.options.id
}
