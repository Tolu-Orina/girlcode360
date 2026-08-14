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
  type    = string
  default = "global.amazon.nova-2-lite-v1:0"
}

variable "cognito_callback_urls" {
  type        = list(string)
  description = "OAuth redirect URIs for Google IdP (PKCE). Email/password still uses custom pages."
  default = [
    "http://localhost:5173/oauth/callback",
    "https://girlcode-dev.conquerorfoundation.com/oauth/callback",
    "https://girlcode-test.conquerorfoundation.com/oauth/callback",
    "https://girlcode.conquerorfoundation.com/oauth/callback",
  ]
}

variable "cognito_logout_urls" {
  type = list(string)
  default = [
    "http://localhost:5173/signin",
    "https://girlcode-dev.conquerorfoundation.com/signin",
    "https://girlcode-test.conquerorfoundation.com/signin",
    "https://girlcode.conquerorfoundation.com/signin",
  ]
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

variable "api_domain_name" {
  type    = string
  default = ""
}

variable "api_certificate_arn" {
  type    = string
  default = ""
}
