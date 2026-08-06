"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Letter } from "@/lib/api";
import { useRole } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { ArrowRight, Download, FileText, History, Send, Sparkles } from "@/components/ui/icons";

export default function LetterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isStaff } = useRole();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [body, setBody] = React.useState("");
  const [viewingVersion, setViewingVersion] = React.useState<number | null>(null);

  const { data: letter, isLoading } = useQuery({
    queryKey: ["letter", id],
    queryFn: () => api.get<Letter>(`/letters/${id}`),
  });

  React.useEffect(() => {
    if (letter && body === "") setBody(letter.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.id, letter?.body]);

  const saveVersion = useMutation({
    mutationFn: () => api.post<Letter>(`/letters/${id}/versions`, { body }),
    onSuccess: (l) => {
      toast({ type: "success", title: "New version saved", description: `v${l.version}` });
      setViewingVersion(null);
      qc.invalidateQueries({ queryKey: ["letter", id] });
    },
    onError: (e: Error) => toast({ type: "error", title: "Save failed", description: e.message }),
  });

  const markSent = useMutation({
    mutationFn: () => api.post<Letter>(`/letters/${id}/send`, { disputeId: letter?.dispute?.id }),
    onSuccess: () => {
      toast({ type: "success", title: "Letter marked as sent" });
      qc.invalidateQueries({ queryKey: ["letter", id] });
    },
  });

  if (isLoading || !letter) {
    return (
      <div className="space-y-6">
        <SkeletonCard lines={2} className="h-24" />
        <SkeletonCard lines={8} className="h-96" />
      </div>
    );
  }

  const activeBody = viewingVersion ? letter.versions.find((v) => v.version === viewingVersion)?.body ?? body : body;
  const isEdited = activeBody !== letter.body;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/letters" className="text-sm text-slate-400 hover:text-brand-500">← Letters</Link>
          <h1 className="mt-1 max-w-2xl text-2xl font-bold tracking-tight">{letter.title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {letter.client.name} · {letter.letterType} · v{letter.version} · {formatDate(letter.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(letter.status)}>{letter.status}</Badge>
          {letter.template && <Badge variant="neutral">{letter.template.name}</Badge>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Letter body</CardTitle>
                <CardDescription>
                  {viewingVersion ? `Viewing version v${viewingVersion} — switch back to edit` : "Editable — saving creates a new version"}
                </CardDescription>
              </div>
              {isStaff && (
                <div className="flex items-center gap-2">
                  <a href={`/api/letters/${letter.id}/pdf`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" /> PDF
                    </Button>
                  </a>
                  {letter.status !== "SENT" && (
                    <Button size="sm" loading={markSent.isPending} onClick={() => markSent.mutate()}>
                      <Send className="h-4 w-4" /> Mark sent
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[420px] font-serif text-[14px] leading-7"
                value={activeBody}
                disabled={viewingVersion !== null || !isStaff}
                onChange={(e) => setBody(e.target.value)}
              />
              {isStaff && viewingVersion === null && isEdited && (
                <div className="mt-3 flex justify-end">
                  <Button loading={saveVersion.isPending} onClick={() => saveVersion.mutate()}>
                    <Sparkles className="h-4 w-4" /> Save as v{letter.version + 1}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" /> Version history
              </CardTitle>
              <CardDescription>Every save is preserved</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {letter.versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setViewingVersion(viewingVersion === v.version ? null : v.version)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                      viewingVersion === v.version
                        ? "border-brand-500/40 bg-brand-500/8"
                        : "border-white/6 bg-white/3 hover:bg-white/6"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">v{v.version}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(v.createdAt)}</p>
                    </div>
                    {viewingVersion === v.version && <ArrowRight className="h-4 w-4 text-brand-500" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {letter.dispute && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Linked dispute
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/disputes/${letter.dispute.id}`} className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 p-3 transition-colors hover:bg-white/6">
                  <span className="truncate text-sm font-medium">{letter.dispute.title}</span>
                  <Badge variant="violet">R{letter.dispute.currentRound}</Badge>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
