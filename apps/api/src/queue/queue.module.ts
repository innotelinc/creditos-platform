import { Global, Module } from "@nestjs/common";
import { QueueService } from "./queue.service";
import { QueueWorkers } from "./workers";
import { AnalysisModule } from "../analysis/analysis.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Global()
@Module({
  imports: [AnalysisModule, NotificationsModule],
  providers: [QueueService, QueueWorkers],
  exports: [QueueService],
})
export class QueueModule {}
