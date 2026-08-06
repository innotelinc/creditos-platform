import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "Demo Agency" })
  @IsString()
  @MinLength(2)
  tenantName: string;

  @ApiProperty({ example: "demo-agency" })
  @Matches(/^[a-z0-9-]{2,32}$/, { message: "Tenant slug: 2–32 chars, lowercase letters, numbers, dashes" })
  tenantSlug: string;

  @ApiProperty({ example: "Alex Rivera" })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: "alex@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: "StrongPass123!" })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: "alex@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty({ required: false, description: "Required only when 2FA is enabled" })
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: "2FA code must be 6 digits" })
  totpCode?: string;
}

export class RefreshDto {
  @ApiProperty({ required: false, description: "Or send header `x-refresh-token`" })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "alex@example.com" })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  newPassword: string;
}

export class TotpVerifyDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class TotpDisableDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @Length(6, 6)
  code: string;
}

const STAFF_ROLES = ["CREDIT_SPECIALIST", "DISPUTE_SPECIALIST", "ATTORNEY", "ADMIN"] as const;

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: STAFF_ROLES, description: "Role for the new user" })
  @IsIn(STAFF_ROLES as unknown as string[])
  role: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: STAFF_ROLES })
  @IsIn(STAFF_ROLES as unknown as string[])
  role: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ["ACTIVE", "DISABLED", "PENDING"] })
  @IsIn(["ACTIVE", "DISABLED", "PENDING"])
  status: string;
}
