"use client";
import Link from "next/link";
import { useState } from "react";
import { AetherClient, getAetherErrorMessage } from "@aether/sdk";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");
export function AuthPage({ kind }: { kind: "login" | "signup" }) {
  const [message, setMessage] = useState("");
  return (
    <main id="main-content" className="auth-page">
      <section>
        <Link className="brand" href="/">
          AETHER
        </Link>
        <p className="eyebrow">Ethereum Sepolia</p>
        <h1>
          {kind === "login"
            ? "Sign in to mission control."
            : "Create your workspace account."}
        </h1>
        <p>
          Review each planned write, its provider record, independent chain
          proof, approvals, and recovery actions.
        </p>
      </section>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setMessage("Checking credentials…");
          try {
            await api[kind](
              String(form.get("email")),
              String(form.get("password")),
            );
            window.location.href =
              kind === "signup" ? "/onboarding" : "/app/overview";
          } catch (error) {
            setMessage(getAetherErrorMessage(error, "Authentication failed."));
          }
        }}
      >
        <h2>{kind === "login" ? "Welcome back" : "Create account"}</h2>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={12}
            autoComplete={
              kind === "login" ? "current-password" : "new-password"
            }
            required
          />
        </label>
        <button className="pill pill-primary" type="submit">
          {kind === "login" ? "Sign in" : "Create account"}
        </button>
        <p aria-live="polite">{message}</p>
        <Link href={kind === "login" ? "/signup" : "/login"}>
          {kind === "login" ? "Create account" : "Back to sign in"}
        </Link>
      </form>
    </main>
  );
}
