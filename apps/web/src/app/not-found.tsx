import Link from "next/link";
import { Button, EmptyState } from "@aether/ui";

export default function NotFound() {
  return (
    <main className="auth-shell" id="main-content">
      <section className="auth-panel">
        <EmptyState
          title="Page not found"
          description="This route is not part of the focused Aether MVP."
          action={
            <Link href="/app/overview">
              <Button variant="primary">Return to overview</Button>
            </Link>
          }
        />
      </section>
    </main>
  );
}
