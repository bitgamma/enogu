"""Tests for image utilities."""

import pytest
from PIL import Image

from app.utils import resize_image_for_llm, encode_image_to_base64
from app.config import MAX_LLM_IMAGE_PIXELS


class TestResizeImageForLLM:
    """Tests for image resizing for LLM processing."""

    def test_no_resize_below_limit(self) -> None:
        """Images below the pixel limit should not be resized."""
        img = Image.new("RGB", (100, 100))  # 10,000 pixels
        result = resize_image_for_llm(img)
        assert result.size == (100, 100)

    def test_resize_above_limit(self) -> None:
        """Images above the pixel limit should be resized."""
        img = Image.new("RGB", (2000, 2000))  # 4,000,000 pixels
        result = resize_image_for_llm(img)
        assert result.size[0] * result.size[1] <= MAX_LLM_IMAGE_PIXELS

    def test_preserve_aspect_ratio(self) -> None:
        """Resizing should preserve aspect ratio."""
        img = Image.new("RGB", (2000, 1000))  # 2:1 ratio
        result = resize_image_for_llm(img)
        # Check that the ratio is approximately preserved
        original_ratio = img.size[0] / img.size[1]
        result_ratio = result.size[0] / result.size[1]
        assert abs(original_ratio - result_ratio) < 0.01

    def test_minimum_dimensions(self) -> None:
        """Resized dimensions should be at least 1x1."""
        img = Image.new("RGB", (10000, 1))  # Very narrow
        result = resize_image_for_llm(img)
        assert result.size[0] >= 1
        assert result.size[1] >= 1


class TestEncodeImageToBase64:
    """Tests for image encoding to base64."""

    def test_encode_returns_string(self) -> None:
        img = Image.new("RGB", (100, 100), color="red")
        result = encode_image_to_base64(img)
        assert isinstance(result, str)

    def test_encode_is_valid_base64(self) -> None:
        import base64

        img = Image.new("RGB", (100, 100), color="blue")
        result = encode_image_to_base64(img)
        # Should not raise - validates it's proper base64
        base64.b64decode(result)
