terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configured via -backend-config in CI:
    # bucket=girlcode360-tf-state key=web/{env}/terraform.tfstate dynamodb_table=girlcode360-tf-lock
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "GirlCode360"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Stack       = "infra-web"
    }
  }
}

# ACM for CloudFront must be in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "GirlCode360"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Stack       = "infra-web"
    }
  }
}

locals {
  # prod: girlcode.rinegansolutions.com
  # nonprod: girlcode-dev / girlcode-test under the same apex
  domain_name          = var.domain_prefix == "" ? var.root_domain : "${var.domain_prefix}.${var.root_domain}"
  enable_custom_domain = var.enable_custom_domain
}

data "aws_route53_zone" "root" {
  count        = local.enable_custom_domain && var.route53_zone_id == "" ? 1 : 0
  name         = var.root_domain
  private_zone = false
}

locals {
  zone_id = local.enable_custom_domain ? (
    var.route53_zone_id != "" ? var.route53_zone_id : data.aws_route53_zone.root[0].zone_id
  ) : ""
}

module "web_bucket" {
  source      = "./modules/s3"
  bucket_name = "girlcode360-web-${var.environment}"
}

module "acm" {
  source = "./modules/acm"
  providers = {
    aws = aws.us_east_1
  }
  domain_name        = local.domain_name
  zone_id            = local.zone_id
  create_certificate = local.enable_custom_domain
}

module "cloudfront" {
  source                         = "./modules/cloudfront"
  environment                    = var.environment
  s3_bucket_id                   = module.web_bucket.bucket_id
  s3_bucket_arn                  = module.web_bucket.bucket_arn
  s3_bucket_regional_domain_name = module.web_bucket.bucket_regional_domain_name
  acm_certificate_arn            = module.acm.certificate_arn
  aliases                        = local.enable_custom_domain ? [local.domain_name] : []
}

module "dns" {
  source                 = "./modules/dns"
  create_record          = local.enable_custom_domain
  zone_id                = local.zone_id
  record_name            = local.domain_name
  cloudfront_domain_name = module.cloudfront.distribution_domain_name
  cloudfront_zone_id     = module.cloudfront.distribution_hosted_zone_id
}

resource "aws_ssm_parameter" "cloudfront_distribution_id" {
  name  = "/girlcode360/${var.environment}/web/cloudfront_distribution_id"
  type  = "String"
  value = module.cloudfront.distribution_id
}

resource "aws_ssm_parameter" "web_bucket_name" {
  name  = "/girlcode360/${var.environment}/web/s3_bucket_name"
  type  = "String"
  value = module.web_bucket.bucket_id
}

resource "aws_ssm_parameter" "web_url" {
  name  = "/girlcode360/${var.environment}/web/url"
  type  = "String"
  value = local.enable_custom_domain ? "https://${local.domain_name}" : "https://${module.cloudfront.distribution_domain_name}"
}

output "cloudfront_domain_name" {
  value = module.cloudfront.distribution_domain_name
}

output "web_domain_name" {
  value = local.enable_custom_domain ? local.domain_name : module.cloudfront.distribution_domain_name
}

output "web_url" {
  value = local.enable_custom_domain ? "https://${local.domain_name}" : "https://${module.cloudfront.distribution_domain_name}"
}

output "web_bucket_name" {
  value = module.web_bucket.bucket_id
}

output "distribution_id" {
  value = module.cloudfront.distribution_id
}
