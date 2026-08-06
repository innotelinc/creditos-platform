"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type DocumentItem, type User } from "@/lib/api";
import { useRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ComplianceBanner } from "@/components/ui/compliance-banner";
import { useToast } from "@/components/ui/toast";
import { Document as DocumentIcon, Upload, Download, X } from "@/components/ui/icons";
import { formatSize, formatDate } from "./page-utils";
import { cn } from "@/lib/utils";

const DOC_TYPES = [
  { value: "CREDIT_REPORT", label: "Credit report" },
  { value: "BUREAU_RESPONSE", label: "Bureau response" },
  { value: "ID_DOCUMENT", label: "ID document" },
  { value: "SSN_CARD", label: "SSN card" },
  { value: "UTILITY_BILL", label: "Utility bill" },
  { value: "POLICE_REPORT", label: "Police report" },
  { value: "FTC_REPORT", label: "FTC report" },
  { value: "SIGNED_LETTER", label: "Signed letter" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OTHER", label: "Other" },
];

export default function DocumentsPage() {
  const { isStaff } = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [type, setType] = React.useState("OTHER");
  const [clientId, setClientId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get<{ items: DocumentItem[]; total: number }>("/documents"),
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<{ items: User[] }>("/users/clients"),
    enabled: isStaff,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      const form = new FormData();
      form.append("file", file);
      const params = new URLSearchParams({ type });
      if (isStaff) {
        if (!clientId) throw new Error("Select a client");
        params.set("clientId", clientId);
      }
      return api.upload<DocumentItem>(`/documents?${params}`, form);
    },
    onSuccess: () => {
      toast({ type: "success", title: "Document uploaded", description: "Stored securely and encrypted at rest." });
      setUploadOpen(false);
      setFile(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: Error) => toast({ type: "error", title: "Upload failed", description: err.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      toast({ type: "success", title: "Document deleted" });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: Error) => toast({ type: "error", title: "Delete failed", description: err.message }),
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Document center</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Encrypted storage for ID, bills, reports and signed letters.
          </p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" /> Upload document
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} className="h-20" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<DocumentIcon className="h-6 w-6" />}
          title="No documents yet"
          description={isStaff ? "Upload IDs, utility bills or signed letters for your clients." : "Your agency can store documents here for your case."}
          action={(
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload your first document
            </Button>
          )}
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((d) => (
            <Card key={d.id} className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/12 text-brand-500">
                <DocumentIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <Badge variant="neutral">{d.type.replace("_", " ").toLowerCase()}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {d.client.name} · {formatSize(d.sizeBytes ?? 0)} · uploaded {formatDate(d.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/api/documents/${d.id}/download`}>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" /> Download
                  </Button>
                </a>
                {isStaff && (
                  <Button variant="outline" size="sm" className="text-rose-500 hover:bg-rose-500/10" onClick={() => remove.mutate(d.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload document" description="Encrypted at rest — accessible to you and your agency.">
        <div className="space-y-4">
          {isStaff && (
            <Field label="Client">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select client…</option>
                {clients?.items.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="File" hint="Max 25 MB">
            <label className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
              file ? "border-brand-500/50 bg-brand-500/5" : "border-slate-300/60 hover:border-brand-500/40 dark:border-white/10",
            )}>
              <Upload className="h-6 w-6 text-brand-500" />
              <span className="text-sm font-medium">{file ? file.name : "Click to choose a file"}</span>
              <span className="text-xs text-slate-400">PDF, image or text file</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
          <Button className="w-full" loading={upload.isPending} onClick={() => upload.mutate()}>
            Upload
          </Button>
        </div>
      </Dialog>

      <ComplianceBanner />
    </div>
  );
}
