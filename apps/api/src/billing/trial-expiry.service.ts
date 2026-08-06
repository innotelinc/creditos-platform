import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationType, Role, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../notifications/mail.service";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Trial lifecycle: subscriptions still TRIALING after `trialEndsAt` are marked
 * EXPIRED (downgrade) and the tenant's admins are re-prompted by email and
 * in-app notification to choose a plan. Once EXPIRED, core API endpoints are
 * blocked with 402 by SubscriptionGateGuard until a paid plan is chosen.
 *
 * Runs hourly as a background sweep AND lazily from read paths (billing
 * summary) so the UI reflects reality immediately without waiting for the cron.
 */
@Injectable()
export class TrialExpiryService {
  private readonly logger = new Logger(TrialExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Hourly sweep — expire every overdue TRIALING subscription. */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpiredTrials(): Promise<number> {
    const count = await this.expireAllOverdue();
    if (count > 0) this.logger.log(`Trial sweep: expired ${count} subscription(s)`);
    return count;
  }

  /** Expire every TRIALING subscription past its trialEndsAt. Returns count. */
  async expireAllOverdue(): Promise<number> {
    const overdue = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.TRIALING, trialEndsAt: { lt: new Date() } },
      select: { id: true, tenantId: true },
    });
    if (overdue.length === 0) return 0;

    await this.prisma.subscription.updateMany({
      where: { id: { in: overdue.map((s) => s.id) } },
      data: { status: SubscriptionStatus.EXPIRED },
    });

    for (const sub of overdue) {
      await this.notifyExpired(sub.tenantId);
    }
    return overdue.length;
  }

  /** Expire a single tenant's trial if overdue (lazy check on read paths).
   *  No-op when the trial is still running or already expired. */
  async expireIfOverdue(tenantId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: SubscriptionStatus.TRIALING, trialEndsAt: { lt: new Date() } },
      select: { id: true },
    });
    if (!sub) return false;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    await this.notifyExpired(tenantId);
    return true;
  }

  /** Re-prompt the tenant's admins (email + in-app notification) and audit. */
  private async notifyExpired(tenantId: string): Promise<void> {
    const [tenant, admins] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
      this.prisma.user.findMany({ where: { tenantId, role: Role.ADMIN }, select: { id: true, name: true, email: true } }),
    ]);

    const appUrl = this.config.get<string>("APP_URL") ?? "http://localhost:3000";
    for (const admin of admins) {
      try {
        await this.notifications.create({
          tenantId,
          userId: admin.id,
          type: NotificationType.WARNING,
          title: "Your trial has ended",
          body: "Choose a plan to keep using CreditOS.",
          link: "/billing",
        });
      } catch (err) {
        this.logger.warn(`Trial expiry notification failed for ${admin.email}: ${(err as Error).message}`);
      }
      await this.mail.send(
        admin.email,
        "Your CreditOS trial has ended",
        `<p>Hi ${admin.name},</p>
         <p>Your free trial for <strong>${tenant?.name ?? "your workspace"}</strong> has ended. Your workspace is now on a
         <strong>limited plan</strong> until you choose a subscription.</p>
         <p><a href="${appUrl}/billing">Choose a plan</a> to keep using all CreditOS features.</p>`,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: "billing.trial_expired",
        entity: "Subscription",
        meta: { expiredAt: new Date().toISOString() },
      },
    });
  }
}
