import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { TenancyModule } from "./common/tenancy.module";
import { JwtAuthGuard, PermissionsGuard, RolesGuard } from "./common/guards";
import { TenancyInterceptor } from "./common/tenancy.interceptor";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TenantsModule } from "./tenants/tenants.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuditModule } from "./audit/audit.module";
import { QueueModule } from "./queue/queue.module";
import { HealthModule } from "./health/health.module";
import { ReportsModule } from "./reports/reports.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { LettersModule } from "./letters/letters.module";
import { DisputesModule } from "./disputes/disputes.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { AdminModule } from "./admin/admin.module";
import { PricingModule } from "./pricing/pricing.module";
import { BillingModule } from "./billing/billing.module";
import { CrmModule } from "./crm/crm.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { ContactModule } from "./contact/contact.module";
import { DocumentsModule } from "./documents/documents.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        redact: {
          paths: ["req.headers.authorization", "req.headers.cookie", "req.body.password", "res.headers['set-cookie']"],
          censor: "[REDACTED]",
        },
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true, singleLine: true } }
            : undefined,
        autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/health/ready" },
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 300,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    TenancyModule,
    AuditModule,
    QueueModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    NotificationsModule,
    HealthModule,
    ReportsModule,
    AnalysisModule,
    LettersModule,
    DisputesModule,
    DashboardModule,
    AdminModule,
    PricingModule,
    BillingModule,
    CrmModule,
    KnowledgeModule,
    ContactModule,
    DocumentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor },
  ],
})
export class AppModule {}
