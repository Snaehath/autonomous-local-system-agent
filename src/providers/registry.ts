import type { LLMProvider } from "./types.ts";
import { OllamaProvider } from "./ollama/client.ts";
import { OpenAICompatibleProvider } from "./openai/client.ts";
import { MockProvider } from "./mock/client.ts";
import type { AppConfig } from "../config/types.ts";

export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  // Register a provider instance
  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  // Get provider by ID
  get(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  // List all registered providers
  list(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  // Create standard registry initialized from application configuration
  static fromConfig(config: AppConfig): ProviderRegistry {
    const registry = new ProviderRegistry();

    if (config.providers.ollama.enabled) {
      registry.register(
        new OllamaProvider(config.providers.ollama.baseUrl, config.providers.ollama.timeoutMs),
      );
    }

    if (config.providers.openaiCompatible.enabled && config.providers.openaiCompatible.apiKey) {
      registry.register(
        new OpenAICompatibleProvider(
          config.providers.openaiCompatible.baseUrl,
          config.providers.openaiCompatible.apiKey,
        ),
      );
    }

    // Always register mock provider for offline or testing mode
    registry.register(new MockProvider());

    return registry;
  }
}
