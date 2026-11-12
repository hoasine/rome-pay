import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syntheticAddress } from "@rome-protocol/sdk";
import { Keypair } from "@solana/web3.js";
import { getAddress, parseEther } from "viem";
import { formatUsdc, parseUsdc, requestStatus, resolveRecipient, textError } from "../lib/money";
import type { PaymentRequest } from "../lib/types";

function request(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    id: 1n,
    recipient: "0x0000000000000000000000000000000000000001",
    amount: 1n,
    note: "",
    createdAt: 0,
    expiresAt: 0,
    paymentId: 0n,
    cancelled: false,
    ...overrides,
  };
}

describe("recipient resolution", () => {
  it("pays EVM addresses directly, checksummed", () => {
    const result = resolveRecipient("0x7fe694a5f7ef358db37525802e63751432e0d5af");
    assert.deepEqual(result, {
      kind: "evm",
      address: getAddress("0x7fe694a5f7ef358db37525802e63751432e0d5af"),
    });
  });

  it("pays a Solana wallet at the Rome synthetic address the SDK derives", () => {
    const keypair = Keypair.generate();
    const result = resolveRecipient(`  ${keypair.publicKey.toBase58()} `);
    assert.equal(result?.kind, "solana");
    assert.equal(result?.address, getAddress(syntheticAddress(keypair.publicKey)));
    assert.equal(result?.kind === "solana" && result.solanaAddress, keypair.publicKey.toBase58());
  });

  it("accepts EVM addresses whose casing does not match the checksum", () => {
    const result = resolveRecipient("0x7f2D39e2a45D7484aA65f6B63F1f94E2a851D5Af");
    assert.equal(result?.kind, "evm");
    assert.equal(result?.address, getAddress("0x7f2d39e2a45d7484aa65f6b63f1f94e2a851d5af"));
  });

  it("rejects anything else", () => {
    for (const value of ["", "hello", "0x1234", "0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl", "a".repeat(50)]) {
      assert.equal(resolveRecipient(value), null, value);
    }
  });
});

describe("amounts and text", () => {
  it("parses up to 6 decimals into 18-decimal native USDC", () => {
    assert.equal(parseUsdc("1"), parseEther("1"));
    assert.equal(parseUsdc("0.000001"), 10n ** 12n);
    assert.equal((parseUsdc("12.345678") ?? 0n) % 10n ** 12n, 0n);
    assert.equal(parseUsdc("0.0000001"), null);
    assert.equal(parseUsdc("0"), null);
    assert.equal(parseUsdc("-1"), null);
    assert.equal(parseUsdc("1e3"), null);
  });

  it("formats balances for display", () => {
    assert.equal(formatUsdc(parseEther("1234.5678")), "1,234.56");
    assert.equal(formatUsdc(parseEther("2"), 4), "2");
    assert.equal(formatUsdc(parseEther("0.0501"), 4), "0.0501");
  });

  it("measures memos in UTF-8 bytes", () => {
    assert.equal(textError("a".repeat(140), "Memo"), null);
    assert.match(textError("Đ".repeat(71), "Memo") ?? "", /140 bytes/);
  });

  it("derives request status", () => {
    assert.equal(requestStatus(request(), 10), "open");
    assert.equal(requestStatus(request({ paymentId: 3n }), 10), "paid");
    assert.equal(requestStatus(request({ cancelled: true }), 10), "cancelled");
    assert.equal(requestStatus(request({ expiresAt: 10 }), 10), "expired");
    assert.equal(requestStatus(request({ expiresAt: 11 }), 10), "open");
  });
});
