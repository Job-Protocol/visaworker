import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SealMark } from "@/components/SealMark";
import { useQueryClient } from "@tanstack/react-query";
import { HeaderNavExtras } from "@/ee";


export function AppShell({
  children,
  title,
  actions,
}: {
  children: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="h-0.5 w-full bg-gradient-to-r from-navy via-paper to-crimson" />
      <header className="border-b border-ink/10 bg-paper/80 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 sm:flex sm:justify-between sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Link to="/projects" className="flex shrink-0 items-center gap-2">
              <SealMark className="h-7 w-7" />
              <span className="hidden font-serif text-lg tracking-tight text-ink sm:inline">
                visaworker<span className="italic text-crimson">.ai</span>
              </span>
            </Link>
            {title && (
              <span className="min-w-0 truncate text-xs uppercase tracking-[0.18em] text-ink/55">
                {title}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {actions}
            <HeaderNavExtras />

            <Link
              to="/account"
              className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/60 hover:text-crimson sm:inline"
            >
              Account
            </Link>

            <Button size="sm" variant="ghost" onClick={signOut} className="px-2 text-ink/70 hover:bg-crimson hover:text-paper sm:px-3">
              <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-[0.2em]">Sign out</span>
              <span className="sm:hidden text-xs">Exit</span>
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
