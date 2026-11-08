import { PublicKey } from "@solana/web3.js";
import { TipJar } from "@/components/tip-jar";
import { clusterName, defaultCreator, usdcMintAddress } from "@/lib/config";

export const dynamic = "force-dynamic";

type Search = { to?: string | string[] };

export default function HomePage({ searchParams }: { searchParams?: Search }) {
  const requested = Array.isArray(searchParams?.to) ? searchParams?.to[0] : searchParams?.to;
  const fallback = defaultCreator();
  let creator = fallback;
  let warning = "";

  if (requested) {
    try {
      creator = new PublicKey(requested).toBase58();
    } catch {
      warning = "That ?to= value is not a valid public key, so the default creator is shown.";
    }
  }

  if (!creator) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        <h1 className="font-display text-4xl">Set a creator wallet</h1>
        <p className="mt-4 text-mute">
          Add CREATOR_WALLET to .env, then restart. The public key is the jar. A payer key is only needed for
          scripts/test-tip.ts and stays out of git.
        </p>
      </main>
    );
  }

  return <TipJar creator={creator} cluster={clusterName()} usdcMint={usdcMintAddress()} warning={warning} />;
}
