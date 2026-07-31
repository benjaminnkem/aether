import { AppRouteView } from "@/components/app/app-route-view";
import { notFound, redirect } from "next/navigation";

const legacyRedirects: Record<string, string> = {
  protocols: "/app/protocol-setup",
  integrations: "/app/protocol-setup",
  "settings/general": "/app/protocol-setup",
  "settings/execution": "/app/protocol-setup",
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
