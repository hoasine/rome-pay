import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PayRequest } from "@/components/pay-request";

async function PayRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <PayRequest requestId={BigInt(id)} />;
}

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="shell claim"><p>Loading payment request…</p></main>}>
      <PayRoute params={params} />
    </Suspense>
  );
}
