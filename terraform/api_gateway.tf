resource "aws_apigatewayv2_api" "job_status_api" {
  name          = "job-status-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.job_status_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "submit_job_integration" {
  api_id      = aws_apigatewayv2_api.job_status_api.id
  integration_type = "AWS_PROXY"
  integration_uri = aws_lambda_function.submit_lambda.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "submit_job_route" {
  api_id      = aws_apigatewayv2_api.job_status_api.id
  route_key   = "POST /jobs"
  target      = "integrations/${aws_apigatewayv2_integration.submit_job_integration.id}"
}

resource "aws_lambda_permission" "submit_job_permission" {
  statement_id  = "allow_submit_job"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.submit_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.job_status_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "getJobStatus_integration" {
  api_id      = aws_apigatewayv2_api.job_status_api.id
  integration_type = "AWS_PROXY"
  integration_uri = aws_lambda_function.getJobStatus_lambda.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "getJobStatus_route" {
  api_id      = aws_apigatewayv2_api.job_status_api.id
  route_key   = "GET /jobs/{jobId}"
  target      = "integrations/${aws_apigatewayv2_integration.getJobStatus_integration.id}"
}

resource "aws_lambda_permission" "getJobStatus_permission" {
  statement_id  = "allow_getJobStatus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.getJobStatus_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.job_status_api.execution_arn}/*/*"
}
