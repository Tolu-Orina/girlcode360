variable "environment" {
  type = string
}

variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "enable_dsql" {
  type        = bool
  description = "Create Aurora DSQL cluster (Phase 0 can set false until account/region ready)"
  default     = true
}

variable "zara_model_id" {
  type    = string
  default = "eu.amazon.nova-2-lite-v1:0"
}

variable "cognito_callback_urls" {
  type        = list(string)
  description = "Only needed if OAuth IdPs are added later; custom email/password auth does not use Hosted UI"
  default = [
    "http://localhost:5173/",
    "https://girlcode-dev.conquerorfoundation.com/",
    "https://girlcode-test.conquerorfoundation.com/",
    "https://girlcode.conquerorfoundation.com/",
  ]
}

variable "cognito_logout_urls" {
  type = list(string)
  default = [
    "http://localhost:5173/",
    "https://girlcode-dev.conquerorfoundation.com/",
    "https://girlcode-test.conquerorfoundation.com/",
    "https://girlcode.conquerorfoundation.com/",
  ]
}

variable "api_domain_name" {
  type    = string
  default = ""
}

variable "api_certificate_arn" {
  type    = string
  default = ""
}
