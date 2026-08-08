"use client";
import { useState } from "react";
import { AetherClient, getAetherErrorMessage } from "@aether/sdk";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");
export function Onboarding() {
  const [message, setMessage] = useState("");
  return (
    <main id="main-content" className="auth-page">
      <section>
        <span className="brand">AETHER</span>
        <p className="eyebrow">Workspace setup</p>
        <h1>Name the operating workspace.</h1>
        <p>
          Membership and role are resolved by the server on every request.
          Provider credentials are configured after this step.
        </p>
      </section>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setMessage("Creating workspace…");
          try {
            await api.onboard(String(data.get("workspaceName")));
            window.location.href = "/app/settings/integrations";
          } catch (error) {
            setMessage(
              getAetherErrorMessage(error, "Workspace could not be created."),
            );
          }
        }}
      >
        <h2>Workspace</h2>
        <label>
          Workspace name
          <input
            name="workspaceName"
            minLength={2}
            maxLength={100}
            required
            placeholder="Operations"
          />
        </label>
        <button className="pill pill-primary" type="submit">
          Create workspace
        </button>
        <p aria-live="polite">{message}</p>
      </form>
    </main>
  );
}
