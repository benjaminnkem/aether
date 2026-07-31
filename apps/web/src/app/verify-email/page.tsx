import { Suspense } from "react";
import { AuthActionPage } from "@/components/auth/auth-action-page";

export default function Page() {
  return (
    <Suspense>
      <AuthActionPage action="verify" />
    </Suspense>
  );
}
