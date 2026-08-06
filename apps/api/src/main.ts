import { ValidationPipe } from "@nestjs/common";
import { NestFactory, HttpAdapterHost } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  // API versioning: everything lives under /v1 except liveness/readiness probes.
  app.setGlobalPrefix("v1", { exclude: ["health", "health/(.*)"] });
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("CreditOS API")
    .setDescription(
      "AI Credit Repair Operating System — multi-tenant, RBAC-enforced REST API. " +
        "Auth: send `Authorization: Bearer <accessToken>`. Refresh tokens rotate on every use.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .addTag("auth", "Authentication, registration, password recovery, 2FA")
    .addTag("users", "User profiles and management")
    .addTag("tenants", "Agency / tenant configuration")
    .addTag("reports", "Credit report ingestion (CSV/PDF) and parsing")
    .addTag("analysis", "AI credit analysis with confidence scoring")
    .addTag("disputes", "Dispute workflow engine (rounds 1–3+)")
    .addTag("letters", "Letter generator, templates, versions, PDF export")
    .addTag("notifications", "In-app notifications")
    .addTag("dashboard", "Aggregated dashboard metrics")
    .addTag("audit", "Audit trail")
    .addTag("admin", "Super-admin operations")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    customSiteTitle: "CreditOS API Docs",
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`CreditOS API listening on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

void bootstrap();
