# Changelog

## 1.3.0
- Added exponential backoff schedule (see `config.yaml`).
- Handler now rejects refunds older than 180 days.

## 1.2.1
- Fixed double-charge when the provider timed out after accepting the payment.

## 1.2.0
- First release with the on-call runbook.
