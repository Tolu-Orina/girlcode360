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

data "aws_caller_identity" "current" {}

# Custom policy is required for Aurora DSQL CMK encryption:
# https://docs.aws.amazon.com/aurora-dsql/latest/userguide/data-encryption.html
resource "aws_kms_key" "main" {
  description             = "GirlCode360 ${var.environment} CMK"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "girlcode360-${var.environment}"
    Statement = [
      {
        Sid    = "EnableRootAccountAdmin"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        # CreateCluster runs before a cluster ARN exists, so scope by account only.
        # See: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/data-encryption.html
        Sid    = "AllowAuroraDsql"
        Effect = "Allow"
        Principal = {
          Service = "dsql.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
          "kms:CreateGrant",
          "kms:RetireGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

resource "aws_kms_alias" "main" {
  name          = "alias/girlcode360-${var.environment}"
  target_key_id = aws_kms_key.main.key_id
}

output "key_arn" {
  value = aws_kms_key.main.arn
}

output "key_id" {
  value = aws_kms_key.main.key_id
}
