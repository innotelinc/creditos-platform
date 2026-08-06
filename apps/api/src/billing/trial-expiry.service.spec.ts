import { SubscriptionStatus, Role, NotificationType } from "@prisma/client";
import { TrialExpiryService } from "./trial-expiry.service";

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    subscription: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    tenant: { findUnique: jest.fn().mockResolvedValue({ name: "Test Agency" }) },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: "u1", name: "Admin", email: "admin@test.local" },
      ]),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    ...(overrides.prisma ?? {}),
  };
  const config = { get: jest.fn().mockReturnValue("http://localhost:3000") };
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const notifications = { create: jest.fn().mockResolvedValue({}) };

  const service = new TrialExpiryService(
    prisma as never,
    config as never,
    mail as never,
    notifications as never,
  );
  return { service, prisma, config, mail, notifications };
}

describe("TrialExpiryService", () => {
  it("expires overdue TRIALING subscriptions and returns the count", async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany.mockResolvedValue([
      { id: "s1", tenantId: "t1" },
      { id: "s2", tenantId: "t2" },
    ]);

    const count = await service.expireAllOverdue();

    expect(count).toBe(2);
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] } },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  });

  it("does nothing when no trials are overdue", async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany.mockResolvedValue([]);

    expect(await service.expireAllOverdue()).toBe(0);
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it("re-prompts admins with a notification and email on expiry", async () => {
    const { service, prisma, mail, notifications } = makeService();
    prisma.subscription.findMany.mockResolvedValue([{ id: "s1", tenantId: "t1" }]);
    prisma.user.findMany.mockResolvedValue([
      { id: "u1", name: "Admin", email: "admin@test.local" },
    ]);

    await service.expireAllOverdue();

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        userId: "u1",
        type: NotificationType.WARNING,
        link: "/billing",
      }),
    );
    expect(mail.send).toHaveBeenCalledWith(
      "admin@test.local",
      expect.stringContaining("trial has ended"),
      expect.stringContaining("/billing"),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("expireIfOverdue is a no-op when the trial is still active", async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findFirst.mockResolvedValue(null);

    expect(await service.expireIfOverdue("t1")).toBe(false);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it("expireIfOverdue expires a single overdue tenant trial", async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findFirst.mockResolvedValue({ id: "s1" });

    expect(await service.expireIfOverdue("t1")).toBe(true);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  });
});
