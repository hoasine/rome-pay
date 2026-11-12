# Denarius demo script

Target length: about 2 minutes.

## Preparation

1. Open the deployed Denarius app.
2. Have MetaMask on Rome Hadrian with a few test USDC, and Solflare on Devnet with a little devnet SOL and devnet USDC.
3. Copy your Solflare address.

## Recording

### 1. The idea (15 s)

"Denarius is one payment app for both wallet worlds. MetaMask and Solflare users pay each other in USDC through one contract on Rome."

### 2. Pay a Solana wallet from MetaMask (35 s)

Connect MetaMask. In Send, paste the Solflare address and point at the preview: "Solana wallet, pays Rome address 0x…". Enter 5 USDC and a memo, and sign. Open the recipient's activity page from the payment row.

### 3. Spend it from Solflare (35 s)

Switch to Solflare. The Rome balance shows the 5 USDC. Send 2 USDC back to the MetaMask address, approving the Rome authorization and the transaction in Solflare. "No EVM key, no bridge."

### 4. Top up and request (25 s)

Top up 1 USDC from Solflare's own devnet USDC. Then create a payment request for 3 USDC and show its link and QR code.

### 5. Proof (10 s)

Open the payment on Via Explorer and the verified contract.
