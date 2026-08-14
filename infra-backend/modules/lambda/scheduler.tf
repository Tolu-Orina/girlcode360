# EventBridge → dedicated worker Lambdas (not the HTTP identity function).

resource "aws_cloudwatch_event_rule" "notifications" {
  name                = "girlcode360-notifications-${var.environment}"
  schedule_expression = "rate(15 minutes)"
}

resource "aws_cloudwatch_event_target" "notifications" {
  rule      = aws_cloudwatch_event_rule.notifications.name
  target_id = "notify-tick"
  arn       = aws_lambda_function.fn["notify-tick"].arn
  input     = jsonencode({ source = "girlcode360.scheduler", detail = { kind = "notifications" } })
}

resource "aws_cloudwatch_event_rule" "healthlens_monthly" {
  name                = "girlcode360-healthlens-monthly-${var.environment}"
  schedule_expression = "cron(0 6 1 * ? *)"
}

resource "aws_cloudwatch_event_target" "healthlens_monthly" {
  rule      = aws_cloudwatch_event_rule.healthlens_monthly.name
  target_id = "healthlens-monthly"
  arn       = aws_lambda_function.fn["healthlens-monthly"].arn
  input     = jsonencode({ source = "girlcode360.scheduler", detail = { kind = "healthlens_monthly" } })
}

resource "aws_cloudwatch_event_rule" "purge_daily" {
  name                = "girlcode360-purge-daily-${var.environment}"
  schedule_expression = "cron(0 4 * * ? *)"
}

resource "aws_cloudwatch_event_target" "purge_daily" {
  rule      = aws_cloudwatch_event_rule.purge_daily.name
  target_id = "purge"
  arn       = aws_lambda_function.fn["purge"].arn
  input     = jsonencode({ source = "girlcode360.scheduler", detail = { kind = "purge" } })
}

resource "aws_lambda_permission" "events_notifications" {
  statement_id  = "AllowEventBridgeNotifications"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn["notify-tick"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.notifications.arn
}

resource "aws_lambda_permission" "events_healthlens" {
  statement_id  = "AllowEventBridgeHealthLens"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn["healthlens-monthly"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.healthlens_monthly.arn
}

resource "aws_lambda_permission" "events_purge" {
  statement_id  = "AllowEventBridgePurge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fn["purge"].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.purge_daily.arn
}
