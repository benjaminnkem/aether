"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArchiveBook,
  Code,
  Status,
  HierarchySquare2,
} from "iconsax-react";
import { useUiStore } from "@/stores/ui";

const items = [
  ["Overview", "/app/overview", Activity],
  ["Protocol Setup", "/app/protocol-setup", HierarchySquare2],
  ["Desired State", "/app/desired-state", Code],
  ["Drift", "/app/drift", Status],
  ["Audit Log", "/app/audit-log", ArchiveBook],
] as const;

export function Sidebar({
  organization,
  protocol,
}: {
  organization?: { name: string; role: string };
  protocol?: { name: string; environment: string };
}) {
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
          <strong>{organization?.name ?? "No organization loaded"}</strong>
          <span>{protocol?.name ?? "No protocol loaded"}</span>
        </span>
        <span className="a-badge">
          {protocol?.environment?.toUpperCase() ?? "SETUP"}
        </span>
      </button>
      <nav className="sidebar__nav">
        {items.map(([label, href, Icon]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`sidebar__link ${pathname === href ? "is-active" : ""}`}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="connection">
          <i /> Live API required
        </div>
        <div
          style={{
            display: "flex",
            gap: 9,
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <div className="a-badge" aria-hidden="true">
            {organization?.name
              ? organization.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()
              : "—"}
          </div>
          <span>
            <strong
              style={{
                display: "block",
                color: "var(--paper)",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {organization ? "Tenant session" : "Sign in required"}
            </strong>
            <span style={{ color: "var(--ash)", fontSize: 9 }}>
              {organization?.role ?? "No membership loaded"}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
