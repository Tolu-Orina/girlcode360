terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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
}

module "apigw" {
  source                = "./modules/apigw"
  environment           = var.environment
  lambda_invoke_arn     = module.lambda.invoke_arn
  lambda_function_name  = module.lambda.function_name
  cognito_user_pool_arn = module.cognito.user_pool_arn
  domain_name           = var.api_domain_name
  certificate_arn       = var.api_certificate_arn
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
