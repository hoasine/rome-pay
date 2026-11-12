"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { isPreviewMode, shortAddress } from "@/lib/config";
import { loadPayments, publicClient } from "@/lib/contract";
import { DEMO_ACCOUNT, demoPayments } from "@/lib/demo-data";
import { formatUsdc } from "@/lib/money";
import type { Payment } from "@/lib/types";
import { PaymentRow } from "./ui";

export function Activity({ address, solanaAddress }: { address: Address; solanaAddress?: string }) {
  const [payments, setPayments] = useState<Payment[] | null>(
    isPreviewMode
      ? demoPayments.filter(
          (payment) =>
            address.toLowerCase() === DEMO_ACCOUNT.toLowerCase() ||
            payment.from.toLowerCase() === address.toLowerCase() ||
            payment.to.toLowerCase() === address.toLowerCase(),
        )
      : null,
  );
  const [balance, setBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicClient
      .getBalance({ address })
      .then((value) => !cancelled && setBalance(value))
      .catch(() => !cancelled && setBalance(null));
    if (!isPreviewMode) {
      loadPayments(address)
        .then((next) => !cancelled && setPayments(next))
        .catch((caught: unknown) => {
          if (cancelled) return;
          setError(caught instanceof Error ? caught.message : "Could not read this activity.");
          setPayments([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [address]);

  const totals = useMemo(() => {
    const list = payments ?? [];
    const lower = address.toLowerCase();
    return {
      received: list.filter((payment) => payment.to.toLowerCase() === lower).reduce((sum, payment) => sum + payment.amount, 0n),
      sent: list.filter((payment) => payment.from.toLowerCase() === lower).reduce((sum, payment) => sum + payment.amount, 0n),
    };
  }, [address, payments]);

  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="shell section">
      <div className="section-head">
        <div>
          <p className="eyebrow">{solanaAddress ? "Solana wallet activity" : "Activity"}</p>
          <h2>{solanaAddress ? shortAddress(solanaAddress, 6) : shortAddress(address, 6)}</h2>
          <p className="detail-description">
            {solanaAddress
              ? `Controlled from Solflare at Rome address ${shortAddress(address)}.`
              : "Payments sent and received through Denarius."}
          </p>
        </div>
        <button className="button" onClick={() => void copy()}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Link copied" : "Share activity"}
        </button>
      </div>

      <section className="stats" aria-label="Account totals" style={{ marginBottom: 24 }}>
        <div><strong>{balance === null ? "—" : formatUsdc(balance)}</strong><span>USDC balance</span></div>
        <div><strong>{formatUsdc(totals.received)}</strong><span>received</span></div>
        <div><strong>{formatUsdc(totals.sent)}</strong><span>sent</span></div>
        <div><strong>{payments ? payments.length : "—"}</strong><span>payments</span></div>
      </section>

      {error && <p className="notice" role="alert">{error}</p>}
      {payments === null ? (
        <div className="empty-state"><LoaderCircle className="spin" /> Loading payments…</div>
      ) : payments.length ? (
        <ul className="payment-list">
          {payments.map((payment) => (
            <PaymentRow key={payment.id.toString()} payment={payment} viewer={address} />
          ))}
        </ul>
      ) : (
        <div className="empty-state">No payments for this address yet.</div>
      )}
    </main>
  );
}
