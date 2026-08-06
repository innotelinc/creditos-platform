import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";
import { TenantsService } from "./tenants.service";
import { Permissions } from "../common/decorators";

class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{6})$/, { message: "brandColor must be a hex color" })
  brandColor?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}

@ApiTags("tenants")
@ApiBearerAuth()
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get("me")
  @ApiOperation({ summary: "My agency profile + stats" })
  mine() {
    return this.tenants.mine();
  }

  @Patch("me")
  @Permissions("manageTenant")
  @ApiOperation({ summary: "Update agency branding / settings" })
  updateBranding(@Body() dto: UpdateBrandingDto) {
    return this.tenants.updateBranding(dto);
  }

  @Get("me/feature-flags")
  @ApiOperation({ summary: "Effective feature flags" })
  featureFlags() {
    return this.tenants.featureFlags();
  }
}
