import { AppRouteView } from "@/components/app/app-route-view";
import { notFound, redirect } from "next/navigation";

const legacyRedirects: Record<string, string> = {
  protocols: "/app/protocol-setup",
  "protocols/arcadia": "/app/protocol-setup",
  "protocols/arcadia/deployments": "/app/protocol-setup",
  "protocols/arcadia/contracts": "/app/protocol-setup",
  integrations: "/app/protocol-setup",
  "settings/general": "/app/protocol-setup",
  "settings/execution": "/app/protocol-setup",
  "protocols/arcadia/desired-state": "/app/desired-state",
  "protocols/arcadia/drift": "/app/drift",
  "protocols/arcadia/incidents": "/app/drift",
  "protocols/arcadia/operations": "/app/operations/op-oracle-restoration",
  "protocols/arcadia/approvals": "/app/operations/op-oracle-restoration",
  "protocols/arcadia/invariants": "/app/desired-state",
  "protocols/arcadia/policies": "/app/desired-state",
  "keeperhub-runs": "/app/executions/exec-kh-8314",
};

export default async function AppPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = ["overview"] } = await params;
  const path = slug.join("/");
  if (legacyRedirects[path]) redirect(legacyRedirects[path]);
  const staticRoute = [
    "overview",
    "protocol-setup",
    "desired-state",
    "drift",
    "audit-log",
  ].includes(path);
  const dynamicRoute =
    (slug[0] === "operations" || slug[0] === "executions") && slug.length === 2;
  if (!staticRoute && !dynamicRoute) notFound();
  return <AppRouteView slug={slug} />;
}
