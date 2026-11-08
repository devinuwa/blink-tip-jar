import { ACTIONS_CORS_HEADERS, type ActionGetResponse } from "@solana/actions";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  clusterName,
  defaultCreator,
  parsePublicKey,
  rpcUrl,
  usdcMintAddress,
} from "@/lib/config";
import { buildTipTransaction, parseToken } from "@/lib/tip-tx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filled(value: string | null): string | null {
  if (!value || /^\{\w+\}$/.test(value)) return null;
  return value;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" ? filled(value) : null;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: ACTIONS_CORS_HEADERS });
}

function creatorFrom(request: Request): PublicKey {
  const url = new URL(request.url);
  const to = url.searchParams.get("to");
  if (to) return parsePublicKey(to, "Recipient");
  const fallback = defaultCreator();
  if (!fallback) throw new Error("CREATOR_WALLET is not configured");
  return parsePublicKey(fallback, "Creator wallet");
}

function actionBase(request: Request, creator: PublicKey): string {
  const url = new URL(request.url);
  return `${url.origin}/api/actions/tip?to=${creator.toBase58()}`;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: ACTIONS_CORS_HEADERS });
}

export async function GET(request: Request) {
  try {
    const creator = creatorFrom(request);
    const base = actionBase(request, creator);
    const short = `${creator.toBase58().slice(0, 4)}…${creator.toBase58().slice(-4)}`;
    const origin = new URL(request.url).origin;
    const body: ActionGetResponse = {
      type: "action",
      icon: `${origin}/icon.png`,
      title: "Blink Tip Jar",
      description: `Tip ${short} in SOL or USDC on Solana ${clusterName()}. Add a short note and it lands on their live tip feed.`,
      label: "Send tip",
      links: {
        actions: [
          { type: "transaction", label: "0.01 SOL", href: `${base}&amount=0.01&token=SOL` },
          { type: "transaction", label: "0.1 SOL", href: `${base}&amount=0.1&token=SOL` },
          { type: "transaction", label: "1 USDC", href: `${base}&amount=1&token=USDC` },
          { type: "transaction", label: "5 USDC", href: `${base}&amount=5&token=USDC` },
          {
            type: "transaction",
            label: "Custom SOL",
            href: `${base}&token=SOL&amount={amount}&message={message}`,
            parameters: [
              { type: "number", name: "amount", label: "Amount in SOL", required: true, min: 0 },
              { type: "text", name: "message", label: "Message (optional)", required: false },
            ],
          },
          {
            type: "transaction",
            label: "Custom USDC",
            href: `${base}&token=USDC&amount={amount}&message={message}`,
            parameters: [
              { type: "number", name: "amount", label: "Amount in USDC", required: true, min: 0 },
              { type: "text", name: "message", label: "Message (optional)", required: false },
            ],
          },
        ],
      },
    };
    return json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build this action";
    return json({ message }, 400);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { account?: unknown; data?: Record<string, unknown> };
    if (typeof payload.account !== "string" || payload.account.trim() === "") {
      return json({ message: "account is required" }, 400);
    }
    const payer = parsePublicKey(payload.account, "Account");
    const creator = creatorFrom(request);
    const url = new URL(request.url);
    const data = payload.data && typeof payload.data === "object" ? payload.data : {};
    const token = parseToken(url.searchParams.get("token") || stringField(data.token));
    const amount = filled(url.searchParams.get("amount")) || stringField(data.amount);
    if (!amount) return json({ message: "Amount is required" }, 400);

    const connection = new Connection(rpcUrl(), "confirmed");
    const built = await buildTipTransaction({
      connection,
      payer,
      creator,
      token,
      amountRaw: amount,
      message: filled(url.searchParams.get("message")) || stringField(data.message),
      usdcMint: new PublicKey(usdcMintAddress()),
    });
    const transaction = Buffer.from(
      built.transaction.serialize({ requireAllSignatures: false, verifySignatures: false }),
    ).toString("base64");
    return json({ type: "transaction", transaction, message: built.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build the tip transaction";
    return json({ message }, 400);
  }
}
