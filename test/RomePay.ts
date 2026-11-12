import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syntheticAddress } from "@rome-protocol/sdk";
import { Keypair } from "@solana/web3.js";
import { getAddress, parseEther, type Address } from "viem";
import { network } from "hardhat";

const DAY = 24 * 60 * 60;

describe("RomePay", async () => {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [alice, bob, carol] = await viem.getWalletClients();

  async function deploy() {
    return viem.deployContract("RomePay");
  }

  async function write(
    contract: { address: Address; abi: readonly unknown[] },
    from: Address,
    functionName: string,
    args: readonly unknown[] = [],
    value = 0n,
  ) {
    const wallet = await viem.getWalletClient(from);
    const hash = await wallet.writeContract({
      address: contract.address,
      abi: contract.abi,
      functionName,
      args,
      value,
    } as never);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  const balanceOf = (address: Address) => publicClient.getBalance({ address });
  const now = async () => Number((await publicClient.getBlock()).timestamp);

  type PaymentView = { id: bigint; from: Address; to: Address; amount: bigint; memo: string; requestId: bigint };
  type RequestView = { recipient: Address; amount: bigint; paymentId: bigint; cancelled: boolean };

  it("forwards the full amount and records the payment for both sides", async () => {
    const romepay = await deploy();
    const amount = parseEther("2.5");
    const before = await balanceOf(bob.account.address);

    await write(romepay, alice.account.address, "pay", [bob.account.address, "Lunch"], amount);

    assert.equal((await balanceOf(bob.account.address)) - before, amount);
    assert.equal(await balanceOf(romepay.address), 0n);
    const payment = (await romepay.read.getPayment([1n])) as PaymentView;
    assert.equal(getAddress(payment.from), getAddress(alice.account.address));
    assert.equal(payment.amount, amount);
    assert.equal(payment.memo, "Lunch");
    for (const account of [alice.account.address, bob.account.address]) {
      const [latest] = (await romepay.read.paymentsOf([account, 0n, 5n])) as readonly PaymentView[];
      assert.equal(latest.id, 1n);
    }
  });

  it("pays a Solana wallet at its Rome synthetic address", async () => {
    const romepay = await deploy();
    const keypair = Keypair.generate();
    const synthetic = getAddress(syntheticAddress(keypair.publicKey));
    const amount = parseEther("1");

    await write(romepay, alice.account.address, "pay", [synthetic, "gm Solana"], amount);
    assert.equal(await balanceOf(synthetic), amount);

    await testClient.impersonateAccount({ address: synthetic });
    await testClient.setBalance({ address: synthetic, value: parseEther("5") });
    await write(romepay, synthetic, "pay", [alice.account.address, "Back to EVM"], parseEther("0.5"));
    assert.equal(await romepay.read.activityCount([synthetic]), 2n);
  });

  it("rejects empty amounts, bad recipients, and long memos", async () => {
    const romepay = await deploy();
    const cases: [unknown[], bigint, RegExp][] = [
      [[bob.account.address, ""], 0n, /InvalidAmount|reverted/],
      [["0x0000000000000000000000000000000000000000", ""], 1n, /InvalidRecipient|reverted/],
      [[alice.account.address, ""], 1n, /InvalidRecipient|reverted/],
      [[romepay.address, ""], 1n, /InvalidRecipient|reverted/],
      [[bob.account.address, "x".repeat(141)], 1n, /TextTooLong|reverted/],
    ];
    for (const [args, value, pattern] of cases) {
      await assert.rejects(() => write(romepay, alice.account.address, "pay", args, value), pattern);
    }
  });

  it("reverts when the recipient refuses funds and blocks re-entry", async () => {
    const romepay = await deploy();
    const rejecting = await viem.deployContract("RejectingReceiver");
    await assert.rejects(
      () => write(romepay, alice.account.address, "pay", [rejecting.address, ""], 1n),
      /TransferFailed|reverted/,
    );

    const reentrant = await viem.deployContract("ReentrantReceiver", [romepay.address, carol.account.address]);
    await assert.rejects(
      () => write(romepay, alice.account.address, "pay", [reentrant.address, ""], parseEther("1")),
      /TransferFailed|ReentrantCall|reverted/,
    );
    assert.equal(await romepay.read.paymentCount(), 0n);
    assert.equal(await balanceOf(romepay.address), 0n);
  });

  it("settles a payment request exactly once for the exact amount", async () => {
    const romepay = await deploy();
    const amount = parseEther("3");
    await write(romepay, bob.account.address, "createRequest", [amount, "Design work", 0n]);

    await assert.rejects(
      () => write(romepay, alice.account.address, "payRequest", [1n, ""], amount - 1n),
      /WrongAmount|reverted/,
    );
    await assert.rejects(
      () => write(romepay, bob.account.address, "payRequest", [1n, ""], amount),
      /InvalidRecipient|reverted/,
    );
    const before = await balanceOf(bob.account.address);
    await write(romepay, alice.account.address, "payRequest", [1n, "Thanks"], amount);
    assert.equal((await balanceOf(bob.account.address)) - before, amount);

    const request = (await romepay.read.getRequest([1n])) as RequestView;
    assert.equal(request.paymentId, 1n);
    const payment = (await romepay.read.getPayment([1n])) as PaymentView;
    assert.equal(payment.requestId, 1n);
    await assert.rejects(
      () => write(romepay, carol.account.address, "payRequest", [1n, ""], amount),
      /RequestClosed|reverted/,
    );
  });

  it("expires and cancels requests", async () => {
    const romepay = await deploy();
    const start = await now();
    await assert.rejects(
      () => write(romepay, bob.account.address, "createRequest", [1n, "", BigInt(start - 1)]),
      /InvalidExpiry|reverted/,
    );
    await assert.rejects(
      () => write(romepay, bob.account.address, "createRequest", [1n, "", BigInt(start + 91 * DAY)]),
      /InvalidExpiry|reverted/,
    );
    await assert.rejects(
      () => write(romepay, bob.account.address, "createRequest", [0n, "", 0n]),
      /InvalidAmount|reverted/,
    );

    await write(romepay, bob.account.address, "createRequest", [10n, "Soon", BigInt(start + DAY)]);
    await testClient.increaseTime({ seconds: DAY });
    await testClient.mine({ blocks: 1 });
    await assert.rejects(
      () => write(romepay, alice.account.address, "payRequest", [1n, ""], 10n),
      /RequestExpired|reverted/,
    );

    await write(romepay, bob.account.address, "createRequest", [10n, "Cancel me", 0n]);
    await assert.rejects(
      () => write(romepay, alice.account.address, "cancelRequest", [2n]),
      /NotRecipient|reverted/,
    );
    await write(romepay, bob.account.address, "cancelRequest", [2n]);
    assert.equal(((await romepay.read.getRequest([2n])) as RequestView).cancelled, true);
    await assert.rejects(
      () => write(romepay, alice.account.address, "payRequest", [2n, ""], 10n),
      /RequestClosed|reverted/,
    );
    await assert.rejects(() => romepay.read.getRequest([9n]), /RequestNotFound|reverted/);
  });

  it("pages history newest first", async () => {
    const romepay = await deploy();
    for (const memo of ["one", "two", "three"]) {
      await write(romepay, alice.account.address, "pay", [bob.account.address, memo], 1n);
    }
    const memos = async (offset: bigint, limit: bigint) =>
      ((await romepay.read.paymentsOf([bob.account.address, offset, limit])) as readonly PaymentView[]).map(
        (payment) => payment.memo,
      );
    assert.deepEqual(await memos(0n, 2n), ["three", "two"]);
    assert.deepEqual(await memos(2n, 5n), ["one"]);
    assert.deepEqual(await memos(3n, 5n), []);
    await assert.rejects(() => romepay.read.paymentsOf([bob.account.address, 0n, 26n]), /LimitTooLarge|reverted/);
    await assert.rejects(() => romepay.read.getPayment([9n]), /PaymentNotFound|reverted/);
  });
});
