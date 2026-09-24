// Model technical capabilities
export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  tools: boolean;
  reasoning: boolean;
  maxContextLength: number;
}

// Normalized model metadata
export interface ModelMetadata {
  id: string;
  displayName: string;
  provider: "ollama" | "openai" | "mock";
  parameterSize?: string;
  quantization?: string;
  vramEstimatedMb?: number;
  capabilities: ModelCapabilities;
  curatedRoles?: Array<"coding" | "reasoning" | "agent" | "general" | "vision">;
  aliases: string[];
}

// Routing request constraints for model selection
export interface ModelRoutingRequest {
  requiresVision?: boolean;
  requiresTools?: boolean;
  requiresReasoning?: boolean;
  minContextTokens?: number;
  strategy?: "auto" | "pinned" | "fastest" | "smallest" | "vision" | "reasoning";
  userSpecifiedModel?: string;
}
