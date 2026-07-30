"use client";

import { CloseCircle, Magicpen } from "iconsax-react";
import { Button, IconButton, Select } from "@aether/ui";
import { mockScenarioNames } from "@aether/mock-data";
import { useDashboard } from "@/features/dashboard/use-dashboard";
import { useUiStore } from "@/stores/ui";

export function DemoController() {
  const open = useUiStore((state) => state.demoOpen);
  const setOpen = useUiStore((state) => state.setDemoOpen);
  const { data, scenario, advance } = useDashboard();
  if (!open)
    return (
      <Button
        variant="secondary"
        size="sm"
        style={{ position: "fixed", right: 18, bottom: 18, zIndex: 45 }}
        onClick={() => setOpen(true)}
      >
        <Magicpen size={14} /> Demo controls
      </Button>
    );
  return (
    <aside
      className="demo-controller"
      aria-label="Development demo scenario controller"
    >
      <div className="demo-controller__head">
        <strong
          style={{ color: "var(--paper)", fontSize: 12, fontWeight: 500 }}
        >
          Demo scenarios
        </strong>
        <IconButton label="Close demo controls" onClick={() => setOpen(false)}>
          <CloseCircle size={16} />
        </IconButton>
      </div>
      <div className="demo-controller__body">
        <Select
          aria-label="Select demo scenario"
          value={data?.scenario ?? "healthy"}
          onChange={(event) =>
            scenario.mutate(
              event.target.value as Parameters<typeof scenario.mutate>[0],
            )
          }
        >
          {mockScenarioNames.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Button
          variant="primary"
          size="sm"
          disabled={
            !["unauthorized-oracle", "approval-execution"].includes(
              data?.scenario ?? "",
            ) || advance.isPending
          }
          onClick={() => advance.mutate()}
        >
          Advance incident lifecycle
        </Button>
        <p>
          The showcase progresses investigation → plan → approval → simulation →
          execution → verification. All changes update one deterministic
          in-memory service.
        </p>
      </div>
    </aside>
  );
}
