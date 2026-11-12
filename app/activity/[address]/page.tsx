import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Activity } from "@/components/activity";
import { resolveRecipient } from "@/lib/money";

async function ActivityRoute({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const resolved = resolveRecipient(decodeURIComponent(address));
  if (!resolved) notFound();
  return (
    <Activity
      address={resolved.address}
      solanaAddress={resolved.kind === "solana" ? resolved.solanaAddress : undefined}
    />
  );
}

export default function ActivityPage({ params }: { params: Promise<{ address: string }> }) {
  return (
    <Suspense fallback={<main className="shell section"><p>Loading activity…</p></main>}>
      <ActivityRoute params={params} />
    </Suspense>
  );
}
