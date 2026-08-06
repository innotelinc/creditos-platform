import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { IsEnum, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { Bureau, ReportStatus } from "@prisma/client";
import { ReportsService } from "./reports.service";
import { Permissions } from "../common/decorators";

class ReportListQueryDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsEnum(Bureau)
  bureau?: Bureau;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

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

class UploadQueryDto {
  @IsString()
  clientId: string;

  @IsOptional()
  @IsEnum(Bureau)
  bureau?: Bureau;
}

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @Permissions("viewReports")
  @ApiOperation({ summary: "List credit reports (tenant-scoped)" })
  list(@Query() query: ReportListQueryDto) {
    return this.reports.list(query);
  }

  @Get(":id")
  @Permissions("viewReports")
  @ApiOperation({ summary: "Full report detail with accounts, scores, disputes" })
  get(@Param("id") id: string) {
    return this.reports.get(id);
  }

  @Get(":id/download")
  @Permissions("viewReports")
  @ApiOperation({ summary: "Download the original file" })
  async download(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const { buffer, filename, mimeType } = await this.reports.download(id);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Post()
  @Permissions("manageReports")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary", description: "CSV or PDF credit report" },
        clientId: { type: "string" },
        bureau: { type: "string", enum: Object.values(Bureau) },
      },
    },
  })
  @ApiOperation({ summary: "Upload a credit report (CSV/PDF) — parses and queues AI analysis" })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadQueryDto,
  ) {
    if (!file) throw new Error("file is required (multipart field 'file')");
    return this.reports.upload({
      clientId: query.clientId,
      bureau: query.bureau,
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
  }

  @Delete(":id")
  @Permissions("manageReports")
  @ApiOperation({ summary: "Delete a report" })
  remove(@Param("id") id: string) {
    return this.reports.remove(id);
  }
}
