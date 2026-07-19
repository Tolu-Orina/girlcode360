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

data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.module}/codes/dist"
  output_path = "${path.module}/api.zip"
}

# CI buildspec must run `npm run build` in codes/ before terraform apply.

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
        # App connections use a custom DB role + DbConnect once wired.
        # Admin DDL stays in CI (migrate-dsql.mjs).
        Effect = "Allow"
        Action = [
          "dsql:DbConnect",
          "dsql:DbConnectAdmin"
        ]
        Resource = ["*"]
      }
    ]
  })
}

resource "aws_lambda_function" "api" {
  function_name = "girlcode360-api-${var.environment}"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 29
  memory_size   = 256

  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT            = var.environment
      COGNITO_USER_POOL_ID   = var.cognito_user_pool_id
      COGNITO_CLIENT_ID      = var.cognito_client_id
      DSQL_ENDPOINT          = var.dsql_endpoint
      DSQL_ENABLED           = tostring(var.dsql_enabled)
      DATA_BUCKET            = var.data_bucket_name
      CONSENT_POLICY_VERSION = "2026-07-v1"
    }
  }
}

output "invoke_arn" {
  value = aws_lambda_function.api.invoke_arn
}

output "function_name" {
  value = aws_lambda_function.api.function_name
}

output "function_arn" {
  value = aws_lambda_function.api.arn
}
