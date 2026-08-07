import { Module } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { S3Service } from "./s3.service";
import { PullsService } from "./pulls/pulls.service";
import { PullsProviderFactory } from "./pulls/pulls.provider.factory";
import { SimulatedProvider } from "./pulls/providers/simulated.provider";
import { SmartCreditProvider } from "./pulls/providers/smartcredit.provider";
import { IdentityIqProvider } from "./pulls/providers/identityiq.provider";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [BillingModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    S3Service,
    PullsService,
    PullsProviderFactory,
    SimulatedProvider,
    SmartCreditProvider,
    IdentityIqProvider,
  ],
  exports: [ReportsService, S3Service],
})
export class ReportsModule {}
