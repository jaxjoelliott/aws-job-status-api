resource "aws_lambda_function" "submit_lambda" {
  function_name = "submit-lambda"
  role          = aws_iam_role.submit_lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"

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
  handler       = "index.handler"
  runtime       = "nodejs20.x"

  filename      = "${path.module}/../lambda/worker.zip"
  timeout = 30

  source_code_hash = filebase64sha256("${path.module}/../lambda/worker.zip")
    environment {
      variables = {
        TABLE_NAME = aws_dynamodb_table.jobs.name
  }
}
}
