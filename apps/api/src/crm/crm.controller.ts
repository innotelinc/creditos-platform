import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { CrmStage, CrmActivityType } from "@prisma/client";
import { CrmService } from "./crm.service";
import { CurrentUser, Permissions } from "../common/decorators";
import { AuthUser } from "../common/types";

class ListQueryDto {
  @IsOptional()
  @IsEnum(CrmStage)
  stage?: CrmStage;
  @IsOptional()
  @IsString()
  search?: string;
  @IsOptional()
  @IsString()
  ownerId?: string;
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  limit?: number = 100;
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;
}

class CreateLeadDto {
  @IsString()
  name: string;
  @IsOptional()
  @IsString()
  email?: string;
  @IsOptional()
  @IsString()
  phone?: string;
  @IsOptional()
  @IsString()
  company?: string;
  @IsOptional()
  @IsString()
  source?: string;
  @IsOptional()
  @IsEnum(CrmStage)
  stage?: CrmStage;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  value?: number;
  @IsOptional()
  @IsString()
  ownerId?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
  @IsOptional()
  @IsString()
  notes?: string;
  @IsOptional()
  @Type(() => Number)
  score?: number;
}

class UpdateLeadDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsString()
  email?: string;
  @IsOptional()
  @IsString()
  phone?: string;
  @IsOptional()
  @IsString()
  company?: string;
  @IsOptional()
  @IsString()
  source?: string;
  @IsOptional()
  @IsEnum(CrmStage)
  stage?: CrmStage;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  value?: number;
  @IsOptional()
  @IsString()
  ownerId?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
  @IsOptional()
  @IsString()
  notes?: string;
  @IsOptional()
  @Type(() => Number)
  score?: number;
}

class CreateActivityDto {
  @IsEnum(CrmActivityType)
  type: CrmActivityType;
  @IsString()
  subject: string;
  @IsOptional()
  @IsString()
  body?: string;
}

@ApiTags("crm")
@ApiBearerAuth()
@Controller("crm")
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get("pipeline")
  @Permissions("viewCrm")
  @ApiOperation({ summary: "Pipeline stage counts and totals" })
  pipeline() {
    return this.crm.pipeline();
  }

  @Get("leads")
  @Permissions("viewCrm")
  @ApiOperation({ summary: "List leads (staff)" })
  list(@Query() query: ListQueryDto) {
    return this.crm.list(query);
  }

  @Get("leads/:id")
  @Permissions("viewCrm")
  @ApiOperation({ summary: "Lead detail with activity timeline" })
  get(@Param("id") id: string) {
    return this.crm.get(id);
  }

  @Post("leads")
  @Permissions("manageCrm")
  @ApiOperation({ summary: "Create a lead" })
  create(@Body() dto: CreateLeadDto) {
    return this.crm.create(dto);
  }

  @Patch("leads/:id")
  @Permissions("manageCrm")
  @ApiOperation({ summary: "Update a lead (stage, value, owner…)" })
  update(@Param("id") id: string, @Body() dto: UpdateLeadDto) {
    return this.crm.update(id, dto);
  }

  @Post("leads/:id/activities")
  @Permissions("manageCrm")
  @ApiOperation({ summary: "Log a call / email / note against a lead" })
  addActivity(@Param("id") id: string, @Body() dto: CreateActivityDto, @CurrentUser() user: AuthUser) {
    return this.crm.addActivity(id, dto, user.id);
  }
}
