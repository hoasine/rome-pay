"use client";

import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  LoaderCircle,
  Plus,
  ReceiptText,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ROMEPAY_ADDRESS, VIA_BASE_URL, isPreviewMode, shortAddress } from "@/lib/config";
import {
  encodeCreateRequest,
  encodePay,
  findRequestId,
  loadPayments,
  loadRecentPayments,
  loadStats,
} from "@/lib/contract";
import { DEMO_ACCOUNT, demoPayments, demoRequests } from "@/lib/demo-data";
import { formatUsdc, parseUsdc, resolveRecipient, textError } from "@/lib/money";
import type { Payment } from "@/lib/types";
import { EvmMark, SolanaMark } from "./brand-icons";
import { PaymentRow, QrCode, openWalletMenu, useChainHealth } from "./ui";
import { useRomeWallet } from "./wallet-provider";

type Tab = "send" | "receive" | "request" | "topup";

const EXPIRIES = [
  { label: "Never", seconds: 0 },
  { label: "1 day", seconds: 86400 },
  { label: "7 days", seconds: 7 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
] as const;

export function RomePayHome() {
  const wallet = useRomeWallet();
  const health = useChainHealth();
  const [tab, setTab] = useState<Tab>("send");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((key) => key + 1);
  const activeTab = tab === "topup" && wallet.activeLane !== "solana" ? "send" : tab;

  return (
    <main className="shell app">
      <div className="app-topline">
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
        <h1 className="app-title">Send USDC to any wallet on Rome</h1>
      </div>

      <div className="app-grid">
        <section className="wallet-panel" aria-label="Wallet">
          <BalanceHeader />
          <div className="action-tabs" role="tablist" aria-label="Wallet actions">
            <TabButton id="send" active={activeTab} onSelect={setTab} icon={<ArrowUpRight size={19} />} label="Send" />
            <TabButton id="receive" active={activeTab} onSelect={setTab} icon={<ArrowDownLeft size={18} />} label="Receive" />
            <TabButton id="request" active={activeTab} onSelect={setTab} icon={<FileText size={18} />} label="Request" />
            <TabButton
              id="topup"
              active={activeTab}
              onSelect={setTab}
              icon={<ArrowDownToLine size={18} />}
              label="Top up"
              disabled={wallet.activeLane !== "solana"}
              hint="Connect Solflare to top up from Solana"
            />
          </div>
          <div className="tab-body" role="tabpanel">
            {activeTab === "send" && <SendForm onSent={refresh} />}
            {activeTab === "receive" && <ReceivePanel />}
            {activeTab === "request" && <RequestForm />}
            {activeTab === "topup" && <TopUpForm onDone={refresh} />}
          </div>
        </section>

        <ActivityPanel refreshKey={refreshKey} />
      </div>

      <section className="feature-strip" id="how-it-works" aria-label="How RomePay works">
        <article>
          <span className="feature-icon solana"><SolanaMark size={18} /></span>
          <h3>Pay Solana wallets</h3>
          <p>Paste a Solana address. RomePay pays the Rome address that wallet controls, keccak256(pubkey)[12:].</p>
        </article>
        <article>
          <span className="feature-icon gold"><ArrowDownToLine size={18} /></span>
          <h3>Spend from Solflare</h3>
          <p>Solana users top up from their own devnet USDC and send through Rome without ever creating an EVM key.</p>
        </article>
        <article>
          <span className="feature-icon primary"><ShieldCheck size={18} /></span>
          <h3>One ledger</h3>
          <p>
            Payments, memos, and requests live in one contract
            {ROMEPAY_ADDRESS ? (
              <>
                {" · "}
                <a href={`${VIA_BASE_URL}/address/${ROMEPAY_ADDRESS}`} target="_blank" rel="noreferrer">verify on Via</a>
              </>
            ) : null}
            .
          </p>
        </article>
      </section>
    </main>
  );
}

function TabButton({
  id,
  active,
  onSelect,
  icon,
  label,
  disabled = false,
  hint,
}: {
  id: Tab;
  active: Tab;
  onSelect(tab: Tab): void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active === id}
      className={`action-tab ${active === id ? "active" : ""}`}
      onClick={() => onSelect(id)}
      disabled={disabled}
      title={disabled ? hint : label}
    >
      <span className="action-tab-icon">{icon}</span>
      {label}
    </button>
  );
}

function BalanceHeader() {
  const wallet = useRomeWallet();
  const [copied, setCopied] = useState(false);
  const shareable = wallet.activeLane === "solana" ? wallet.solanaAddress : wallet.activeAddress;

  const copy = async () => {
    if (!shareable) return;
    await navigator.clipboard.writeText(shareable);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (!wallet.activeAddress) {
    return (
      <div className="balance-header">
        <span className="balance-label">Total balance</span>
        <strong className="balance-amount">— <small>USDC</small></strong>
        <p className="balance-sub">MetaMask or Solflare. Both pay into the same Rome contract.</p>
        <button className="button button-primary" onClick={openWalletMenu}>
          <Wallet size={16} /> Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="balance-header">
      <div className="balance-top">
        <span className="balance-label">Total balance</span>
        <span className={`lane-badge ${wallet.activeLane}`}>
          {wallet.activeLane === "solana" ? <SolanaMark size={12} /> : <EvmMark size={12} />}
          {wallet.activeLane === "solana" ? "Solflare" : "MetaMask"}
        </span>
      </div>
      <strong className="balance-amount" data-testid="balance">
        {wallet.balance === null ? "—" : formatUsdc(wallet.balance, 4)} <small>USDC</small>
      </strong>
      <button className="address-chip" onClick={() => void copy()} title={shareable ?? undefined}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {shortAddress(shareable ?? "", 6)}
        {wallet.activeLane === "solana" && <span className="muted"> · Rome {shortAddress(wallet.activeAddress)}</span>}
      </button>
    </div>
  );
}

function SendForm({ onSent }: { onSent(): void }) {
  const wallet = useRomeWallet();
  const [recipientInput, setRecipientInput] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const recipient = recipientInput.trim() ? resolveRecipient(recipientInput) : null;

  const setMax = () => {
    if (wallet.balance === null) return;
    const reserve = 10n ** 17n;
    const available = wallet.balance > reserve ? wallet.balance - reserve : 0n;
    const micro = available - (available % 10n ** 12n);
    setAmount(formatUsdc(micro, 6).replace(/,/g, ""));
  };

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
      setSent(
        `Sent ${formatUsdc(value, 6)} USDC to ${shortAddress(recipient.kind === "solana" ? recipient.solanaAddress : recipient.address)}.`,
      );
      setAmount("");
      setMemo("");
      onSent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payment failed.");
    }
  };

  return (
    <form className="wallet-form" id="send" onSubmit={(event) => void submit(event)}>
      <label className="field">
        <span>To</span>
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
      <label className="field amount-field">
        <span>Amount</span>
        <div className="amount-input">
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
          <span className="amount-unit">USDC</span>
          <button type="button" className="max-button" onClick={setMax} disabled={wallet.balance === null}>
            MAX
          </button>
        </div>
      </label>
      <label className="field">
        <span>Memo (optional)</span>
        <input value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={140} placeholder="Dinner split" />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      {sent && <div className="ballot-note" role="status">{sent}</div>}
      <button className="button button-primary button-large button-block" disabled={wallet.isBusy}>
        <Send size={16} /> {wallet.isBusy ? "Sending…" : "Send USDC"}
      </button>
    </form>
  );
}

function ReceivePanel() {
  const wallet = useRomeWallet();
  const shareable = wallet.activeLane === "solana" ? wallet.solanaAddress : wallet.activeAddress;
  if (!shareable) {
    return <p className="tab-hint">Connect a wallet to show the address people can pay.</p>;
  }
  return (
    <div className="receive">
      <QrCode value={shareable} label="Your receiving address" />
      <div>
        <p className="tab-hint">
          {wallet.activeLane === "solana"
            ? "Share your Solana address. RomePay senders pay the Rome address it controls, and you spend it from Solflare."
            : "Share your MetaMask address on Rome Hadrian."}
        </p>
        <code className="address-full">{shareable}</code>
        {wallet.activeAddress && (
          <Link className="button button-small" href={`/activity/${wallet.activeAddress}`}>
            <ReceiptText size={14} /> Full activity
          </Link>
        )}
      </div>
    </div>
  );
}

function RequestForm() {
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
    <form className="wallet-form" id="request" onSubmit={(event) => void submit(event)}>
      <p className="tab-hint">Create a one-time payment link with a QR code. Anyone can pay it from MetaMask or Solflare.</p>
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
      <button className="button button-primary button-large button-block" disabled={wallet.isBusy}>
        <Plus size={16} /> Create payment link
      </button>
      {isPreviewMode && (
        <Link className="back-link" href={`/pay/${demoRequests[0].id.toString()}`}>
          <ReceiptText size={14} /> See a sample request
        </Link>
      )}
    </form>
  );
}

function TopUpForm({ onDone }: { onDone(): void }) {
  const wallet = useRomeWallet();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const value = parseUsdc(amount);
    if (!value) return setError("Enter a positive amount with at most 6 decimals.");
    try {
      await wallet.fundFromSolana(value);
      setAmount("");
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The top-up failed.");
    }
  };

  return (
    <form className="wallet-form" onSubmit={(event) => void submit(event)}>
      <p className="tab-hint">Move devnet USDC from your Solflare wallet into your Rome balance with one signature.</p>
      <label className="field amount-field">
        <span>Amount</span>
        <div className="amount-input">
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="5.00" aria-label="Top-up amount" />
          <span className="amount-unit">USDC</span>
        </div>
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary button-large button-block" disabled={wallet.isBusy}>
        <ArrowDownToLine size={16} /> {wallet.isBusy ? "Waiting for Solflare…" : "Top up from Solflare"}
      </button>
    </form>
  );
}

function ActivityPanel({ refreshKey }: { refreshKey: number }) {
  const wallet = useRomeWallet();
  // Preview data belongs to the sample account, so show it from that account's point of view.
  const viewer = isPreviewMode ? DEMO_ACCOUNT : (wallet.activeAddress ?? undefined);
  const [scope, setScope] = useState<"mine" | "network">("mine");
  const showMine = scope === "mine" && viewer !== undefined;
  const [payments, setPayments] = useState<Payment[] | null>(isPreviewMode ? demoPayments : null);
  const [stats, setStats] = useState(
    isPreviewMode ? { payments: demoPayments.length, requests: demoRequests.length } : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    Promise.all([showMine && viewer ? loadPayments(viewer) : loadRecentPayments(10), loadStats()])
      .then(([next, nextStats]) => {
        if (cancelled) return;
        setPayments(next);
        setStats(nextStats);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not read RomePay from Hadrian.");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, showMine, viewer]);

  return (
    <aside className="activity-panel" id="activity" aria-label="Activity">
      <div className="activity-head">
        <h2>Activity</h2>
        <div className="segmented" role="group" aria-label="Activity scope">
          <button aria-pressed={showMine} onClick={() => setScope("mine")} disabled={viewer === undefined}>
            Mine
          </button>
          <button aria-pressed={!showMine} onClick={() => setScope("network")}>
            Network
          </button>
        </div>
      </div>
      <div className="mini-stats">
        <div><strong>{stats ? stats.payments : "—"}</strong><span>payments</span></div>
        <div><strong>{stats ? stats.requests : "—"}</strong><span>requests</span></div>
      </div>
      {isPreviewMode && <p className="notice">Sample data. Deploy the contract to read live Hadrian activity.</p>}
      {error && <p className="notice" role="alert">{error}</p>}
      {payments === null ? (
        <div className="empty-state"><LoaderCircle className="spin" /> Loading…</div>
      ) : payments.length ? (
        <ul className="payment-list">
          {payments.map((payment) => (
            <PaymentRow key={payment.id.toString()} payment={payment} viewer={showMine ? viewer : undefined} />
          ))}
        </ul>
      ) : (
        <div className="empty-state">{showMine ? "No payments for this wallet yet." : "No payments yet."}</div>
      )}
      {showMine && viewer && (
        <Link className="view-all" href={`/activity/${viewer}`}>
          View full history <ArrowUpRight size={14} />
        </Link>
      )}
    </aside>
  );
}
