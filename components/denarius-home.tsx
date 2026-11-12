"use client";

import { ArrowRight, ArrowUpRight, LoaderCircle, Plus, ReceiptText, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DENARIUS_ADDRESS, VIA_BASE_URL, isPreviewMode, shortAddress } from "@/lib/config";
import {
  encodeCreateRequest,
  encodePay,
  findRequestId,
  loadRecentPayments,
  loadStats,
} from "@/lib/contract";
import { demoPayments, demoRequests } from "@/lib/demo-data";
import { formatUsdc, parseUsdc, resolveRecipient, textError } from "@/lib/money";
import type { Payment } from "@/lib/types";
import { PaymentRow, useChainHealth } from "./ui";
import { useRomeWallet } from "./wallet-provider";

const EXPIRIES = [
  { label: "Never", seconds: 0 },
  { label: "1 day", seconds: 86400 },
  { label: "7 days", seconds: 7 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
] as const;

export function DenariusHome() {
  const health = useChainHealth();
  const [recent, setRecent] = useState<Payment[]>(isPreviewMode ? demoPayments : []);
  const [stats, setStats] = useState(
    isPreviewMode ? { payments: demoPayments.length, requests: demoRequests.length } : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    Promise.all([loadRecentPayments(), loadStats()])
      .then(([payments, nextStats]) => {
        if (cancelled) return;
        setRecent(payments);
        setStats(nextStats);
      })
      .catch((error: unknown) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Could not read Denarius from Hadrian.");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const volume = useMemo(() => recent.reduce((total, payment) => total + payment.amount, 0n), [recent]);

  return (
    <main>
      <section className="shell hero">
        <div>
          <span className={`kicker ${health.online === false ? "offline" : ""}`} data-testid="network-health">
            <span className="dot" />
            {isPreviewMode
              ? "Preview data · read only"
              : health.online === null
                ? "Checking Hadrian…"
                : health.online
                  ? `Live on Hadrian · block ${health.block?.toLocaleString("en-US")}`
                  : "Hadrian RPC unreachable"}
          </span>
          <h1>
            Send USDC. <em>Both wallet worlds.</em>
          </h1>
          <p className="hero-copy">
            Pay any MetaMask address or Solana wallet on Rome. Paste a Solana address and Denarius
            pays the Rome address that wallet controls, so the recipient spends it from Solflare
            with no EVM key and no bridge.
          </p>
          <div className="hero-actions">
            <a className="button button-primary button-large" href="#send">
              <Send size={17} /> Send USDC
            </a>
            <a className="button button-large" href="#request">
              Request a payment <ArrowRight size={16} />
            </a>
          </div>
        </div>
        <WalletCard onChanged={() => setRefreshKey((key) => key + 1)} />
      </section>

      <section className="shell stats" aria-label="Denarius statistics">
        <div><strong>{stats ? stats.payments : "—"}</strong><span>payments</span></div>
        <div><strong>{stats ? stats.requests : "—"}</strong><span>payment requests</span></div>
        <div><strong>{formatUsdc(volume)}</strong><span>USDC in recent payments</span></div>
        <div><strong>2</strong><span>wallet worlds, one contract</span></div>
      </section>

      <section className="shell section action-grid">
        <SendCard onSent={() => setRefreshKey((key) => key + 1)} />
        <RequestCard />
      </section>

      <section className="shell section" id="activity">
        <div className="section-head">
          <div>
            <p className="eyebrow">The ledger</p>
            <h2>Latest payments.</h2>
          </div>
          {DENARIUS_ADDRESS && (
            <a className="button" href={`${VIA_BASE_URL}/address/${DENARIUS_ADDRESS}`} target="_blank" rel="noreferrer">
              View contract <ArrowUpRight size={15} />
            </a>
          )}
        </div>
        {isPreviewMode && (
          <p className="notice">Showing sample payments. Configure the deployed contract to read live Hadrian data.</p>
        )}
        {notice && <p className="notice" role="alert">{notice}</p>}
        {recent.length ? (
          <ul className="payment-list">
            {recent.map((payment) => (
              <PaymentRow key={payment.id.toString()} payment={payment} />
            ))}
          </ul>
        ) : (
          <div className="empty-state">No payments yet. Send the first one.</div>
        )}
      </section>

      <section className="shell section" id="how-it-works">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>One balance, any wallet.</h2>
          </div>
        </div>
        <div className="steps">
          <article className="step">
            <span>01</span>
            <h3>Paste any address</h3>
            <p>An EVM address is paid directly. A Solana address is paid at its Rome synthetic address, keccak256(pubkey)[12:].</p>
          </article>
          <article className="step">
            <span>02</span>
            <h3>Top up from Solflare</h3>
            <p>Solana users move devnet USDC from their wallet into their Rome balance with one signature, then send like anyone else.</p>
          </article>
          <article className="step">
            <span>03</span>
            <h3>Keep a receipt</h3>
            <p>Every payment, memo, and request lives in one contract, with a shareable activity page for any address.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

function WalletCard({ onChanged }: { onChanged(): void }) {
  const wallet = useRomeWallet();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const topUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const value = parseUsdc(amount);
    if (!value) return setError("Enter a positive amount with at most 6 decimals.");
    try {
      await wallet.fundFromSolana(value);
      setAmount("");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The top-up failed.");
    }
  };

  return (
    <aside className="proof-card wallet-card">
      <p className="eyebrow">Your Rome balance</p>
      {wallet.activeAddress ? (
        <>
          <strong className="balance">
            {wallet.balance === null ? "—" : formatUsdc(wallet.balance, 4)} <small>USDC</small>
          </strong>
          <p>
            {wallet.activeLane === "solana"
              ? `Solflare ${shortAddress(wallet.solanaAddress ?? "", 4)} controls Rome address ${shortAddress(wallet.activeAddress)}.`
              : `MetaMask ${shortAddress(wallet.activeAddress)} on Rome Hadrian.`}
          </p>
          {wallet.activeLane === "solana" && (
            <form className="topup" onSubmit={(event) => void topUp(event)}>
              <label className="field">
                <span>Top up from Solflare (devnet USDC)</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="5.00"
                  aria-label="Top-up amount"
                />
              </label>
              <button className="button button-primary" disabled={wallet.isBusy}>
                <Sparkles size={15} /> Top up
              </button>
            </form>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
        </>
      ) : (
        <>
          <strong className="balance">—</strong>
          <p>Connect MetaMask or Solflare to see your balance and send USDC.</p>
          <code>{"pay(to, memo)  // value forwarded\n// Solana wallet → keccak256(pubkey)[12:]"}</code>
        </>
      )}
    </aside>
  );
}

function SendCard({ onSent }: { onSent(): void }) {
  const wallet = useRomeWallet();
  const [recipientInput, setRecipientInput] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const recipient = recipientInput.trim() ? resolveRecipient(recipientInput) : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSent(null);
    if (!recipient) return setError("Enter an EVM address (0x…) or a Solana wallet address.");
    const value = parseUsdc(amount);
    if (!value) return setError("Enter a positive amount with at most 6 decimals.");
    const memoError = textError(memo, "The memo");
    if (memoError) return setError(memoError);
    if (!wallet.activeAddress) return setError("Connect MetaMask or Solflare first.");
    if (recipient.address.toLowerCase() === wallet.activeAddress.toLowerCase()) {
      return setError("That is your own active address.");
    }
    try {
      await wallet.executeCall(encodePay(recipient.address, memo.trim()), undefined, value);
      setSent(`Sent ${formatUsdc(value, 6)} USDC to ${recipient.kind === "solana" ? "Solana wallet" : ""} ${shortAddress(recipient.kind === "solana" ? recipient.solanaAddress : recipient.address)}.`);
      setAmount("");
      setMemo("");
      onSent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payment failed.");
    }
  };

  return (
    <article className="action-card" id="send">
      <p className="eyebrow">Send</p>
      <h2>Pay any wallet.</h2>
      <form onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Recipient: EVM address or Solana wallet</span>
          <input
            value={recipientInput}
            onChange={(event) => setRecipientInput(event.target.value)}
            placeholder="0x… or a Solana address"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {recipientInput.trim() && (
          <p className={`resolved ${recipient ? "" : "invalid"}`} data-testid="resolved-recipient">
            {!recipient
              ? "Not a valid EVM or Solana address."
              : recipient.kind === "solana"
                ? `Solana wallet · pays Rome address ${shortAddress(recipient.address)}`
                : `EVM address · ${shortAddress(recipient.address)}`}
          </p>
        )}
        <div className="field-row">
          <label className="field">
            <span>Amount (USDC)</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="10.00" />
          </label>
          <label className="field">
            <span>Memo (optional)</span>
            <input value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={140} placeholder="Dinner split" />
          </label>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {sent && <div className="ballot-note" role="status">{sent}</div>}
        <button className="button button-primary button-large" disabled={wallet.isBusy}>
          <Send size={16} /> {wallet.isBusy ? "Sending…" : "Send USDC"}
        </button>
      </form>
    </article>
  );
}

function RequestCard() {
  const wallet = useRomeWallet();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const value = parseUsdc(String(data.get("amount") ?? ""));
    const note = String(data.get("note") ?? "").trim();
    const duration = Number(data.get("expiry") ?? 0);
    if (!value) return setError("Enter a positive amount with at most 6 decimals.");
    const noteError = textError(note, "The note");
    if (noteError) return setError(noteError);
    if (!wallet.activeAddress) return setError("Connect the wallet that should receive the payment.");
    const expiresAt = duration ? Math.floor(Date.now() / 1000) + duration : 0;
    try {
      await wallet.executeCall(encodeCreateRequest(value, note, expiresAt));
      const id = await findRequestId(wallet.activeAddress, value, note);
      if (!id) throw new Error("The request was created but could not be found yet. Refresh in a moment.");
      router.push(`/pay/${id.toString()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The request could not be created.");
    }
  };

  return (
    <article className="action-card" id="request">
      <p className="eyebrow">Request</p>
      <h2>Get paid by link.</h2>
      <p className="detail-description">
        Create a one-time request and share its link or QR code. Anyone can pay it from MetaMask or Solflare.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <div className="field-row">
          <label className="field">
            <span>Amount (USDC)</span>
            <input name="amount" inputMode="decimal" placeholder="42.00" required />
          </label>
          <label className="field">
            <span>Expires</span>
            <select name="expiry" defaultValue={EXPIRIES[2].seconds}>
              {EXPIRIES.map((expiry) => (
                <option key={expiry.seconds} value={expiry.seconds}>{expiry.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>What is it for? (optional)</span>
          <input name="note" maxLength={140} placeholder="Workshop ticket" />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-large" disabled={wallet.isBusy}>
          <Plus size={16} /> Create payment link
        </button>
      </form>
      {isPreviewMode && (
        <a className="back-link" href={`/pay/${demoRequests[0].id.toString()}`}>
          <ReceiptText size={14} /> See a sample request
        </a>
      )}
      {wallet.isBusy && <p className="detail-description"><LoaderCircle className="spin" size={14} /> Waiting for your wallet…</p>}
    </article>
  );
}
