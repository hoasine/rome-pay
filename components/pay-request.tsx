"use client";

import { ArrowLeft, Ban, Check, Copy, LoaderCircle, ReceiptText, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { isPreviewMode, shortAddress } from "@/lib/config";
import { encodeCancelRequest, encodePayRequest, loadRequest } from "@/lib/contract";
import { demoRequests } from "@/lib/demo-data";
import { formatDate, formatUsdc, requestStatus, textError } from "@/lib/money";
import type { PaymentRequest } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { AddressLink, QrCode } from "./ui";
import { useRomeWallet } from "./wallet-provider";

const STATUS_COPY = {
  open: "Waiting for payment",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
} as const;

export function PayRequest({ requestId }: { requestId: bigint }) {
  const wallet = useRomeWallet();
  const now = useNow();
  const [request, setRequest] = useState<PaymentRequest | null>(
    isPreviewMode ? (demoRequests.find((item) => item.id === requestId) ?? null) : null,
  );
  const [missing, setMissing] = useState(isPreviewMode && !request);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setLink(window.location.href.split("#")[0]));
  }, []);

  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    loadRequest(requestId)
      .then((next) => !cancelled && setRequest(next))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (missing) {
    return (
      <main className="shell claim">
        <div className="claim-card">
          <h1>Request not found.</h1>
          <p className="detail-description">Payment request #{requestId.toString()} does not exist on this contract.</p>
          <Link className="button" href="/"><ArrowLeft size={15} /> Back to Denarius</Link>
        </div>
      </main>
    );
  }
  if (!request) {
    return (
      <main className="shell claim">
        <p><LoaderCircle className="spin" /> Loading payment request…</p>
      </main>
    );
  }

  const status = now === null ? null : requestStatus(request, now);
  const isRecipient = wallet.activeAddress?.toLowerCase() === request.recipient.toLowerCase();

  const pay = async () => {
    setError(null);
    const memoError = textError(memo, "The memo");
    if (memoError) return setError(memoError);
    if (!wallet.activeAddress) return setError("Connect MetaMask or Solflare to pay.");
    try {
      await wallet.executeCall(encodePayRequest(requestId, memo.trim()), undefined, request.amount);
      setRequest(await loadRequest(requestId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payment failed.");
    }
  };

  const cancel = async () => {
    setError(null);
    try {
      await wallet.executeCall(encodeCancelRequest(requestId));
      setRequest(await loadRequest(requestId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be cancelled.");
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="shell detail">
      <div>
        <Link className="back-link" href="/"><ArrowLeft size={15} /> Denarius</Link>
        <p className="eyebrow">Payment request #{request.id.toString()}</p>
        <h1>
          {formatUsdc(request.amount, 6)} <span className="unit">USDC</span>
        </h1>
        {request.note && <p className="detail-description">{request.note}</p>}
        {status && <span className={`status status-request-${status}`}>{STATUS_COPY[status]}</span>}

        <div className="action-card" style={{ marginTop: 24 }}>
          {status === "paid" ? (
            <div className="ballot-note" role="status">
              <Check size={15} style={{ display: "inline", marginRight: 6 }} />
              Paid in payment #{request.paymentId.toString()}.{" "}
              <Link href={`/activity/${request.recipient}`}>View the recipient&apos;s activity</Link>
            </div>
          ) : status === "open" && !isRecipient ? (
            <>
              <label className="field">
                <span>Message to the recipient (optional)</span>
                <input value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={140} placeholder="Thanks!" />
              </label>
              <button className="button button-primary button-large" onClick={() => void pay()} disabled={wallet.isBusy}>
                <Send size={16} />{" "}
                {wallet.activeAddress
                  ? `Pay ${formatUsdc(request.amount, 6)} USDC${wallet.activeLane === "solana" ? " from Solflare" : ""}`
                  : "Connect a wallet to pay"}
              </button>
            </>
          ) : status === "open" && isRecipient ? (
            <p className="detail-description" style={{ margin: 0 }}>
              This is your request. Share the link or QR code; it closes as soon as someone pays.
            </p>
          ) : status ? (
            <p className="notice" style={{ margin: 0 }}>This request is {status} and can no longer be paid.</p>
          ) : null}
          {error && <div className="form-error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
        </div>
      </div>

      <aside className="side-card">
        {link && status === "open" && <QrCode value={link} label={`Payment QR code for request ${request.id.toString()}`} />}
        <dl>
          <div><dt>Pay to</dt><dd><AddressLink address={request.recipient} /></dd></div>
          <div><dt>Created</dt><dd>{formatDate(request.createdAt)}</dd></div>
          <div><dt>Expires</dt><dd>{request.expiresAt ? formatDate(request.expiresAt) : "Never"}</dd></div>
        </dl>
        <button className="button" onClick={() => void copy()} disabled={!link}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Link copied" : "Copy payment link"}
        </button>
        {isRecipient && status === "open" && (
          <button className="button" onClick={() => void cancel()} disabled={wallet.isBusy}>
            <Ban size={15} /> Cancel request
          </button>
        )}
        <Link className="button" href={`/activity/${request.recipient}`}>
          <ReceiptText size={15} /> {shortAddress(request.recipient)} activity
        </Link>
      </aside>
    </main>
  );
}
