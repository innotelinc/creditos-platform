import { Controller, Delete, Get, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { DocumentType } from "@prisma/client";
import { DocumentsService } from "./documents.service";
import { Permissions } from "../common/decorators";

class DocumentListQueryDto {
  @IsOptional()
  @IsString()
  clientId?: string;
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}

@ApiTags("documents")
@ApiBearerAuth()
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @Permissions("viewDocuments")
  @ApiOperation({ summary: "List documents (clients see only their own)" })
  list(@Query() query: DocumentListQueryDto) {
    return this.documents.list(query);
  }

  @Post()
  @Permissions("viewDocuments")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload a document — clients upload to their own file; staff pick the client" })
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query("clientId") clientId: string | undefined,
    @Query("type") type?: DocumentType,
  ) {
    if (!file) throw new Error("A file is required");
    return this.documents.upload({
      clientId: clientId ?? "",
      type: type as DocumentType,
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
  }

  @Get(":id/download")
  @Permissions("viewDocuments")
  @ApiOperation({ summary: "Download the original file" })
  async download(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const { buffer, filename, mimeType } = await this.documents.download(id);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  @Delete(":id")
  @Permissions("manageDocuments")
  @ApiOperation({ summary: "Delete a document" })
  remove(@Param("id") id: string) {
    return this.documents.remove(id);
  }
}
