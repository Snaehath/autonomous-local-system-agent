// Model technical capabilities
export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  tools: boolean;
  thinking: boolean;
  reasoning: boolean;
  maxContextLength: number;
}

// Memory source classification
export type MemoryEstimateSource = "provider" | "heuristic" | "measured" | "unknown";

// Normalized model metadata
export interface ModelMetadata {
  id: string;
  displayName: string;
  provider: "ollama" | "openai" | "mock";
  parameterSize?: string;
  quantization?: string;
  vramEstimatedMb?: number;
  estimatedMemoryMb?: number;
  memoryEstimateSource?: MemoryEstimateSource;
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

// Single candidate evaluation trace in routing decisions
export interface ModelCandidateEvaluation {
  modelId: string;
  displayName: string;
  accepted: boolean;
  reasons: string[];
}

// Trace of a routing decision for explainability and diagnostics
export interface ModelSelectionTrace {
  timestamp: number;
  strategy: string;
  requirements: {
    vision: boolean;
    tools: boolean;
    thinking: boolean;
    minContextTokens?: number;
  };
  taskRequirements: {
    requiresVision?: boolean;
    requiresTools?: boolean;
    requiresReasoning?: boolean;
    minContextTokens?: number;
  };
  candidates: ModelCandidateEvaluation[];
  selectedModel?: string;
  selectedModelId: string;
  reason: string;
  selectionReason: string;
}

