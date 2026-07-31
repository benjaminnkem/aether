"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { aetherClient } from "@aether/sdk";
import { Button, Field, Input, Status } from "@aether/ui";
import { useUiStore } from "@/stores/ui";

export function Onboarding() {
  const setOrganization = useUiStore((state) => state.setOrganization);
  const setProtocol = useUiStore((state) => state.setProtocol);
  const [pending, setPending] = useState(false);

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
          {["Account", "Organization", "Protocol", "Live providers"].map(
            (step, index) => (
              <li key={step} className={index === 1 ? "is-active" : ""}>
                <span className="onboarding__step">{index + 1}</span>
                {step}
              </li>
            ),
          )}
        </ol>
        <Status status="warning" label="Provider setup required" />
      </aside>
      <section className="onboarding__main">
        <form
          className="onboarding__content"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            const form = new FormData(event.currentTarget);
            try {
              const result = await aetherClient.onboard({
                organizationName: String(form.get("organizationName") ?? ""),
                protocolName: String(form.get("protocolName") ?? ""),
                governanceAuthority: String(
                  form.get("governanceAuthority") ?? "",
                ),
              });
              setOrganization(result.organizationId);
              setProtocol(result.protocolId);
              toast.success("Organization and protocol created.");
              window.location.href = "/app/protocol-setup";
            } catch {
              toast.error(
                "Onboarding could not be persisted. Sign in and retry.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="eyebrow">Live onboarding</div>
          <h1 style={{ color: "var(--paper)", fontWeight: 500, fontSize: 34 }}>
            Create your operating context.
          </h1>
          <p style={{ color: "var(--fog)", maxWidth: 620 }}>
            These records are written to MongoDB. No sample protocol, provider
            response, transaction, or execution is created automatically.
          </p>
          <div className="settings-form a-card" style={{ marginTop: 24 }}>
            <Field label="Organization name">
              <Input
                name="organizationName"
                required
                minLength={2}
                placeholder="Your protocol organization"
              />
            </Field>
            <Field label="Protocol name">
              <Input
                name="protocolName"
                required
                minLength={2}
                placeholder="Protocol name"
              />
            </Field>
            <Field label="Governance authority">
              <Input
                name="governanceAuthority"
                required
                placeholder="Safe address or governance description"
              />
            </Field>
            <div className="a-callout">
              Base Sepolia (84532) is the only live network permitted in this
              release. Configure RPC, contracts, GitHub, OpenAI, and KeeperHub
              after this record is created.
            </div>
            <Button type="submit" variant="primary" disabled={pending}>
              Create organization and protocol
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
