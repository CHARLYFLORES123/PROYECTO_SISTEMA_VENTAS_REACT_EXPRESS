import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, X, AlertTriangle, Trash2, XCircle, ShieldAlert } from "lucide-react";
import { getToken } from "@/lib/auth";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AuditEntry {
  id: number;
  userName: string | null;
  userRole: string | null;
  action: string;
  actionLabel: string;
  entity: string;
  entityLabel: string;
  entityId: number | null;
  entityName: string | null;
  createdAt: string;
}

const CRITICAL_ACTIONS = ["cancelled", "deleted"];

async function fetchCriticalEvents(): Promise<AuditEntry[]> {
  const dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const results: AuditEntry[] = [];

  for (const action of CRITICAL_ACTIONS) {
    const res = await fetch(`/api/audit-logs?action=${action}&dateFrom=${dateFrom}&limit=20`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      const data = await res.json();
      results.push(...(data.data ?? []));
    }
  }

  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
}

const ACTION_ICON: Record<string, React.ElementType> = {
  cancelled: XCircle,
  deleted:   Trash2,
};

const ACTION_COLOR: Record<string, string> = {
  cancelled: "text-orange-500",
  deleted:   "text-red-500",
};

const ACTION_BG: Record<string, string> = {
  cancelled: "bg-orange-50 border-orange-100",
  deleted:   "bg-red-50 border-red-100",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["critical-events"],
    queryFn: fetchCriticalEvents,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unseenCount = events.filter(e => e.id > lastSeenId).length;

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && events.length > 0) {
      setLastSeenId(events[0].id);
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Alertas del sistema"
      >
        <Bell className="w-4 h-4" />
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold">Alertas críticas</span>
              <span className="text-xs text-muted-foreground">(últimas 24h)</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Bell className="w-6 h-6 opacity-30" />
                <p className="text-xs">Sin alertas en las últimas 24h</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {events.map(event => {
                  const Icon = ACTION_ICON[event.action] ?? AlertTriangle;
                  const color = ACTION_COLOR[event.action] ?? "text-gray-500";
                  const bg = ACTION_BG[event.action] ?? "bg-gray-50 border-gray-100";
                  const isNew = event.id > (lastSeenId - unseenCount);

                  return (
                    <div key={event.id} className={`px-4 py-3 ${isNew ? "bg-primary/5" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                          <Icon className={`w-3.5 h-3.5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground leading-snug">
                            <span className={`font-semibold ${color}`}>{event.actionLabel}</span>
                            {" "}{event.entityLabel.toLowerCase()}
                            {event.entityName && <span className="font-semibold"> "{event.entityName}"</span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            por <span className="font-medium">{event.userName ?? "Sistema"}</span>
                            {" · "}
                            {format(new Date(event.createdAt), "HH:mm 'del' dd MMM", { locale: es })}
                          </p>
                        </div>
                        {isNew && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {events.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-center">
              <a href="/audit" className="text-xs text-primary hover:underline font-medium">
                Ver registro completo →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
