import type { SlashCommandPlugin, CommandContext } from "./types.ts";

export class CommandRegistry {
  private commands: Map<string, SlashCommandPlugin> = new Map();
  private aliasMap: Map<string, string> = new Map();

  // Register a command plugin
  register(command: SlashCommandPlugin): void {
    const key = command.name.toLowerCase().replace(/^\//, "");
    this.commands.set(key, command);

    for (const alias of command.aliases || []) {
      const aliasKey = alias.toLowerCase().replace(/^\//, "");
      this.aliasMap.set(aliasKey, key);
    }
  }

  // Get command by name or alias
  get(nameOrAlias: string): SlashCommandPlugin | undefined {
    const key = nameOrAlias.toLowerCase().replace(/^\//, "");
    if (this.commands.has(key)) {
      return this.commands.get(key);
    }
    const resolved = this.aliasMap.get(key);
    if (resolved && this.commands.has(resolved)) {
      return this.commands.get(resolved);
    }
    return undefined;
  }

  // Check if a line starts with a registered slash command
  canHandle(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.startsWith("/")) return false;
    const [rawCmd] = trimmed.split(/\s+/);
    return Boolean(this.get(rawCmd));
  }

  // Dispatch and execute slash command
  async execute(line: string, ctx: CommandContext): Promise<boolean> {
    const trimmed = line.trim();
    if (!trimmed.startsWith("/")) return false;

    const [rawCmd, ...args] = trimmed.split(/\s+/);
    const cmd = this.get(rawCmd);
    if (!cmd) return false;

    await cmd.execute(args, ctx);
    return true;
  }

  // List all registered commands
  list(): SlashCommandPlugin[] {
    return Array.from(this.commands.values());
  }
}
