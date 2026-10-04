terraform {
  backend "s3" {
    bucket = "applicationflow-dev-jackson"
    key    = "job-status-api/terraform.tfstate"
    region = "us-east-1"
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region_name

  # Local development against LocalStack (see README). All null when use_localstack = false.
  access_key                  = var.use_localstack ? "test" : null
  secret_key                  = var.use_localstack ? "test" : null
  skip_credentials_validation = var.use_localstack
  skip_metadata_api_check     = var.use_localstack
  skip_requesting_account_id  = var.use_localstack

  endpoints {
    apigatewayv2 = var.use_localstack ? var.localstack_endpoint : null
    cloudwatch   = var.use_localstack ? var.localstack_endpoint : null
    dynamodb     = var.use_localstack ? var.localstack_endpoint : null
    iam          = var.use_localstack ? var.localstack_endpoint : null
    lambda       = var.use_localstack ? var.localstack_endpoint : null
    sns          = var.use_localstack ? var.localstack_endpoint : null
    sqs          = var.use_localstack ? var.localstack_endpoint : null
    sts          = var.use_localstack ? var.localstack_endpoint : null
  }
}
