import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { AnalysisService } from "./analysis.service";
import { Permissions, CurrentUser } from "../common/decorators";
import { AuthUser } from "../common/types";

class DraftDto {
  @IsString()
  clientId: string;

  @IsString()
  accountId: string;

  @IsIn(["609", "611", "623", "604", "goodwill", "identity_theft", "debt_validation", "pay_for_delete", "method_of_verification", "bankruptcy_verification", "custom"])
  letterType: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags("analysis")
@ApiBearerAuth()
@Controller("analysis")
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get("reports/:id")
  @Permissions("viewReports")
  @ApiOperation({ summary: "Analysis result for a report" })
  result(@Param("id") id: string) {
    return this.analysis.getResult(id);
  }

  @Post("reports/:id/run")
  @Permissions("runAnalysis")
  @ApiOperation({ summary: "Re-run analysis immediately" })
  async rerun(@Param("id") id: string) {
    await this.analysis.run(id);
    return this.analysis.getResult(id);
  }

  @Post("reports/:id/run-local")
  @Permissions("runAnalysis")
  @ApiOperation({ summary: "Run the local deterministic engine (no AI key)" })
  runLocal(@Param("id") id: string) {
    return this.analysis.runLocal(id);
  }

  @Post("letters/draft")
  @Permissions("manageLetters")
  @ApiOperation({ summary: "AI-draft a dispute letter for an account" })
  draft(@CurrentUser() user: AuthUser, @Body() dto: DraftDto) {
    return this.analysis.generateDraft({
      clientName: user.name,
      clientId: dto.clientId,
      bureau: "bureau",
      accountId: dto.accountId,
      letterType: dto.letterType,
      reason: dto.reason,
    });
  }
}
