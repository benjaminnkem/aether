"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  CloseCircle,
  Copy,
  ExportSquare,
  InfoCircle,
  TickCircle,
  Warning2,
} from "iconsax-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md";
  }
>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "a-button",
        `a-button--${variant}`,
        `a-button--${size}`,
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(({ label, className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn("a-icon-button", className)}
    aria-label={label}
    {...props}
  />
));
IconButton.displayName = "IconButton";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("a-card", className)} {...props} />;
}
export function Surface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("a-surface", className)} {...props} />;
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("a-input", className)} {...props} />
));
Input.displayName = "Input";
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("a-input a-textarea", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("a-input", className)} {...props} />
));
Select.displayName = "Select";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="a-field">
      <span className="a-field__label">{label}</span>
      {children}
      {error ? (
        <span className="a-field__error">{error}</span>
      ) : hint ? (
        <span className="a-field__hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={cn("a-badge", `a-badge--${tone}`)}>{children}</span>;
}
export function Status({ status, label }: { status: string; label?: string }) {
  const tone = ["healthy", "resolved", "completed", "connected"].includes(
    status,
  )
    ? "success"
    : ["critical", "failed", "rejected"].includes(status)
      ? "danger"
      : [
            "warning",
            "partial",
            "open",
            "unknown",
            "reconciling",
            "correction_required",
          ].includes(status)
        ? "warning"
        : "info";
  const Icon =
    tone === "success"
      ? TickCircle
      : tone === "danger"
        ? CloseCircle
        : tone === "warning"
          ? Warning2
          : InfoCircle;
  return (
    <span className={cn("a-status", `a-status--${tone}`)}>
      <Icon size={13} aria-hidden="true" />
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  trigger?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      ) : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="a-overlay" />
        <DialogPrimitive.Content className="a-dialog">
          <div className="a-dialog__header">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description>
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close dialog">
                <CloseCircle size={18} />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="a-overlay" />
        <DialogPrimitive.Content className="a-drawer">
          <div className="a-dialog__header">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description>
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close details">
                <CloseCircle size={18} />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Tabs({
  value,
  onValueChange,
  tabs,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: Array<{ value: string; label: string }>;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List className="a-tabs" aria-label="View options">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}
export const TabContent = TabsPrimitive.Content;

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="a-tooltip" sideOffset={6}>
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function Dropdown({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: Array<{ label: string; onSelect?: () => void; disabled?: boolean }>;
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          className="a-menu"
          align="end"
          sideOffset={6}
        >
          {items.map((item) => (
            <DropdownPrimitive.Item
              className="a-menu__item"
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.label}
            </DropdownPrimitive.Item>
          ))}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}

export function DataTable({
  caption,
  columns,
  rows,
  onRowClick,
}: {
  caption: string;
  columns: string[];
  rows: Array<Record<string, ReactNode>>;
  onRowClick?: (index: number) => void;
}) {
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.id ?? index)}
              onClick={() => onRowClick?.(index)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === "Enter" || event.key === " "))
                  onRowClick(index);
              }}
            >
              {columns.map((column) => (
                <td key={column}>{row[column]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="a-empty">
      <img src="/brand/aether-mark-mono.svg" alt="" width="32" height="32" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PermissionState({ action }: { action: string }) {
  return (
    <div className="a-callout">
      <Warning2 size={18} />
      <div>
        <strong>Read-only permission</strong>
        <p>
          Your current role can review this data but cannot {action}. Ask an
          organization owner for access.
        </p>
      </div>
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("a-skeleton", className)} aria-hidden="true" />;
}
export function ValidationSummary({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="a-callout a-callout--danger" role="alert">
      <Warning2 size={18} />
      <div>
        <strong>
          Resolve {errors.length} validation issue
          {errors.length === 1 ? "" : "s"}
        </strong>
        <ul>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
export function CodeBlock({
  code,
  language = "yaml",
}: {
  code: string;
  language?: string;
}) {
  return (
    <div className="a-code">
      <div className="a-code__bar">
        <span>{language}</span>
        <CopyButton value={code} />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
export function DiffBlock({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  return (
    <div className="a-diff">
      <div>
        <span>− previous</span>
        <pre>{before}</pre>
      </div>
      <div>
        <span>+ proposed</span>
        <pre>{after}</pre>
      </div>
    </div>
  );
}
export function CopyButton({ value }: { value: string }) {
  return (
    <IconButton
      label="Copy to clipboard"
      onClick={() => void navigator.clipboard?.writeText(value)}
    >
      <Copy size={15} />
    </IconButton>
  );
}
export function ChainValue({
  value,
  kind = "address",
  href,
}: {
  value: string;
  kind?: "address" | "transaction" | "block";
  href?: string;
}) {
  return (
    <span className="a-chain-value">
      <code>{value}</code>
      <CopyButton value={value} />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${kind} in explorer`}
        >
          <ExportSquare size={14} />
        </a>
      ) : null}
    </span>
  );
}
export function Timeline({
  items,
}: {
  items: Array<{ title: string; detail: string; status: string }>;
}) {
  return (
    <ol className="a-timeline">
      {items.map((item) => (
        <li key={`${item.title}-${item.detail}`}>
          <span className={cn("a-timeline__dot", `is-${item.status}`)} />
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
export function ToastRegion({ message }: { message?: string }) {
  return (
    <div className="a-toast-region" aria-live="polite" aria-atomic="true">
      {message ? (
        <div className="a-toast">
          <TickCircle size={16} />
          {message}
        </div>
      ) : null}
    </div>
  );
}
