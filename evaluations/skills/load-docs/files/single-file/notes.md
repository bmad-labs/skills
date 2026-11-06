# Team Notes: Q3 Planning

## Decisions

- The billing service migrates from cron jobs to a queue worker by September 15.
- Feature flags move from the config file to the flag service; owner is Priya.
- The public API keeps v1 alive until March 31 next year, then returns 410 Gone.

## Open questions

1. Do we need a separate staging database for the reporting team?
2. Who owns the on-call rotation for the new queue worker?

## Numbers to remember

- p95 checkout latency target: 450 ms
- Error budget: 0.1% of requests per 30 days
- Last incident review count: 7
