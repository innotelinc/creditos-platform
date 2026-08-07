import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { BillingService } from "./billing.service";

class CheckoutDto {
  @IsString()
  planCode: string;
  @IsOptional()
  @IsIn(["BUSINESS", "CONSUMER"])
  model?: "BUSINESS" | "CONSUMER";
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
  // Role checks happen in the service: admins always, plus CLIENT users on
  // self-signup consumer tenants (so they can manage their monitoring plan).
  @ApiOperation({ summary: "Subscription, invoices, usage and entitlements for the tenant (admins, or clients on consumer tenants)" })
  summary() {
    return this.billing.summary();
  }

  @Get("status")
  @ApiOperation({ summary: "Subscription status for the current tenant — available to any authenticated user (used to render the trial-expired paywall)" })
  status() {
    return this.billing.status();
  }

  @Post("checkout")
  @ApiOperation({ summary: "Start or switch a subscription. Admins pick any plan; consumer tenants can self-subscribe to Credit Monitoring. Returns a Stripe Checkout URL when Stripe is configured, or processes locally." })
  checkout(@Body() dto: CheckoutDto) {
    return this.billing.checkout(dto);
  }

  @Post("cancel")
  @ApiOperation({ summary: "Cancel the tenant subscription (admins, or clients on consumer tenants)" })
  cancel() {
    return this.billing.cancel();
  }

  @Post("portal")
  @ApiOperation({ summary: "Get a Stripe Customer Portal URL for managing payment method, invoices, and subscription (admins, or clients on consumer tenants)" })
  portal() {
    return this.billing.portal();
  }
}
