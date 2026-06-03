resource "aws_cloudwatch_metric_alarm" "dlq_alarm" {
  alarm_name           = "dlq_alarm"
  comparison_operator  = "GreaterThanOrEqualToThreshold"
  evaluation_periods   = 1
  metric_name          = "ApproximateNumberOfMessagesVisible"
  namespace            = "AWS/SQS"
  period               = 60
  threshold            = 1
  statistic            = "Sum"

 dimensions = {
  QueueName = aws_sqs_queue.job_queue_dev_dlq.name
}

}
