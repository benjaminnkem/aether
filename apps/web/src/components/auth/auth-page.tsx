"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { aetherClient } from "@aether/sdk";
import { activeLiveChain } from "@aether/shared";
import { Button, Field, Input } from "@aether/ui";

const copy = {
  login: [
    "Welcome back",
    "Enter the control plane to review protocol state.",
    "Sign in",
  ],
  signup: [
    "Create your Aether account",
    "Create a real account. Provider actions remain disabled until configured.",
    "Create account",
  ],
} as const;
export function AuthPage({ kind }: { kind: keyof typeof copy }) {
  const [title, description, action] = copy[kind];
  const [pending, setPending] = useState(false);
  return (
    <main id="main-content" className="auth-shell">
      <section className="auth-art">
        <Link href="/">
          <Image
            src="/brand/aether-lockup.svg"
            alt="Aether"
            width={170}
            height={32}
            style={{ width: 170, height: 32 }}
          />
        </Link>
        <blockquote>
          AI investigates and proposes. Deterministic policy authorizes. Humans
          approve. KeeperHub executes. Aether verifies.
        </blockquote>
        <span className="a-status">
          Live API · {activeLiveChain.displayName} only
        </span>
      </section>
      <section className="auth-panel">
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            const form = new FormData(event.currentTarget);
            try {
              const email = String(form.get("email") ?? "");
              const password = String(form.get("password") ?? "");
              if (kind === "signup") {
                await aetherClient.signup(email, password);
                toast.success(
                  "Account created. Check your email to verify it.",
                );
                window.location.href = "/login";
              } else {
                await aetherClient.login(email, password);
                window.location.href = "/app/overview";
              }
            } catch {
              toast.error(
                kind === "signup"
                  ? "Account creation failed. Check the form and email service."
                  : "Sign in failed. Check your credentials and verification status.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <Image src="/brand/aether-mark.svg" alt="" width={38} height={38} />
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="form-stack">
            {kind === "signup" ? (
              <Field label="Full name">
                <Input
                  name="name"
                  autoComplete="name"
                  required
                  placeholder="Mina Chen"
                />
              </Field>
            ) : null}
            <Field label="Work email">
              <Input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@protocol.xyz"
              />
            </Field>
            <Field label="Password" hint="Use at least 12 characters.">
              <Input
                name="password"
                type="password"
                autoComplete={
                  kind === "login" ? "current-password" : "new-password"
                }
                minLength={12}
                required
              />
            </Field>
            <Button type="submit" variant="primary" disabled={pending}>
              {action}
            </Button>
          </div>
          <div className="auth-links">
            {kind === "login" ? (
              <>
                <Link href="/signup">Create account</Link>
                <Link href="/forgot-password">Forgot password?</Link>
              </>
            ) : (
              <Link href="/login">Back to sign in</Link>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
