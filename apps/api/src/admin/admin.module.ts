import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { TenantsModule } from "../tenants/tenants.module";

@Module({
  imports: [TenantsModule],
  controllers: [AdminController],
})
export class AdminModule {}
