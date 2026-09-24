import { ModelRegistry } from "../models/registry.ts";
import { ModelRouter } from "../models/router.ts";
import { ProviderRegistry } from "../providers/registry.ts";
import { detectHardwareProfile } from "../hardware/detector.ts";
import { getConfig } from "../config/loader.ts";
import type { AppConfig } from "../config/types.ts";
import type { HardwareProfile } from "../hardware/types.ts";
import type { ModelMetadata, ModelRoutingRequest } from "../models/types.ts";
import type { LLMProvider, ChatCompletionRequest, ChatCompletionResponse, ChatChunk } from "../providers/types.ts";
import { ModelNotFoundError, ProviderError } from "../core/errors/index.ts";

export class ModelRuntime {
  public readonly registry: ModelRegistry;
  public readonly router: ModelRouter;
  public readonly providers: ProviderRegistry;
  public readonly hardware: HardwareProfile;
  public readonly config: AppConfig;

  private activeModelOverride?: string;

  constructor(options?: {
    registry?: ModelRegistry;
    providers?: ProviderRegistry;
    hardware?: HardwareProfile;
    config?: AppConfig;
  }) {
    this.config = options?.config ?? getConfig();
    this.hardware = options?.hardware ?? detectHardwareProfile();
    this.providers = options?.providers ?? ProviderRegistry.fromConfig(this.config);
    this.registry = options?.registry ?? new ModelRegistry();
    this.router = new ModelRouter(this.registry, this.hardware, this.config);
  }

  // Initialize runtime by discovering models across all providers
  async initialize(): Promise<ModelMetadata[]> {
    return this.registry.discover(this.providers.list());
  }

  // Manually set or pin active model ID or alias (pass "auto" to unpin)
  setActiveModel(idOrAlias: string): ModelMetadata {
    if (idOrAlias === "auto") {
      this.activeModelOverride = undefined;
      return this.resolveModel();
    }

    const matched = this.registry.get(idOrAlias);
    if (!matched) {
      throw new ModelNotFoundError(idOrAlias, this.registry.list().map((m) => m.id));
    }
    this.activeModelOverride = matched.id;
    return matched;
  }

  // Get current active model override or "auto"
  getActiveModelId(): string {
    return this.activeModelOverride || this.config.runtime.pinnedModelId || "auto";
  }

  // Resolve model based on routing request and active override
  resolveModel(req: ModelRoutingRequest = {}): ModelMetadata {
    const effectiveReq: ModelRoutingRequest = {
      ...req,
      userSpecifiedModel: req.userSpecifiedModel || this.activeModelOverride,
    };
    return this.router.select(effectiveReq);
  }

  // Get matching provider instance for a model
  getProvider(model: ModelMetadata): LLMProvider {
    const provider = this.providers.get(model.provider);
    if (!provider) {
      throw new ProviderError(
        `Provider "${model.provider}" for model "${model.id}" is not available`,
        model.provider,
      );
    }
    return provider;
  }

  // Execute chat completion on resolved model and provider
  async chat(
    request: Omit<ChatCompletionRequest, "modelId"> & { modelRequest?: ModelRoutingRequest },
  ): Promise<ChatCompletionResponse & { resolvedModel: ModelMetadata }> {
    const model = this.resolveModel(request.modelRequest);
    const provider = this.getProvider(model);

    const res = await provider.chat({
      ...request,
      modelId: model.id,
    });

    return {
      ...res,
      resolvedModel: model,
    };
  }

  // Execute streaming completion on resolved model and provider
  async *stream(
    request: Omit<ChatCompletionRequest, "modelId"> & { modelRequest?: ModelRoutingRequest },
  ): AsyncIterable<ChatChunk & { resolvedModel: ModelMetadata }> {
    const model = this.resolveModel(request.modelRequest);
    const provider = this.getProvider(model);

    for await (const chunk of provider.stream({ ...request, modelId: model.id })) {
      yield {
        ...chunk,
        resolvedModel: model,
      };
    }
  }

  // List all models currently registered in catalog
  listModels(): ModelMetadata[] {
    return this.registry.list();
  }

  // Force refresh model discovery from live providers
  async refreshModels(): Promise<ModelMetadata[]> {
    return this.registry.refresh(this.providers.list());
  }
}

// Global runtime singleton
let _globalRuntime: ModelRuntime | null = null;

export function getModelRuntime(): ModelRuntime {
  if (!_globalRuntime) {
    _globalRuntime = new ModelRuntime();
  }
  return _globalRuntime;
}
