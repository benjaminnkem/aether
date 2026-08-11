"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AetherClient } from "@aether/sdk";

const api = new AetherClient(process.env.NEXT_PUBLIC_AETHER_API_URL ?? "/v1");

export function LandingSessionLink() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api.session(),
    staleTime: 30_000,
    retry: false,
  });
  const authenticated = session.data?.authenticated === true;
  const destination =
    session.data?.destination === "onboarding"
      ? "/onboarding"
      : "/app/overview";

  return (
    <Link href={authenticated ? destination : "/login"}>
      {authenticated ? "View dashboard" : "Sign in"}
    </Link>
  );
}
