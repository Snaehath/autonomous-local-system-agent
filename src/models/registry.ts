import type { LLMProvider } from "../providers/types.ts";
import type { ModelMetadata } from "./types.ts";
import {
  normalizeOllamaModel,
  generateModelAliases,
  detectCapabilities,
  estimateVramMb,
} from "./discovery/ollama.ts";

export class ModelRegistry {
  private models: Map<string, ModelMetadata> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private lastDiscovered: number = 0;

  // Discover and cache models across available providers
  async discover(providers: LLMProvider[], forceRefresh = false): Promise<ModelMetadata[]> {
    const now = Date.now();
    // Cache for 60 seconds unless explicitly refreshed
    if (!forceRefresh && this.models.size > 0 && now - this.lastDiscovered < 60000) {
      return this.list();
    }

    this.models.clear();
    this.aliasMap.clear();

    for (const provider of providers) {
      try {
        const available = await provider.isAvailable();
        if (!available) continue;

        const rawList = await provider.listRawModels();
        for (const raw of rawList) {
          let inspectData: Record<string, any> | undefined;
          if (provider.inspectModel) {
            inspectData = await provider.inspectModel(raw.id);
          }

          const metadata: ModelMetadata =
            provider.id === "ollama"
              ? normalizeOllamaModel(raw, inspectData)
              : {
                  id: raw.id,
                  displayName: raw.name || raw.id,
                  provider: provider.id as any,
                  parameterSize: raw.parameterSize || "Unknown",
                  quantization: raw.quantization || "Unknown",
                  vramEstimatedMb: estimateVramMb(raw.parameterSize, raw.quantization),
                  capabilities: detectCapabilities(raw.id, inspectData),
                  curatedRoles: ["general"],
                  aliases: generateModelAliases(raw.id),
                };

          this.register(metadata);
        }
      } catch {
        // Continue discovering other providers
      }
    }

    this.lastDiscovered = now;
    return this.list();
  }

  // Register a single model metadata entry
  register(model: ModelMetadata): void {
    this.models.set(model.id, model);
    for (const alias of model.aliases) {
      this.aliasMap.set(alias.toLowerCase(), model.id);
    }
  }

  // Lookup model by exact ID or alias
  get(idOrAlias: string): ModelMetadata | undefined {
    const trimmed = idOrAlias.trim();
    if (this.models.has(trimmed)) {
      return this.models.get(trimmed);
    }
    const resolvedId = this.aliasMap.get(trimmed.toLowerCase());
    if (resolvedId && this.models.has(resolvedId)) {
      return this.models.get(resolvedId);
    }
    return undefined;
  }

  // List all registered models
  list(): ModelMetadata[] {
    return Array.from(this.models.values());
  }

  // Refresh discovery cache immediately
  async refresh(providers: LLMProvider[]): Promise<ModelMetadata[]> {
    return this.discover(providers, true);
  }

  // Total count of registered models
  get count(): number {
    return this.models.size;
  }
}
