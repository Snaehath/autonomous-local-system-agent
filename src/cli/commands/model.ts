import type { SlashCommandPlugin, CommandContext } from "./types.ts";

export const modelCommand: SlashCommandPlugin = {
  name: "model",
  aliases: ["switch-model"],
  description: "View or switch active model (/model auto, /model qwen, /model granite)",
  usage: "/model [auto | <id-or-alias>]",
  execute: async (args: string[], ctx: CommandContext) => {
    const target = args[0]?.trim();

    if (!target) {
      const activeId = ctx.modelRuntime.getActiveModelId();
      const resolved = ctx.modelRuntime.resolveModel();
      ctx.stdout(
        `\nActive Model Selection Mode: ${activeId === "auto" ? "🟢 AUTO (Dynamic Capability & VRAM Routing)" : "📌 PINNED"}\n` +
          `• Current Model : ${resolved.displayName} (${resolved.id})\n` +
          `• Provider      : ${resolved.provider}\n` +
          `• VRAM Footprint: ~${(resolved.vramEstimatedMb ? resolved.vramEstimatedMb / 1024 : 3).toFixed(1)} GB\n` +
          `• Capabilities  : ${Object.entries(resolved.capabilities)
            .filter(([_, v]) => v === true)
            .map(([k]) => k)
            .join(" · ")}\n` +
          `\nUsage:\n` +
          `• /model status - Display active runtime and capability details\n` +
          `• /model why    - Explain why current model was chosen\n` +
          `• /model auto   - Enable dynamic capability & hardware routing\n` +
          `• /model <id>   - Pin to a specific model alias or ID\n\n`,
      );
      return;
    }

    if (target.toLowerCase() === "status") {
      const activeId = ctx.modelRuntime.getActiveModelId();
      const resolved = ctx.modelRuntime.resolveModel();
      ctx.stdout("\nCurrent Model Runtime Status\n" + "─".repeat(68) + "\n");
      ctx.stdout(`• Active Model : ${resolved.displayName} (${resolved.id})\n`);
      ctx.stdout(`• Selection    : ${activeId === "auto" ? "auto (dynamic capability & hardware routing)" : `pinned (${activeId})`}\n`);
      ctx.stdout(`• Provider     : ${resolved.provider}\n`);
      ctx.stdout(`• Parameter Sz : ${resolved.parameterSize || "Unknown"}\n`);
      ctx.stdout(`• Context Limit: ${resolved.capabilities.maxContextLength.toLocaleString()} tokens\n`);
      ctx.stdout(`• Memory Est.  : ~${((resolved.estimatedMemoryMb || resolved.vramEstimatedMb || 3000) / 1024).toFixed(1)} GB\n`);
      ctx.stdout(`• Vision       : ${resolved.capabilities.vision ? "YES" : "no"}\n`);
      ctx.stdout(`• Tool Calling : ${resolved.capabilities.tools ? "YES" : "no"}\n`);
      ctx.stdout(`• Thinking     : ${resolved.capabilities.thinking ? "YES" : "no"}\n\n`);
      return;
    }

    if (target.toLowerCase() === "why") {
      const trace = ctx.modelRuntime.getLastSelectionTrace() || ctx.modelRuntime.explainSelection();
      const resolved = ctx.modelRuntime.resolveModel();

      ctx.stdout("\nModel Selection Explanation\n" + "─".repeat(68) + "\n");
      ctx.stdout(`Strategy: ${trace.strategy}\n`);
      ctx.stdout(
        `Requirements: Vision: ${trace.taskRequirements.requiresVision ? "YES" : "no"} | ` +
          `Tools: ${trace.taskRequirements.requiresTools ? "YES" : "no"} | ` +
          `Reasoning: ${trace.taskRequirements.requiresReasoning ? "YES" : "no"}\n\n`,
      );

      ctx.stdout("Candidate Evaluation:\n");
      for (const c of trace.candidates) {
        const mark = c.accepted ? "✓" : "✗";
        ctx.stdout(`  ${mark} ${c.displayName} (${c.modelId})\n`);
        for (const r of c.reasons) {
          ctx.stdout(`    • ${r}\n`);
        }
      }

      ctx.stdout(`\nSelected Model: ${resolved.displayName} (${resolved.id})\n`);
      ctx.stdout(`Reason: ${trace.selectionReason}\n\n`);
      return;
    }

    if (target.toLowerCase() === "auto") {
      const resolved = ctx.modelRuntime.setActiveModel("auto");
      process.env.MODEL = "auto";
      ctx.stdout(
        `\n✨ Model selection set to AUTO.\n` +
          `Active model dynamically routed to: ${resolved.displayName} (${resolved.id})\n\n`,
      );
      return;
    }

    try {
      const resolved = ctx.modelRuntime.setActiveModel(target);
      process.env.MODEL = resolved.id;
      ctx.stdout(
        `\n✓ Switched active model to: ${resolved.displayName} (${resolved.id})\n` +
          `Capabilities: ${Object.entries(resolved.capabilities)
            .filter(([_, v]) => v === true)
            .map(([k]) => k)
            .join(" · ")}\n\n`,
      );
    } catch (e: any) {
      ctx.stderr(`\n❌ Error: ${e.message}\n\n`);
    }
  },
};
