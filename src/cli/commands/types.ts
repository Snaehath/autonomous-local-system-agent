import type { ModelRuntime } from "../../runtime/model-runtime.ts";

export interface CommandContext {
  modelRuntime: ModelRuntime;
  sessionFile: string;
  history: any[];
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface SlashCommandPlugin {
  readonly name: string;
  readonly aliases?: string[];
  readonly description: string;
  readonly usage?: string;
  execute(args: string[], ctx: CommandContext): Promise<void> | void;
}
