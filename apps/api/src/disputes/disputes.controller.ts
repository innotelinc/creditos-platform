import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { DisputeStatus, RoundStatus } from "@prisma/client";
import { DisputesService } from "./disputes.service";
import { Permissions } from "../common/decorators";

class CreateDisputeDto {
  @IsString()
  clientId: string;
  @IsOptional()
  @IsString()
  reportId?: string;
  @IsString()
  title: string;
  @IsOptional()
  @IsIn(["LOW", "MEDIUM", "HIGH", "URGENT"])
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  @IsOptional()
  @IsString()
  notes?: string;
  @IsOptional()
  @IsString()
  letterId?: string;
}

class ListQueryDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
  @IsOptional()
  @IsString()
  clientId?: string;
  @IsOptional()
  @IsString()
  search?: string;
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number = 50;
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;
}

class UpdateDisputeDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
  @IsOptional()
  @IsString()
  title?: string;
  @IsOptional()
  @IsString()
  notes?: string;
  @IsOptional()
  @IsIn(["LOW", "MEDIUM", "HIGH", "URGENT"])
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

class StartRoundDto {
  @IsOptional()
  @IsString()
  letterId?: string;
}

class RecordResponseDto {
  @IsOptional()
  @IsString()
  responseSummary?: string;
  @IsOptional()
  @IsString()
  result?: string;
  @IsOptional()
  @IsEnum(RoundStatus)
  status?: RoundStatus;
}

class EscalateDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags("disputes")
@ApiBearerAuth()
@Controller("disputes")
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  @Permissions("viewDisputes")
  @ApiOperation({ summary: "List disputes" })
  list(@Query() query: ListQueryDto) {
    return this.disputes.list(query);
  }

  @Get("stats")
  @Permissions("viewDisputes")
  @ApiOperation({ summary: "Dispute statistics for the tenant" })
  stats() {
    return this.disputes.stats();
  }

  @Post()
  @Permissions("manageDisputes")
  @ApiOperation({ summary: "Create a dispute (starts round 1 if a letter is attached)" })
  create(@Body() dto: CreateDisputeDto) {
    return this.disputes.create(dto);
  }

  @Get(":id")
  @Permissions("viewDisputes")
  @ApiOperation({ summary: "Dispute detail with rounds and letters" })
  get(@Param("id") id: string) {
    return this.disputes.get(id);
  }

  @Patch(":id")
  @Permissions("manageDisputes")
  @ApiOperation({ summary: "Update status / notes / priority" })
  update(@Param("id") id: string, @Body() dto: UpdateDisputeDto) {
    return this.disputes.update(id, dto);
  }

  @Post(":id/rounds")
  @Permissions("manageDisputes")
  @ApiOperation({ summary: "Start the next round (rounds 1–5)" })
  startRound(@Param("id") id: string, @Body() dto: StartRoundDto) {
    return this.disputes.startRound(id, dto.letterId);
  }

  @Post(":id/rounds/:round/response")
  @Permissions("manageDisputes")
  @ApiOperation({ summary: "Record a bureau response on a round" })
  recordResponse(@Param("id") id: string, @Param("round") round: string, @Body() dto: RecordResponseDto) {
    return this.disputes.recordResponse(id, Number(round), dto);
  }

  @Post(":id/escalate")
  @Permissions("manageDisputes")
  @ApiOperation({ summary: "Escalate (attorney review / CFPB filing)" })
  escalate(@Param("id") id: string, @Body() dto: EscalateDto) {
    return this.disputes.escalate(id, dto.reason);
  }
}
