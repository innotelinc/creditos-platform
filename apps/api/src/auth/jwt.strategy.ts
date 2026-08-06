import { Logger, UnauthorizedException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthUser } from "../common/types";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    if (!payload.sub || !payload.tenantId) {
      this.logger.warn("JWT payload missing sub/tenantId");
      throw new UnauthorizedException("Malformed token");
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role as AuthUser["role"],
      tenantId: payload.tenantId,
      isSuperAdmin: payload.isSuperAdmin === true,
    };
  }
}
