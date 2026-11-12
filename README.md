# Denarius

Denarius sends Rome's native USDC from MetaMask or Solflare to any EVM address or Solana wallet. Paste a Solana address and Denarius pays the Rome address that wallet controls, so the recipient spends it from Solflare with no EVM key and no bridge. Payments carry memos, payment requests are shareable links with QR codes, and every address has an on-chain history.

![CI](https://github.com/hoasine/rome-denarius/actions/workflows/check.yml/badge.svg)

## Why it needs Rome

- **Solana recipients.** Rome derives each Solana wallet's EVM address as `keccak256(pubkey)[12:]` and lets that wallet sign for it from Solflare. Denarius resolves a pasted Solana address with the Rome SDK's `syntheticAddress` and pays it like any other address.
- **Solana senders.** A Solflare user moves devnet USDC from their wallet into their Rome balance with the SDK's `fundSyntheticGas`, then sends through `submitRomeTxV1` with a `value`, never creating an EVM key.
- **One ledger.** MetaMask and Solflare users pay each other through the same contract and see the same history.

## Features

- Send to an EVM address or a Solana wallet, with a live preview of the Rome address being paid
- Memos up to 140 bytes
- Top up from Solflare (devnet USDC to Rome balance)
- One-time payment requests with an optional expiry, shareable link, QR code, and cancel
- `/activity/<address>` for any EVM address or Solana wallet, with balance, totals, and history
- Live Hadrian status, labelled read-only preview, disconnect buttons for both wallets

## Contract

`contracts/Denarius.sol`, Solidity 0.8.28:

- `pay(to, memo)` payable: forwards the full amount in the same call
- `createRequest(amount, note, expiresAt)`, `payRequest(requestId, memo)` payable, `cancelRequest(requestId)`
- `getPayment`, `getRequest`, `paymentsOf(account, offset, limit)` newest first, `activityCount`

Rules enforced on-chain: no zero amounts, no zero, self, or contract-self recipients, a request is paid once for its exact amount before it expires, and only its recipient cancels it. State is written before the transfer, and a reentrancy guard blocks recursive payments. A recipient that refuses funds reverts the whole payment. The contract holds nothing between calls and has no owner or upgrade path.

## Limits

- Amounts use at most 6 decimals, so every value is a whole number of Solana-side micro-USDC and matches what a Solflare top-up accepts.
- Denarius does not move USDC back to a Solana wallet as an SPL token. Recipients spend their Rome balance from Solflare, or move it out with the Rome Bridge.

## Local development

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev
```

```bash
npm run check          # lint, typecheck, contract + unit tests, production build
npx playwright install chromium
npm run test:e2e       # desktop + mobile smoke tests against the preview build
```

## Deploy

```bash
npm run deploy:secure    # Hadrian testnet
npm run deploy:rubicon   # Rubicon mainnet, real USDC gas
```

Each command asks for the key with hidden input, deploys, prints the deployment transaction hash for Arena, writes `deployments/<network>.json`, and verifies the source on Rome's Sourcify. Then configure:

```bash
NEXT_PUBLIC_DENARIUS_ADDRESS=0x...
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
```

See [`docs/ARENA_SUBMISSION.md`](docs/ARENA_SUBMISSION.md) and [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).
