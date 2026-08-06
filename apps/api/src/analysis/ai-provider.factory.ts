import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AiProvider } from "./types";
import { LocalEngine } from "./local-engine";
import { OpenRouterProvider } from "./openrouter.provider";

@Injectable()
export class AiProviderFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly local: LocalEngine,
  ) {}

  getProvider(): AiProvider {
    const provider = this.config.get<string>("AI_PROVIDER") ?? "openrouter";
    if (provider === "local") return this.local;
    return new OpenRouterProvider(this.config, this.local);
  }
}
