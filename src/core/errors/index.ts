// Base error class for all agent domain errors
export abstract class AgentError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// Thrown when configuration is invalid or missing
export class ConfigurationError extends AgentError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
  }
}

// Thrown when an LLM provider fails to communicate or returns error
export class ProviderError extends AgentError {
  constructor(message: string, public readonly providerId: string, public readonly statusCode?: number) {
    super(message, "PROVIDER_ERROR");
  }
}

// Thrown when a requested model is not found in registry or installed
export class ModelNotFoundError extends AgentError {
  constructor(public readonly modelId: string, public readonly availableModels: string[] = []) {
    super(
      `Model "${modelId}" is not available or installed.${
        availableModels.length > 0 ? ` Available models: ${availableModels.join(", ")}` : ""
      }`,
      "MODEL_NOT_FOUND",
    );
  }
}

// Thrown when a tool execution fails
export class ToolError extends AgentError {
  constructor(public readonly toolName: string, message: string) {
    super(`Tool "${toolName}" failed: ${message}`, "TOOL_ERROR");
  }
}

// Thrown when permission to execute a tool or access a path is denied
export class PermissionError extends AgentError {
  constructor(public readonly toolName: string, public readonly target: string) {
    super(`Permission denied to execute "${toolName}" on "${target}".`, "PERMISSION_DENIED");
  }
}

// Thrown when user or model parameters fail validation
export class ValidationError extends AgentError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}
