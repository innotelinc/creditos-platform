import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CreditPullProvider } from "./pull-provider.interface";
import { SimulatedProvider } from "./providers/simulated.provider";
import { SmartCreditProvider } from "./providers/smartcredit.provider";
import { IdentityIqProvider } from "./providers/identityiq.provider";

/**
 * Resolves the active credit pull provider from CREDIT_PULL_PROVIDER:
 *   simulated (default — no credentials, deterministic sample reports)
 *   smartcredit | identityiq (real partner adapters)
 */
@Injectable()
export class PullsProviderFactory {
  private readonly logger = new Logger(PullsProviderFactory.name);

  constructor(
    private readonly config: ConfigService,
    private readonly simulated: SimulatedProvider,
    private readonly smartCredit: SmartCreditProvider,
    private readonly identityIq: IdentityIqProvider,
  ) {}

  get(): CreditPullProvider {
    const which = this.config.get<string>("CREDIT_PULL_PROVIDER") ?? "simulated";
    switch (which.toLowerCase()) {
      case "smartcredit":
        return this.smartCredit;
      case "identityiq":
        return this.identityIq;
      case "simulated":
        return this.simulated;
      default:
        this.logger.warn(`Unknown CREDIT_PULL_PROVIDER "${which}" — falling back to simulated`);
        return this.simulated;
    }
  }
}
