// Compact user-facing review dialog for a single exhibit. Shows the AI's
// summary + per-page reasons and lets the user override the page selection
// (range input) or revert to the untouched original.

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { applyExhibitSelection, rerunExhibitReview } from "@/lib/exhibits.functions";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";

export type ReviewDialogExhibit = {
  id: string;
  label: string;
  title: string;
  mime_type: string;
  page_count: number | null;
  original_page_count: number | null;
  included_pages: number[] | null;
  review_status: string | null;
  ai_recommendation:
    | {
        keep?: number[];
        drop?: number[];
        reasons?: Record<string, string>;
        summary?: string;
        confidence?: number;
        relevance?: string;
        model?: string;
        created_at?: string;
      }
    | null;
};

function parseRange(input: string, total: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of input.split(/[,\s]+/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const m = chunk.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    for (let p = lo; p <= hi; p++) {
      if (p >= 1 && p <= total && !seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out;
}

function pagesToRange(pages: number[]): string {
  if (pages.length === 0) return "";
  const sorted = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = start;
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  return parts.join(", ");
}

const RELEVANCE_COLOR: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  low: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  irrelevant: "bg-destructive/10 text-destructive",
};

export function ExhibitReviewDialog({
  exhibit,
  open,
  onOpenChange,
  onChanged,
}: {
  exhibit: ReviewDialogExhibit | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const applyFn = useServerFn(applyExhibitSelection);
  const rerunFn = useServerFn(rerunExhibitReview);

  const total = exhibit?.original_page_count ?? exhibit?.page_count ?? 0;
  const currentPages = useMemo(() => {
    if (!exhibit) return [] as number[];
    if (exhibit.included_pages && exhibit.included_pages.length) return exhibit.included_pages;
    if (exhibit.ai_recommendation?.keep?.length) return exhibit.ai_recommendation.keep;
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [exhibit, total]);
  const [rangeInput, setRangeInput] = useState("");

  useEffect(() => {
    if (open) setRangeInput(pagesToRange(currentPages));
  }, [open, currentPages]);

  const parsedPages = useMemo(() => parseRange(rangeInput, total), [rangeInput, total]);

  const apply = useMutation({
    mutationFn: async (pages: number[] | null) => {
      if (!exhibit) throw new Error("No exhibit");
      return applyFn({ data: { exhibitId: exhibit.id, pages } });
    },
    onSuccess: (r) => {
      toast.success(r.reverted ? "Reverted to original" : `Kept ${r.pages} page${r.pages === 1 ? "" : "s"}`);
      onChanged?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rerun = useMutation({
    mutationFn: async () => {
      if (!exhibit) throw new Error("No exhibit");
      return rerunFn({ data: { exhibitId: exhibit.id } });
    },
    onSuccess: (r) => {
      toast.success(`AI review: kept ${r.kept}/${r.total} pages (${r.status})`);
      onChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!exhibit) return null;

  const rec = exhibit.ai_recommendation;
  const relevance = rec?.relevance ?? "unknown";
  const confidence =
    typeof rec?.confidence === "number" ? Math.round(rec.confidence * 100) : null;
  const droppedReasons = rec?.reasons ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Review pages · {exhibit.label}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{exhibit.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* AI summary card */}
          {rec ? (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge className={RELEVANCE_COLOR[relevance] ?? ""} variant="outline">
                  {relevance}
                </Badge>
                {confidence != null && (
                  <span className="text-muted-foreground">confidence {confidence}%</span>
                )}
                <span className="text-muted-foreground">
                  · kept {currentPages.length}/{total} pages
                </span>
                {exhibit.review_status && (
                  <span className="text-muted-foreground">· status: {exhibit.review_status}</span>
                )}
              </div>
              {rec.summary && (
                <p className="whitespace-pre-wrap text-sm text-foreground/90">{rec.summary}</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              No AI review yet. Run one to get recommendations.
            </div>
          )}

          {/* Range editor */}
          <div className="space-y-1.5">
            <Label htmlFor="pages" className="text-xs">
              Included pages ({total} total)
            </Label>
            <Input
              id="pages"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="e.g. 1-3, 7, 12-14"
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{parsedPages.length} selected</span>
              <button
                type="button"
                className="text-primary underline underline-offset-2"
                onClick={() => setRangeInput(pagesToRange(Array.from({ length: total }, (_, i) => i + 1)))}
              >
                Keep all
              </button>
              {rec?.keep?.length ? (
                <button
                  type="button"
                  className="text-primary underline underline-offset-2"
                  onClick={() => setRangeInput(pagesToRange(rec.keep!))}
                >
                  Use AI selection
                </button>
              ) : null}
              <button
                type="button"
                className="text-primary underline underline-offset-2"
                onClick={() => setRangeInput("")}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Per-page reasons for dropped pages */}
          {Object.keys(droppedReasons).length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                AI reasons for dropped pages
              </div>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                <ul className="divide-y divide-border text-xs">
                  {Object.entries(droppedReasons).map(([p, reason]) => (
                    <li key={p} className="flex gap-3 px-3 py-1.5">
                      <span className="w-10 shrink-0 tabular-nums text-muted-foreground">p.{p}</span>
                      <span className="text-foreground/80">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rerun.isPending}
              onClick={() => rerun.mutate()}
            >
              {rerun.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Re-run AI review
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={apply.isPending}
              onClick={() => apply.mutate(null)}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Revert to original
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={apply.isPending || parsedPages.length === 0 || parsedPages.length > 60}
            onClick={() => apply.mutate(parsedPages)}
          >
            {apply.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Save selection ({parsedPages.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
