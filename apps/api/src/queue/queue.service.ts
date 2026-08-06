import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";

export const ANALYSIS_QUEUE = "analysis";
export const EMAIL_QUEUE = "email";

export interface AnalysisJobData {
  reportId: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: { host: string; port: number; password?: string };
  private analysisQueue?: Queue<AnalysisJobData>;
  private emailQueue?: Queue<EmailJobData>;
  private closed = false;

  constructor(config: ConfigService) {
    this.connection = {
      host: config.get("REDIS_HOST") ?? "localhost",
      port: config.get<number>("REDIS_PORT") ?? 6379,
      password: config.get("REDIS_PASSWORD") || undefined,
    };
  }

  getAnalysisQueue(): Queue<AnalysisJobData> {
    if (!this.analysisQueue) {
      this.analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
    }
    return this.analysisQueue;
  }

  getEmailQueue(): Queue<EmailJobData> {
    if (!this.emailQueue) {
      this.emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE, {
        connection: this.connection,
        defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 5000 } },
      });
    }
    return this.emailQueue;
  }

  async enqueueAnalysis(reportId: string): Promise<void> {
    if (this.closed) return;
    try {
      await this.getAnalysisQueue().add("run", { reportId });
    } catch (err) {
      this.logger.warn(`Could not enqueue analysis (Redis down?): ${(err as Error).message}`);
    }
  }

  async enqueueEmail(data: EmailJobData): Promise<void> {
    if (this.closed) return;
    try {
      await this.getEmailQueue().add("send", data);
    } catch {
      /* mailhog-less local dev: silently skip */
    }
  }

  onModuleDestroy() {
    this.closed = true;
    void Promise.all([
      this.analysisQueue?.close().catch(() => undefined),
      this.emailQueue?.close().catch(() => undefined),
    ]);
  }
}
