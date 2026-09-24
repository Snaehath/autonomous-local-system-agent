import { DEFAULT_CONFIG } from "./defaults.ts";
import type { AppConfig, ModelSelectionStrategy, ThinkingEffort } from "./types.ts";

let _cachedConfig: AppConfig | null = null;

// Parse model selection strategy from string
function parseModelSelection(raw?: string): { strategy: ModelSelectionStrategy; pinnedId?: string } {
  if (!raw) return { strategy: "auto" };
  const lower = raw.trim().toLowerCase();
  if (lower === "auto") return { strategy: "auto" };
  if (["fastest", "smallest", "best-context", "vision", "reasoning"].includes(lower)) {
    return { strategy: lower as ModelSelectionStrategy };
  }
  return { strategy: "pinned", pinnedId: raw.trim() };
}

// Parse thinking effort from string
function parseThinkingEffort(raw?: string): ThinkingEffort {
  if (!raw) return "auto";
  const lower = raw.trim().toLowerCase();
  if (["off", "low", "medium", "high", "auto"].includes(lower)) {
    return lower as ThinkingEffort;
  }
  return "auto";
}

// Load and validate environment configuration once
export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const envModel = process.env.MODEL_SELECTION || process.env.MODEL;
  const { strategy, pinnedId } = parseModelSelection(envModel);

  const ollamaBaseUrl =
    process.env.OLLAMA_BASE_URL ||
    (process.env.OPENROUTER_BASE_URL?.includes("11434")
      ? process.env.OPENROUTER_BASE_URL.replace(/\/v1\/?$/, "")
      : DEFAULT_CONFIG.providers.ollama.baseUrl);

  const openrouterBaseUrl =
    process.env.OPENROUTER_BASE_URL || DEFAULT_CONFIG.providers.openaiCompatible.baseUrl;
  const openrouterApiKey =
    process.env.OPENROUTER_API_KEY ?? "";

  const config: AppConfig = {
    runtime: {
      modelSelection: overrides?.runtime?.modelSelection ?? strategy,
      pinnedModelId: overrides?.runtime?.pinnedModelId ?? pinnedId,
      thinkingEffort: overrides?.runtime?.thinkingEffort ?? parseThinkingEffort(process.env.THINKING_EFFORT),
      personaId: overrides?.runtime?.personaId ?? process.env.PERSONA ?? DEFAULT_CONFIG.runtime.personaId,
    },
    providers: {
      ollama: {
        baseUrl: overrides?.providers?.ollama?.baseUrl ?? ollamaBaseUrl,
        enabled: overrides?.providers?.ollama?.enabled ?? true,
        timeoutMs: overrides?.providers?.ollama?.timeoutMs ?? DEFAULT_CONFIG.providers.ollama.timeoutMs,
      },
      openaiCompatible: {
        baseUrl: overrides?.providers?.openaiCompatible?.baseUrl ?? openrouterBaseUrl,
        apiKey: overrides?.providers?.openaiCompatible?.apiKey ?? openrouterApiKey,
        enabled: overrides?.providers?.openaiCompatible?.enabled ?? true,
      },
    },
    hardware: {
      maxVramUsageRatio:
        overrides?.hardware?.maxVramUsageRatio ?? DEFAULT_CONFIG.hardware.maxVramUsageRatio,
    },
    security: {
      sandboxAllowed:
        overrides?.security?.sandboxAllowed ?? DEFAULT_CONFIG.security.sandboxAllowed,
      permissionsConfigPath:
        overrides?.security?.permissionsConfigPath ?? DEFAULT_CONFIG.security.permissionsConfigPath,
    },
  };

  _cachedConfig = config;
  return config;
}

// Get cached application configuration
export function getConfig(): AppConfig {
  if (!_cachedConfig) {
    return loadConfig();
  }
  return _cachedConfig;
}
