import { Role } from "@prisma/client";
import { TenancyService } from "./tenancy";
import type { AuthUser } from "./types";

const staffUser: AuthUser = {
  id: "u-staff",
  email: "staff@summit.test",
  name: "Staff",
  role: Role.CREDIT_SPECIALIST,
  tenantId: "t1",
  isSuperAdmin: false,
};

const clientUser: AuthUser = {
  id: "u-client",
  email: "client@summit.test",
  name: "Client",
  role: Role.CLIENT,
  tenantId: "t1",
  isSuperAdmin: false,
};

describe("TenancyService (tenant isolation)", () => {
  let service: TenancyService;

  beforeEach(() => {
    service = new TenancyService();
  });

  it("returns the tenant id from the request context", () => {
    service.run({ tenantId: "t1", user: staffUser }, () => {
      expect(service.getTenantId()).toBe("t1");
    });
  });

  it("getClientScope forces own-data scope for CLIENT role users", () => {
    service.run({ tenantId: "t1", user: clientUser }, () => {
      expect(service.getClientScope()).toEqual({ clientId: "u-client" });
    });
  });

  it("getClientScope returns undefined for staff so tenant-wide scoping applies", () => {
    service.run({ tenantId: "t1", user: staffUser }, () => {
      expect(service.getClientScope()).toBeUndefined();
    });
  });

  it("throws when accessed outside a request context", () => {
    expect(() => service.getTenantId()).toThrow(/No tenant context/);
    expect(() => service.getUser()).toThrow(/No tenant context/);
  });

  it("getClientScope degrades to tenant-wide (undefined) outside a request context", () => {
    // Safe for background workers / public paths: no throw, no client narrowing.
    expect(service.getClientScope()).toBeUndefined();
  });

  it("does not leak tenant context across concurrent request scopes", async () => {
    const observed: string[] = [];
    await Promise.all([
      Promise.resolve().then(() =>
        service.run({ tenantId: "t1", user: staffUser }, () => {
          observed.push(service.getTenantId());
        }),
      ),
      Promise.resolve().then(() =>
        service.run({ tenantId: "t2", user: clientUser }, () => {
          observed.push(service.getTenantId());
        }),
      ),
    ]);
    expect(observed.sort()).toEqual(["t1", "t2"]);
  });
});
