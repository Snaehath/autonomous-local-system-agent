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
          `\nSwitch with: /model auto  or  /model <alias> (e.g. /model qwen)\n\n`,
      );
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
