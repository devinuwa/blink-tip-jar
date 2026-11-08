import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { MEMO_PROGRAM_ID, sanitizeMessage, toBaseUnits } from "./config";

const MEMO = new PublicKey(MEMO_PROGRAM_ID);

export type TipToken = "SOL" | "USDC";

export type BuiltTip = {
  transaction: Transaction;
  blockhash: string;
  lastValidBlockHeight: number;
  message: string;
};

type MintInfo = { decimals: number; programId: PublicKey };

const mintCache = new Map<string, MintInfo>();

export async function readMint(connection: Connection, mint: PublicKey): Promise<MintInfo> {
  const key = mint.toBase58();
  const cached = mintCache.get(key);
  if (cached) return cached;
  const info = await connection.getAccountInfo(mint, "confirmed");
  if (!info || info.data.length < 82) {
    throw new Error("USDC mint was not found on this cluster. Set USDC_MINT to a real SPL mint.");
  }
  const system = "11111111111111111111111111111111";
  if (info.owner.toBase58() === system) {
    throw new Error("USDC_MINT points at a wallet, not a token mint.");
  }
  const decimals = info.data[44] ?? 0;
  if (decimals < 0 || decimals > 18) throw new Error("USDC mint decimals look invalid.");
  const parsed: MintInfo = { decimals, programId: info.owner };
  mintCache.set(key, parsed);
  return parsed;
}

export function parseToken(value: string | null): TipToken {
  const token = (value || "").trim().toUpperCase();
  if (token === "SOL" || token === "USDC") return token;
  throw new Error("Token must be SOL or USDC");
}

export async function buildTipTransaction(input: {
  connection: Connection;
  payer: PublicKey;
  creator: PublicKey;
  token: TipToken;
  amountRaw: string;
  message?: string | null;
  usdcMint: PublicKey;
}): Promise<BuiltTip> {
  const note = sanitizeMessage(input.message);
  const memoText = `tipjar:${note}`;
  const { blockhash, lastValidBlockHeight } = await input.connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: input.payer, recentBlockhash: blockhash });

  if (input.token === "SOL") {
    const lamports = toBaseUnits(input.amountRaw, 9);
    tx.add(
      SystemProgram.transfer({
        fromPubkey: input.payer,
        toPubkey: input.creator,
        lamports: Number(lamports),
      }),
    );
  } else {
    const mintInfo = await readMint(input.connection, input.usdcMint);
    const units = toBaseUnits(input.amountRaw, mintInfo.decimals);
    const source = getAssociatedTokenAddressSync(
      input.usdcMint,
      input.payer,
      false,
      mintInfo.programId,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const destination = getAssociatedTokenAddressSync(
      input.usdcMint,
      input.creator,
      true,
      mintInfo.programId,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        input.payer,
        destination,
        input.creator,
        input.usdcMint,
        mintInfo.programId,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
    tx.add(
      createTransferCheckedInstruction(
        source,
        input.usdcMint,
        destination,
        input.payer,
        units,
        mintInfo.decimals,
        [],
        mintInfo.programId,
      ),
    );
  }

  // Memo program rejects non-signer accounts, so only the payer is attached.
  // The creator is already a transaction account via the transfer or ATA create.
  tx.add(
    new TransactionInstruction({
      programId: MEMO,
      keys: [{ pubkey: input.payer, isSigner: true, isWritable: true }],
      data: Buffer.from(memoText, "utf8"),
    }),
  );

  const prettyAmount = input.amountRaw.trim();
  const message = note
    ? `Tip ${prettyAmount} ${input.token} — ${note}`
    : `Tip ${prettyAmount} ${input.token}`;

  return { transaction: tx, blockhash, lastValidBlockHeight, message };
}
