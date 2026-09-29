from openai import OpenAI
import ollama

from app.core.ai_config import (
    AI_PROVIDER_ORDER,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    GROQ_API_KEY,
    GROQ_BASE_URL,
    GROQ_MODEL,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    OPENROUTER_MODEL,
)
from app.services.research_service import search_web


def _ask_ollama(prompt: str) -> str:
    client = ollama.Client(host=OLLAMA_BASE_URL)

    response = client.chat(
        model=OLLAMA_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response["message"]["content"]

    if not content:
        raise RuntimeError("Ollama returned an empty response.")

    return content


def _ask_cloud(
    prompt: str,
    api_key: str,
    base_url: str,
    model: str,
) -> str:
    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=60.0,
    )

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.choices[0].message.content

    if not content:
        raise RuntimeError("The AI provider returned an empty response.")

    return content


def generate_ai_response(prompt: str) -> dict:
    sources = search_web(prompt, max_results=5)

    if sources:
        source_context = "\n\n".join(
            (
                f"Source {index}:\n"
                f"Title: {source.get('title', '')}\n"
                f"URL: {source.get('url', '')}\n"
                f"Snippet: {source.get('snippet', '')}"
            )
            for index, source in enumerate(sources, start=1)
        )

        research_prompt = (
            f"{prompt}\n\n"
            "Use the following web search results as supporting material. "
            "Do not claim that you visited or verified the full pages. "
            "Use only information supported by the provided snippets. "
            "Mention uncertainty where the snippets are insufficient. "
            "Refer to sources by their numbered labels.\n\n"
            f"{source_context}"
        )
    else:
        research_prompt = (
            f"{prompt}\n\n"
            "No web search results were available. Do not invent sources "
            "or claim that web research was performed."
        )

    providers = {
        "ollama": lambda: _ask_ollama(research_prompt),
        "groq": lambda: _ask_cloud(
            research_prompt,
            GROQ_API_KEY,
            GROQ_BASE_URL,
            GROQ_MODEL,
        ),
        "openrouter": lambda: _ask_cloud(
            research_prompt,
            OPENROUTER_API_KEY,
            OPENROUTER_BASE_URL,
            OPENROUTER_MODEL,
        ),
    }

    errors = []

    for provider_name in AI_PROVIDER_ORDER:
        provider = providers.get(provider_name)

        if provider is None:
            errors.append(f"{provider_name}: Unsupported provider")
            continue

        if provider_name == "groq" and not GROQ_API_KEY:
            errors.append("groq: API key is not configured")
            continue

        if provider_name == "openrouter" and not OPENROUTER_API_KEY:
            errors.append("openrouter: API key is not configured")
            continue

        try:
            result = provider()

            return {
                "success": True,
                "provider": provider_name,
                "response": result,
                "sources": sources,
                "error": None,
            }

        except Exception as exc:
            errors.append(f"{provider_name}: {str(exc)}")

    return {
        "success": False,
        "provider": None,
        "response": None,
        "sources": sources,
        "error": "All AI providers failed. " + " | ".join(errors),
    }