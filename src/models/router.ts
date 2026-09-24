import type { ModelRegistry } from "./registry.ts";
import type { ModelMetadata, ModelRoutingRequest, ModelSelectionTrace, ModelCandidateEvaluation } from "./types.ts";
import type { HardwareProfile } from "../hardware/types.ts";
import type { AppConfig } from "../config/types.ts";
import { ModelNotFoundError } from "../core/errors/index.ts";

export class ModelRouter {
  private lastTrace?: ModelSelectionTrace;

  constructor(
    private readonly registry: ModelRegistry,
    private readonly hardware: HardwareProfile,
    private readonly config: AppConfig,
  ) {}

  // Get the most recent routing decision trace
  getLastTrace(): ModelSelectionTrace | undefined {
    return this.lastTrace;
  }

  // Explain routing decision for a given request without necessarily running it
  explain(req: ModelRoutingRequest = {}): ModelSelectionTrace {
    this.select(req);
    return this.lastTrace!;
  }

  // Select the optimal model matching task requirements, hardware profile, and user preferences
  select(req: ModelRoutingRequest = {}): ModelMetadata {
    const allModels = this.registry.list();
    if (allModels.length === 0) {
      throw new ModelNotFoundError("No models registered or discovered in registry", []);
    }

    const candidateEvaluations: ModelCandidateEvaluation[] = [];

    // 1. Explicit user request (e.g. CLI flag or /model command) takes top priority
    if (req.userSpecifiedModel && req.userSpecifiedModel !== "auto") {
      const match = this.registry.get(req.userSpecifiedModel);
      if (match) {
        this.lastTrace = {
          timestamp: Date.now(),
          strategy: "explicit-user-override",
          taskRequirements: req,
          candidates: [{ modelId: match.id, displayName: match.displayName, accepted: true, reasons: ["Explicit user selection"] }],
          selectedModelId: match.id,
          selectionReason: `Explicitly chosen by user: ${req.userSpecifiedModel}`,
        };
        return match;
      }
      throw new ModelNotFoundError(req.userSpecifiedModel, allModels.map((m) => m.id));
    }

    // Check pinned model from config; if installed, use it; otherwise fallback to auto-selection
    if (this.config.runtime.modelSelection === "pinned" && this.config.runtime.pinnedModelId) {
      const pinnedMatch = this.registry.get(this.config.runtime.pinnedModelId);
      if (pinnedMatch) {
        this.lastTrace = {
          timestamp: Date.now(),
          strategy: "pinned-configuration",
          taskRequirements: req,
          candidates: [{ modelId: pinnedMatch.id, displayName: pinnedMatch.displayName, accepted: true, reasons: ["Pinned in configuration"] }],
          selectedModelId: pinnedMatch.id,
          selectionReason: `Configured as pinned model in settings`,
        };
        return pinnedMatch;
      }
    }

    // 2. Filter by required technical capabilities with strict validation
    const totalVramMb = this.hardware.gpu?.totalVramMB || 0;
    const maxUsableVramMb = totalVramMb * this.config.hardware.maxVramUsageRatio;

    const acceptedCandidates: ModelMetadata[] = [];

    for (const m of allModels) {
      const reasons: string[] = [];
      let accepted = true;

      if (req.requiresVision && !m.capabilities.vision) {
        reasons.push("Lacks vision capability");
        accepted = false;
      } else if (req.requiresVision) {
        reasons.push("Vision supported");
      }

      if (req.requiresTools && !m.capabilities.tools) {
        reasons.push("Lacks tool calling support");
        accepted = false;
      } else if (req.requiresTools) {
        reasons.push("Tools supported");
      }

      if (req.requiresReasoning && !m.capabilities.reasoning && !m.capabilities.thinking) {
        reasons.push("Lacks thinking/reasoning capability");
        accepted = false;
      } else if (req.requiresReasoning) {
        reasons.push("Reasoning supported");
      }

      if (req.minContextTokens && m.capabilities.maxContextLength < req.minContextTokens) {
        reasons.push(`Context (${m.capabilities.maxContextLength}) below required (${req.minContextTokens})`);
        accepted = false;
      }

      const memMb = m.estimatedMemoryMb || m.vramEstimatedMb || 3000;
      if (totalVramMb > 0 && memMb <= maxUsableVramMb) {
        reasons.push(`Fits in GPU VRAM (~${(memMb / 1024).toFixed(1)} GB / ${(totalVramMb / 1024).toFixed(1)} GB)`);
      } else if (totalVramMb > 0) {
        reasons.push(`Exceeds VRAM headroom (~${(memMb / 1024).toFixed(1)} GB); requires RAM offload`);
      }

      candidateEvaluations.push({
        modelId: m.id,
        displayName: m.displayName,
        accepted,
        reasons,
      });

      if (accepted) {
        acceptedCandidates.push(m);
      }
    }

    // If a strict requirement was requested and zero models satisfy it, fail fast with a clear error
    if (req.requiresVision && acceptedCandidates.length === 0) {
      throw new ModelNotFoundError("No installed models support vision/multimodal input", allModels.map((m) => m.id));
    }
    if (req.requiresTools && acceptedCandidates.length === 0) {
      throw new ModelNotFoundError("No installed models support function/tool calling", allModels.map((m) => m.id));
    }

    const viableCandidates = acceptedCandidates.length > 0 ? acceptedCandidates : allModels;

    // 3. Separate models that fit completely into VRAM from those requiring system RAM spill
    const fitsInVram = totalVramMb > 0
      ? viableCandidates.filter((m) => (m.estimatedMemoryMb || m.vramEstimatedMb || 3000) <= maxUsableVramMb)
      : [];

    const viablePool = fitsInVram.length > 0 ? fitsInVram : viableCandidates;

    // 4. Rank candidates deterministically based on selection strategy
    const strategy = req.strategy || this.config.runtime.modelSelection;

    viablePool.sort((a, b) => {
      const aMem = a.estimatedMemoryMb || a.vramEstimatedMb || 0;
      const bMem = b.estimatedMemoryMb || b.vramEstimatedMb || 0;

      // Smallest / Fastest strategy: prioritize lowest VRAM
      if (strategy === "fastest" || strategy === "smallest") {
        if (aMem !== bMem) return aMem - bMem;
      }

      // Vision strategy: prioritize vision models
      if (strategy === "vision") {
        if (a.capabilities.vision !== b.capabilities.vision) {
          return a.capabilities.vision ? -1 : 1;
        }
      }

      // Reasoning strategy: prioritize reasoning models
      if (strategy === "reasoning") {
        const aReasoning = a.capabilities.reasoning || a.capabilities.thinking;
        const bReasoning = b.capabilities.reasoning || b.capabilities.thinking;
        if (aReasoning !== bReasoning) {
          return aReasoning ? -1 : 1;
        }
      }

      // Auto / Default strategy: prefer coding/agent models that fit within hardware
      const aScore = (a.curatedRoles?.includes("coding") ? 2 : 0) + (a.curatedRoles?.includes("agent") ? 2 : 0) + (a.capabilities.tools ? 1 : 0);
      const bScore = (b.curatedRoles?.includes("coding") ? 2 : 0) + (b.curatedRoles?.includes("agent") ? 2 : 0) + (b.capabilities.tools ? 1 : 0);

      if (aScore !== bScore) return bScore - aScore;

      // Prefer models closest to target VRAM capacity without overflowing
      if (bMem !== aMem) return bMem - aMem;

      // Deterministic tie-breaker: sort alphabetically by ID
      return a.id.localeCompare(b.id);
    });

    const selected = viablePool[0] || allModels[0];

    this.lastTrace = {
      timestamp: Date.now(),
      strategy,
      taskRequirements: req,
      candidates: candidateEvaluations,
      selectedModelId: selected.id,
      selectionReason: `Optimal candidate under strategy '${strategy}' matching hardware and capability requirements`,
    };

    return selected;
  }
}
