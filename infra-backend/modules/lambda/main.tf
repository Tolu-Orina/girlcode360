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
}

variable "environment" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "dsql_endpoint" {
  type = string
}

variable "dsql_enabled" {
  type = bool
}

variable "data_bucket_name" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "alena_model_id" {
  type = string
}

variable "bedrock_enabled" {
  type    = bool
  default = true
}

data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.module}/codes/dist"
  output_path = "${path.module}/api.zip"
}

# CI buildspec must run `npm run build` in codes/ before terraform apply.

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "lambda" {
  name = "girlcode360-api-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "app" {
  name = "girlcode360-api-${var.environment}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:*:*:parameter/girlcode360/${var.environment}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:girlcode360/${var.environment}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.data_bucket_name}",
          "arn:aws:s3:::${var.data_bucket_name}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [var.kms_key_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = ["*"]
      },
      {
        # App uses custom DB role + DbConnect. Admin DDL stays in CI migrate-dsql.mjs.
        Effect = "Allow"
        Action = [
          "dsql:DbConnect"
        ]
        Resource = ["*"]
      }
    ]
  })
}

output "invoke_arns" {
  value = local.invoke_arns
}

output "streaming_invoke_arns" {
  value = local.streaming_invoke_arns
}

output "function_names" {
  value = local.function_names
}

output "function_arns" {
  value = { for k, f in aws_lambda_function.fn : k => f.arn }
}

# Identity is the leftover {proxy+} target and health check.
output "invoke_arn" {
  value = local.invoke_arns["identity"]
}

output "function_name" {
  value = aws_lambda_function.fn["identity"].function_name
}

output "function_arn" {
  value = aws_lambda_function.fn["identity"].arn
}

output "role_arn" {
  value = aws_iam_role.lambda.arn
}

output "role_name" {
  value = aws_iam_role.lambda.name
}
