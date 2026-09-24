import { CommandRegistry } from "./registry.ts";
import { modelCommand } from "./model.ts";
import { modelsCommand } from "./models.ts";
import { stateCommand } from "./state.ts";
import { toolsCommand } from "./tools.ts";

export * from "./types.ts";
export * from "./registry.ts";

// Create and populate default command registry
export function createDefaultCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry.register(modelCommand);
  registry.register(modelsCommand);
  registry.register(stateCommand);
  registry.register(toolsCommand);
  return registry;
}

export const defaultCommandRegistry = createDefaultCommandRegistry();
