# Keep keys in sync with codes/scripts/functions.mjs
locals {
  lambda_env = {
    ENVIRONMENT            = var.environment
    COGNITO_USER_POOL_ID   = var.cognito_user_pool_id
    COGNITO_CLIENT_ID      = var.cognito_client_id
    DSQL_ENDPOINT          = var.dsql_endpoint
    DSQL_ENABLED           = tostring(var.dsql_enabled)
    DSQL_USER              = "girlcode360_app"
    DATA_BUCKET            = var.data_bucket_name
    CONSENT_POLICY_VERSION = "2026-07-v1"
    ALENA_MODEL_ID         = var.alena_model_id
    BEDROCK_ENABLED        = tostring(var.bedrock_enabled)
  }

  # identity keeps girlcode360-api-{env} so state can `moved` the monolith in place
  # (rename would ForceNew and re-introduce destroy ↔ API Gateway CBD cycles).
  function_names = {
    for k, _ in local.functions :
    k => k == "identity" ? "girlcode360-api-${var.environment}" : "girlcode360-${k}-${var.environment}"
  }

  # Plan-time ARNs. Do not use aws_lambda_function.fn.invoke_arn — that edge plus
  # API Gateway deployment create_before_destroy plus env (DSQL/Cognito) is a cycle.
  invoke_arns = {
    for k, name in local.function_names :
    k => "arn:aws:apigateway:${data.aws_region.current.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:function:${name}/invocations"
  }
  streaming_invoke_arns = {
    for k, name in local.function_names :
    k => "arn:aws:apigateway:${data.aws_region.current.region}:lambda:path/2021-11-15/functions/arn:aws:lambda:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:function:${name}/response-streaming-invocations"
  }

  functions = {
    identity           = { memory = 256, timeout = 29 }
    cycles             = { memory = 256, timeout = 29 }
    pmos               = { memory = 256, timeout = 29 }
    pregnancy          = { memory = 256, timeout = 29 }
    ttc                = { memory = 256, timeout = 29 }
    wallet             = { memory = 256, timeout = 29 }
    wallet-share       = { memory = 256, timeout = 29 }
    alena              = { memory = 512, timeout = 60 }
    alena-guest        = { memory = 512, timeout = 60 }
    healthlens         = { memory = 512, timeout = 29 }
    healthlens-monthly = { memory = 512, timeout = 60 }
    mirror             = { memory = 512, timeout = 29 }
    youcam-webhook     = { memory = 512, timeout = 60 }
    wardrobe-intel     = { memory = 256, timeout = 29 }
    resale             = { memory = 256, timeout = 29 }
    marketplace        = { memory = 256, timeout = 29 }
    library            = { memory = 256, timeout = 29 }
    community          = { memory = 256, timeout = 29 }
    notify             = { memory = 256, timeout = 29 }
    notify-tick        = { memory = 256, timeout = 60 }
    billing            = { memory = 256, timeout = 29 }
    billing-webhooks   = { memory = 256, timeout = 29 }
    privacy            = { memory = 256, timeout = 29 }
    purge              = { memory = 256, timeout = 60 }
  }
}

resource "aws_lambda_function" "fn" {
  for_each = local.functions

  function_name = local.function_names[each.key]
  role          = aws_iam_role.lambda.arn
  handler       = "${each.key}.handler"
  runtime       = "nodejs22.x"
  timeout       = each.value.timeout
  memory_size   = each.value.memory

  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  environment {
    variables = local.lambda_env
  }
}
