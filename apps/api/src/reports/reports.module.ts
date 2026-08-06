import { Module } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { S3Service } from "./s3.service";

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, S3Service],
  exports: [ReportsService, S3Service],
})
export class ReportsModule {}
