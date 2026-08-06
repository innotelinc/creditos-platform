import { Shield } from "@/components/ui/icons";

/**
 * Required compliance disclosure (spec §7.2) shown on all client-facing
 * dispute and report views. CreditOS is a documentation & tracking platform,
 * not a law firm, credit bureau, or credit repair organization.
 */
export function ComplianceBanner({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400 ${className ?? ""}`}
      role="note"
      aria-label="Compliance disclosure"
    >
      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand-500 dark:text-brand-400" />
      <p>
        <strong className="font-semibold text-slate-700 dark:text-slate-300">CreditOS</strong> assists with the
        preparation of credit dispute documentation and dispute tracking. We are not a law firm, are not a credit
        bureau, and do not provide legal advice. Information on this platform is for educational purposes and does
        not guarantee any particular credit outcome. 15 U.S.C. § 1679c disclosure: you have the right to file a
        dispute directly with the credit bureaus at no cost.
      </p>
    </div>
  );
}
