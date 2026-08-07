"use client";

import { HambergerMenu } from "iconsax-react";
import { IconButton, Status } from "@aether/ui";
import { useUiStore } from "@/stores/ui";
import { ThemeToggle } from "@/components/theme-toggle";

export function Topbar({
  title,
  protocolName,
  realtime = "reconnecting",
}: {
  title: string;
  protocolName?: string;
  realtime?: "connected" | "reconnecting" | "offline";
}) {
  const setSidebar = useUiStore((state) => state.setSidebarOpen);
  return (
    <header className="topbar">
      <div className="topbar__lead">
        <IconButton
          className="mobile-trigger"
          label="Open navigation"
          onClick={() => setSidebar(true)}
        >
          <HambergerMenu size={18} />
        </IconButton>
        <div className="breadcrumbs">
          <span className="breadcrumbs__protocol">
            {protocolName ?? "No protocol loaded"}&nbsp; / &nbsp;
          </span>
          <strong>{title}</strong>
        </div>
      </div>
      <div className="topbar__actions">
        <ThemeToggle compact className="theme-toggle--topbar" />
        <Status
          status={
            realtime === "connected"
              ? "healthy"
              : realtime === "offline"
                ? "critical"
                : "warning"
          }
          label={
            realtime === "connected"
              ? "Realtime connected"
              : realtime === "offline"
                ? "Realtime offline"
                : "Realtime reconnecting"
          }
        />
      </div>
    </header>
  );
}
