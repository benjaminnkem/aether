"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun1, Setting2 } from "iconsax-react";
import { IconButton } from "@aether/ui";

const order = ["light", "dark", "system"] as const;
type ThemeChoice = (typeof order)[number];

function nextTheme(current: string | undefined): ThemeChoice {
  const index = order.indexOf((current as ThemeChoice) ?? "dark");
  return order[(index + 1) % order.length]!;
}

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = (theme ?? "dark") as ThemeChoice;
  const resolved = resolvedTheme === "light" ? "light" : "dark";
  const Icon =
    active === "system" ? Setting2 : resolved === "light" ? Sun1 : Moon;
  const label =
    active === "system"
      ? "Theme: system"
      : active === "light"
        ? "Theme: light"
        : "Theme: dark";

  if (!mounted) {
    return (
      <IconButton
        className={className}
        label="Toggle color theme"
        disabled
        aria-hidden={!compact}
      >
        <Moon size={16} />
      </IconButton>
    );
  }

  if (compact) {
    return (
      <IconButton
        className={className}
        label={`${label}. Click to switch.`}
        onClick={() => setTheme(nextTheme(active))}
      >
        <Icon size={16} />
      </IconButton>
    );
  }

  return (
    <div
      className={className ? `theme-toggle ${className}` : "theme-toggle"}
      role="group"
      aria-label="Color theme"
    >
      {order.map((value) => {
        const OptionIcon =
          value === "system" ? Setting2 : value === "light" ? Sun1 : Moon;
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            className={
              selected
                ? "theme-toggle__option is-active"
                : "theme-toggle__option"
            }
            aria-pressed={selected}
            onClick={() => setTheme(value)}
          >
            <OptionIcon size={14} aria-hidden="true" />
            <span>{value}</span>
          </button>
        );
      })}
    </div>
  );
}
