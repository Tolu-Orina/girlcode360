# Phase 2.2: EventBridge → same API Lambda (not a second engine).
# Notifications every 15 minutes; HealthLens monthly; deletion/wallet purge daily.

resource "aws_cloudwatch_event_rule" "notifications" {
  name                = "girlcode360-notifications-${var.environment}"
  schedule_expression = "rate(15 minutes)"
}

resource "aws_cloudwatch_event_target" "notifications" {
  rule      = aws_cloudwatch_event_rule.notifications.name
  target_id = "api"
  arn       = aws_lambda_function.api.arn
  input     = jsonencode({ source = "girlcode360.scheduler", detail = { kind = "notifications" } })
}

resource "aws_cloudwatch_event_rule" "healthlens_monthly" {
  name                = "girlcode360-healthlens-monthly-${var.environment}"
  schedule_expression = "cron(0 6 1 * ? *)"
}

resource "aws_cloudwatch_event_target" "healthlens_monthly" {
  rule      = aws_cloudwatch_event_rule.healthlens_monthly.name
  target_id = "api"
  arn       = aws_lambda_function.api.arn
  input     = jsonencode({ source = "girlcode360.scheduler", detail = { kind = "healthlens_monthly" } })
}

resource "aws_cloudwatch_event_rule" "purge_daily" {
  name                = "girlcode360-purge-daily-${var.environment}"
  schedule_expression = "cron(0 4 * * ? *)"
}

resource "aws_cloudwatch_event_target" "purge_daily" {
  rule      = aws_cloudwatch_event_rule.purge_daily.name
  target_id = "api"
  arn       = aws_lambda_function.api.arn
  input     = jsonencode({ source = "girlcode360.scheduler", detail = { kind = "purge" } })
}

resource "aws_lambda_permission" "events_notifications" {
  statement_id  = "AllowEventBridgeNotifications"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.notifications.arn
}

resource "aws_lambda_permission" "events_healthlens" {
  statement_id  = "AllowEventBridgeHealthLens"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.healthlens_monthly.arn
}

resource "aws_lambda_permission" "events_purge" {
  statement_id  = "AllowEventBridgePurge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.purge_daily.arn
}
