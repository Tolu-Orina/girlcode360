terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.25.0"
    }
  }
}

variable "environment" {
  type = string
}

variable "lambda_invoke_arns" {
  type        = map(string)
  description = "Invoke ARNs keyed by capability Lambda name (identity, cycles, …)."
}

variable "lambda_streaming_invoke_arns" {
  type        = map(string)
  description = "InvokeWithResponseStream ARNs keyed by capability Lambda name."
}

variable "lambda_function_names" {
  type        = map(string)
  description = "Function names keyed by capability Lambda name."
}

variable "cognito_user_pool_arn" {
  type = string
}

variable "domain_name" {
  type    = string
  default = ""
}

variable "certificate_arn" {
  type    = string
  default = ""
}

variable "enable_custom_domain" {
  type        = bool
  default     = false
  description = "Must be a plan-time boolean. Do not derive this from certificate_arn (unknown until ACM issues)."
}

resource "aws_api_gateway_rest_api" "main" {
  name        = "girlcode360-${var.environment}"
  description = "GirlCode360 API ${var.environment}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_authorizer" "cognito" {
  name            = "cognito"
  rest_api_id     = aws_api_gateway_rest_api.main.id
  type            = "COGNITO_USER_POOLS"
  provider_arns   = [var.cognito_user_pool_arn]
  identity_source = "method.request.header.Authorization"
}

resource "aws_api_gateway_resource" "v1" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "v1"
}

# ——— Public: GET /v1/health ———
resource "aws_api_gateway_resource" "health" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "health"
}

resource "aws_api_gateway_method" "health_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.health.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "health_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.health.id
  http_method             = aws_api_gateway_method.health_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["identity"]
}

# ——— Public: GET /v1/wallet/share/{token}[+ /object] ———
resource "aws_api_gateway_resource" "wallet" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "wallet"
}

resource "aws_api_gateway_resource" "wallet_share" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.wallet.id
  path_part   = "share"
}

resource "aws_api_gateway_resource" "wallet_share_token" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.wallet_share.id
  path_part   = "{token}"
}

resource "aws_api_gateway_method" "wallet_share_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.wallet_share_token.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "wallet_share_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.wallet_share_token.id
  http_method             = aws_api_gateway_method.wallet_share_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["wallet-share"]
}

resource "aws_api_gateway_method" "wallet_share_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.wallet_share_token.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "wallet_share_options" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.wallet_share_token.id
  http_method             = aws_api_gateway_method.wallet_share_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["wallet-share"]
}

resource "aws_api_gateway_resource" "wallet_share_object" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.wallet_share_token.id
  path_part   = "object"
}

resource "aws_api_gateway_method" "wallet_share_object_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.wallet_share_object.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "wallet_share_object_get" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.wallet_share_object.id
  http_method             = aws_api_gateway_method.wallet_share_object_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["wallet-share"]
}

resource "aws_api_gateway_method" "wallet_share_object_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.wallet_share_object.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "wallet_share_object_options" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.wallet_share_object.id
  http_method             = aws_api_gateway_method.wallet_share_object_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["wallet-share"]
}

# ——— Public: POST /v1/billing/webhooks/{stripe|paystack} ———
resource "aws_api_gateway_resource" "billing" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "billing"
}

resource "aws_api_gateway_resource" "billing_webhooks" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.billing.id
  path_part   = "webhooks"
}

resource "aws_api_gateway_resource" "billing_webhooks_stripe" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.billing_webhooks.id
  path_part   = "stripe"
}

resource "aws_api_gateway_method" "billing_webhooks_stripe_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.billing_webhooks_stripe.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_webhooks_stripe_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.billing_webhooks_stripe.id
  http_method             = aws_api_gateway_method.billing_webhooks_stripe_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["billing-webhooks"]
}

resource "aws_api_gateway_resource" "billing_webhooks_paystack" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.billing_webhooks.id
  path_part   = "paystack"
}

resource "aws_api_gateway_method" "billing_webhooks_paystack_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.billing_webhooks_paystack.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "billing_webhooks_paystack_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.billing_webhooks_paystack.id
  http_method             = aws_api_gateway_method.billing_webhooks_paystack_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["billing-webhooks"]
}

# ——— Public: POST /v1/privacy/purge-tick (INTERNAL_PURGE_KEY in Lambda) ———
resource "aws_api_gateway_resource" "privacy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "privacy"
}

resource "aws_api_gateway_resource" "privacy_purge_tick" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.privacy.id
  path_part   = "purge-tick"
}

resource "aws_api_gateway_method" "privacy_purge_tick_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.privacy_purge_tick.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "privacy_purge_tick_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.privacy_purge_tick.id
  http_method             = aws_api_gateway_method.privacy_purge_tick_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["purge"]
}

# ——— Public: POST /v1/guest/alena (landing FAB; rate-limited in Lambda) ———
resource "aws_api_gateway_resource" "guest" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "guest"
}

resource "aws_api_gateway_resource" "guest_alena" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.guest.id
  path_part   = "alena"
}

resource "aws_api_gateway_method" "guest_alena_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.guest_alena.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "guest_alena_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.guest_alena.id
  http_method             = aws_api_gateway_method.guest_alena_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_streaming_invoke_arns["alena-guest"]
  response_transfer_mode  = "STREAM"
  timeout_milliseconds    = 60000
}

resource "aws_api_gateway_method" "guest_alena_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.guest_alena.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "guest_alena_options" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.guest_alena.id
  http_method             = aws_api_gateway_method.guest_alena_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_streaming_invoke_arns["alena-guest"]
  response_transfer_mode  = "STREAM"
  timeout_milliseconds    = 60000
}
# ——— Public: POST /v1/webhooks/youcam (HMAC; poller remains) ———
resource "aws_api_gateway_resource" "webhooks" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "webhooks"
}

resource "aws_api_gateway_resource" "webhooks_youcam" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.webhooks.id
  path_part   = "youcam"
}

resource "aws_api_gateway_method" "webhooks_youcam_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.webhooks_youcam.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhooks_youcam_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.webhooks_youcam.id
  http_method             = aws_api_gateway_method.webhooks_youcam_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["youcam-webhook"]
}

resource "aws_api_gateway_method" "webhooks_youcam_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.webhooks_youcam.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhooks_youcam_options" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.webhooks_youcam.id
  http_method             = aws_api_gateway_method.webhooks_youcam_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["youcam-webhook"]
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.v1.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "proxy_any" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["identity"]
}

resource "aws_api_gateway_method" "proxy_options" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "proxy_options" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_options.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["identity"]
}

resource "aws_lambda_permission" "apigw" {
  for_each = var.lambda_function_names

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  # Hash must be known at plan time. Integration .id values are unknown until
  # apply; hashing them with create_before_destroy plus a deposed deployment
  # from a failed apply is a Terraform cycle (Lambda destroy + DSQL + Cognito).
  triggers = {
    redeployment = sha1(jsonencode({
      revision = "capability-split-24"
      invoke   = var.lambda_invoke_arns
      stream   = var.lambda_streaming_invoke_arns
    }))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.health_get,
    aws_api_gateway_integration.wallet_share_get,
    aws_api_gateway_integration.wallet_share_object_get,
    aws_api_gateway_integration.billing_webhooks_stripe_post,
    aws_api_gateway_integration.billing_webhooks_paystack_post,
    aws_api_gateway_integration.privacy_purge_tick_post,
    aws_api_gateway_integration.guest_alena_post,
    aws_api_gateway_integration.guest_alena_options,
    aws_api_gateway_integration.webhooks_youcam_post,
    aws_api_gateway_integration.webhooks_youcam_options,
    aws_api_gateway_integration.proxy_any,
    aws_api_gateway_integration.proxy_options,
    aws_api_gateway_integration.healthlens_monthly_tick_post,
    aws_api_gateway_integration.notifications_tick_post,
    module.cognito_prefix,
    module.wallet_auth,
    module.billing_auth,
    module.privacy_auth,
    module.healthlens,
    module.notifications,
    module.mirror_studio,
    module.wardrobe_intel,
    module.resale,
  ]
}

resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment
}

locals {
  execute_api_url = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.region}.amazonaws.com/${aws_api_gateway_stage.main.stage_name}"
}

resource "aws_api_gateway_domain_name" "custom" {
  count = var.enable_custom_domain ? 1 : 0

  domain_name              = var.domain_name
  regional_certificate_arn = var.certificate_arn
  security_policy          = "TLS_1_2"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_base_path_mapping" "custom" {
  count = var.enable_custom_domain ? 1 : 0

  api_id      = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  domain_name = aws_api_gateway_domain_name.custom[0].domain_name
}

output "api_base_url" {
  value = var.enable_custom_domain ? "https://${var.domain_name}" : local.execute_api_url
}

output "regional_domain_name" {
  value = var.enable_custom_domain ? aws_api_gateway_domain_name.custom[0].regional_domain_name : ""
}

output "regional_zone_id" {
  value = var.enable_custom_domain ? aws_api_gateway_domain_name.custom[0].regional_zone_id : ""
}

output "rest_api_id" {
  value = aws_api_gateway_rest_api.main.id
}

data "aws_region" "current" {}
