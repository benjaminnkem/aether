"use client";

import { HambergerMenu } from "iconsax-react";
import { IconButton, Status } from "@aether/ui";
import { useUiStore } from "@/stores/ui";

export function Topbar({
  title,
  protocolName,
}: {
  title: string;
  protocolName?: string;
}) {
  const setSidebar = useUiStore((state) => state.setSidebarOpen);
  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <IconButton
          className="mobile-trigger"
          label="Open navigation"
          onClick={() => setSidebar(true)}
        >
          <HambergerMenu size={18} />
        </IconButton>
        <div className="breadcrumbs">
          {protocolName ?? "No protocol loaded"}&nbsp; / &nbsp;
          <strong>{title}</strong>
        </div>
      </div>
      <div className="topbar__actions">
        <Status status="warning" label="Live API session" />
      </div>
    </header>
  );
}
