variable "region_name" {
  description = "Name of the AWS region"
  type        = string
  default     = "us-east-1"
}

variable "alarm_email" {
  description = "Email address subscribed to DLQ alarm notifications. Leave empty to create the topic without a subscription."
  type        = string
  default     = ""
}

variable "use_localstack" {
  description = "Point the AWS provider at LocalStack instead of real AWS."
  type        = bool
  default     = false
}

variable "localstack_endpoint" {
  description = "LocalStack edge endpoint, used when use_localstack is true."
  type        = string
  default     = "http://localhost:4566"
}
