import { expect, test, type Page } from "@playwright/test";

const mockEvmAccount = "0x1111111111111111111111111111111111111111";
// The public key of the System Program: a valid 32-byte Solana address.
const solanaAddress = "11111111111111111111111111111111";

async function installMockMetaMask(page: Page) {
  await page.addInitScript((account) => {
    Object.defineProperty(window, "ethereum", {
      value: {
        isMetaMask: true,
        async request({ method }: { method: string }) {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
          if (method === "eth_chainId") return "0x30d4a";
          if (
            method === "wallet_switchEthereumChain" ||
            method === "wallet_requestPermissions" ||
            method === "wallet_revokePermissions"
          ) {
            return null;
          }
          throw new Error(`Unsupported mock method ${method}`);
        },
        on() {},
        removeListener() {},
      },
    });
  }, mockEvmAccount);
}

test("home explains the product and shows recent payments", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Send USDC.");
  await expect(page.getByTestId("network-health")).toContainText("Preview");
  await expect(page.locator(".payment-list .payment-row")).toHaveCount(3);
  await expect(page.getByText("gm from Solana")).toBeVisible();
});

test("the send form resolves EVM and Solana recipients", async ({ page }) => {
  await page.goto("/");
  const recipient = page.getByPlaceholder("0x… or a Solana address");
  await recipient.fill(solanaAddress);
  await expect(page.getByTestId("resolved-recipient")).toContainText("Solana wallet · pays Rome address 0x");
  await recipient.fill(mockEvmAccount);
  await expect(page.getByTestId("resolved-recipient")).toContainText("EVM address");
  await recipient.fill("not-an-address");
  await expect(page.getByTestId("resolved-recipient")).toContainText("Not a valid");
});

test("sending validates input and stays read-only in preview", async ({ page }) => {
  await installMockMetaMask(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await expect(page.getByRole("button", { name: `Use MetaMask address ${mockEvmAccount}` })).toBeVisible();

  const send = page.locator("#send");
  await send.getByPlaceholder("0x… or a Solana address").fill(solanaAddress);
  await send.getByPlaceholder("10.00").fill("1.1234567");
  await send.getByRole("button", { name: "Send USDC" }).click();
  await expect(send.locator(".form-error")).toContainText("6 decimals");

  await send.getByPlaceholder("10.00").fill("2.5");
  await send.getByRole("button", { name: "Send USDC" }).click();
  await expect(send.locator(".form-error")).toContainText(/read-only/);
});

test("a payment request page shows the QR code and pay button", async ({ page }) => {
  await page.goto("/pay/2");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("42");
  await expect(page.getByText("Waiting for payment")).toBeVisible();
  await expect(page.getByRole("img", { name: /Payment QR code for request 2/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect a wallet to pay" })).toBeVisible();
});

test("paid and unknown requests render their states", async ({ page }) => {
  await page.goto("/pay/1");
  await expect(page.getByText("Paid in payment #4.")).toBeVisible();
  await page.goto("/pay/99");
  await expect(page.getByRole("heading", { name: "Request not found." })).toBeVisible();
  await page.goto("/pay/abc");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("activity pages accept EVM and Solana addresses", async ({ page }) => {
  await page.goto("/activity/0x7f2D39e2a45D7484aA65f6B63F1f94E2a851D5Af");
  await expect(page.locator(".payment-row")).toHaveCount(3);
  await expect(page.getByText("+120 USDC")).toBeVisible();
  await page.goto(`/activity/${solanaAddress}`);
  await expect(page.getByText("Solana wallet activity")).toBeVisible();
  await page.goto("/activity/nope");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("a connected MetaMask wallet can be disconnected", async ({ page }) => {
  await installMockMetaMask(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await page.getByRole("button", { name: "Disconnect MetaMask" }).click();
  await expect(page.getByRole("button", { name: "Connect MetaMask" })).toBeVisible();
});

test("responses carry security headers", async ({ request }) => {
  const headers = (await request.get("/")).headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
