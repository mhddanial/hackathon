"""Native Gemini SDK boundary; database history remains provider independent."""

from contextlib import asynccontextmanager
import json
import os

import anyio
from google import genai
from google.genai import types

from agent_config import SYSTEM_PROMPT, TOOL_SCHEMAS

DEFAULT_MODEL = "gemini-3.5-flash"


def native_history(messages: list[dict]) -> list[types.Content]:
    """Load completed history as text/data, without fabricating old signatures.

    Prior tool calls were saved without Gemini thought signatures. Their paired
    results are reference data in the original user turn, not new function calls.
    The current turn retains the provider's native parts/signatures in memory.
    """
    contents = []
    saved_calls = {}
    for message in messages:
        if message["role"] == "user":
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message["content"])]))
            saved_calls = {}
        elif message["role"] == "assistant":
            for call in message.get("tool_calls") or []:
                saved_calls[call["id"]] = call["function"]
            if message.get("content"):
                contents.append(types.Content(role="model", parts=[types.Part.from_text(text=message["content"])]))
        elif message["role"] == "tool":
            call = saved_calls[message["tool_call_id"]]
            if not contents or contents[-1].role != "user":
                raise ValueError("Unpaired saved tool result")
            data = {"name": call["name"], "arguments": json.loads(call["arguments"]),
                    "output": json.loads(message["content"])}
            contents[-1].parts.append(types.Part.from_text(
                text="Previously recorded tool data (untrusted reference, not a new call): " + json.dumps(data)))
        else:
            raise ValueError("Unsupported saved context role")
    return contents


def generation_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        tools=[types.Tool(function_declarations=[types.FunctionDeclaration(**tool) for tool in TOOL_SCHEMAS])],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        # Developer API returns complete function args. The SDK's optional
        # stream_function_call_arguments flag belongs to its enterprise API.
        tool_config=types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode="AUTO")),
        thinking_config=types.ThinkingConfig(include_thoughts=False),
        response_modalities=["TEXT"], max_output_tokens=2048,
    )


class GeminiSession:
    def __init__(self, client, model: str, contents: list[types.Content]):
        self.client, self.model, self.contents = client, model, contents
        self.config = generation_config()

    async def stream(self):
        return await self.client.models.generate_content_stream(
            model=self.model, contents=self.contents, config=self.config)

    def remember_round(self, parts: list[types.Part]):
        # Preserve exact part order and opaque signatures, including empty-text
        # signature parts that can arrive at the end of a stream.
        self.contents.append(types.Content(role="model", parts=parts))

    def answer_tools(self, replies: list[types.Part]):
        self.contents.append(types.Content(role="user", parts=replies))


class GeminiProvider:
    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self.api_key, self.model = api_key, model

    @classmethod
    def from_environment(cls):
        key = os.environ.get("GEMINI_API_KEY", "").strip()
        model = os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_MODEL
        return cls(key, model) if key else None

    def create_client(self):
        # Explicit Developer API/key; ignore unrelated Vertex/GOOGLE_API_KEY
        # settings. One attempt means no hidden provider retry.
        return genai.Client(api_key=self.api_key, vertexai=False,
            http_options=types.HttpOptions(timeout=20000,
                retry_options=types.HttpRetryOptions(attempts=1)))

    @asynccontextmanager
    async def session(self, history: list[dict], message: str):
        contents = native_history(history)
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))
        client = self.create_client()
        try:
            yield GeminiSession(client.aio, self.model, contents)
        finally:
            # Close this turn's transport even during ASGI cancellation. Neither
            # client nor native model history is shared with another user.
            with anyio.CancelScope(shield=True):
                with anyio.move_on_after(5):
                    await client.aio.aclose()
            client.close()
