"""Tests for validation utilities."""

import pytest
from fastapi import HTTPException

from app.utils import (
    validate_name,
    validate_name_or_raise,
)


class TestValidateName:
    """Tests for name validation."""

    def test_valid_alphanumeric(self) -> None:
        assert validate_name("test_profile") is True
        assert validate_name("Test123") is True
        assert validate_name("test-profile") is True

    def test_invalid_with_spaces(self) -> None:
        assert validate_name("test profile") is False

    def test_invalid_with_special_chars(self) -> None:
        assert validate_name("test/profile") is False
        assert validate_name("test..profile") is False
        assert validate_name("../etc") is False

    def test_empty_string(self) -> None:
        assert validate_name("") is False


class TestValidateNameOrRaise:
    """Tests for name validation with exception raising."""

    def test_valid_name_no_exception(self) -> None:
        validate_name_or_raise("test_profile", "test")
        # No exception raised

    def test_none_raises_exception(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            validate_name_or_raise(None, "test")
        assert exc_info.value.status_code == 400

    def test_invalid_name_raises_exception(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            validate_name_or_raise("test/profile", "test")
        assert exc_info.value.status_code == 400
