terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  type = string
}

resource "aws_kms_key" "main" {
  description             = "GirlCode360 ${var.environment} CMK"
  deletion_window_in_days = 7
  enable_key_rotation     = true
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
