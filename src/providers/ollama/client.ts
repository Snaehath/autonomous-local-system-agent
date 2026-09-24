import type {
  LLMProvider,
  ProviderModelListing,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatChunk,
} from "../types.ts";
import { ProviderError } from "../../core/errors/index.ts";

export class OllamaProvider implements LLMProvider {
  public readonly id = "ollama";
  public readonly name = "Ollama Local Runtime";

  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly timeoutMs: number = 60000,
  ) {}

  // Check if Ollama daemon is reachable
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Discover installed models via Ollama /api/tags
  async listRawModels(): Promise<ProviderModelListing[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new ProviderError(`Failed to fetch models from Ollama (${res.status})`, this.id, res.status);
      }
      const data: any = await res.json();
      const rawList = Array.isArray(data.models) ? data.models : [];

      return rawList.map((m: any) => ({
        id: m.name || m.model,
        name: m.name || m.model,
        sizeBytes: m.size,
        parameterSize: m.details?.parameter_size,
        quantization: m.details?.quantization_level,
        family: m.details?.family,
        rawDetails: m.details,
      }));
    } catch (e: any) {
      if (e instanceof ProviderError) throw e;
      return [];
    }
  }

  // Inspect model architecture, context length, and template via /api/show
  async inspectModel(modelId: string): Promise<Record<string, any> | undefined> {
    try {
      const res = await fetch(`${this.baseUrl}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelId }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return undefined;
      return await res.json();
    } catch {
      return undefined;
    }
  }

  // Send non-streaming chat completion to Ollama
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const body: Record<string, any> = {
      model: request.modelId,
      messages: request.messages,
      stream: false,
    };
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }
    if (request.temperature !== undefined) {
      body.options = { temperature: request.temperature };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new ProviderError(`Ollama chat error (${res.status}): ${errorText}`, this.id, res.status);
      }

      const data: any = await res.json();
      return {
        content: data.message?.content || "",
        thinking: data.message?.thinking,
        toolCalls: data.message?.tool_calls,
        finishReason: data.done_reason || "stop",
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (e: any) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(`Ollama request failed: ${e.message}`, this.id);
    }
  }

  // Stream tokens from Ollama /api/chat via NDJSON
  async *stream(request: ChatCompletionRequest): AsyncIterable<ChatChunk> {
    const body: Record<string, any> = {
      model: request.modelId,
      messages: request.messages,
      stream: true,
    };
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok || !res.body) {
      throw new ProviderError(`Ollama stream error: ${res.statusText}`, this.id, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            yield {
              content: parsed.message?.content,
              thinking: parsed.message?.thinking,
              toolCallDelta: parsed.message?.tool_calls,
            };
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
