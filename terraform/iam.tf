resource "aws_iam_role" "submit_lambda_role" {
  name = "submit-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

}


resource "aws_iam_policy" "submit_lambda_policy" {
  name        = "submit-lambda-policy"
  path        = "/"
  description = "Policy for submit Lambda to allow PutItem and sendMessage"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:PutItem"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.jobs.arn
      },
      {
        Action = [
          "sqs:SendMessage"
        ]
        Effect   = "Allow"
        Resource = aws_sqs_queue.job_queue_dev.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "submit_lambda_attach" {
  role       = aws_iam_role.submit_lambda_role.name
  policy_arn = aws_iam_policy.submit_lambda_policy.arn
}

resource "aws_iam_role_policy_attachment" "submit_lambda_basic_execution" {
  role       = aws_iam_role.submit_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role" "worker_lambda_role" {
  name = "worker-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "worker_lambda_policy" {
  name        = "worker-lambda-policy"
  path        = "/"
  description = "Policy for worker Lambda to allow GetItem, PutItem, ReceiveMessage, and DeleteMessage"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.jobs.arn
      },
      {
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Effect   = "Allow"
        Resource = aws_sqs_queue.job_queue_dev.arn
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "worker_lambda_attach" {
  role       = aws_iam_role.worker_lambda_role.name
  policy_arn = aws_iam_policy.worker_lambda_policy.arn
}

resource "aws_iam_role_policy_attachment" "worker_lambda_basic_execution" {
  role       = aws_iam_role.worker_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
