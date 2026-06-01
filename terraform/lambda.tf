resource "aws_lambda_function" "submit_lambda" {
  function_name = "submit-lambda"
  role          = aws_iam_role.submit_lambda_role.arn
  handler       = "submit.handler"
  runtime       = "nodejs22.x"

  filename      = "${path.module}/../lambda/submit.zip"

  source_code_hash = filebase64sha256("${path.module}/../lambda/submit.zip")
    environment {
      variables = {
        QUEUE_URL  = aws_sqs_queue.job_queue_dev.url
        TABLE_NAME = aws_dynamodb_table.jobs.name
  }
}
}

resource "aws_lambda_function" "worker_lambda" {
  function_name = "worker-lambda"
  role          = aws_iam_role.worker_lambda_role.arn
  handler       = "worker.handler"
  runtime       = "nodejs22.x"

  filename      = "${path.module}/../lambda/worker.zip"
  timeout = 30

  source_code_hash = filebase64sha256("${path.module}/../lambda/worker.zip")
    environment {
      variables = {
        TABLE_NAME = aws_dynamodb_table.jobs.name
  }
}
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.job_queue_dev.arn
  function_name    = aws_lambda_function.worker_lambda.arn
  batch_size       = 1
  enabled          = true
}
