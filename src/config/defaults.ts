import path from "node:path";
import type { AppConfig } from "./types.ts";

// Standard default configuration
export const DEFAULT_CONFIG: AppConfig = {
  runtime: {
    modelSelection: "auto",
    pinnedModelId: undefined,
    thinkingEffort: "auto",
    personaId: "default",
  },
  providers: {
    ollama: {
      baseUrl: "http://localhost:11434",
      enabled: true,
      timeoutMs: 60000,
    },
    openaiCompatible: {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "",
      enabled: true,
    },
  },
  hardware: {
    maxVramUsageRatio: 0.85,
  },
  security: {
    sandboxAllowed: true,
    permissionsConfigPath: path.resolve(process.cwd(), ".agents", "permissions.json"),
  },
};
