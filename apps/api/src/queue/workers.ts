import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker, type Job } from "bullmq";
import { EMAIL_QUEUE, ANALYSIS_QUEUE, type AnalysisJobData, type EmailJobData } from "./queue.service";
import { AnalysisService } from "../analysis/analysis.service";
import { MailService } from "../notifications/mail.service";

@Injectable()
export class QueueWorkers implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueWorkers.name);
  private workers: Worker[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly analysis: AnalysisService,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    const connection = {
      host: this.config.get("REDIS_HOST") ?? "localhost",
      port: this.config.get<number>("REDIS_PORT") ?? 6379,
      password: this.config.get("REDIS_PASSWORD") || undefined,
    };
    const opts = { connection, concurrency: 3 };

    const emailWorker = new Worker<EmailJobData>(
      EMAIL_QUEUE,
      async (job: Job<EmailJobData>) => {
        await this.mail.send(job.data.to, job.data.subject, job.data.html);
      },
      opts,
    );
    emailWorker.on("failed", (job, err) =>
      this.logger.error(`Email job ${job?.id} failed: ${err.message}`),
    );

    const analysisWorker = new Worker<AnalysisJobData>(
      ANALYSIS_QUEUE,
      async (job: Job<AnalysisJobData>) => {
        this.logger.log(`Analyzing report ${job.data.reportId}`);
        await this.analysis.run(job.data.reportId);
      },
      opts,
    );
    analysisWorker.on("failed", (job, err) =>
      this.logger.error(`Analysis job ${job?.id} failed: ${err.message}`),
    );

    this.workers = [emailWorker, analysisWorker];
  }

  onModuleDestroy() {
    void Promise.all(this.workers.map((w) => w.close()));
  }
}
