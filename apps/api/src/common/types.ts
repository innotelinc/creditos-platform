import { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
  isSuperAdmin: boolean;
}

export interface TenantContext {
  tenantId: string;
  user: AuthUser;
}

/** Permission matrix — which roles can access a given capability. */
export const PERMISSIONS = {
  // Client-facing
  viewOwnData: [Role.CLIENT],
  // Staff
  viewClients: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ATTORNEY, Role.ADMIN, Role.SUPER_ADMIN],
  manageClients: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ADMIN, Role.SUPER_ADMIN],
  viewReports: [Role.CLIENT, Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ATTORNEY, Role.ADMIN, Role.SUPER_ADMIN],
  manageReports: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ADMIN, Role.SUPER_ADMIN],
  runAnalysis: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ADMIN, Role.SUPER_ADMIN],
  viewDisputes: [Role.CLIENT, Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ATTORNEY, Role.ADMIN, Role.SUPER_ADMIN],
  manageDisputes: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ADMIN, Role.SUPER_ADMIN],
  viewLetters: [Role.CLIENT, Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ATTORNEY, Role.ADMIN, Role.SUPER_ADMIN],
  manageLetters: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ADMIN, Role.SUPER_ADMIN],
  manageTemplates: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ADMIN, Role.SUPER_ADMIN],
  viewAudit: [Role.ADMIN, Role.SUPER_ADMIN],
  manageTenant: [Role.ADMIN, Role.SUPER_ADMIN],
  manageUsers: [Role.ADMIN, Role.SUPER_ADMIN],
  viewDocuments: [Role.CLIENT, Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ATTORNEY, Role.ADMIN, Role.SUPER_ADMIN],
  manageDocuments: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ADMIN, Role.SUPER_ADMIN],
  viewCrm: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ATTORNEY, Role.ADMIN, Role.SUPER_ADMIN],
  manageCrm: [Role.CREDIT_SPECIALIST, Role.DISPUTE_SPECIALIST, Role.ADMIN, Role.SUPER_ADMIN],
  adminAll: [Role.ADMIN, Role.SUPER_ADMIN],
  superAdmin: [Role.SUPER_ADMIN],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  if (role === Role.SUPER_ADMIN) return true;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
