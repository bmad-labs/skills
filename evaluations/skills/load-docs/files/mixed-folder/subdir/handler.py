"""Payment handler: retries provider calls using the schedule in config.yaml."""

import time

REFUND_WINDOW_DAYS = 180


def charge(provider, request, backoff=(1, 5, 30, 120)):
    for attempt, delay in enumerate(backoff, start=1):
        try:
            return provider.charge(request)
        except TimeoutError:
            if attempt == len(backoff):
                raise
            time.sleep(delay)


def can_refund(age_days: int) -> bool:
    return age_days <= REFUND_WINDOW_DAYS
