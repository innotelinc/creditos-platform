import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma/client";
import { UsersService } from "./users.service";
import { CurrentUser, Permissions } from "../common/decorators";
import { AuthUser } from "../common/types";
import { CreateUserDto, UpdateUserDto, UpdateUserRoleDto, UpdateUserStatusDto } from "../auth/dto";
import { IsEnum, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

class UserListQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

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

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "My profile" })
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update my profile" })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Get("clients")
  @Permissions("viewClients")
  @ApiOperation({ summary: "Active client list (staff dropdowns)" })
  clients() {
    return this.users.clients();
  }

  @Get()
  @Permissions("viewClients")
  @ApiOperation({ summary: "List tenant users (staff)" })
  list(@Query() query: UserListQueryDto) {
    return this.users.list(query);
  }

  @Post()
  @Permissions("manageUsers")
  @ApiOperation({ summary: "Create a staff user" })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(":id/role")
  @Permissions("manageUsers")
  @ApiOperation({ summary: "Change a user's role" })
  updateRole(@Param("id") id: string, @Body() dto: UpdateUserRoleDto) {
    return this.users.updateRole(id, dto.role as Role);
  }

  @Patch(":id/status")
  @Permissions("manageUsers")
  @ApiOperation({ summary: "Enable / disable a user" })
  updateStatus(@Param("id") id: string, @Body() dto: UpdateUserStatusDto) {
    return this.users.updateStatus(id, dto.status as UserStatus);
  }
}
