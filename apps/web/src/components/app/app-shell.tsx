import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({
  title,
  children,
  organization,
  protocol,
}: {
  title: string;
  children: ReactNode;
  organization?: { name: string; role: string };
  protocol?: { name: string; environment: string };
}) {
  return (
    <div className="app-shell">
      <Sidebar organization={organization} protocol={protocol} />
      <div className="app-main">
        <Topbar title={title} protocolName={protocol?.name} />
        <main className="page" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
