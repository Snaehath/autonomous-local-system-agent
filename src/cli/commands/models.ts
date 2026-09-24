import type { SlashCommandPlugin, CommandContext } from "./types.ts";

export const modelsCommand: SlashCommandPlugin = {
  name: "models",
  aliases: ["list-models"],
  description: "List discovered local models or refresh catalog from providers (/models, /models --refresh)",
  usage: "/models [--refresh]",
  execute: async (args: string[], ctx: CommandContext) => {
    const isRefresh = args.includes("--refresh") || args.includes("-r");

    if (isRefresh) {
      ctx.stdout("\n🔍 Scanning LLM providers for installed models...\n");
      await ctx.modelRuntime.refreshModels();
    }

    const models = ctx.modelRuntime.listModels();
    if (models.length === 0) {
      ctx.stdout(
        `\nNo models discovered. Ensure Ollama is running at ${ctx.modelRuntime.config.providers.ollama.baseUrl} or run "ollama pull qwen3.5:4b".\n\n`,
      );
      return;
    }

    const activeId = ctx.modelRuntime.getActiveModelId();
    const resolved = ctx.modelRuntime.resolveModel();

    ctx.stdout("\nDiscovered Local Models:\n" + "─".repeat(68) + "\n");
    for (const m of models) {
      const isActive = m.id === resolved.id;
      const badge = isActive ? (activeId === "auto" ? " [ACTIVE: AUTO]" : " [ACTIVE]") : "";
      const caps = Object.entries(m.capabilities)
        .filter(([_, v]) => v === true)
        .map(([k]) => k)
        .join(" · ");

      ctx.stdout(`• ${m.displayName}${badge}\n`);
      ctx.stdout(`  ID: ${m.id} | Aliases: ${m.aliases.join(", ")}\n`);
      ctx.stdout(`  Provider: ${m.provider} | Parameter Size: ${m.parameterSize || "Unknown"} | ~${(m.vramEstimatedMb ? m.vramEstimatedMb / 1024 : 3).toFixed(1)} GB VRAM\n`);
      ctx.stdout(`  Capabilities: ${caps}\n\n`);
    }

    ctx.stdout(
      `Switch model with: /model <alias>  or  /model auto\n` +
        `Refresh discovered models with: /models --refresh\n\n`,
    );
  },
};
