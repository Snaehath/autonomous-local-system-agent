import type { SlashCommandPlugin, CommandContext } from "./types.ts";
import { executeToolsAvailable } from "../../../app/tool-discovery.ts";

export const toolsCommand: SlashCommandPlugin = {
  name: "tools",
  aliases: ["tools-available"],
  description: "View active kernel tools and discoverable on-demand tools",
  usage: "/tools [category]",
  execute: (args: string[], ctx: CommandContext) => {
    const category = args[0]?.trim();
    ctx.stdout("\n" + executeToolsAvailable(category) + "\n\n");
  },
};
