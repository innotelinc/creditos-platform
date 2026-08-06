import { Global, Module } from "@nestjs/common";
import { TenancyService } from "./tenancy";

@Global()
@Module({
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
