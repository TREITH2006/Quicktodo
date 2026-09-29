import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(BACKEND_ENV_FILE)

# Local Ollama
OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL",
    "http://localhost:11434",
)
OLLAMA_MODEL = os.getenv(
    "OLLAMA_MODEL",
    "qwen3-vl:8b",
)

# Groq cloud fallback
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

# OpenRouter secondary fallback
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")

# Provider order: local first, then cloud
AI_PROVIDER_ORDER = ["ollama", "groq", "openrouter"]