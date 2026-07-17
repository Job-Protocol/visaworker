import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompilePanel } from "@/components/CompilePanel";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  ChevronDown,
  ChevronLeft,
  Compass,
  FileText,
  ListTree,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Settings,
  UserCircle,
} from "lucide-react";
import { SealMark } from "@/components/SealMark";
import { SectionsPane } from "@/components/workspace/SectionsPane";
import { ExhibitsPane } from "@/components/workspace/ExhibitsPane";
import { StrategyPane } from "@/components/workspace/StrategyPane";
import { ChatPane } from "@/components/workspace/ChatPane";
import { SettingsPane } from "@/components/workspace/SettingsPane";
import { DemoBanner } from "@/components/workspace/DemoBanner";
import { FreeBanner } from "@/components/workspace/FreeBanner";
import { DEMO_PROJECT_ID } from "@/lib/demo-config";
import { BudgetRing, useProjectBilling } from "@/components/workspace/TokenMeter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Petition workspace — visaworker.ai" },
      { name: "description", content: "Draft, cite, and build this petition." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (
    s: Record<string, unknown>,
  ): { topup?: string; unlock?: string; session_id?: string } => ({
    topup: (s.topup as string | undefined) ?? undefined,
    unlock: (s.unlock as string | undefined) ?? undefined,
    session_id: (s.session_id as string | undefined) ?? undefined,
  }),
  component: PetitionWorkspace,
});

type Pane = "strategy" | "exhibits" | "sections" | "preview" | "settings";
type MobileTab = "chat" | Pane;

const NAV: { key: Pane; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "strategy", label: "Strategy", icon: Compass },
  { key: "exhibits", label: "Exhibits", icon: Paperclip },
  { key: "sections", label: "Sections", icon: ListTree },
  { key: "preview", label: "Preview", icon: FileText },
];


function PetitionWorkspace() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const router = useRouter();
  const qc = useQueryClient();
  const [pane, setPane] = useState<Pane>("strategy");
  const [paneOpen, setPaneOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  // Close side panes on first load when intake isn't complete — new cases start
  // with just the intake form + chat visible, uncluttered by the workspace tabs.
  const [paneAutoAdjusted, setPaneAutoAdjusted] = useState(false);

  function handlePaneClick(next: Pane) {
    if (next === pane && paneOpen) {
      setPaneOpen(false);
    } else {
      setPane(next);
      setPaneOpen(true);
    }
  }

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (paneAutoAdjusted || !project) return;
    const intakeDone = !!(project.profile_data as { intake_completed_at?: string } | null)?.intake_completed_at;
    if (!intakeDone) setPaneOpen(false);
    setPaneAutoAdjusted(true);
  }, [project, paneAutoAdjusted]);

  // Chat markdown emits this when the user clicks a pane keyword (e.g. **Strategy**).
  useEffect(() => {
    function onOpenPane(e: Event) {
      const detail = (e as CustomEvent<{ pane?: Pane }>).detail;
      if (!detail?.pane) return;
      setPane(detail.pane);
      setPaneOpen(true);
      setMobileTab(detail.pane);
    }
    window.addEventListener("visaworker:open-pane", onOpenPane);
    return () => window.removeEventListener("visaworker:open-pane", onOpenPane);
  }, []);

  useEffect(() => {
    if (search.topup === "success") {
      toast.success("Top-up applied");
      qc.invalidateQueries({ queryKey: ["project_billing", id] });
      router.navigate({ to: "/projects/$id", params: { id }, search: {}, replace: true });
    } else if (search.topup === "cancel") {
      toast.info("Top-up canceled");
      router.navigate({ to: "/projects/$id", params: { id }, search: {}, replace: true });
    } else if (search.unlock === "success") {
      toast.success("Case unlocked — full budget and downloads enabled");
      qc.invalidateQueries({ queryKey: ["project_billing", id] });
      router.navigate({ to: "/projects/$id", params: { id }, search: {}, replace: true });
    } else if (search.unlock === "cancel") {
      toast.info("Unlock canceled");
      router.navigate({ to: "/projects/$id", params: { id }, search: {}, replace: true });
    }
  }, [search.topup, search.unlock, id, qc, router]);

  // Close any open right-side tab on Escape (desktop: pane; mobile: back to chat).
  // Modals/dialogs take precedence — if a shadcn Dialog/AlertDialog is open, ignore.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (paneOpen) {
        setPaneOpen(false);
      } else if (mobileTab !== "chat") {
        setMobileTab("chat");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paneOpen, mobileTab]);

  const isDemo = id === DEMO_PROJECT_ID;
  const { data: billing } = useProjectBilling(id);
  const isFree = billing?.status === "free";

  return (
    <>
      {/* Desktop: sidebar + chat + content pane */}
      <div className="hidden h-[100dvh] w-full flex-col bg-background md:flex">
        <div className="min-h-0 flex-1">
          <SidebarProvider defaultOpen={false} className="h-full min-h-0">
            <WorkspaceSidebar projectId={id} project={project} pane={pane} paneOpen={paneOpen} onPaneClick={handlePaneClick} isDemo={isDemo} />
            <SidebarInset className="min-w-0">
              {isDemo && <DemoBanner />}
              {!isDemo && isFree && <FreeBanner projectId={id} />}
              <DesktopContent projectId={id} pane={pane} paneOpen={paneOpen} onPaneClick={handlePaneClick} onCloseSettings={() => setPaneOpen(false)} />
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>

      {/* Mobile: keep the compact bottom-tab layout */}
      <div className="flex h-[100dvh] w-full flex-col bg-background md:hidden">
        {isDemo && <DemoBanner />}
        {!isDemo && isFree && <FreeBanner projectId={id} />}
        <MobileHeader project={project} isDemo={isDemo} onOpenSettings={() => setMobileTab("settings")} settingsActive={mobileTab === "settings"} />
        <div className="min-h-0 flex-1 overflow-hidden">
          {mobileTab === "chat" && (
            <div className="h-full">
              <ClientOnly fallback={<div className="p-6 text-sm text-muted-foreground">Loading chat…</div>}>
                <ChatPane projectId={id} onNavigate={(p) => setMobileTab(p)} />
              </ClientOnly>
            </div>
          )}
          {mobileTab === "strategy" && (
            <div className="h-full overflow-hidden px-3 pt-3">
              <StrategyPane projectId={id} />
            </div>
          )}
          {mobileTab === "sections" && (
            <div className="h-full overflow-auto px-3 pt-3">
              <SectionsPane projectId={id} />
            </div>
          )}
          {mobileTab === "exhibits" && (
            <div className="h-full overflow-auto px-3 pt-3">
              <ExhibitsPane projectId={id} />
            </div>
          )}
          {mobileTab === "preview" && (
            <div className="h-full overflow-auto px-3 pt-3">
              <ClientOnly fallback={<div className="p-4 text-sm text-muted-foreground">Loading preview…</div>}>
                <CompilePanel projectId={id} />
              </ClientOnly>
            </div>
          )}
          {mobileTab === "settings" && (
            <div className="h-full overflow-hidden">
              <SettingsPane projectId={id} onClose={() => setMobileTab("chat")} />
            </div>
          )}
        </div>
        <nav
          className="h-16 shrink-0 border-t border-border bg-card/95 backdrop-blur"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
            <MobileTabButton label="Chat" icon={<MessageSquare className="h-5 w-5" />} active={mobileTab === "chat"} onClick={() => setMobileTab("chat")} />
            <MobileTabButton label="Strategy" icon={<Compass className="h-5 w-5" />} active={mobileTab === "strategy"} onClick={() => setMobileTab("strategy")} />
            <MobileTabButton label="Exhibits" icon={<Paperclip className="h-5 w-5" />} active={mobileTab === "exhibits"} onClick={() => setMobileTab("exhibits")} />
            <MobileTabButton label="Sections" icon={<ListTree className="h-5 w-5" />} active={mobileTab === "sections"} onClick={() => setMobileTab("sections")} />
            <MobileTabButton label="Preview" icon={<FileText className="h-5 w-5" />} active={mobileTab === "preview"} onClick={() => setMobileTab("preview")} />
          </ul>

        </nav>
      </div>
    </>
  );
}

// ------------- Desktop sidebar -------------

function WorkspaceSidebar({
  projectId,
  project,
  pane,
  paneOpen,
  onPaneClick,
  isDemo,
}: {
  projectId: string;
  project: { name: string; visa_type: string } | null | undefined;
  pane: Pane;
  paneOpen: boolean;
  onPaneClick: (p: Pane) => void;
  isDemo?: boolean;
}) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: isDemo ? "/" : "/auth", replace: true });
  }

  const { data: userEmail } = useQuery({
    queryKey: ["auth-user-email"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.email ?? null;
    },
    staleTime: 60_000,
  });
  const initials = (userEmail ?? "?").slice(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-ink/10">
      <SidebarHeader className={collapsed ? "p-2" : "p-3"}>
        <Link
          to="/projects"
          className={cn(
            "flex items-center gap-2 rounded-md px-1 py-1",
            collapsed && "justify-center px-0",
          )}
        >
          <SealMark className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="font-serif text-base tracking-tight text-ink">
              visaworker<span className="italic text-crimson">.ai</span>
            </span>
          )}
        </Link>
        {!collapsed && project && (
          <div className="px-1 pt-1">
            <Link
              to="/projects"
              className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-crimson"
            >
              <ChevronLeft className="h-3 w-3" /> Petitions
            </Link>
            <button
              type="button"
              onClick={() => onPaneClick("settings")}
              className={cn(
                "-mx-1 block w-[calc(100%+0.5rem)] rounded-md px-1 py-1 text-left transition-colors hover:bg-sidebar-accent",
                pane === "settings" && paneOpen && "bg-sidebar-accent",
              )}
              title="Case settings"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 border-navy/60 px-1.5 py-0 text-[10px] text-navy">
                  {project.visa_type}
                </Badge>
              </div>
              <p className="mt-1.5 truncate font-serif text-sm text-foreground" title={project.name}>
                {project.name}
              </p>
            </button>

          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={pane === item.key && paneOpen}
                    onClick={() => onPaneClick(item.key)}
                    tooltip={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("gap-1 border-t border-sidebar-border", collapsed ? "p-2" : "p-2")}>
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => toggleSidebar()}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground transition-colors hover:bg-sidebar-accent active:bg-sidebar-accent",
            collapsed && "justify-center",
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="flex-1 text-left">Collapse</span>}
        </button>

        {/* User menu: single avatar+ring trigger opens account/settings menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-sidebar-accent active:bg-sidebar-accent",
                collapsed ? "justify-center" : "px-2",
                pane === "settings" && paneOpen && "bg-sidebar-accent",
              )}
              title="Account menu"
            >
              <BudgetRing projectId={projectId} size={40} stroke={3}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-muted text-[11px] font-medium text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </BudgetRing>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground">
                    {userEmail ?? "Account"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className="w-56">
            {userEmail && (
              <>
                <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                  {userEmail}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onPaneClick("settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Case settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/account" className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:bg-destructive focus:text-destructive-foreground">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

// ------------- Desktop content -------------

function DesktopContent({
  projectId,
  pane,
  paneOpen,
  onPaneClick,
  onCloseSettings,
}: {
  projectId: string;
  pane: Pane;
  paneOpen: boolean;
  onPaneClick: (p: Pane) => void;
  onCloseSettings: () => void;
}) {
  const chat = (centered = false) => (
    <ClientOnly fallback={<div className="p-6 text-sm text-muted-foreground">Loading chat…</div>}>
      <ChatPane projectId={projectId} onNavigate={(p) => onPaneClick(p)} centered={centered} />
    </ClientOnly>
  );

  const isSettings = pane === "settings" && paneOpen;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 p-3">
        {isSettings ? (
          <section className="h-full min-h-0 w-full rounded-lg border border-border bg-card">
            <SettingsPane projectId={projectId} onClose={onCloseSettings} />
          </section>
        ) : paneOpen ? (
          <Group orientation="horizontal" className="h-full w-full">
            <Panel defaultSize="42%" minSize="20%" maxSize="80%" collapsible={false}>
              <section className="h-full min-h-0">{chat()}</section>
            </Panel>
            <Separator className="group relative z-10 -mx-1.5 w-3 cursor-col-resize bg-transparent transition-colors hover:bg-navy/10 active:bg-navy/20">
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border p-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-muted-foreground">
                  <circle cx="2.5" cy="2.5" r="1" fill="currentColor" />
                  <circle cx="7.5" cy="2.5" r="1" fill="currentColor" />
                  <circle cx="2.5" cy="7.5" r="1" fill="currentColor" />
                  <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
                </svg>
              </span>
            </Separator>
            <Panel defaultSize="58%" minSize="20%" maxSize="80%" collapsible={false}>
              <section className="h-full min-h-0 rounded-lg border border-border bg-card p-3">
                {pane === "strategy" && (
                  <div className="h-full overflow-hidden"><StrategyPane projectId={projectId} /></div>
                )}
                {pane === "sections" && (
                  <div className="h-full overflow-auto"><SectionsPane projectId={projectId} /></div>
                )}
                {pane === "exhibits" && (
                  <div className="h-full overflow-auto"><ExhibitsPane projectId={projectId} /></div>
                )}
                {pane === "preview" && (
                  <div className="h-full overflow-auto">
                    <ClientOnly fallback={<div className="p-4 text-sm text-muted-foreground">Loading preview…</div>}>
                      <CompilePanel projectId={projectId} />
                    </ClientOnly>
                  </div>
                )}
              </section>
            </Panel>
          </Group>
        ) : (
          <section className="h-full min-h-0 w-full">{chat(true)}</section>
        )}
      </div>
    </div>
  );
}

// ------------- Mobile header + tab button -------------

function MobileHeader({ project, isDemo, onOpenSettings, settingsActive }: { project: { name: string; visa_type: string } | null | undefined; isDemo?: boolean; onOpenSettings: () => void; settingsActive: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: isDemo ? "/" : "/auth", replace: true });
  }
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-ink/10 bg-paper/80 px-3 backdrop-blur">
      <Link to="/projects" className="flex min-w-0 items-center gap-2">
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        {project && (
          <>
            <Badge variant="outline" className="shrink-0 border-navy/60 px-1.5 py-0 text-[10px] text-navy">
              {project.visa_type}
            </Badge>
            <span className="truncate font-serif text-sm text-foreground">{project.name}</span>
          </>
        )}
      </Link>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenSettings}
          aria-pressed={settingsActive}
          className={cn("px-2 text-ink/70", settingsActive && "text-crimson")}
          title="Case settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={signOut} className="px-2 text-ink/70">
          <span className="text-xs">Exit</span>
        </Button>
      </div>
    </header>
  );
}


function MobileTabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={
          "relative flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors " +
          (active ? "text-crimson" : "text-muted-foreground hover:text-foreground")
        }
      >
        {active && <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-crimson" />}
        {icon}
        <span>{label}</span>
      </button>
    </li>
  );
}
