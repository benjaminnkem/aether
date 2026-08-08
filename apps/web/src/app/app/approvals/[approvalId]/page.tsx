import { ApprovalsView } from "@/components/app/views";
export default async function Page({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  return <ApprovalsView approvalId={(await params).approvalId} />;
}
