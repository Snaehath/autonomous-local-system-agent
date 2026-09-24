import type { SlashCommandPlugin, CommandContext } from "./types.ts";
import { stateMachine } from "../../../app/state-machine.ts";

export const stateCommand: SlashCommandPlugin = {
  name: "state",
  aliases: ["lifecycle"],
  description: "View agent lifecycle state machine status and transition timeline",
  usage: "/state",
  execute: (_args: string[], ctx: CommandContext) => {
    ctx.stdout("\n" + stateMachine.renderStateReport() + "\n\n");
  },
};
