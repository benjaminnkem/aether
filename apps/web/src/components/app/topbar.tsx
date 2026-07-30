"use client";

import { useState } from "react";
import { HambergerMenu, Notification, SearchNormal1 } from "iconsax-react";
import { Button, Dialog, IconButton } from "@aether/ui";
import { useUiStore } from "@/stores/ui";

export function Topbar({
  title,
  onNotifications,
}: {
  title: string;
  onNotifications: () => void;
}) {
  const [search, setSearch] = useState(false);
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
          Arcadia Markets&nbsp; / &nbsp;<strong>{title}</strong>
        </div>
      </div>
      <div className="topbar__actions">
        <Button
          className="search-button"
          variant="secondary"
          size="sm"
          onClick={() => setSearch(true)}
        >
          <SearchNormal1 size={14} />
          <span>Search or run a command</span>
          <span className="kbd">⌘ K</span>
        </Button>
        <IconButton label="Open notifications" onClick={onNotifications}>
          <Notification size={17} />
          <span className="sr-only">1 unread notification</span>
        </IconButton>
      </div>
      <Dialog
        open={search}
        onOpenChange={setSearch}
        title="Search Aether"
        description="Find resources or run a permission-aware command."
      >
        <input
          className="a-input"
          autoFocus
          placeholder="Search protocols, operations, addresses, hashes…"
          aria-label="Search Aether"
        />
        <div className="command-list" style={{ marginTop: 12 }}>
          {[
            ["Open critical drift", "D R"],
            ["Create operation", "C O"],
            ["Go to desired state", "G D"],
            ["Scan Arcadia Markets", "S P"],
          ].map(([label, key]) => (
            <button
              key={label}
              className="command-item"
              onClick={() => setSearch(false)}
            >
              {label}
              <span>{key}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </header>
  );
}
