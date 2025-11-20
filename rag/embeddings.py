"""Embedding helpers wrapping the OpenAI API."""
from __future__ import annotations

from typing import List

import numpy as np
from openai import OpenAI

from . import config

_client = OpenAI(api_key=config.OPENAI_API_KEY)


def embed_texts(texts: List[str]) -> np.ndarray:
    """Embed a batch of texts into a float32 numpy matrix.

    Args:
        texts: Collection of strings to embed.

    Returns:
        Array shaped (n_texts, embedding_dim) with dtype float32.
        Returns an empty (0, 0) array if no texts are provided.
    """

    if not texts:
        return np.zeros((0, 0), dtype=np.float32)

    response = _client.embeddings.create(model=config.EMBED_MODEL, input=texts)
    matrix = np.array([item.embedding for item in response.data], dtype=np.float32)
    return matrix
