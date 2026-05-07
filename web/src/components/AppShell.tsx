import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { SideNav } from "./SideNav";
import { api } from "../lib/api";
import type { HealthInfo } from "../../shared/types";

export function AppShell() {
  const [health, setHealth] = useState<HealthInfo | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-slate-900">claude-expert-kit</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
            v0.3 · web M1.5
          </span>
        </div>
        {health && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Projects</span>
            <span
              className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700"
              title={`auto-discovered from ~/workspace and ~/Desktop`}
            >
              {health.projectCount}
            </span>
          </div>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <SideNav />
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
