import Image from "next/image";
import Link from "next/link";
import { Button, Status } from "@aether/ui";

export default function UnauthorizedPage() {
  return (
    <main id="main-content" className="auth-shell">
      <section className="auth-panel">
        <Image src="/brand/aether-mark.svg" alt="" width={42} height={42} />
        <Status status="failed" label="Access denied" />
        <h1>You do not have access to this protocol.</h1>
        <p>
          Your signed organization and protocol context does not authorize this
          resource. Aether did not perform the requested action.
        </p>
        <div className="page-actions">
          <Link href="/login">
            <Button variant="primary">Sign in with another account</Button>
          </Link>
          <Link href="/">
            <Button>Return to Aether</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
