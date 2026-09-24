import OpenAI from "openai";
import type {
  LLMProvider,
  ProviderModelListing,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatChunk,
} from "../types.ts";
import { ProviderError } from "../../core/errors/index.ts";

export class OpenAICompatibleProvider implements LLMProvider {
  public readonly id = "openai";
  public readonly name = "OpenAI-Compatible Runtime";
  private client: OpenAI;

  constructor(
    private readonly baseUrl: string = "https://openrouter.ai/api/v1",
    private readonly apiKey: string = "",
  ) {
    this.client = new OpenAI({
      baseURL: this.baseUrl,
      apiKey: this.apiKey || "dummy-key",
    });
  }

  // Check if endpoint is accessible
  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.client.models.list();
      return Boolean(res);
    } catch {
      return false;
    }
  }

  // List models exposed by OpenAI-compatible endpoint
  async listRawModels(): Promise<ProviderModelListing[]> {
    try {
      const list = await this.client.models.list();
      const rawList: any[] = (list as any).data || [];
      return rawList.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length,
      }));
    } catch {
      return [];
    }
  }

  // Non-streaming completion
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const payload: any = {
        model: request.modelId,
        messages: request.messages,
        tools: request.tools,
        stream: false,
      };
      if (request.temperature !== undefined) payload.temperature = request.temperature;

      const res = await this.client.chat.completions.create(payload);
      const choice = res.choices[0];
      return {
        content: choice?.message?.content || "",
        toolCalls: choice?.message?.tool_calls,
        finishReason: choice?.finish_reason || "stop",
        usage: res.usage
          ? {
              promptTokens: res.usage.prompt_tokens,
              completionTokens: res.usage.completion_tokens,
              totalTokens: res.usage.total_tokens,
            }
          : undefined,
      };
    } catch (e: any) {
      throw new ProviderError(`OpenAI request failed: ${e.message}`, this.id, e.status);
    }
  }

  // Streaming completion
  async *stream(request: ChatCompletionRequest): AsyncIterable<ChatChunk> {
    try {
      const payload: any = {
        model: request.modelId,
        messages: request.messages,
        tools: request.tools,
        stream: true,
      };
      if (request.temperature !== undefined) payload.temperature = request.temperature;

      const stream = (await this.client.chat.completions.create(payload)) as unknown as AsyncIterable<any>;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        yield {
          content: delta?.content || "",
          thinking: (delta as any)?.reasoning_content || (delta as any)?.thinking,
          toolCallDelta: delta?.tool_calls,
        };
      }
    } catch (e: any) {
      throw new ProviderError(`OpenAI stream failed: ${e.message}`, this.id, e.status);
    }
  }
}
