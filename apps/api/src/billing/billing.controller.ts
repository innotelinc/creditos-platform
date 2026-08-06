import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { BillingService } from "./billing.service";
import { Permissions } from "../common/decorators";

class CheckoutDto {
  @IsString()
  planCode: string;
  @IsOptional()
  @IsIn(["MONTH", "YEAR"])
  interval?: "MONTH" | "YEAR";
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number;
}

@ApiTags("billing")
@ApiBearerAuth()
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("summary")
  @Permissions("adminAll")
  @ApiOperation({ summary: "Subscription, invoices, usage and entitlements for the tenant" })
  summary() {
    return this.billing.summary();
  }

  @Post("checkout")
  @Permissions("adminAll")
  @ApiOperation({ summary: "Start or switch a subscription. Returns a Stripe Checkout URL when Stripe is configured, or processes locally." })
  checkout(@Body() dto: CheckoutDto) {
    return this.billing.checkout(dto);
  }

  @Post("cancel")
  @Permissions("adminAll")
  @ApiOperation({ summary: "Cancel the tenant subscription (downgrades to Free)" })
  cancel() {
    return this.billing.cancel();
  }
}
