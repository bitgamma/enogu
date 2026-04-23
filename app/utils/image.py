"""Image processing utilities."""

import base64
import io

from PIL import Image

from app.config import MAX_LLM_IMAGE_PIXELS


def resize_image_for_llm(
    image: Image.Image, max_pixels: int = MAX_LLM_IMAGE_PIXELS
) -> Image.Image:
    """
    Resize image to no more than max_pixels while preserving aspect ratio.
    Does not upscale smaller images.
    """
    width, height = image.size
    current_pixels = width * height

    # Don't upscale if already below the limit
    if current_pixels <= max_pixels:
        return image

    # Calculate new dimensions preserving aspect ratio
    new_width = int(width * (max_pixels / current_pixels) ** 0.5)
    new_height = int(height * (max_pixels / current_pixels) ** 0.5)

    # Ensure dimensions are at least 1
    new_width = max(1, new_width)
    new_height = max(1, new_height)

    return image.resize((new_width, new_height), Image.Resampling.LANCZOS)


def encode_image_to_base64(image: Image.Image) -> str:
    """Encode a PIL Image to base64 string."""
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")
