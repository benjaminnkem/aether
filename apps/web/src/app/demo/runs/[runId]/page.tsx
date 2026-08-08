import { RunView } from "@/components/app/views";

export default async function Page({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  return <RunView runId={(await params).runId} demo />;
}
