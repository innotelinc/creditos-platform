"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { api, type CreditReport, type User } from "@/lib/api";
import { useRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ComplianceBanner } from "@/components/ui/compliance-banner";
import { useToast } from "@/components/ui/toast";
import { formatDate, cn } from "@/lib/utils";
import { FileText, Upload, ArrowRight, Download, RefreshCw } from "@/components/ui/icons";

const bureaus = [
  { value: "EXPERIAN", label: "Experian" },
  { value: "EQUIFAX", label: "Equifax" },
  { value: "TRANSUNION", label: "TransUnion" },
  { value: "OTHER", label: "Other" },
];

export default function ReportsPage() {
  const { isStaff } = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [bureau, setBureau] = React.useState("EXPERIAN");
  const [clientId, setClientId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.get<{ items: CreditReport[]; total: number }>("/reports"),
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<{ items: User[] }>("/users/clients"),
    enabled: isStaff,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !clientId) throw new Error("Select a client and a file");
      const form = new FormData();
      form.append("file", file);
      form.append("clientId", clientId);
      form.append("bureau", bureau);
      return api.upload<CreditReport>(`/reports?clientId=${clientId}&bureau=${bureau}`, form);
    },
    onSuccess: (report) => {
      toast({ type: "success", title: "Report uploaded", description: "Parsing complete — AI analysis is running in the background." });
      setUploadOpen(false);
      setFile(null);
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => toast({ type: "error", title: "Upload failed", description: err.message }),
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credit reports</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ingested reports across all bureaus, parsed and AI-analyzed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {isStaff && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload report
            </Button>
          )}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} lines={4} className="h-44" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No reports yet"
          description={isStaff ? "Upload a CSV or PDF credit report from any bureau to start the AI pipeline." : "Ask your agency to upload your credit reports."}
          action={isStaff ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload your first report
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`}>
              <Card className="card-hover h-full p-5">
                <div className="flex items-start justify-between">
                  <Badge variant="info">{r.bureau}</Badge>
                  <Badge variant={statusVariant(r.status)}>{r.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-3 truncate text-sm font-semibold">{r.filename}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {r.client.name} · {formatDate(r.createdAt)}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3 text-xs">
                  <span className="text-slate-400">
                    {r._count?.accounts ?? 0} accounts · {r._count?.disputes ?? 0} disputes
                  </span>
                  <span className="flex items-center gap-1 font-medium text-brand-600 dark:text-brand-400">
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload credit report"
        description="CSV or PDF from Experian, Equifax or TransUnion. Parsed automatically, then AI-analyzed."
      >
        <div className="space-y-4">
          <Field label="Client">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clients?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bureau">
            <Select value={bureau} onChange={(e) => setBureau(e.target.value)}>
              {bureaus.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="File" hint="Max 25 MB">
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
                file ? "border-brand-500/50 bg-brand-500/5" : "border-slate-300/60 hover:border-brand-500/40 dark:border-white/10",
              )}
            >
              <Upload className="h-6 w-6 text-brand-500" />
              <span className="text-sm font-medium">{file ? file.name : "Click to choose a file"}</span>
              <span className="text-xs text-slate-400">.csv or .pdf</span>
              <input
                type="file"
                accept=".csv,.pdf,text/csv,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </Field>
          <Button className="w-full" loading={upload.isPending} onClick={() => upload.mutate()}>
            Upload & analyze
          </Button>
        </div>
      </Dialog>

      <ComplianceBanner />
    </div>
  );
}
