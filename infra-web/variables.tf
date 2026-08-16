variable "environment" {
  type        = string
  description = "dev | test | prod"
}

variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "root_domain" {
  type        = string
  description = "Apex domain (Route 53 public hosted zone in this account)"
  default     = "rinegansolutions.com"
}

variable "domain_prefix" {
  type        = string
  description = "Subdomain label: girlcode (prod), girlcode-dev, girlcode-test"
  default     = "girlcode"
}

variable "enable_custom_domain" {
  type        = bool
  description = "ACM (us-east-1) + Route53 alias for CloudFront under root_domain"
  default     = true
}

variable "route53_zone_id" {
  type        = string
  description = "Optional override; when empty, looks up the public zone for root_domain"
  default     = ""
}
