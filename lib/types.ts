import type { Address } from "viem";

export interface Payment {
  id: bigint;
  from: Address;
  to: Address;
  amount: bigint;
  memo: string;
  requestId: bigint;
  createdAt: number;
}

export type RequestStatus = "open" | "paid" | "expired" | "cancelled";

export interface PaymentRequest {
  id: bigint;
  recipient: Address;
  amount: bigint;
  note: string;
  createdAt: number;
  expiresAt: number;
  paymentId: bigint;
  cancelled: boolean;
}

export type TransactionState =
  | { status: "idle" }
  | { status: "preparing"; message: string }
  | { status: "signing"; message: string }
  | { status: "confirming"; message: string; hash?: `0x${string}` }
  | { status: "success"; message: string; hash?: `0x${string}` }
  | { status: "error"; message: string };
