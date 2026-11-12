# Denarius — Arena submission

## App name

Denarius

## One line

Send USDC on Rome from MetaMask or Solflare to any EVM address or Solana wallet

## What are you building?

One payment app for both wallet worlds. Paste an EVM address or a Solana wallet address, enter an amount and a memo, and send native USDC on Rome Hadrian from MetaMask or Solflare.

A Solana address is paid at the Rome synthetic address that wallet controls, so the recipient spends the funds from Solflare with no EVM key and no bridge. Solflare users top up their Rome balance from their own devnet USDC with one signature, then send like anyone else. One-time payment requests are shareable links with QR codes, and every payment, memo, and request lives in one Solidity contract with a public history for any EVM or Solana address.

## Kind

Both

## Why Rome

Rome lets a Solana wallet control an EVM address derived from its public key and sign Solidity calls from Solflare. That makes a Solana wallet a first-class payment recipient and sender in the same contract MetaMask users use, with no wrapping, mirroring, or bridge in between.

## Completed features

- Send to EVM addresses or Solana wallets, with a preview of the Rome address being paid
- Top up from Solflare via the Rome SDK's `fundSyntheticGas`
- Sending from Solflare via `submitRomeTxV1` with value
- One-time payment requests: amount, note, expiry, link, QR code, cancel
- Activity pages for any EVM or Solana address with balance and totals
- Live Hadrian status; labelled preview mode; disconnect for both wallets

## Quality

- 7 contract tests: forwarding and history, paying and spending from a real Solana keypair's synthetic address, input checks, refusing recipients, reentrancy, request lifecycle, expiry and cancel, pagination
- Unit tests for recipient resolution against the Rome SDK, amount parsing, formatting, and request status
- Playwright smoke tests on desktop and mobile with a mocked MetaMask session
- GitHub Actions: lint, typecheck, tests, build, browser tests, dependency audit

## Links

- Website: `ADD_APP_URL`
- GitHub: `https://github.com/hoasine/rome-denarius`
- X: `https://x.com/HoaTranRom`
- Contract: `ADD_CONTRACT_ADDRESS`
- Deployment transaction (for "Link a contract"): `ADD_DEPLOY_TX`
- Demo video: `ADD_VIDEO_URL`

## Grant application

What is the grant for:

```
Make Denarius the simplest way to pay across EVM and Solana wallets on Rome, in three milestones:

1. Rubicon launch (2 weeks): deploy and verify on Rubicon, switch to a Solana mainnet RPC, and test top-up, send, and request flows from both wallets end to end.

2. Cash out to Solana (4 weeks): let Solflare users move their Rome USDC back into their wallet as SPL USDC through Rome's withdraw and token precompiles, so funds round-trip without the bridge.

3. Merchant pilots (4 weeks): payment links with fixed amounts for 5 Rome builders and community events, sponsored gas for first-time payers, and a target of 500 payments with at least a third from Solana wallets.

Funds cover Rubicon gas, gas sponsorship, a paid Solana mainnet RPC, an audit of the payment contract before mainnet volume, and development time.
```

Does your app hold user funds: No. Denarius forwards every payment in the same transaction and holds nothing between calls.
