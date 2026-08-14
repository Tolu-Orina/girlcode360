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

variable "enabled" {
  type = bool
}

variable "kms_key_arn" {
  type = string
}

# Aurora DSQL — public cluster endpoint is not an API/Terraform attribute.
# AWS documents the hostname as: {identifier}.dsql.{region}.on.aws
# https://docs.aws.amazon.com/aurora-dsql/latest/userguide/SECTION_authentication-token.html
# https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/dsql_cluster
data "aws_region" "current" {}

resource "aws_dsql_cluster" "main" {
  count = var.enabled ? 1 : 0

  deletion_protection_enabled = false
  kms_encryption_key          = var.kms_key_arn

  tags = {
    Name = "girlcode360-${var.environment}"
  }
}

locals {
  identifier = var.enabled ? aws_dsql_cluster.main[0].identifier : ""
  endpoint   = var.enabled ? "${local.identifier}.dsql.${data.aws_region.current.region}.on.aws" : ""
}

output "endpoint" {
  description = "PostgreSQL host: {identifier}.dsql.{region}.on.aws"
  value       = local.endpoint
}

output "identifier" {
  value = local.identifier
}

output "arn" {
  value = var.enabled ? aws_dsql_cluster.main[0].arn : ""
}

output "vpc_endpoint_service_name" {
  description = "For PrivateLink only; public Lambda access uses endpoint above"
  value       = var.enabled ? aws_dsql_cluster.main[0].vpc_endpoint_service_name : ""
}
