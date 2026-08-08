import { MissionView } from "@/components/app/views";
export default async function Page({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  return <MissionView missionId={(await params).missionId} />;
}
