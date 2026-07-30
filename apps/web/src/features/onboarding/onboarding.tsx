"use client";

import Image from "next/image";
import { useState } from "react";
import { Button, Field, Input, Status } from "@aether/ui";
import { useUiStore } from "@/stores/ui";

const steps = [
  "Organization",
  "Protocol",
  "Setup method",
  "Network",
  "Contract",
  "KeeperHub",
  "Initial scan",
  "Overview",
];
export function Onboarding() {
  const persisted = useUiStore((state) => state.onboardingStep);
  const setPersisted = useUiStore((state) => state.setOnboardingStep);
  const [selected, setSelected] = useState("demo");
  return (
    <main id="main-content" className="onboarding">
      <aside className="onboarding__rail">
        <Image
          src="/brand/aether-lockup.svg"
          alt="Aether"
          width={170}
          height={32}
          style={{ width: 170, height: 32 }}
        />
        <ol className="onboarding__steps">
          {steps.map((step, index) => (
            <li key={step} className={index === persisted ? "is-active" : ""}>
              <span className="onboarding__step">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <Status status="healthy" label="Progress saved locally" />
      </aside>
      <section className="onboarding__main">
        <div className="onboarding__content">
          <div className="eyebrow">
            Step {persisted + 1} of {steps.length}
          </div>
          <h1 style={{ color: "var(--paper)", fontWeight: 500, fontSize: 34 }}>
            Set up {steps[persisted]?.toLowerCase()}.
          </h1>
          <p style={{ color: "var(--fog)", maxWidth: 560 }}>
            {persisted === 0
              ? "Name the workspace that contains this protocol and its audit evidence."
              : persisted === 1
                ? "Name the protocol and choose the environment Aether should observe."
                : persisted === 2
                  ? "Start with the deterministic Arcadia demo or enter resources manually."
                  : "Review this setup stage. Live credentials remain disconnected in frontend mock mode."}
          </p>
          {persisted === 0 ? (
            <div className="settings-form a-card" style={{ marginTop: 24 }}>
              <Field label="Organization name">
                <Input defaultValue="Arcadia Labs" />
              </Field>
            </div>
          ) : persisted === 2 ? (
            <div className="choice-grid">
              <button
                className={`choice-card ${selected === "demo" ? "is-selected" : ""}`}
                onClick={() => setSelected("demo")}
              >
                <h3>Try the demo protocol</h3>
                <p>
                  Explore a complete healthy-to-incident-to-verification
                  lifecycle with no credentials.
                </p>
              </button>
              <button
                className={`choice-card ${selected === "existing" ? "is-selected" : ""}`}
                onClick={() => setSelected("existing")}
              >
                <h3>Connect an existing protocol</h3>
                <p>
                  Review GitHub import and manual contract discovery in
                  simulated provider mode.
                </p>
              </button>
            </div>
          ) : (
            <div className="choice-grid">
              <div className="choice-card is-selected">
                <h3>{steps[persisted]}</h3>
                <p>
                  Mock configuration is ready. Continue to inspect the next
                  boundary.
                </p>
                <Status status="healthy" label="Validated" />
              </div>
              <div className="choice-card">
                <h3>Safety note</h3>
                <p>
                  No secret, private key, or live provider credential is
                  requested by this frontend phase.
                </p>
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 24,
            }}
          >
            <Button
              disabled={persisted === 0}
              onClick={() => setPersisted(Math.max(0, persisted - 1))}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (persisted === steps.length - 1)
                  window.location.href = "/app/overview";
                else setPersisted(persisted + 1);
              }}
            >
              {persisted === steps.length - 1 ? "Enter dashboard" : "Continue"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
