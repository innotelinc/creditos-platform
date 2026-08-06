import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";

/** Stateless token utilities: refresh token hashing, one-time codes. */
@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService) {}

  generateRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  generateResetToken(userId: string): string {
    const payload = Buffer.from(userId, "utf8").toString("base64url");
    return payload + "." + this.hashReset(userId);
  }

  hashReset(userId: string): string {
    const secret = this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
    return createHash("sha256").update(`${userId}.${secret}.reset`).digest("hex").slice(0, 32);
  }

  /** Decodes and verifies a reset token, returning the user id or null. */
  verifyResetToken(token: string): string | null {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const userId = Buffer.from(payload, "base64url").toString("utf8");
    if (!userId || !this.hashReset(userId).startsWith(signature)) return null;
    return userId;
  }

  /** Deterministic code for demo purposes — replaces an emailed OTP when SMTP is unset. */
  generateOtp(): string {
    return String(randomBytes(3).readUIntBE(0, 3) % 1_000_000).padStart(6, "0");
  }
}
