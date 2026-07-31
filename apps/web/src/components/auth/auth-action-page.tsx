"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { aetherClient } from "@aether/sdk";
import { Button, Field, Input } from "@aether/ui";

export function AuthActionPage({
  action,
}: {
  action: "verify" | "forgot" | "reset";
}) {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(action === "verify");

  useEffect(() => {
    if (action !== "verify") return;
    if (!token) {
      setPending(false);
      toast.error("The verification link is missing its token.");
      return;
    }
    void aetherClient
      .verifyEmail(token)
      .then(() => {
        setComplete(true);
        toast.success("Email verified. You can sign in.");
      })
      .catch(() => toast.error("This verification link is invalid or expired."))
      .finally(() => setPending(false));
  }, [action, token]);

  return (
    <main id="main-content" className="auth-shell">
      <section className="auth-panel" style={{ gridColumn: "1 / -1" }}>
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            const form = new FormData(event.currentTarget);
            try {
              if (action === "forgot") {
                await aetherClient.forgotPassword(
                  String(form.get("email") ?? ""),
                );
                toast.success(
                  "If that account exists, a reset link has been sent.",
                );
              } else if (action === "reset") {
                await aetherClient.resetPassword(
                  token,
                  String(form.get("password") ?? ""),
                );
                toast.success("Password reset. Sign in with the new password.");
              }
              setComplete(true);
            } catch {
              toast.error("The request could not be completed.");
            } finally {
              setPending(false);
            }
          }}
        >
          <h1>
            {action === "verify"
              ? "Verify email"
              : action === "forgot"
                ? "Reset your password"
                : "Choose a new password"}
          </h1>
          {action === "verify" ? (
            <p>{pending ? "Verifying your one-time link…" : ""}</p>
          ) : null}
          {action === "forgot" && !complete ? (
            <Field label="Work email">
              <Input name="email" type="email" autoComplete="email" required />
            </Field>
          ) : null}
          {action === "reset" && !complete ? (
            <Field label="New password" hint="Use at least 12 characters.">
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </Field>
          ) : null}
          {action !== "verify" && !complete ? (
            <Button type="submit" variant="primary" disabled={pending}>
              Continue
            </Button>
          ) : null}
          {complete ? <Link href="/login">Continue to sign in</Link> : null}
        </form>
      </section>
    </main>
  );
}
