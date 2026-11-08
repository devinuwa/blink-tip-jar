import { Connection, PublicKey } from "@solana/web3.js";
import { defaultCreator, parsePublicKey, rpcUrl, usdcMintAddress } from "@/lib/config";
import { fetchRecentTips, type TipRecord } from "@/lib/parse-tips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = new Map<string, { at: number; tips: TipRecord[] }>();
const CACHE_MS = 2500;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requested = url.searchParams.get("to");
    const creatorRaw = requested || defaultCreator();
    if (!creatorRaw) {
      return Response.json({ tips: [], message: "CREATOR_WALLET is not configured" }, { status: 200 });
    }
    const creator = requested ? parsePublicKey(requested, "Recipient") : parsePublicKey(creatorRaw, "Creator wallet");
    const key = creator.toBase58();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return Response.json({ tips: hit.tips, creator: key });
    }
    const connection = new Connection(rpcUrl(), "confirmed");
    const tips = await fetchRecentTips(connection, creator, usdcMintAddress());
    cache.set(key, { at: Date.now(), tips });
    return Response.json({ tips, creator: key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RPC request failed";
    return Response.json({ tips: [], message }, { status: 200 });
  }
}
