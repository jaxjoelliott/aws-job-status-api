# HTTP APIs (apigatewayv2) are a LocalStack Pro feature, so these are skipped when
# use_localstack = true. The Lambdas are exercised by direct invocation instead.
resource "aws_apigatewayv2_api" "job_status_api" {
  count         = var.use_localstack ? 0 : 1
  name          = "job-status-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  count       = var.use_localstack ? 0 : 1
  api_id      = aws_apigatewayv2_api.job_status_api[0].id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "submit_job_integration" {
  count              = var.use_localstack ? 0 : 1
  api_id             = aws_apigatewayv2_api.job_status_api[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.submit_lambda.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "submit_job_route" {
  count     = var.use_localstack ? 0 : 1
  api_id    = aws_apigatewayv2_api.job_status_api[0].id
  route_key = "POST /jobs"
  target    = "integrations/${aws_apigatewayv2_integration.submit_job_integration[0].id}"
}

resource "aws_lambda_permission" "submit_job_permission" {
  count         = var.use_localstack ? 0 : 1
  statement_id  = "allow_submit_job"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.submit_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.job_status_api[0].execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "getJobStatus_integration" {
  count              = var.use_localstack ? 0 : 1
  api_id             = aws_apigatewayv2_api.job_status_api[0].id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.getJobStatus_lambda.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "getJobStatus_route" {
  count     = var.use_localstack ? 0 : 1
  api_id    = aws_apigatewayv2_api.job_status_api[0].id
  route_key = "GET /jobs/{jobId}"
  target    = "integrations/${aws_apigatewayv2_integration.getJobStatus_integration[0].id}"
}

resource "aws_lambda_permission" "getJobStatus_permission" {
  count         = var.use_localstack ? 0 : 1
  statement_id  = "allow_getJobStatus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.getJobStatus_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.job_status_api[0].execution_arn}/*/*"
}
