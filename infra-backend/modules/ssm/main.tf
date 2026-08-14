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

variable "api_base_url" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "cognito_user_pool_region" {
  type = string
}

variable "cognito_domain" {
  type = string
}

variable "cognito_google_idp" {
  type = string
}

variable "data_bucket_name" {
  type = string
}

variable "dsql_endpoint" {
  type = string
}

resource "aws_ssm_parameter" "api_base_url" {
  name  = "/girlcode360/${var.environment}/backend/api_base_url"
  type  = "String"
  value = var.api_base_url
}

resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "/girlcode360/${var.environment}/backend/cognito_user_pool_id"
  type  = "String"
  value = var.cognito_user_pool_id
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name  = "/girlcode360/${var.environment}/backend/cognito_client_id"
  type  = "String"
  value = var.cognito_client_id
}

resource "aws_ssm_parameter" "cognito_region" {
  name  = "/girlcode360/${var.environment}/backend/cognito_region"
  type  = "String"
  value = var.cognito_user_pool_region
}

resource "aws_ssm_parameter" "cognito_domain" {
  name  = "/girlcode360/${var.environment}/backend/cognito_domain"
  type  = "String"
  value = var.cognito_domain
}

resource "aws_ssm_parameter" "cognito_google_idp" {
  name  = "/girlcode360/${var.environment}/backend/cognito_google_idp"
  type  = "String"
  value = var.cognito_google_idp
}

resource "aws_ssm_parameter" "data_bucket" {
  name  = "/girlcode360/${var.environment}/backend/data_bucket_name"
  type  = "String"
  value = var.data_bucket_name
}

resource "aws_ssm_parameter" "dsql_endpoint" {
  name  = "/girlcode360/${var.environment}/backend/dsql_endpoint"
  type  = "String"
  value = var.dsql_endpoint != "" ? var.dsql_endpoint : "disabled"
}
