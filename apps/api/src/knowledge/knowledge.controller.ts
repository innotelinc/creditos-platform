import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { KnowledgeService } from "./knowledge.service";
import { Permissions, Public } from "../common/decorators";

class ArticleQueryDto {
  @IsOptional()
  @IsString()
  category?: string;
  @IsOptional()
  @IsString()
  search?: string;
}

class CreateArticleDto {
  @IsString()
  slug: string;
  @IsString()
  title: string;
  @IsString()
  category: string;
  @IsOptional()
  @IsString()
  excerpt?: string;
  @IsString()
  body: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

class UpdateArticleDto {
  @IsOptional()
  @IsString()
  title?: string;
  @IsOptional()
  @IsString()
  category?: string;
  @IsOptional()
  @IsString()
  excerpt?: string;
  @IsOptional()
  @IsString()
  body?: string;
  @IsOptional()
  @Type(() => Number)
  order?: number;
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

@ApiTags("knowledge")
@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Public()
  @Get("articles")
  @ApiOperation({ summary: "Published help-center articles (public)" })
  list(@Query() query: ArticleQueryDto) {
    return this.knowledge.list(query.category, query.search);
  }

  @Public()
  @Get("categories")
  @ApiOperation({ summary: "Article categories with counts (public)" })
  categories() {
    return this.knowledge.categories();
  }

  @Public()
  @Get("articles/:slug")
  @ApiOperation({ summary: "Single article by slug (public)" })
  get(@Param("slug") slug: string) {
    return this.knowledge.getBySlug(slug);
  }

  @ApiBearerAuth()
  @Post("articles")
  @Permissions("adminAll")
  @ApiOperation({ summary: "Create an article (admin)" })
  create(@Body() dto: CreateArticleDto) {
    return this.knowledge.create(dto);
  }

  @ApiBearerAuth()
  @Patch("articles/:id")
  @Permissions("adminAll")
  @ApiOperation({ summary: "Update an article (admin)" })
  update(@Param("id") id: string, @Body() dto: UpdateArticleDto) {
    return this.knowledge.update(id, dto);
  }
}
