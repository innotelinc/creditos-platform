import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ReportsModule } from "../reports/reports.module";

@Module({
  imports: [ReportsModule],
  controllers: [HealthController],
})
export class HealthModule {}
