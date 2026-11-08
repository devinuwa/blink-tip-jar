import { Connection, PublicKey } from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "./config";

export type TipRecord = {
  signature: string;
  sender: string;
  amount: number;
  token: "SOL" | "USDC";
  message: string | null;
  timestamp: number | null;
};

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" ? (value as AnyRecord) : null;
}

function keyString(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (!record) return "";
  const pubkey = record.pubkey ?? record;
  if (typeof pubkey === "string") return pubkey;
  if (pubkey && typeof (pubkey as { toBase58?: () => string }).toBase58 === "function") {
    return (pubkey as { toBase58: () => string }).toBase58();
  }
  return "";
}

function instructionsOf(tx: AnyRecord): AnyRecord[] {
  const message = asRecord(asRecord(tx.transaction)?.message);
  const top = Array.isArray(message?.instructions) ? (message.instructions as unknown[]) : [];
  const meta = asRecord(tx.meta);
  const inner = Array.isArray(meta?.innerInstructions) ? (meta.innerInstructions as unknown[]) : [];
  const nested = inner.flatMap((group) => {
    const record = asRecord(group);
    return Array.isArray(record?.instructions) ? (record.instructions as unknown[]) : [];
  });
  return [...top, ...nested].map((item) => asRecord(item)).filter((item): item is AnyRecord => !!item);
}

function memoText(ix: AnyRecord): string | null {
  const program = typeof ix.program === "string" ? ix.program : "";
  const programId = keyString(ix.programId);
  if (program !== "spl-memo" && programId !== MEMO_PROGRAM_ID) return null;
  if (typeof ix.parsed === "string") return ix.parsed;
  const parsed = asRecord(ix.parsed);
  if (typeof parsed?.info === "string") return parsed.info;
  return null;
}

function signerOf(tx: AnyRecord): string {
  const message = asRecord(asRecord(tx.transaction)?.message);
  const keys = Array.isArray(message?.accountKeys) ? (message.accountKeys as unknown[]) : [];
  for (const key of keys) {
    const record = asRecord(key);
    if (record?.signer === true) return keyString(record);
    if (typeof key === "string") return key;
  }
  return "";
}

type TokenBalance = {
  mint: string;
  owner: string;
  uiAmount: number;
};

function tokenBalances(value: unknown): TokenBalance[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    const amount = asRecord(record?.uiTokenAmount);
    const ui = typeof amount?.uiAmount === "number" ? amount.uiAmount : Number(amount?.uiAmountString ?? 0);
    const mint = typeof record?.mint === "string" ? record.mint : "";
    const owner = typeof record?.owner === "string" ? record.owner : "";
    if (!mint || !owner || !Number.isFinite(ui)) return [];
    return [{ mint, owner, uiAmount: ui }];
  });
}

function balanceOf(list: TokenBalance[], owner: string, mint: string): number {
  return list.filter((item) => item.owner === owner && item.mint === mint).reduce((sum, item) => sum + item.uiAmount, 0);
}

export function parseTipTransaction(
  tx: unknown,
  signature: string,
  creator: string,
  usdcMint: string,
): TipRecord[] {
  const record = asRecord(tx);
  if (!record) return [];
  const meta = asRecord(record.meta);
  if (!meta || meta.err) return [];

  let message: string | null = null;
  for (const ix of instructionsOf(record)) {
    const text = memoText(ix);
    if (text && text.startsWith("tipjar:")) {
      const note = text.slice("tipjar:".length).trim();
      message = note.length > 0 ? note : null;
    }
  }

  const tips: TipRecord[] = [];
  const timestamp = typeof record.blockTime === "number" ? record.blockTime : null;
  const fallbackSender = signerOf(record);

  for (const ix of instructionsOf(record)) {
    if (ix.program !== "system") continue;
    const parsed = asRecord(ix.parsed);
    if (parsed?.type !== "transfer") continue;
    const info = asRecord(parsed.info);
    if (!info || keyString(info.destination) !== creator) continue;
    const lamports = Number(info.lamports ?? 0);
    if (!Number.isFinite(lamports) || lamports <= 0) continue;
    const sender = keyString(info.source) || fallbackSender;
    if (!sender || sender === creator) continue;
    tips.push({
      signature,
      sender,
      amount: lamports / 1_000_000_000,
      token: "SOL",
      message,
      timestamp,
    });
  }

  const pre = tokenBalances(meta.preTokenBalances);
  const post = tokenBalances(meta.postTokenBalances);
  const received = balanceOf(post, creator, usdcMint) - balanceOf(pre, creator, usdcMint);
  if (received > 0.0000001) {
    let sender = fallbackSender;
    for (const ix of instructionsOf(record)) {
      if (ix.program !== "spl-token") continue;
      const parsed = asRecord(ix.parsed);
      const type = parsed?.type;
      if (type !== "transfer" && type !== "transferChecked") continue;
      const info = asRecord(parsed?.info);
      if (!info) continue;
      const mint = keyString(info.mint);
      if (mint && mint !== usdcMint) continue;
      const authority = keyString(info.authority) || keyString(info.multisigAuthority);
      if (authority) sender = authority;
    }
    if (sender && sender !== creator) {
      tips.push({
        signature,
        sender,
        amount: received,
        token: "USDC",
        message,
        timestamp,
      });
    }
  }

  return tips;
}

export async function fetchRecentTips(
  connection: Connection,
  creator: PublicKey,
  usdcMint: string,
): Promise<TipRecord[]> {
  const signatures = await connection.getSignaturesForAddress(creator, { limit: 20 }, "confirmed");
  const ids = signatures.map((item) => item.signature);
  if (ids.length === 0) return [];

  const config = { maxSupportedTransactionVersion: 1 as const, commitment: "confirmed" as const };
  let parsed: unknown[] = [];
  try {
    parsed = await connection.getParsedTransactions(ids, config);
  } catch {
    parsed = [];
    for (const id of ids) {
      try {
        parsed.push(await connection.getParsedTransaction(id, config));
      } catch {
        parsed.push(null);
      }
    }
  }

  const creatorKey = creator.toBase58();
  const tips = parsed.flatMap((tx, index) => parseTipTransaction(tx, ids[index] || "", creatorKey, usdcMint));
  const seen = new Set<string>();
  return tips.filter((tip) => {
    const key = `${tip.signature}:${tip.token}:${tip.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
