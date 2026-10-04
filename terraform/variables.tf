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
