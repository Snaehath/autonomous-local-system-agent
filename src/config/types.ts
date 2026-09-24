// Model selection strategies
export type ModelSelectionStrategy =
  | "auto"
  | "pinned"
  | "fastest"
  | "smallest"
  | "best-context"
  | "vision"
  | "reasoning";

// Thinking reasoning effort level
export type ThinkingEffort = "off" | "low" | "medium" | "high" | "auto";

// Ollama provider config
export interface OllamaProviderConfig {
  baseUrl: string;
  enabled: boolean;
  timeoutMs: number;
}

// OpenAI-compatible provider config
export interface OpenAICompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

// Full application configuration
export interface AppConfig {
  runtime: {
    modelSelection: ModelSelectionStrategy;
    pinnedModelId?: string;
    thinkingEffort: ThinkingEffort;
    personaId?: string;
    sessionId?: string;
  };
  providers: {
    ollama: OllamaProviderConfig;
    openaiCompatible: OpenAICompatibleProviderConfig;
  };
  hardware: {
    maxVramUsageRatio: number;
  };
  security: {
    sandboxAllowed: boolean;
    permissionsConfigPath: string;
  };
}
