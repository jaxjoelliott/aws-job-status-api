

resource "aws_sqs_queue" "job_queue_dev_dlq" {
  name = "job-queue-dev-dlq"
}

resource "aws_sqs_queue" "job_queue_dev" {
  name = "job-queue-dev"
  # Must exceed the worker Lambda timeout; AWS recommends ~6x.
  visibility_timeout_seconds = 180
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.job_queue_dev_dlq.arn
    maxReceiveCount     = 3
  })
}