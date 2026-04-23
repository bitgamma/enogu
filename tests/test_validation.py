"""Tests for validation utilities."""

import pytest

from app.utils import (
    PARAM_HANDLERS,
    apply_mappings,
    validate_profile_name,
    validate_profile_name_or_raise,
)
from fastapi import HTTPException


class TestValidateProfileName:
    """Tests for profile name validation."""

    def test_valid_alphanumeric(self) -> None:
        assert validate_profile_name("test_profile") is True
        assert validate_profile_name("Test123") is True
        assert validate_profile_name("test-profile") is True

    def test_invalid_with_spaces(self) -> None:
        assert validate_profile_name("test profile") is False

    def test_invalid_with_special_chars(self) -> None:
        assert validate_profile_name("test/profile") is False
        assert validate_profile_name("test..profile") is False
        assert validate_profile_name("../etc") is False

    def test_empty_string(self) -> None:
        assert validate_profile_name("") is False


class TestValidateProfileNameOrRaise:
    """Tests for profile name validation with exception raising."""

    def test_valid_name_no_exception(self) -> None:
        validate_profile_name_or_raise("test_profile", "test")
        # No exception raised

    def test_none_raises_exception(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            validate_profile_name_or_raise(None, "test")
        assert exc_info.value.status_code == 400

    def test_invalid_name_raises_exception(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            validate_profile_name_or_raise("test/profile", "test")
        assert exc_info.value.status_code == 400


class TestApplyMappings:
    """Tests for parameter mapping application."""

    def test_apply_prompt_mapping(self) -> None:
        workflow = {"node1": {"inputs": {"text": "original"}}}
        mappings = {"prompt": "node1"}
        result = apply_mappings(workflow, mappings, "new prompt", 1024, 1024, -1, False, 1024)
        assert result["node1"]["inputs"]["text"] == "new prompt"

    def test_apply_seed_mapping(self) -> None:
        workflow = {"node1": {"inputs": {"seed": 0}}}
        mappings = {"seed": "node1"}
        result = apply_mappings(workflow, mappings, "prompt", 1024, 1024, 42, False, 1024)
        assert result["node1"]["inputs"]["seed"] == 42

    def test_apply_resolution_mapping(self) -> None:
        workflow = {"node1": {"inputs": {"width": 512, "height": 512}}}
        mappings = {"resolution": "node1"}
        result = apply_mappings(workflow, mappings, "prompt", 768, 1024, -1, False, 1024)
        assert result["node1"]["inputs"]["width"] == 768
        assert result["node1"]["inputs"]["height"] == 1024

    def test_apply_upscaler_switch_mapping(self) -> None:
        workflow = {"node1": {"inputs": {"switch": 0}}}
        mappings = {"upscaler_switch": "node1"}
        result = apply_mappings(workflow, mappings, "prompt", 1024, 1024, -1, True, 2048)
        assert result["node1"]["inputs"]["switch"] is True

    def test_missing_node_ignored(self) -> None:
        workflow = {"node1": {"inputs": {"text": "original"}}}
        mappings = {"prompt": "nonexistent_node"}
        result = apply_mappings(workflow, mappings, "new prompt", 1024, 1024, -1, False, 1024)
        assert result["node1"]["inputs"]["text"] == "original"

    def test_workflow_is_deep_copied(self) -> None:
        workflow = {"node1": {"inputs": {"text": "original"}}}
        mappings = {"prompt": "node1"}
        result = apply_mappings(workflow, mappings, "new prompt", 1024, 1024, -1, False, 1024)
        assert workflow["node1"]["inputs"]["text"] == "original"
        assert result["node1"]["inputs"]["text"] == "new prompt"
