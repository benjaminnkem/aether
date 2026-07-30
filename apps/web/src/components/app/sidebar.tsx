"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArchiveBook,
  Box,
  ClipboardTick,
  Code,
  Element3,
  Judge,
  Layer,
  Notification,
  People,
  Setting2,
  ShieldTick,
  Status,
  TaskSquare,
} from "iconsax-react";
import { useUiStore } from "@/stores/ui";

const sections = [
  { label: "", items: [["Overview", "/app/overview", Activity]] },
  {
    label: "Protocol",
    items: [
      ["Protocols", "/app/protocols", Element3],
      ["Desired state", "/app/protocols/arcadia/desired-state", Code],
      ["Deployments", "/app/protocols/arcadia/deployments", Layer],
      ["Contracts", "/app/protocols/arcadia/contracts", Box],
    ],
  },
  {
    label: "Operations",
    items: [
      ["Drift", "/app/protocols/arcadia/drift", Status],
      ["Incidents", "/app/protocols/arcadia/incidents", ShieldTick],
      ["Operations", "/app/protocols/arcadia/operations", TaskSquare],
      ["Approvals", "/app/protocols/arcadia/approvals", ClipboardTick],
      ["Invariants", "/app/protocols/arcadia/invariants", Activity],
      ["Policies", "/app/protocols/arcadia/policies", Judge],
    ],
  },
  {
    label: "System",
    items: [
      ["KeeperHub runs", "/app/keeperhub-runs", Activity],
      ["Audit log", "/app/audit-log", ArchiveBook],
      ["Integrations", "/app/integrations", Element3],
      ["Team", "/app/team", People],
      ["Notifications", "/app/notifications", Notification],
      ["Settings", "/app/settings/general", Setting2],
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const open = useUiStore((state) => state.sidebarOpen);
  const setOpen = useUiStore((state) => state.setSidebarOpen);
  return (
    <aside
      className={`sidebar ${open ? "is-open" : ""}`}
      aria-label="Product navigation"
    >
      <div className="sidebar__brand">
        <Link href="/">
          <Image
            src="/brand/aether-lockup.svg"
            alt="Aether"
            width={170}
            height={32}
            style={{ width: 170, height: 32 }}
          />
        </Link>
      </div>
      <button className="sidebar__switcher" onClick={() => setOpen(false)}>
        <span>
          <strong>Arcadia Labs</strong>
          <span>Arcadia Markets</span>
        </span>
        <span className="a-badge">PROD</span>
      </button>
      <nav className="sidebar__nav">
        {sections.map((section) => (
          <div key={section.label || "main"}>
            {section.label ? (
              <div className="sidebar__label">
                {section.label.toUpperCase()}
              </div>
            ) : null}
            {section.items.map(([label, href, Icon]) => {
              const active =
                pathname === href ||
                (href.endsWith("/protocols") && pathname === "/app/protocols");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`sidebar__link ${active ? "is-active" : ""}`}
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="connection">
          <i /> Mock realtime connected
        </div>
        <div
          style={{
            display: "flex",
            gap: 9,
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <div className="a-badge">MC</div>
          <span>
            <strong
              style={{
                display: "block",
                color: "var(--paper)",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Mina Chen
            </strong>
            <span style={{ color: "var(--ash)", fontSize: 9 }}>
              Organization owner
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
