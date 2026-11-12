import { parseEther } from "viem";
import type { Payment, PaymentRequest } from "./types";

const base = Math.floor(Date.UTC(2026, 10, 10) / 1000);

export const DEMO_ACCOUNT = "0x7f2D39e2a45D7484aA65f6B63F1f94E2a851D5Af" as const;

export const demoPayments: Payment[] = [
  {
    id: 4n,
    from: "0x3Fa6E34B41DC1Ce583F64F7B495AD35DdE76E813",
    to: DEMO_ACCOUNT,
    amount: parseEther("120"),
    memo: "Design milestone 2",
    requestId: 1n,
    createdAt: base - 1800,
  },
  {
    id: 3n,
    from: DEMO_ACCOUNT,
    to: "0x99235f50A5F0E9345cfA83a99aBDF3FaD754C9a1",
    amount: parseEther("18.5"),
    memo: "Dinner split",
    requestId: 0n,
    createdAt: base - 7200,
  },
  {
    id: 2n,
    from: "0xA8642Fd55193D34FD987D4DeFA60F3a55f7919b0",
    to: DEMO_ACCOUNT,
    amount: parseEther("5"),
    memo: "gm from Solana",
    requestId: 0n,
    createdAt: base - 86400,
  },
];

export const demoRequests: PaymentRequest[] = [
  {
    id: 2n,
    recipient: DEMO_ACCOUNT,
    amount: parseEther("42"),
    note: "Workshop ticket",
    createdAt: base - 600,
    expiresAt: 0,
    paymentId: 0n,
    cancelled: false,
  },
  {
    id: 1n,
    recipient: DEMO_ACCOUNT,
    amount: parseEther("120"),
    note: "Design milestone 2",
    createdAt: base - 3600,
    expiresAt: 0,
    paymentId: 4n,
    cancelled: false,
  },
];
