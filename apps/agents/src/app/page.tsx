import { AgentApplication } from "@/components/agent-application";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  return searchParams.then(({ product }) => (
    <AgentApplication mode={product === "lending" ? "lending" : "savings"} />
  ));
}
