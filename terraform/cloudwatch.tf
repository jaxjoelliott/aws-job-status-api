resource "aws_sns_topic" "dlq_alarm" {
  name = "job-queue-dlq-alarm"
}

resource "aws_sns_topic_subscription" "dlq_alarm_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.dlq_alarm.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "dlq_alarm" {
  alarm_name          = "dlq_alarm"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  threshold           = 1
  statistic           = "Sum"
  alarm_actions       = [aws_sns_topic.dlq_alarm.arn]

  dimensions = {
    QueueName = aws_sqs_queue.job_queue_dev_dlq.name
  }

}
