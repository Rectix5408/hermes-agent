"""Configuration-value validation used during agent initialization."""

import pytest

from agent.agent_init_validation import positive_int


@pytest.mark.parametrize(
    ("raw", "reject", "expected"),
    [
        ("42", (), 42),
        (0, (), None),
        ("invalid", (), None),
        (True, (bool, float), None),
        (3.5, (bool, float), None),
    ],
)
def test_positive_int_preserves_agent_init_config_validation(raw, reject, expected):
    assert positive_int(raw, reject=reject) == expected
