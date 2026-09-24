import type { ProviderModelListing } from "../../providers/types.ts";
import type { ModelMetadata, ModelCapabilities } from "../types.ts";

// Estimate VRAM consumption in MB based on parameter size and quantization
export function estimateVramMb(paramSize?: string, quant?: string): number {
  if (!paramSize) return 3000;
  const match = paramSize.match(/([0-9.]+)\s*([BMK])/i);
  if (!match) return 3000;

  const count = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const billions = unit === "B" ? count : unit === "M" ? count / 1000 : 1;

  // Approximate bytes per parameter: Q4 ~ 0.6 GB/B, Q8 ~ 1.0 GB/B, FP16 ~ 2.0 GB/B + 600MB runtime overhead
  const isQ4 = !quant || /q4/i.test(quant);
  const bytesPerParam = isQ4 ? 0.65 : 1.1;
  const estimatedGb = billions * bytesPerParam + 0.6;
  return Math.round(estimatedGb * 1024);
}

// Generate sensible aliases for a model ID
export function generateModelAliases(modelId: string): string[] {
  const aliases = new Set<string>();
  const [base, tag] = modelId.toLowerCase().split(":");
  const simpleBase = base.split("/").pop() || base;

  aliases.add(simpleBase);
  if (tag) {
    aliases.add(`${simpleBase}:${tag}`);
    const noDotTag = tag.replace(/\./g, "");
    aliases.add(`${simpleBase}${noDotTag}`);
  }

  // Model family aliases
  if (simpleBase.includes("granite")) {
    aliases.add("granite");
    aliases.add("ibm");
  } else if (simpleBase.includes("qwen")) {
    aliases.add("qwen");
    aliases.add("alibaba");
  } else if (simpleBase.includes("gemma")) {
    aliases.add("gemma");
    aliases.add("google");
  } else if (simpleBase.includes("ministral") || simpleBase.includes("mistral")) {
    aliases.add("ministral");
    aliases.add("mistral");
  } else if (simpleBase.includes("fable") || simpleBase.includes("parable")) {
    aliases.add("fable");
  } else if (simpleBase.includes("lfm") || simpleBase.includes("liquid")) {
    aliases.add("lfm");
    aliases.add("liquid");
  }

  return Array.from(aliases);
}

// Detect capabilities from model ID and optional raw inspect data
export function detectCapabilities(
  modelId: string,
  rawInspect?: Record<string, any>,
): ModelCapabilities {
  const lower = modelId.toLowerCase();
  const template = String(rawInspect?.template || "");
  const modelfile = String(rawInspect?.modelfile || "");

  // Vision detection
  const hasVision =
    /\b(gemma3|qwen3\.5|ministral|llava|vision|vl|clip|omni)\b/i.test(lower) ||
    /vision|image/i.test(modelfile);

  // Reasoning / thinking detection
  const hasReasoning =
    /\b(granite4|fable|deepseek|r1|qwq|reasoning|think)\b/i.test(lower) ||
    /<think>/i.test(template) ||
    /<think>/i.test(modelfile);

  // Tool use detection
  const hasTools =
    !/\b(base|instruct-unaligned|whisper|embed)\b/i.test(lower);

  // Context length detection
  const contextLength =
    Number(rawInspect?.model_info?.["llama.context_length"] ||
      rawInspect?.model_info?.["context_length"] ||
      rawInspect?.parameters?.num_ctx ||
      16384);

  return {
    text: true,
    vision: hasVision,
    tools: hasTools,
    thinking: hasReasoning,
    reasoning: hasReasoning,
    maxContextLength: contextLength,
  };
}

// Normalize a raw model listing into ModelMetadata
export function normalizeOllamaModel(
  listing: ProviderModelListing,
  rawInspect?: Record<string, any>,
): ModelMetadata {
  const id = listing.id;
  const paramSize = listing.parameterSize || listing.rawDetails?.parameter_size || "4B";
  const quant = listing.quantization || listing.rawDetails?.quantization_level || "Q4_K_M";
  const capabilities = detectCapabilities(id, rawInspect);
  const vramMb = estimateVramMb(paramSize, quant);
  const aliases = generateModelAliases(id);

  const curatedRoles: Array<"coding" | "reasoning" | "agent" | "general" | "vision"> = ["general"];
  if (capabilities.reasoning) curatedRoles.push("reasoning");
  if (capabilities.vision) curatedRoles.push("vision");
  if (/granite|qwen|fable|mistral|code|coding/i.test(id)) curatedRoles.push("coding", "agent");

  return {
    id,
    displayName: listing.name || id,
    provider: "ollama",
    parameterSize: paramSize,
    quantization: quant,
    vramEstimatedMb: vramMb,
    estimatedMemoryMb: vramMb,
    memoryEstimateSource: "heuristic",
    capabilities,
    curatedRoles,
    aliases,
  };
}
