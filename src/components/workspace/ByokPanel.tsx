// UI for attaching / removing a personal Anthropic API key on a project.
// When active, the workspace is fully unlocked and Anthropic bills the user directly.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Key, ExternalLink, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearByokKey, getAiConfig, setByokKey } from "@/lib/ai-config.functions";

export function useAiConfig(projectId: string) {
  const fetchCfg = useServerFn(getAiConfig);
  return useQuery({
    queryKey: ["ai_config", projectId],
    queryFn: () => fetchCfg({ data: { project_id: projectId } }),
  });
}

export function ByokPanel({
  projectId,
  compact = false,
}: {
  projectId: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const { data: cfg } = useAiConfig(projectId);
  const [key, setKey] = useState("");
  const [expanded, setExpanded] = useState(false);

  const saveKey = useServerFn(setByokKey);
  const removeKey = useServerFn(clearByokKey);

  const saveMut = useMutation({
    mutationFn: () => saveKey({ data: { project_id: projectId, api_key: key.trim() } }),
    onSuccess: () => {
      toast.success("Key saved. Workspace unlocked — you're on your own Anthropic bill now.");
      setKey("");
      setExpanded(false);
      qc.invalidateQueries({ queryKey: ["ai_config", projectId] });
      qc.invalidateQueries({ queryKey: ["project_billing", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMut = useMutation({
    mutationFn: () => removeKey({ data: { project_id: projectId } }),
    onSuccess: () => {
      toast.success("Key removed. Reverted to managed billing.");
      qc.invalidateQueries({ queryKey: ["ai_config", projectId] });
      qc.invalidateQueries({ queryKey: ["project_billing", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = cfg?.ai_mode === "byok" && cfg.byok_key_last4;

  if (active) {
    return (
      <div className={compact ? "text-xs" : "space-y-3"}>
        <div className="flex items-center justify-between gap-3 rounded-md border border-navy/30 bg-navy/5 p-3">
          <div className="flex items-center gap-2 min-w-0">
            <Key className="h-3.5 w-3.5 shrink-0 text-navy" />
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-widest text-navy">
                Your Anthropic key · sk-ant-…{cfg.byok_key_last4}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Usage billed by Anthropic directly. No cost to you here.
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
            disabled={clearMut.isPending}
            onClick={() => {
              if (confirm("Remove this key? The case reverts to the free preview until you unlock it or add a new key.")) {
                clearMut.mutate();
              }
            }}
          >
            <Trash2 className="h-3 w-3" /> Remove
          </Button>
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setExpanded(true)}
        className="gap-1.5 border-navy/40 text-navy hover:bg-navy/5 hover:text-navy"
      >
        <Key className="h-3.5 w-3.5" /> Use your own Anthropic key — free
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Anthropic API key
        </label>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-navy underline decoration-dotted underline-offset-2"
        >
          console.anthropic.com <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <Input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="sk-ant-api03-…"
        className="h-8 font-mono text-xs"
        autoComplete="off"
        autoFocus
      />
      <p className="text-[11px] text-muted-foreground">
        Stored encrypted. We use it only to run this case. Anthropic bills you directly — expect ~$3–8 for a full petition draft.
      </p>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          disabled={saveMut.isPending || key.trim().length < 20}
          onClick={() => saveMut.mutate()}
          className="h-7 text-xs"
        >
          {saveMut.isPending ? "Verifying…" : "Verify & save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpanded(false);
            setKey("");
          }}
          className="h-7 text-xs text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
