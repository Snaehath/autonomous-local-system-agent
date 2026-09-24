import type {
  LLMProvider,
  ProviderModelListing,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatChunk,
} from "../types.ts";

export class MockProvider implements LLMProvider {
  public readonly id = "mock";
  public readonly name = "Mock Offline Provider";

  private queuedResponses: Array<Partial<ChatCompletionResponse>> = [];

  private availableModels: ProviderModelListing[];

  constructor(availableModels?: ProviderModelListing[]) {
    this.availableModels = availableModels
      ? [...availableModels]
      : [
          {
            id: "mock-coding:3b",
            name: "Mock Coding 3B",
            parameterSize: "3B",
            quantization: "Q4_K_M",
            sizeBytes: 2.2 * 1024 * 1024 * 1024,
          },
          {
            id: "mock-vision:4b",
            name: "Mock Vision 4B",
            parameterSize: "4B",
            quantization: "Q4_K_M",
            sizeBytes: 3.4 * 1024 * 1024 * 1024,
          },
        ];
  }

  enqueueResponse(res: Partial<ChatCompletionResponse>): void {
    this.queuedResponses.push(res);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async listRawModels(): Promise<ProviderModelListing[]> {
    return [...this.availableModels];
  }

  async inspectModel(modelId: string): Promise<Record<string, any> | undefined> {
    return {
      model: modelId,
      capabilities: modelId.includes("vision") ? ["vision", "tools"] : ["tools", "reasoning"],
    };
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const next = this.queuedResponses.shift();
    return {
      content: next?.content ?? `Completed prompt with ${request.modelId}`,
      thinking: next?.thinking,
      toolCalls: next?.toolCalls,
      finishReason: next?.finishReason ?? "stop",
    };
  }

  async *stream(request: ChatCompletionRequest): AsyncIterable<ChatChunk> {
    const res = await this.chat(request);
    if (res.thinking) {
      yield { thinking: res.thinking };
    }
    const words = res.content.split(" ");
    for (const w of words) {
      yield { content: w + " " };
    }
    if (res.toolCalls && res.toolCalls.length > 0) {
      yield { toolCallDelta: res.toolCalls[0] };
    }
  }
}
