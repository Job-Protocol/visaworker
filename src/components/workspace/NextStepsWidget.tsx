// Inline "next step" chip row rendered inside an assistant message when the
// agent calls the `suggest_next_steps` tool. Tapping a chip sends its prompt
// as the user's next message and collapses the row.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { track } from "@/ee";

export type NextStepSuggestion = { label: string; prompt: string };

const storageKey = (toolUseId: string) => `vw:next-steps:${toolUseId}`;

export function NextStepsWidget({
  projectId,
  toolUseId,
  suggestions,
  onPick,
}: {
  projectId: string;
  toolUseId: string;
  suggestions: NextStepSuggestion[];
  // Kept for API compatibility; chips are shown regardless of position so
  // they don't vanish when the model emits a follow-up assistant message
  // after the suggest_next_steps tool call.
  isLatestAssistant?: boolean;
  onPick: (prompt: string) => void;
}) {
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey(toolUseId));
      if (stored) setPickedLabel(stored);
    } catch {
      // ignore
    }
  }, [toolUseId]);

  const cleaned = suggestions.filter((s) => s?.label && s?.prompt).slice(0, 4);
  if (cleaned.length < 2) return null;

  if (pickedLabel) {
    return (
      <div className="rounded-md border border-border/60 bg-parchment/40 px-4 py-2 text-xs text-muted-foreground">
        <span className="opacity-70">Chose:</span>{" "}
        <span className="text-foreground">{pickedLabel}</span>
      </div>
    );
  }

  

  const pick = (s: NextStepSuggestion) => {
    setPickedLabel(s.label);
    try {
      window.localStorage.setItem(storageKey(toolUseId), s.label);
    } catch {
      // ignore
    }
    track("next_step_chip_clicked", { project_id: projectId, label: s.label });
    onPick(s.prompt);
  };

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border/60 bg-parchment/40 px-3 py-2.5">
      {cleaned.map((s, i) => (
        <Button
          key={i}
          type="button"
          variant="outline"
          size="sm"
          className="h-auto rounded-full border-navy/30 bg-background px-3 py-1 text-xs font-medium text-navy hover:border-navy hover:bg-navy hover:text-primary-foreground"
          onClick={() => pick(s)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}
