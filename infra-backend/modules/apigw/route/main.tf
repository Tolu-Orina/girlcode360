terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.25.0"
    }
  }
}

variable "rest_api_id" {
  type = string
}

variable "parent_id" {
  type    = string
  default = null
}

variable "path_part" {
  type    = string
  default = null
}

variable "create_resource" {
  type    = bool
  default = true
}

variable "existing_resource_id" {
  type    = string
  default = null
}

variable "invoke_arn" {
  type = string
}

variable "stream" {
  type    = bool
  default = false
}

variable "streaming_invoke_arn" {
  type    = string
  default = null
}

variable "authorization" {
  type    = string
  default = "COGNITO_USER_POOLS"
}

variable "authorizer_id" {
  type    = string
  default = null
}

variable "methods_on_root" {
  type    = bool
  default = true
}

variable "include_proxy" {
  type    = bool
  default = true
}

resource "aws_api_gateway_resource" "this" {
  count = var.create_resource ? 1 : 0

  rest_api_id = var.rest_api_id
  parent_id   = var.parent_id
  path_part   = var.path_part
}

locals {
  resource_id = var.create_resource ? aws_api_gateway_resource.this[0].id : var.existing_resource_id
  authorizer  = var.authorization == "COGNITO_USER_POOLS" ? var.authorizer_id : null
}

resource "aws_api_gateway_method" "root_any" {
  count = var.methods_on_root ? 1 : 0

  rest_api_id   = var.rest_api_id
  resource_id   = local.resource_id
  http_method   = "ANY"
  authorization = var.authorization
  authorizer_id = local.authorizer
}

resource "aws_api_gateway_integration" "root_any" {
  count = var.methods_on_root ? 1 : 0

  rest_api_id             = var.rest_api_id
  resource_id             = local.resource_id
  http_method             = aws_api_gateway_method.root_any[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.stream ? var.streaming_invoke_arn : var.invoke_arn
  response_transfer_mode  = var.stream ? "STREAM" : null
  timeout_milliseconds    = var.stream ? 60000 : 29000
}

module "root_options" {
  count = var.methods_on_root ? 1 : 0

  source      = "../cors_options"
  rest_api_id = var.rest_api_id
  resource_id = local.resource_id
}

resource "aws_api_gateway_resource" "proxy" {
  count = var.include_proxy ? 1 : 0

  rest_api_id = var.rest_api_id
  parent_id   = local.resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy_any" {
  count = var.include_proxy ? 1 : 0

  rest_api_id   = var.rest_api_id
  resource_id   = aws_api_gateway_resource.proxy[0].id
  http_method   = "ANY"
  authorization = var.authorization
  authorizer_id = local.authorizer
}

resource "aws_api_gateway_integration" "proxy_any" {
  count = var.include_proxy ? 1 : 0

  rest_api_id             = var.rest_api_id
  resource_id             = aws_api_gateway_resource.proxy[0].id
  http_method             = aws_api_gateway_method.proxy_any[0].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.stream ? var.streaming_invoke_arn : var.invoke_arn
  response_transfer_mode  = var.stream ? "STREAM" : null
  timeout_milliseconds    = var.stream ? 60000 : 29000
}

module "proxy_options" {
  count = var.include_proxy ? 1 : 0

  source      = "../cors_options"
  rest_api_id = var.rest_api_id
  resource_id = aws_api_gateway_resource.proxy[0].id
}

output "resource_id" {
  value = local.resource_id
}

output "integration_ids" {
  value = compact([
    var.methods_on_root ? aws_api_gateway_integration.root_any[0].id : "",
    var.methods_on_root ? module.root_options[0].integration_id : "",
    var.include_proxy ? aws_api_gateway_integration.proxy_any[0].id : "",
    var.include_proxy ? module.proxy_options[0].integration_id : "",
  ])
}

# OPTIONS already exist on these resources. Without a move, Terraform creates a
# second OPTIONS method and API Gateway returns 409 ConflictException.
moved {
  from = aws_api_gateway_method.root_options[0]
  to   = module.root_options[0].aws_api_gateway_method.options
}

moved {
  from = aws_api_gateway_integration.root_options[0]
  to   = module.root_options[0].aws_api_gateway_integration.options
}

moved {
  from = aws_api_gateway_method.proxy_options[0]
  to   = module.proxy_options[0].aws_api_gateway_method.options
}

moved {
  from = aws_api_gateway_integration.proxy_options[0]
  to   = module.proxy_options[0].aws_api_gateway_integration.options
}
