terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "domain_name" {
  type = string
}

variable "zone_id" {
  type = string
}

variable "create_certificate" {
  type    = bool
  default = true
}

resource "aws_acm_certificate" "api" {
  count = var.create_certificate ? 1 : 0

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  # count (not for_each over domain_validation_options) so plan does not depend on
  # ACM attributes that only exist after the certificate is created.
  count = var.create_certificate ? 1 : 0

  allow_overwrite = true
  name            = tolist(aws_acm_certificate.api[0].domain_validation_options)[0].resource_record_name
  records         = [tolist(aws_acm_certificate.api[0].domain_validation_options)[0].resource_record_value]
  ttl             = 60
  type            = tolist(aws_acm_certificate.api[0].domain_validation_options)[0].resource_record_type
  zone_id         = var.zone_id
}

resource "aws_acm_certificate_validation" "api" {
  count = var.create_certificate ? 1 : 0

  certificate_arn         = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [aws_route53_record.validation[0].fqdn]

  timeouts {
    create = "45m"
  }
}

output "certificate_arn" {
  value = var.create_certificate ? aws_acm_certificate_validation.api[0].certificate_arn : ""
}
