import { Module } from "@nestjs/common";
import { AnalysisService } from "./analysis.service";
import { AnalysisController } from "./analysis.controller";
import { LocalEngine } from "./local-engine";
import { OpenRouterProvider } from "./openrouter.provider";
import { AiProviderFactory } from "./ai-provider.factory";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, LocalEngine, OpenRouterProvider, AiProviderFactory],
  exports: [AnalysisService],
})
export class AnalysisModule {}
