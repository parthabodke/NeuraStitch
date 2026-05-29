# nextgen-core/backend/providers.py
from typing import List, Dict, Generator
import google.genai as genai
from google.genai import types
from openai import OpenAI


def call_gemini(model: str, messages: List[Dict[str, str]], api_key: str, stream: bool = False):
    """
    Ephemerally instantiates the Google GenAI SDK and performs text content generation.
    Supports real-time token streaming.
    """
    client = genai.Client(api_key=api_key)
    
    system_instructions = []
    contents = []
    
    for m in messages:
        role = m["role"].lower()
        content = m["content"]
        
        if role == "system":
            system_instructions.append(content)
        elif role == "system_summary":
            # Inject long-term archived memories as custom system instructions
            system_instructions.append(f"[LONG-TERM MEMORY ARCHIVE]: {content}")
        elif role == "user":
            contents.append({"role": "user", "parts": [{"text": content}]})
        elif role in ["assistant", "model"]:
            contents.append({"role": "model", "parts": [{"text": content}]})
            
    config = types.GenerateContentConfig(
        system_instruction="\n\n".join(system_instructions) if system_instructions else None,
        temperature=0.7
    )
    
    clean_model = model.replace("models/", "")
    
    if stream:
        def generator() -> Generator[str, None, None]:
            try:
                response_stream = client.models.generate_content_stream(
                    model=clean_model,
                    contents=contents,
                    config=config
                )
                for chunk in response_stream:
                    if chunk.text:
                        yield chunk.text
            except Exception as e:
                yield f"\n[Gemini Streaming Error]: {str(e)}"
        return generator()
    else:
        try:
            resp = client.models.generate_content(
                model=clean_model,
                contents=contents,
                config=config
            )
            return resp.text.strip()
        except Exception as e:
            raise RuntimeError(f"Gemini API Error: {str(e)}")


def call_openai(model: str, messages: List[Dict[str, str]], api_key: str, base_url: str = None, stream: bool = False):
    """
    Ephemerally instantiates the OpenAI SDK (or custom compatible endpoints like Groq/OpenRouter)
    and queries model chat completions. Supports real-time token streaming.
    """
    if base_url:
        client = OpenAI(api_key=api_key, base_url=base_url)
    else:
        client = OpenAI(api_key=api_key)
    
    openai_messages = []
    for m in messages:
        role = m["role"].lower()
        content = m["content"]
        
        if role == "system":
            openai_messages.append({"role": "system", "content": content})
        elif role == "system_summary":
            openai_messages.append({"role": "system", "content": f"[LONG-TERM MEMORY]: {content}"})
        elif role in ["assistant", "model"]:
            openai_messages.append({"role": "assistant", "content": content})
        else:
            openai_messages.append({"role": "user", "content": content})
            
    if stream:
        def generator() -> Generator[str, None, None]:
            try:
                # Add OpenRouter identification headers if calling OpenRouter
                extra_headers = {}
                if base_url and "openrouter.ai" in base_url:
                    extra_headers = {
                        "HTTP-Referer": "https://neurastitch.ai",
                        "X-Title": "NeuraStitch AI"
                    }
                
                response = client.chat.completions.create(
                    model=model,
                    messages=openai_messages,
                    temperature=0.7,
                    stream=True,
                    extra_headers=extra_headers if extra_headers else None
                )
                for chunk in response:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        yield delta.content
            except Exception as e:
                yield f"\n[Streaming Error]: {str(e)}"
        return generator()
    else:
        try:
            extra_headers = {}
            if base_url and "openrouter.ai" in base_url:
                extra_headers = {
                    "HTTP-Referer": "https://neurastitch.ai",
                    "X-Title": "NeuraStitch AI"
                }
            resp = client.chat.completions.create(
                model=model,
                messages=openai_messages,
                temperature=0.7,
                extra_headers=extra_headers if extra_headers else None
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            raise RuntimeError(f"API Error: {str(e)}")


def call_model_stream(active_model: str, messages: List[Dict[str, str]], keys: Dict[str, str]) -> Generator[str, None, None]:
    """
    Dynamic routing pipeline that extracts dynamic credentials and streams output.
    Supports Gemini, OpenAI, Groq, and OpenRouter.
    """
    name = active_model.lower().strip()
    
    # 1. OpenRouter (Signified by '/' in model name, e.g. 'google/gemini-2.5-flash')
    if "/" in active_model:
        if not keys.get("openrouter"):
            raise ValueError("OpenRouter API Key is missing from headers.")
        return call_openai(active_model, messages, keys["openrouter"], base_url="https://openrouter.ai/api/v1", stream=True)
        
    # 2. Gemini native
    elif name.startswith("gemini"):
        if not keys.get("gemini"):
            raise ValueError("Google Gemini API Key is missing from headers.")
        return call_gemini(active_model, messages, keys["gemini"], stream=True)
        
    # 3. Groq native models
    elif any(b in name for b in ["llama", "mixtral", "gemma2"]) and keys.get("groq"):
        return call_openai(active_model, messages, keys["groq"], base_url="https://api.groq.com/openai/v1", stream=True)
        
    # 4. OpenAI native
    elif name.startswith("gpt") or "openai" in name:
        if not keys.get("openai"):
            raise ValueError("OpenAI API Key is missing from headers.")
        return call_openai(active_model, messages, keys["openai"], stream=True)
        
    # Fallback routing
    else:
        if keys.get("openrouter"):
            return call_openai(active_model, messages, keys["openrouter"], base_url="https://openrouter.ai/api/v1", stream=True)
        elif keys.get("gemini"):
            return call_gemini(active_model, messages, keys["gemini"], stream=True)
        elif keys.get("groq"):
            return call_openai(active_model, messages, keys["groq"], base_url="https://api.groq.com/openai/v1", stream=True)
        elif keys.get("openai"):
            return call_openai(active_model, messages, keys["openai"], stream=True)
        else:
            raise ValueError("No active API Key header matches the requested model.")


def call_model_sync(active_model: str, messages: List[Dict[str, str]], keys: Dict[str, str]) -> str:
    """
    Dynamic routing pipeline for synchronous backend operations.
    Supports Gemini, OpenAI, Groq, and OpenRouter.
    """
    name = active_model.lower().strip()
    
    # 1. OpenRouter
    if "/" in active_model:
        if not keys.get("openrouter"):
            raise ValueError("OpenRouter API Key is missing.")
        return call_openai(active_model, messages, keys["openrouter"], base_url="https://openrouter.ai/api/v1", stream=False)
        
    # 2. Gemini native
    elif name.startswith("gemini"):
        if not keys.get("gemini"):
            raise ValueError("Google Gemini API Key is missing.")
        return call_gemini(active_model, messages, keys["gemini"], stream=False)
        
    # 3. Groq
    elif any(b in name for b in ["llama", "mixtral", "gemma2"]) and keys.get("groq"):
        return call_openai(active_model, messages, keys["groq"], base_url="https://api.groq.com/openai/v1", stream=False)
        
    # 4. OpenAI
    elif name.startswith("gpt") or "openai" in name:
        if not keys.get("openai"):
            raise ValueError("OpenAI API Key is missing.")
        return call_openai(active_model, messages, keys["openai"], stream=False)
        
    else:
        if keys.get("openrouter"):
            return call_openai(active_model, messages, keys["openrouter"], base_url="https://openrouter.ai/api/v1", stream=False)
        elif keys.get("gemini"):
            return call_gemini(active_model, messages, keys["gemini"], stream=False)
        elif keys.get("groq"):
            return call_openai(active_model, messages, keys["groq"], base_url="https://api.groq.com/openai/v1", stream=False)
        elif keys.get("openai"):
            return call_openai(active_model, messages, keys["openai"], stream=False)
        else:
            raise ValueError("No active API Key credential matches the requested model.")

