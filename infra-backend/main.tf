terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.25.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  backend "s3" {
    # bucket=girlcode360-tf-state key=backend/{env}/terraform.tfstate dynamodb_table=girlcode360-tf-lock
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "GirlCode360"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Stack       = "infra-backend"
    }
  }
}

locals {
  domain_prefix = var.domain_prefix != "" ? var.domain_prefix : (
    var.environment == "prod" ? "girlcode" : (
      var.environment == "test" ? "girlcode-test" : "girlcode-dev"
    )
  )
  api_fqdn = var.api_domain_name != "" ? var.api_domain_name : "api.${local.domain_prefix}.${var.root_domain}"
}

data "aws_route53_zone" "root" {
  count        = var.enable_api_custom_domain && var.route53_zone_id == "" ? 1 : 0
  name         = var.root_domain
  private_zone = false
}

locals {
  zone_id = var.enable_api_custom_domain ? (
    var.route53_zone_id != "" ? var.route53_zone_id : data.aws_route53_zone.root[0].zone_id
  ) : ""
  issue_api_cert = var.enable_api_custom_domain && var.api_certificate_arn == ""
}

module "acm_api" {
  source             = "./modules/acm"
  domain_name        = local.api_fqdn
  zone_id            = local.zone_id
  create_certificate = local.issue_api_cert
}

module "kms" {
  source      = "./modules/kms"
  environment = var.environment
}

module "cognito" {
  source      = "./modules/cognito"
  environment = var.environment
  # Custom auth pages in PWA — Cognito domain is OAuth plumbing for Google only
  callback_urls        = var.cognito_callback_urls
  logout_urls          = var.cognito_logout_urls
  google_client_id     = var.google_oauth_client_id
  google_client_secret = var.google_oauth_client_secret
}

module "s3_data" {
  source      = "./modules/s3-data"
  environment = var.environment
  kms_key_arn = module.kms.key_arn
}

module "dsql" {
  source      = "./modules/dsql"
  environment = var.environment
  enabled     = var.enable_dsql
  kms_key_arn = module.kms.key_arn
}

module "lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
  dsql_endpoint        = module.dsql.endpoint
  dsql_enabled         = var.enable_dsql
  data_bucket_name     = module.s3_data.bucket_id
  kms_key_arn          = module.kms.key_arn
  alena_model_id       = var.alena_model_id
  bedrock_enabled      = var.bedrock_enabled
}

module "apigw" {
  source                       = "./modules/apigw"
  environment                  = var.environment
  lambda_invoke_arns           = module.lambda.invoke_arns
  lambda_streaming_invoke_arns = module.lambda.streaming_invoke_arns
  lambda_function_names        = module.lambda.function_names
  cognito_user_pool_arn        = module.cognito.user_pool_arn
  enable_custom_domain         = var.enable_api_custom_domain
  domain_name                  = var.enable_api_custom_domain ? local.api_fqdn : ""
  certificate_arn = var.enable_api_custom_domain ? (
    var.api_certificate_arn != "" ? var.api_certificate_arn : module.acm_api.certificate_arn
  ) : ""
}

resource "aws_route53_record" "api_a" {
  count   = var.enable_api_custom_domain ? 1 : 0
  zone_id = local.zone_id
  name    = local.api_fqdn
  type    = "A"

  alias {
    name                   = module.apigw.regional_domain_name
    zone_id                = module.apigw.regional_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_aaaa" {
  count   = var.enable_api_custom_domain ? 1 : 0
  zone_id = local.zone_id
  name    = local.api_fqdn
  type    = "AAAA"

  alias {
    name                   = module.apigw.regional_domain_name
    zone_id                = module.apigw.regional_zone_id
    evaluate_target_health = false
  }
}

module "ssm" {
  source                   = "./modules/ssm"
  environment              = var.environment
  api_base_url             = module.apigw.api_base_url
  cognito_user_pool_id     = module.cognito.user_pool_id
  cognito_client_id        = module.cognito.client_id
  cognito_user_pool_region = var.aws_region
  cognito_domain           = "${module.cognito.hosted_ui_domain}.auth.${var.aws_region}.amazoncognito.com"
  cognito_google_idp       = module.cognito.google_idp_enabled ? "true" : "false"
  data_bucket_name         = module.s3_data.bucket_id
  dsql_endpoint            = module.dsql.endpoint
}

output "api_base_url" {
  value = module.apigw.api_base_url
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "lambda_role_arn" {
  value       = module.lambda.role_arn
  description = "IAM role ARN mapped to DSQL app role girlcode360_app via migrate-dsql.mjs"
}

output "dsql_endpoint" {
  value = module.dsql.endpoint
}
