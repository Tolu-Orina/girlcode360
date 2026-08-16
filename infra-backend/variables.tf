variable "environment" {
  type = string
}

variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "enable_dsql" {
  type        = bool
  description = "Provision Aurora DSQL cluster and wire Lambda DSQL_ENABLED (always on for GirlCode360)"
  default     = true
}

variable "alena_model_id" {
  type        = string
  default     = "global.amazon.nova-2-lite-v1:0"
  description = "Nova 2 Lite Global CRIS profile. Do not use amazon.nova-2-lite-v1:0 (in-region) or eu.amazon.nova-2-lite-v1:0 unless data residency requires it."
}

variable "bedrock_enabled" {
  type        = bool
  default     = true
  description = "Lambda kill switch for live Bedrock Converse. Not a secret. Set false only for a Bedrock outage."
}

variable "cognito_callback_urls" {
  type        = list(string)
  default     = null
  description = "Override Google OAuth callbacks. Null uses localhost plus girlcode{,-dev,-test}.{root_domain}."
}

variable "cognito_logout_urls" {
  type        = list(string)
  default     = null
  description = "Override OAuth logout URLs. Null uses localhost plus girlcode{,-dev,-test}.{root_domain}/signin."
}

variable "google_oauth_client_id" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Google OAuth client ID. Empty skips the Google IdP. Prefer TF_VAR_ from Secrets Manager."
}

variable "google_oauth_client_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Google OAuth client secret. Empty skips the Google IdP."
}

variable "root_domain" {
  type        = string
  default     = "rinegansolutions.com"
  description = "Public Route 53 zone. API host is api.{domain_prefix}.{root_domain}."
}

variable "domain_prefix" {
  type        = string
  default     = ""
  description = "girlcode (prod), girlcode-dev, girlcode-test. Empty derives from environment."
}

variable "enable_api_custom_domain" {
  type        = bool
  default     = true
  description = "ACM in eu-west-2 + API Gateway custom domain + Route 53 alias."
}

variable "route53_zone_id" {
  type    = string
  default = ""
}

variable "api_domain_name" {
  type        = string
  default     = ""
  description = "Override FQDN. Empty → api.{prefix}.{root_domain}."
}

variable "api_certificate_arn" {
  type        = string
  default     = ""
  description = "Optional pre-issued ACM ARN in eu-west-2. Empty → this stack issues one."
}
