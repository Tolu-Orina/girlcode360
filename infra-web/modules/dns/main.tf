terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "create_record" {
  type    = bool
  default = true
}

variable "zone_id" {
  type = string
}

variable "record_name" {
  type = string
}

variable "cloudfront_domain_name" {
  type = string
}

variable "cloudfront_zone_id" {
  type = string
}

resource "aws_route53_record" "web_a" {
  count   = var.create_record ? 1 : 0
  zone_id = var.zone_id
  name    = var.record_name
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_aaaa" {
  count   = var.create_record ? 1 : 0
  zone_id = var.zone_id
  name    = var.record_name
  type    = "AAAA"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = var.cloudfront_zone_id
    evaluate_target_health = false
  }
}
