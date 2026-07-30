"use client";

import Image from "next/image";
import Link from "next/link";
import { Button, Field, Input } from "@aether/ui";

const copy = {
  login: [
    "Welcome back",
    "Enter the control plane to review protocol state.",
    "Sign in",
  ],
  signup: [
    "Create your Aether account",
    "Start in mock mode. Connect live providers only when ready.",
    "Create account",
  ],
} as const;
export function AuthPage({ kind }: { kind: keyof typeof copy }) {
  const [title, description, action] = copy[kind];
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
        <span className="a-status a-status--success">
          Mock control plane ready
        </span>
      </section>
      <section className="auth-panel">
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            window.location.href =
              kind === "signup" ? "/onboarding" : "/app/overview";
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
            <Button type="submit" variant="primary">
              {action}
            </Button>
          </div>
          <div className="auth-links">
            {kind === "login" ? (
              <Link href="/signup">Create account</Link>
            ) : (
              <Link href="/login">Back to sign in</Link>
            )}
            <Link href="/app/overview">Explore demo</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
