"use client";

import { Button, EmptyState } from "@aether/ui";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="auth-shell" id="main-content">
      <section className="auth-panel">
        <EmptyState
          title="Aether could not render this view"
          description="Retry the current route. Mock data and organization context remain local."
          action={
            <Button variant="primary" onClick={reset}>
              Retry
            </Button>
          }
        />
      </section>
    </main>
  );
}
