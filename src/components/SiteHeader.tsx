import { Link } from "@tanstack/react-router";
import { Activity, ShieldCheck } from "lucide-react";

const navLink =
  "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 py-6">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-signal/15 text-signal">
          <Activity className="size-4" />
        </span>
        <span className="font-display text-2xl tracking-tight">veyra</span>
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground md:flex">
          <ShieldCheck className="size-3.5 text-signal" />
          Runs in your browser · no video uploaded
        </span>
        <nav className="flex items-center gap-1 rounded-full border border-border p-1">
          <Link to="/" className={navLink} activeOptions={{ exact: true }}>
            Measure
          </Link>
          <Link to="/history" className={navLink}>
            History
          </Link>
        </nav>
      </div>
    </header>
  );
}
