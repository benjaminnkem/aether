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
