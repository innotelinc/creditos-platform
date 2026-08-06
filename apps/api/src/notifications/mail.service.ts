import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(config: ConfigService) {
    this.transporter = createTransport({
      host: config.get("SMTP_HOST") ?? "localhost",
      port: config.get<number>("SMTP_PORT") ?? 1025,
      secure: false,
      auth:
        config.get("SMTP_USER") || config.get("SMTP_PASS")
          ? { user: config.get("SMTP_USER"), pass: config.get("SMTP_PASS") }
          : undefined,
      connectionTimeout: 5000,
    });
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const from = process.env.SMTP_FROM ?? "CreditOS <no-reply@creditos.local>";
    try {
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.debug(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.warn(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }

  onModuleDestroy() {
    void this.transporter.close();
  }
}
