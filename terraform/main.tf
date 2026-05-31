terraform {
  backend "s3" {
    bucket = "applicationflow-dev-jackson"
    key    = "job-status-api/terraform.tfstate"
    region = "us-east-1"
  }
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region_name
}
