"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, type Dispute, type Letter, type LetterTemplate } from "@/lib/api";
import { useRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SkeletonCard } from "@/components/ui/skeleton";
import { ComplianceBanner } from "@/components/ui/compliance-banner";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { ArrowRight, Check, Gavel, Mail, RefreshCw } from "@/components/ui/icons";

const roundStatusSteps = ["SENT", "DELIVERED", "RECEIVED", "RESPONSE_RECEIVED"];

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>() ?? { id: "" };
  const { isStaff } = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [roundOpen, setRoundOpen] = React.useState(false);
  const [letterId, setLetterId] = React.useState("");
  const [responseOpen, setResponseOpen] = React.useState(false);
  const [result, setResult] = React.useState("resolved");

  const { data: dispute, isLoading } = useQuery({
    queryKey: ["dispute", id],
    queryFn: () => api.get<Dispute>(`/disputes/${id}`),
  });

  const { data: letters } = useQuery({
    queryKey: ["letters-ready"],
    queryFn: () => api.get<{ items: Letter[] }>("/letters?status=READY"),
    enabled: isStaff && !isLoading,
  });

  const startRound = useMutation({
    mutationFn: () => api.post<Dispute>(`/disputes/${id}/rounds`, { letterId: letterId || undefined }),
    onSuccess: (d) => {
      toast({ type: "success", title: `Round ${d.currentRound} started` });
      setRoundOpen(false);
      setLetterId("");
      qc.invalidateQueries({ queryKey: ["dispute", id] });
    },
    onError: (e: Error) => toast({ type: "error", title: "Failed", description: e.message }),
  });

  const recordResponse = useMutation({
    mutationFn: () =>
      api.post<Dispute>(`/disputes/${id}/rounds/${dispute?.currentRound}/response`, { result }),
    onSuccess: (d) => {
      toast({ type: "success", title: "Response recorded", description: d.status === "RESOLVED" ? "Dispute resolved 🎉" : "Timeline updated." });
      setResponseOpen(false);
      qc.invalidateQueries({ queryKey: ["dispute", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast({ type: "error", title: "Failed", description: e.message }),
  });

  const escalate = useMutation({
    mutationFn: () => api.post<Dispute>(`/disputes/${id}/escalate`, { reason: "Escalated for attorney review / CFPB filing" }),
    onSuccess: () => {
      toast({ type: "success", title: "Escalated", description: "Marked for attorney review." });
      qc.invalidateQueries({ queryKey: ["dispute", id] });
    },
  });

  if (isLoading || !dispute) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={2} className="h-28" />
        <SkeletonCard lines={5} className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/disputes" className="text-sm text-slate-400 hover:text-brand-500">← Disputes</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{dispute.title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {dispute.client.name} · created {formatDate(dispute.createdAt)}
            {dispute.report && <> · on {dispute.report.filename}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(dispute.status)}>{dispute.status.replace("_", " ")}</Badge>
          <Badge variant="violet">Round {dispute.currentRound}</Badge>
          {isStaff && dispute.status !== "RESOLVED" && dispute.status !== "REJECTED" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setResponseOpen(true)}>
                <Check className="h-4 w-4" /> Record response
              </Button>
              <Button variant="outline" size="sm" onClick={() => escalate.mutate()}>
                Escalate
              </Button>
              <Button size="sm" onClick={() => setRoundOpen(true)}>
                <RefreshCw className="h-4 w-4" /> Start round {dispute.currentRound + 1}
              </Button>
            </>
          )}
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Round timeline</CardTitle>
              <CardDescription>Sent → Delivered → Received → Response</CardDescription>
            </CardHeader>
            <CardContent>
              {dispute.rounds.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No rounds yet — generate a letter and start round 1.
                </p>
              ) : (
                <div className="space-y-6">
                  {dispute.rounds.map((r) => {
                    const stepIdx = roundStatusSteps.indexOf(r.status);
                    const isResolved = r.status === "RESOLVED" || r.status === "REJECTED";
                    return (
                      <div key={r.id} className="relative pl-6">
                        {/* connector */}
                        <div className="absolute left-[7px] top-5 h-full w-px bg-white/10" />
                        <div className="absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-brand-500/50 bg-brand-500/20">
                          <div className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">Round {r.roundNumber}</p>
                          <Badge variant={statusVariant(r.status)}>{r.status.replace("_", " ")}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {r.sentAt && <>Sent {formatDate(r.sentAt)}</>}
                          {r.deliveredAt && <> · Delivered {formatDate(r.deliveredAt)}</>}
                          {r.responseAt && <> · Responded {formatDate(r.responseAt)}</>}
                        </p>
                        {r.letter && (
                          <Link href={`/letters/${r.letter.id}`} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-500/8 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/15 dark:text-brand-300">
                            <Mail className="h-3.5 w-3.5" /> {r.letter.title} <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                        {r.responseSummary && (
                          <p className="mt-2 rounded-lg bg-white/4 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {r.responseSummary}
                          </p>
                        )}
                        {(isResolved || r.result) && (
                          <Badge className="mt-2" variant={r.result === "resolved" ? "success" : "danger"}>
                            {r.result === "resolved" ? "✓ Item resolved" : "Response received"}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Letters */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Letters</CardTitle>
                <CardDescription>Letters attached to this dispute</CardDescription>
              </div>
              <Link href="/letters" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                Library
              </Link>
            </CardHeader>
            <CardContent>
              {dispute.letters.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No letters yet.</p>
              ) : (
                <div className="space-y-2">
                  {dispute.letters.map((l) => (
                    <Link key={l.id} href={`/letters/${l.id}`} className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 p-3.5 transition-colors hover:bg-white/6">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.title}</p>
                        <p className="text-xs text-slate-400">{l.letterType} · v{l.version}</p>
                      </div>
                      <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Case details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Client</span><span className="font-medium">{dispute.client.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Priority</span>
                <Badge variant={dispute.priority === "HIGH" || dispute.priority === "URGENT" ? "danger" : dispute.priority === "MEDIUM" ? "warning" : "neutral"}>{dispute.priority}</Badge>
              </div>
              <div className="flex justify-between"><span className="text-slate-400">Current round</span><span className="font-medium">{dispute.currentRound} / 5</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Updated</span><span className="font-medium">{formatDate(dispute.updatedAt)}</span></div>
              {dispute.notes && (
                <div className="rounded-lg bg-amber-500/8 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  {dispute.notes}
                </div>
              )}
            </CardContent>
          </Card>
          <ComplianceBanner />
        </div>
      </div>

      {/* Start round dialog */}
      <Dialog open={roundOpen} onClose={() => setRoundOpen(false)} title={`Start round ${dispute.currentRound + 1}`} description="Attach a ready letter to begin the round as 'Sent'.">
        <div className="space-y-4">
          <Field label="Letter">
            <Select value={letterId} onChange={(e) => setLetterId(e.target.value)}>
              <option value="">No letter (manual send)</option>
              {letters?.items.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </Select>
          </Field>
          <Button className="w-full" loading={startRound.isPending} onClick={() => startRound.mutate()}>
            Start round {dispute.currentRound + 1}
          </Button>
        </div>
      </Dialog>

      {/* Response dialog */}
      <Dialog open={responseOpen} onClose={() => setResponseOpen(false)} title="Record bureau response" description="Updates the timeline and dispute status automatically.">
        <div className="space-y-4">
          <Field label="Outcome">
            <Select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="resolved">Resolved — item removed/corrected</option>
              <option value="verified">Verified — furnisher confirmed item</option>
              <option value="rejected">Rejected — dispute not accepted</option>
              <option value="no_response">No response received</option>
            </Select>
          </Field>
          <Button className="w-full" loading={recordResponse.isPending} onClick={() => recordResponse.mutate()}>
            Save response
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
