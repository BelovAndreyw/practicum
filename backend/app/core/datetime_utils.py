from datetime import datetime, timezone


def to_naive_utc(value: datetime | None) -> datetime | None:
    """PostgreSQL TIMESTAMP WITHOUT TIME ZONE ожидает naive UTC."""
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value
