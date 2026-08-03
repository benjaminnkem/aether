"use client";

import Link from "next/link";
import { ArrowRight2 } from "iconsax-react";
import { Button } from "@aether/ui";
import { useSession } from "@/features/auth/use-session";

export function SessionActions({ hero = false }: { hero?: boolean }) {
  const session = useSession();
  if (session.isLoading) {
    return <div className="session-actions-placeholder" aria-hidden="true" />;
  }
  if (session.data) {
    const href =
      session.data.destination === "dashboard"
        ? "/app/overview"
        : "/onboarding";
    return (
      <Link href={href}>
        <Button variant="primary" size={hero ? undefined : "sm"}>
          {session.data.destination === "dashboard"
            ? "Go to dashboard"
            : "Continue setup"}
          <ArrowRight2 size={14} />
        </Button>
      </Link>
    );
  }
  return hero ? (
    <>
      <Link href="/signup">
        <Button variant="primary">
          Create account <ArrowRight2 size={15} />
        </Button>
      </Link>
      <Link href="#how-it-works">
        <Button variant="secondary">See how it works</Button>
      </Link>
    </>
  ) : (
    <>
      <Link className="secondary-cta" href="/login">
        Sign in
      </Link>
      <Link href="/signup">
        <Button variant="primary" size="sm">
          Create account
        </Button>
      </Link>
    </>
  );
}

export function SessionProductCta() {
  const session = useSession();

  if (session.isLoading) {
    return <div className="session-actions-placeholder" aria-hidden="true" />;
  }

  const href = session.data
    ? session.data.destination === "dashboard"
      ? "/app/overview"
      : "/onboarding"
    : "/signup";
  const label = session.data
    ? session.data.destination === "dashboard"
      ? "Go to dashboard"
      : "Continue setup"
    : "Explore the product";

  return (
    <Link href={href}>
      <Button variant="ghost">
        {label} <ArrowRight2 size={14} />
      </Button>
    </Link>
  );
}
