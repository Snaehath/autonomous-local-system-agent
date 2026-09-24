// Raw model listing returned by a provider
export interface ProviderModelListing {
  id: string;
  name?: string;
  sizeBytes?: number;
  parameterSize?: string;
  quantization?: string;
  family?: string;
  contextLength?: number;
  rawDetails?: Record<string, any>;
}

// Uniform chat message
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | any[];
  tool_call_id?: string;
  tool_calls?: any[];
}

// Uniform chat completion request sent to any LLMProvider
export interface ChatCompletionRequest {
  modelId: string;
  messages: ChatMessage[];
  tools?: any[];
  temperature?: number;
  thinking?: {
    enabled: boolean;
    effort?: "off" | "low" | "medium" | "high" | "auto";
  };
}

// Single streaming delta chunk
export interface ChatChunk {
  content?: string;
  thinking?: string;
  toolCallDelta?: any;
}

// Chat completion response
export interface ChatCompletionResponse {
  content: string;
  thinking?: string;
  toolCalls?: any[];
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Uniform LLM Provider interface
export interface LLMProvider {
  readonly id: string;
  readonly name: string;

  // Check if provider server/endpoint is reachable
  isAvailable(): Promise<boolean>;

  // List all models installed or accessible on provider
  listRawModels(): Promise<ProviderModelListing[]>;

  // Inspect raw details for a specific model (e.g. Ollama /api/show)
  inspectModel?(modelId: string): Promise<Record<string, any> | undefined>;

  // Non-streaming completion
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  // Streaming completion
  stream(request: ChatCompletionRequest): AsyncIterable<ChatChunk>;
}
