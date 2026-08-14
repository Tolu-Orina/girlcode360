locals {
  cognito_prefixes = {
    users       = { path = "users", fn = "identity" }
    consents    = { path = "consents", fn = "identity" }
    cycles      = { path = "cycles", fn = "cycles" }
    symptoms    = { path = "symptoms", fn = "cycles" }
    pcos        = { path = "pcos", fn = "pmos" }
    pregnancy   = { path = "pregnancy", fn = "pregnancy" }
    emergency   = { path = "emergency", fn = "pregnancy" }
    ttc         = { path = "ttc", fn = "ttc" }
    alena       = { path = "alena", fn = "alena", stream = true }
    zara        = { path = "zara", fn = "alena", stream = true }
    marketplace = { path = "marketplace", fn = "marketplace" }
    shematch    = { path = "shematch", fn = "marketplace" }
    content     = { path = "content", fn = "library" }
    community   = { path = "community", fn = "community" }
    in-app      = { path = "in-app", fn = "notify" }
    mirror      = { path = "mirror", fn = "mirror" }
  }
}

module "cognito_prefix" {
  for_each = local.cognito_prefixes
  source   = "./route"

  rest_api_id          = aws_api_gateway_rest_api.main.id
  parent_id            = aws_api_gateway_resource.v1.id
  path_part            = each.value.path
  invoke_arn           = var.lambda_invoke_arns[each.value.fn]
  stream               = try(each.value.stream, false)
  streaming_invoke_arn = try(each.value.stream, false) ? var.lambda_streaming_invoke_arns[each.value.fn] : null
  authorization        = "COGNITO_USER_POOLS"
  authorizer_id        = aws_api_gateway_authorizer.cognito.id
}

# Authenticated /v1/wallet/{proxy+} — /share stays a more-specific public child.
module "wallet_auth" {
  source = "./route"

  rest_api_id          = aws_api_gateway_rest_api.main.id
  create_resource      = false
  existing_resource_id = aws_api_gateway_resource.wallet.id
  methods_on_root      = false
  include_proxy        = true
  invoke_arn           = var.lambda_invoke_arns["wallet"]
  authorization        = "COGNITO_USER_POOLS"
  authorizer_id        = aws_api_gateway_authorizer.cognito.id
}

# Authenticated /v1/billing/{proxy+} — /webhooks stays more-specific public.
module "billing_auth" {
  source = "./route"

  rest_api_id          = aws_api_gateway_rest_api.main.id
  create_resource      = false
  existing_resource_id = aws_api_gateway_resource.billing.id
  methods_on_root      = false
  include_proxy        = true
  invoke_arn           = var.lambda_invoke_arns["billing"]
  authorization        = "COGNITO_USER_POOLS"
  authorizer_id        = aws_api_gateway_authorizer.cognito.id
}

# Authenticated /v1/privacy/{proxy+} — /purge-tick stays more-specific public.
module "privacy_auth" {
  source = "./route"

  rest_api_id          = aws_api_gateway_rest_api.main.id
  create_resource      = false
  existing_resource_id = aws_api_gateway_resource.privacy.id
  methods_on_root      = false
  include_proxy        = true
  invoke_arn           = var.lambda_invoke_arns["privacy"]
  authorization        = "COGNITO_USER_POOLS"
  authorizer_id        = aws_api_gateway_authorizer.cognito.id
}

module "healthlens" {
  source = "./route"

  rest_api_id   = aws_api_gateway_rest_api.main.id
  parent_id     = aws_api_gateway_resource.v1.id
  path_part     = "healthlens"
  invoke_arn    = var.lambda_invoke_arns["healthlens"]
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_resource" "healthlens_monthly_tick" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = module.healthlens.resource_id
  path_part   = "monthly-tick"
}

resource "aws_api_gateway_method" "healthlens_monthly_tick_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.healthlens_monthly_tick.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "healthlens_monthly_tick_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.healthlens_monthly_tick.id
  http_method             = aws_api_gateway_method.healthlens_monthly_tick_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["healthlens-monthly"]
}

module "notifications" {
  source = "./route"

  rest_api_id   = aws_api_gateway_rest_api.main.id
  parent_id     = aws_api_gateway_resource.v1.id
  path_part     = "notifications"
  invoke_arn    = var.lambda_invoke_arns["notify"]
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_resource" "notifications_tick" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = module.notifications.resource_id
  path_part   = "tick"
}

resource "aws_api_gateway_method" "notifications_tick_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.notifications_tick.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "notifications_tick_post" {
  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.notifications_tick.id
  http_method             = aws_api_gateway_method.notifications_tick_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arns["notify-tick"]
}

# /v1/mirror-studio: style-analytics and resale beat the studio {proxy+}.
module "mirror_studio" {
  source = "./route"

  rest_api_id     = aws_api_gateway_rest_api.main.id
  parent_id       = aws_api_gateway_resource.v1.id
  path_part       = "mirror-studio"
  methods_on_root = false
  include_proxy   = true
  invoke_arn      = var.lambda_invoke_arns["mirror"]
  authorization   = "COGNITO_USER_POOLS"
  authorizer_id   = aws_api_gateway_authorizer.cognito.id
}

module "wardrobe_intel" {
  source = "./route"

  rest_api_id     = aws_api_gateway_rest_api.main.id
  parent_id       = module.mirror_studio.resource_id
  path_part       = "style-analytics"
  methods_on_root = true
  include_proxy   = false
  invoke_arn      = var.lambda_invoke_arns["wardrobe-intel"]
  authorization   = "COGNITO_USER_POOLS"
  authorizer_id   = aws_api_gateway_authorizer.cognito.id
}

module "resale" {
  source = "./route"

  rest_api_id     = aws_api_gateway_rest_api.main.id
  parent_id       = module.mirror_studio.resource_id
  path_part       = "resale"
  methods_on_root = true
  include_proxy   = true
  invoke_arn      = var.lambda_invoke_arns["resale"]
  authorization   = "COGNITO_USER_POOLS"
  authorizer_id   = aws_api_gateway_authorizer.cognito.id
}
