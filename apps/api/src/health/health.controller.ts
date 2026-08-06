import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queue/queue.service";
import { Public } from "../common/decorators";
import { S3Service } from "../reports/s3.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get("health")
  @ApiOperation({ summary: "Liveness probe" })
  liveness() {
    return { status: "ok", service: "creditos-api", time: new Date().toISOString() };
  }

  @Public()
  @Get("health/ready")
  @ApiOperation({ summary: "Readiness probe — verifies db, redis, s3" })
  async readiness() {
    const checks: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "unreachable";
    }

    try {
      const redis = await import("ioredis");
      const client = new redis.default({
        host: this.config.get("REDIS_HOST") ?? "localhost",
        port: this.config.get<number>("REDIS_PORT") ?? 6379,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      await client.connect();
      await client.ping();
      await client.quit();
      checks.redis = "ok";
    } catch {
      checks.redis = "unreachable";
    }

    try {
      await this.s3.listBuckets();
      checks.storage = "ok";
    } catch {
      checks.storage = "unreachable";
    }

    const healthy = Object.values(checks).every((v) => v === "ok");
    if (!healthy) throw new ServiceUnavailableException({ status: "degraded", checks });
    return { status: "ok", checks };
  }
}
