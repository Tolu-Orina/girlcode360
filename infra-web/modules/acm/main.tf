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

resource "aws_acm_certificate" "web" {
  count = var.create_certificate ? 1 : 0

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = var.create_certificate ? {
    for dvo in aws_acm_certificate.web[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.zone_id
}

resource "aws_acm_certificate_validation" "web" {
  count = var.create_certificate ? 1 : 0

  certificate_arn         = aws_acm_certificate.web[0].arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]

  timeouts {
    create = "45m"
  }
}

output "certificate_arn" {
  # Validated ARN only — CloudFront requires ISSUED certificates
  value = var.create_certificate ? aws_acm_certificate_validation.web[0].certificate_arn : null
}
