"""Small validation helpers used while initializing an agent."""

from __future__ import annotations

from typing import Any, Optional


def positive_int(raw: Any, *, reject: tuple = ()) -> Optional[int]:
    """``int(raw)`` when positive, else None. ``reject`` lists types refused outright."""
    if reject and isinstance(raw, reject):
        return None
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None
