import { Body, Controller, Get, Param, Patch, Post, Query, Res, StreamableFile } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { IsIn, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { LetterStatus } from "@prisma/client";
import { LettersService } from "./letters.service";
import { CurrentUser, Permissions } from "../common/decorators";
import { AuthUser } from "../common/types";

class TemplateQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Boolean)
  favorites?: boolean;
}

class CreateTemplateDto {
  @IsString()
  code: string;
  @IsString()
  name: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsString()
  category?: string;
  @IsString()
  letterType: string;
  @IsString()
  body: string;
}

class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsString()
  category?: string;
  @IsOptional()
  @IsString()
  letterType?: string;
  @IsOptional()
  @IsString()
  body?: string;
  @IsOptional()
  @Type(() => Boolean)
  isFavorite?: boolean;
}

class GenerateLetterDto {
  @IsOptional()
  @IsString()
  templateId?: string;
  @IsOptional()
  @IsString()
  templateCode?: string;
  @IsString()
  clientId: string;
  @IsOptional()
  @IsString()
  disputeId?: string;
  @IsOptional()
  @IsString()
  accountId?: string;
  @IsOptional()
  @IsString()
  title?: string;
}

class SaveVersionDto {
  @IsString()
  body: string;
  @IsOptional()
  @IsString()
  title?: string;
}

class LetterListQueryDto {
  @IsOptional()
  @IsString()
  clientId?: string;
  @IsOptional()
  @IsIn(["DRAFT", "READY", "SENT", "ARCHIVED"])
  status?: LetterStatus;
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

class SendLetterDto {
  @IsOptional()
  @IsString()
  disputeId?: string;
}

@ApiTags("letters")
@ApiBearerAuth()
@Controller("letters")
export class LettersController {
  constructor(private readonly letters: LettersService) {}

  // Templates
  @Get("templates")
  @Permissions("viewLetters")
  @ApiOperation({ summary: "Template library (system + tenant)" })
  templates(@Query() query: TemplateQueryDto) {
    return this.letters.listTemplates(query.category, query.favorites ?? false);
  }

  @Post("templates")
  @Permissions("manageTemplates")
  @ApiOperation({ summary: "Create a custom template" })
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.letters.createTemplate(dto);
  }

  @Patch("templates/:id")
  @Permissions("manageTemplates")
  @ApiOperation({ summary: "Update a template (bumps version)" })
  updateTemplate(@Param("id") id: string, @Body() dto: UpdateTemplateDto) {
    return this.letters.updateTemplate(id, dto);
  }

  @Post("templates/:id/favorite")
  @Permissions("viewLetters")
  @ApiOperation({ summary: "Toggle favorite" })
  favoriteTemplate(@Param("id") id: string, @Body("favorite") favorite: boolean) {
    return this.letters.favoriteTemplate(id, favorite);
  }

  // Letters
  @Get()
  @Permissions("viewLetters")
  @ApiOperation({ summary: "List letters" })
  list(@Query() query: LetterListQueryDto) {
    return this.letters.list(query);
  }

  @Post("generate")
  @Permissions("manageLetters")
  @ApiOperation({ summary: "Generate a letter from a template with merge fields" })
  generate(@Body() dto: GenerateLetterDto, @CurrentUser() user: AuthUser) {
    return this.letters.generate(dto, user.id);
  }

  @Get(":id")
  @Permissions("viewLetters")
  @ApiOperation({ summary: "Letter detail with version history" })
  get(@Param("id") id: string) {
    return this.letters.get(id);
  }

  @Post(":id/versions")
  @Permissions("manageLetters")
  @ApiOperation({ summary: "Save a new editable version" })
  saveVersion(@Param("id") id: string, @Body() dto: SaveVersionDto, @CurrentUser() user: AuthUser) {
    return this.letters.saveVersion(id, dto.body, dto.title, user.id);
  }

  @Post(":id/send")
  @Permissions("manageLetters")
  @ApiOperation({ summary: "Mark letter as sent (optionally attach to a dispute)" })
  send(@Param("id") id: string, @Body() dto: SendLetterDto) {
    return this.letters.markSent(id, dto.disputeId);
  }

  @Get(":id/pdf")
  @Permissions("viewLetters")
  @ApiOperation({ summary: "Export the letter as PDF" })
  async pdf(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const { buffer, filename } = await this.letters.renderPdf(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }
}
