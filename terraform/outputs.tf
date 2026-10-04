output "api_url" {
  value = var.use_localstack ? null : aws_apigatewayv2_api.job_status_api[0].api_endpoint
}
