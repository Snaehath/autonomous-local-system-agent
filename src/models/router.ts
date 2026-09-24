import type { ModelRegistry } from "./registry.ts";
import type { ModelMetadata, ModelRoutingRequest } from "./types.ts";
import type { HardwareProfile } from "../hardware/types.ts";
import type { AppConfig } from "../config/types.ts";
import { ModelNotFoundError } from "../core/errors/index.ts";

export class ModelRouter {
  constructor(
    private readonly registry: ModelRegistry,
    private readonly hardware: HardwareProfile,
    private readonly config: AppConfig,
  ) {}

  // Select the optimal model matching task requirements, hardware profile, and user preferences
  select(req: ModelRoutingRequest = {}): ModelMetadata {
    const allModels = this.registry.list();
    if (allModels.length === 0) {
      throw new ModelNotFoundError("No models registered or discovered in registry", []);
    }

    // 1. Explicit user request (e.g. CLI flag or /model command) takes top priority
    if (req.userSpecifiedModel && req.userSpecifiedModel !== "auto") {
      const match = this.registry.get(req.userSpecifiedModel);
      if (match) return match;
      throw new ModelNotFoundError(req.userSpecifiedModel, allModels.map((m) => m.id));
    }

    // Check pinned model from config; if installed, use it; otherwise fallback to auto-selection
    if (this.config.runtime.modelSelection === "pinned" && this.config.runtime.pinnedModelId) {
      const pinnedMatch = this.registry.get(this.config.runtime.pinnedModelId);
      if (pinnedMatch) return pinnedMatch;
    }

    // 2. Filter by required technical capabilities
    let candidates = allModels.filter((m) => {
      if (req.requiresVision && !m.capabilities.vision) return false;
      if (req.requiresTools && !m.capabilities.tools) return false;
      if (req.requiresReasoning && !m.capabilities.reasoning) return false;
      if (req.minContextTokens && m.capabilities.maxContextLength < req.minContextTokens) return false;
      return true;
    });

    // If requirements are too strict (e.g. no installed model has vision), fallback to all models
    if (candidates.length === 0) {
      candidates = allModels;
    }

    // 3. Filter/rank by hardware VRAM capacity
    const totalVramMb = this.hardware.gpu?.totalVramMB || 0;
    const maxUsableVramMb = totalVramMb * this.config.hardware.maxVramUsageRatio;

    // Separate models that fit completely into VRAM from those requiring system RAM spill
    const fitsInVram = totalVramMb > 0
      ? candidates.filter((m) => (m.vramEstimatedMb || 3000) <= maxUsableVramMb)
      : [];

    const viablePool = fitsInVram.length > 0 ? fitsInVram : candidates;

    // 4. Rank candidates based on selection strategy
    const strategy = req.strategy || this.config.runtime.modelSelection;

    viablePool.sort((a, b) => {
      // Smallest / Fastest strategy: prioritize lowest VRAM / smallest parameters
      if (strategy === "fastest" || strategy === "smallest") {
        return (a.vramEstimatedMb || 0) - (b.vramEstimatedMb || 0);
      }

      // Vision strategy: prioritize vision models
      if (strategy === "vision") {
        if (a.capabilities.vision !== b.capabilities.vision) {
          return a.capabilities.vision ? -1 : 1;
        }
      }

      // Reasoning strategy: prioritize reasoning models
      if (strategy === "reasoning") {
        if (a.capabilities.reasoning !== b.capabilities.reasoning) {
          return a.capabilities.reasoning ? -1 : 1;
        }
      }

      // Auto / Default strategy: prefer coding/agent models that fit within hardware
      const aScore = (a.curatedRoles?.includes("coding") ? 2 : 0) + (a.curatedRoles?.includes("agent") ? 2 : 0) + (a.capabilities.tools ? 1 : 0);
      const bScore = (b.curatedRoles?.includes("coding") ? 2 : 0) + (b.curatedRoles?.includes("agent") ? 2 : 0) + (b.capabilities.tools ? 1 : 0);

      if (aScore !== bScore) return bScore - aScore;

      // Prefer models closest to target VRAM capacity without overflowing
      return (b.vramEstimatedMb || 0) - (a.vramEstimatedMb || 0);
    });

    return viablePool[0] || allModels[0];
  }
}
