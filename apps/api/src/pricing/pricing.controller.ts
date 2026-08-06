import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { PricingService } from "./pricing.service";
import { Permissions, Public } from "../common/decorators";

class CreatePlanDto {
  @IsIn(["BUSINESS", "CONSUMER"])
  model: "BUSINESS" | "CONSUMER";
  @IsString()
  code: string;
  @IsString()
  name: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsInt()
  @Min(0)
  priceCents: number;
  @IsOptional()
  @IsIn(["MONTH", "YEAR", "ONE_TIME"])
  interval?: "MONTH" | "YEAR" | "ONE_TIME";
  @IsOptional()
  @IsBoolean()
  popular?: boolean;
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @Type(() => Number)
  priceCents?: number;
  @IsOptional()
  @IsIn(["MONTH", "YEAR", "ONE_TIME"])
  interval?: "MONTH" | "YEAR" | "ONE_TIME";
  @IsOptional()
  @IsBoolean()
  popular?: boolean;
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

@ApiTags("pricing")
@Controller("pricing")
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Public()
  @Get("public")
  @ApiOperation({ summary: "Public pricing catalog — business (agency SaaS) and consumer (client services) models" })
  catalog() {
    return this.pricing.catalog();
  }

  @ApiBearerAuth()
  @Get()
  @Permissions("adminAll")
  @ApiOperation({ summary: "Full plan catalog (admin)" })
  listAll() {
    return this.pricing.listAll();
  }

  @ApiBearerAuth()
  @Post()
  @Permissions("adminAll")
  @ApiOperation({ summary: "Create a plan (admin)" })
  create(@Body() dto: CreatePlanDto) {
    return this.pricing.create(dto);
  }

  @ApiBearerAuth()
  @Patch(":id")
  @Permissions("adminAll")
  @ApiOperation({ summary: "Update a plan (admin)" })
  update(@Param("id") id: string, @Body() dto: UpdatePlanDto) {
    return this.pricing.update(id, dto);
  }

  @ApiBearerAuth()
  @Delete(":id")
  @Permissions("adminAll")
  @ApiOperation({ summary: "Delete a plan (admin)" })
  remove(@Param("id") id: string) {
    return this.pricing.remove(id);
  }
}
