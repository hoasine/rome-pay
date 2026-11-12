import { createPublicClient, encodeFunctionData, http, type Address, type Hex } from "viem";
import { denariusAbi } from "./abi";
import { DENARIUS_ADDRESS, hadrian } from "./config";
import type { Payment, PaymentRequest } from "./types";

export const publicClient = createPublicClient({
  chain: hadrian,
  transport: http(),
});

export const PAGE_SIZE = 25;

function requireContract() {
  if (!DENARIUS_ADDRESS) {
    throw new Error("Denarius is running in preview mode. Configure NEXT_PUBLIC_DENARIUS_ADDRESS.");
  }
  return DENARIUS_ADDRESS;
}

type RawPayment = {
  id: bigint;
  from: Address;
  to: Address;
  amount: bigint;
  memo: string;
  requestId: bigint;
  createdAt: bigint;
};

export function toPayment(raw: RawPayment): Payment {
  return {
    id: raw.id,
    from: raw.from,
    to: raw.to,
    amount: raw.amount,
    memo: raw.memo,
    requestId: raw.requestId,
    createdAt: Number(raw.createdAt),
  };
}

export async function loadPayments(account: Address, offset = 0): Promise<Payment[]> {
  const raw = await publicClient.readContract({
    address: requireContract(),
    abi: denariusAbi,
    functionName: "paymentsOf",
    args: [account, BigInt(offset), BigInt(PAGE_SIZE)],
  });
  return raw.map(toPayment);
}

export async function loadRecentPayments(limit = 8): Promise<Payment[]> {
  const address = requireContract();
  const count = Number(await publicClient.readContract({ address, abi: denariusAbi, functionName: "paymentCount" }));
  const ids = Array.from({ length: Math.min(limit, count) }, (_, index) => BigInt(count - index));
  return Promise.all(
    ids.map(async (id) =>
      toPayment(await publicClient.readContract({ address, abi: denariusAbi, functionName: "getPayment", args: [id] })),
    ),
  );
}

export async function loadStats() {
  const address = requireContract();
  const [payments, requests] = await Promise.all([
    publicClient.readContract({ address, abi: denariusAbi, functionName: "paymentCount" }),
    publicClient.readContract({ address, abi: denariusAbi, functionName: "requestCount" }),
  ]);
  return { payments: Number(payments), requests: Number(requests) };
}

export async function loadRequest(id: bigint): Promise<PaymentRequest> {
  const raw = await publicClient.readContract({
    address: requireContract(),
    abi: denariusAbi,
    functionName: "getRequest",
    args: [id],
  });
  return {
    id: raw.id,
    recipient: raw.recipient,
    amount: raw.amount,
    note: raw.note,
    createdAt: Number(raw.createdAt),
    expiresAt: Number(raw.expiresAt),
    paymentId: raw.paymentId,
    cancelled: raw.cancelled,
  };
}

export async function findRequestId(recipient: Address, amount: bigint, note: string) {
  const address = requireContract();
  const count = await publicClient.readContract({ address, abi: denariusAbi, functionName: "requestCount" });
  for (let id = count; id > 0n && id > count - 10n; id--) {
    const request = await loadRequest(id);
    if (
      request.recipient.toLowerCase() === recipient.toLowerCase() &&
      request.amount === amount &&
      request.note === note
    ) {
      return id;
    }
  }
  return null;
}

export function encodePay(to: Address, memo: string): Hex {
  return encodeFunctionData({ abi: denariusAbi, functionName: "pay", args: [to, memo] });
}

export function encodeCreateRequest(amount: bigint, note: string, expiresAt: number): Hex {
  return encodeFunctionData({
    abi: denariusAbi,
    functionName: "createRequest",
    args: [amount, note, BigInt(expiresAt)],
  });
}

export function encodePayRequest(requestId: bigint, memo: string): Hex {
  return encodeFunctionData({ abi: denariusAbi, functionName: "payRequest", args: [requestId, memo] });
}

export function encodeCancelRequest(requestId: bigint): Hex {
  return encodeFunctionData({ abi: denariusAbi, functionName: "cancelRequest", args: [requestId] });
}
