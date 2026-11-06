# On-call Runbook

## Alert: PaymentsHandlerErrorRate

1. Check the provider status page first; most spikes are upstream.
2. If the provider is healthy, look for `TimeoutError` in handler logs.
3. If timeouts exceed 5% for 10 minutes, set `use_new_ledger` to false and page the ledger owner.

## Alert: RefundQueueBacklog

1. Confirm the refund worker is running (`kubectl get pods -l app=refund-worker`).
2. If the backlog is over 10,000 items, scale the worker to 6 replicas.
