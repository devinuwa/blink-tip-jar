import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { clusterName, parsePublicKey, rpcUrl } from "../lib/config";
import { buildTipTransaction } from "../lib/tip-tx";

function loadEnv(file = ".env") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    if (!process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function upsertEnv(key: string, value: string) {
  const file = ".env";
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, "m").test(current)) {
    writeFileSync(file, current.replace(new RegExp(`^${key}=.*$`, "m"), line));
  } else {
    writeFileSync(file, `${current.trim()}\n${line}\n`);
  }
}

async function airdrop(connection: Connection, payer: PublicKey) {
  const balance = await connection.getBalance(payer, "confirmed");
  if (balance >= 50_000_000) {
    console.log(`payer balance ${(balance / 1e9).toFixed(4)} SOL`);
    return;
  }
  console.log(`requesting 1 SOL devnet airdrop for ${payer.toBase58()}…`);
  let sig: string;
  try {
    sig = await connection.requestAirdrop(payer, 1_000_000_000);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${detail}\nThe public RPC faucet is closed. Send devnet SOL to ${payer.toBase58()} from https://faucet.solana.com and run npm run test:tip again.`,
    );
  }
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  console.log("airdrop", sig);
}

async function main() {
  loadEnv();
  if (clusterName() !== "devnet") {
    throw new Error("Refusing to send a test tip unless SOLANA_CLUSTER is devnet.");
  }
  const creatorRaw = process.env.CREATOR_WALLET || "";
  if (!creatorRaw) throw new Error("CREATOR_WALLET is missing from .env");
  const creator = parsePublicKey(creatorRaw, "Creator wallet");

  let payer: Keypair;
  if (process.env.TIP_PAYER_SECRET) {
    payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.TIP_PAYER_SECRET)));
  } else {
    payer = Keypair.generate();
    upsertEnv("TIP_PAYER_SECRET", JSON.stringify(Array.from(payer.secretKey)));
    console.log("generated payer", payer.publicKey.toBase58());
  }

  const connection = new Connection(rpcUrl(), "confirmed");
  await airdrop(connection, payer.publicKey);
  const built = await buildTipTransaction({
    connection,
    payer: payer.publicKey,
    creator,
    token: "SOL",
    amountRaw: "0.01",
    message: "demo tip from blink tip jar",
    usdcMint: new PublicKey(process.env.USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  });
  built.transaction.sign(payer);
  const signature = await connection.sendRawTransaction(built.transaction.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(
    { signature, blockhash: built.blockhash, lastValidBlockHeight: built.lastValidBlockHeight },
    "confirmed",
  );
  console.log("tipped 0.01 SOL");
  console.log(signature);
  console.log(`https://solscan.io/tx/${signature}?cluster=devnet`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
