"use client";

import { useState, type ReactNode } from "react";
import { Drawer, Status, Timeline } from "@aether/ui";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DemoController } from "./demo-controller";
import { useDashboard } from "@/features/dashboard/use-dashboard";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState(false);
  const { data } = useDashboard();
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar title={title} onNotifications={() => setNotifications(true)} />
        <main className="page" id="main-content">
          {children}
        </main>
      </div>
      <DemoController />
      <Drawer
        open={notifications}
        onOpenChange={setNotifications}
        title="Notifications"
        description="Permission-aware operational updates across Arcadia Labs."
      >
        <div className="context-strip">
          <Status
            status={data?.realtime ?? "connected"}
            label={`Realtime ${data?.realtime ?? "connected"}`}
          />
        </div>
        <Timeline
          items={(data?.notifications ?? []).map((item) => ({
            title: item.title,
            detail: `${item.subtitle} · ${item.value}`,
            status: item.status,
          }))}
        />
      </Drawer>
    </div>
  );
}
