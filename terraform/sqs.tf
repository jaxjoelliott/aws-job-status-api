

resource "aws_sqs_queue" "job_queue_dev_dlq" {
  name = "job-queue-dev-dlq"
}

resource "aws_sqs_queue" "job_queue_dev" {
  name = "job-queue-dev"
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.job_queue_dev_dlq.arn
    maxReceiveCount     = 3
  })
}