import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma/client";
import { UsersService } from "./users.service";
import { CurrentUser, Permissions } from "../common/decorators";
import { AuthUser } from "../common/types";
import { CreateUserDto, UpdateUserDto, UpdateUserRoleDto, UpdateUserStatusDto } from "../auth/dto";
import { IsEmail, IsEnum, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

class CreateClientDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

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
  @ApiOperation({ summary: "Client list with notes, status and report counts (staff)" })
  clients() {
    return this.users.clients();
  }

  @Post("clients")
  @Permissions("manageClients")
  @ApiOperation({ summary: "Add a client to the workspace (creates portal credentials)" })
  createClient(@Body() dto: CreateClientDto) {
    return this.users.createClient(dto);
  }

  @Patch("clients/:id")
  @Permissions("manageClients")
  @ApiOperation({ summary: "Update a client — name, email, phone, notes, status" })
  updateClient(@Param("id") id: string, @Body() dto: UpdateClientDto) {
    return this.users.updateClient(id, dto);
  }

  @Delete("clients/:id")
  @Permissions("manageClients")
  @ApiOperation({ summary: "Remove a client (disables portal access, history is kept)" })
  removeClient(@Param("id") id: string) {
    return this.users.removeClient(id);
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
