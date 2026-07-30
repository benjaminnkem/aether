import { AppRouteView } from "@/components/app/app-route-view";

export default async function AppPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = ["overview"] } = await params;
  return <AppRouteView slug={slug} />;
}
