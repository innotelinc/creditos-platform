import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

/**
 * S3-compatible storage (MinIO in dev, AWS S3 in prod). Used for credit report
 * files and documents. Bucket + keys are tenant-agnostic here; ownership is
 * enforced at the application layer via the reports/documents tables.
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get("S3_BUCKET") ?? "creditos";
    this.client = new S3Client({
      region: config.get("S3_REGION") ?? "us-east-1",
      endpoint: config.get("S3_ENDPOINT"),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get("S3_ACCESS_KEY") ?? "minioadmin",
        secretAccessKey: config.get("S3_SECRET_KEY") ?? "minioadmin",
      },
      maxAttempts: 3,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  /** Creates the configured bucket (idempotent) so first uploads never 404. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch {
      /* bucket missing — create it */
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created S3 bucket "${this.bucket}"`);
    } catch (err) {
      this.logger.warn(`Could not create bucket "${this.bucket}": ${(err as Error).message}`);
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return key;
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    const stream = res.Body as unknown as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`S3 delete failed: ${(err as Error).message}`);
    }
  }

  async listBuckets(): Promise<string[]> {
    const res = await this.client.send(new ListBucketsCommand({}));
    return (res.Buckets ?? []).map((b) => b.Name ?? "");
  }
}
