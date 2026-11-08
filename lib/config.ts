import { PublicKey } from "@solana/web3.js";

/**
 * The brief named 6qkijfVTYE7AzweBStGT9PPbEf4H3PpxJfxbGYdPW1Sr as the USDC mint.
 * On mainnet that address is a system-owned wallet (0 bytes). On devnet it does
 * not exist, so it cannot be a mint. Circle's devnet USDC is the working default.
 * Mainnet switch uses Circle's canonical USDC. Override either with USDC_MINT.
 */
export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export function clusterName(): string {
  return process.env.SOLANA_CLUSTER || process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
}

export function rpcUrl(): string {
  if (process.env.NEXT_PUBLIC_RPC_URL) return process.env.NEXT_PUBLIC_RPC_URL;
  if (process.env.RPC_URL) return process.env.RPC_URL;
  const cluster = clusterName();
  if (cluster === "mainnet" || cluster === "mainnet-beta") return "https://api.mainnet-beta.solana.com";
  if (cluster === "testnet") return "https://api.testnet.solana.com";
  return "https://api.devnet.solana.com";
}

export function usdcMintAddress(): string {
  if (process.env.USDC_MINT) return process.env.USDC_MINT;
  const cluster = clusterName();
  if (cluster === "mainnet" || cluster === "mainnet-beta") return MAINNET_USDC_MINT;
  return DEVNET_USDC_MINT;
}

export function defaultCreator(): string {
  return process.env.CREATOR_WALLET || process.env.NEXT_PUBLIC_CREATOR_WALLET || "";
}

export function dialCluster(cluster = clusterName()): string {
  if (cluster === "mainnet" || cluster === "mainnet-beta") return "mainnet";
  if (cluster === "testnet") return "testnet";
  return "devnet";
}

export function solscanCluster(cluster = clusterName()): string | null {
  if (cluster === "mainnet" || cluster === "mainnet-beta") return null;
  if (cluster === "testnet") return "testnet";
  return "devnet";
}

export function parsePublicKey(value: string, label = "Address"): PublicKey {
  const trimmed = value.trim();
  try {
    return new PublicKey(trimmed);
  } catch {
    throw new Error(`${label} is not a valid Solana public key`);
  }
}

export function sanitizeMessage(input: string | null | undefined): string {
  if (!input) return "";
  const cleaned = input.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, 140).join("");
}

export function toBaseUnits(amountRaw: string, decimals: number): bigint {
  const trimmed = amountRaw.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be a positive number");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places`);
  }
  const digits = `${whole}${(frac + "0".repeat(decimals)).slice(0, decimals)}`.replace(/^0+/, "") || "0";
  const value = BigInt(digits);
  if (value <= 0n) throw new Error("Amount must be greater than 0");
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large");
  return value;
}
