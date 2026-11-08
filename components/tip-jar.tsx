"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dialCluster, solscanCluster } from "@/lib/config";

type Tip = {
  signature: string;
  sender: string;
  amount: number;
  token: "SOL" | "USDC";
  message: string | null;
  timestamp: number | null;
};

type Props = {
  creator: string;
  cluster: string;
  usdcMint: string;
  warning?: string;
};

function shortKey(value: string) {
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function ago(timestamp: number | null, now: number) {
  if (!timestamp) return "just now";
  const seconds = Math.max(0, Math.floor(now / 1000 - timestamp));
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

function withCluster(base: string, cluster: string) {
  const name = solscanCluster(cluster);
  return name ? `${base}?cluster=${name}` : base;
}

export function TipJar({ creator, cluster, usdcMint, warning }: Props) {
  const [origin, setOrigin] = useState("");
  const [tips, setTips] = useState<Tip[]>([]);
  const [feedNote, setFeedNote] = useState("");
  const [copied, setCopied] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const response = await fetch(`/api/tips?to=${creator}`, { cache: "no-store" });
        const body = (await response.json()) as { tips?: Tip[]; message?: string };
        if (stop) return;
        const next = body.tips ?? [];
        if (!primed.current) {
          next.forEach((tip) => seen.current.add(tip.signature));
          primed.current = true;
          setFresh(new Set());
        } else {
          const arrived = new Set<string>();
          next.forEach((tip) => {
            if (!seen.current.has(tip.signature)) arrived.add(tip.signature);
            seen.current.add(tip.signature);
          });
          setFresh(arrived);
        }
        setTips(next);
        setFeedNote(body.message || "");
      } catch {
        if (!stop) setFeedNote("The tip feed could not reach the RPC. Retrying.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [creator]);

  const actionUrl = origin ? `${origin}/api/actions/tip?to=${creator}` : "";
  const prettyUrl = origin ? `${origin}/tip?to=${creator}` : "";
  const blinkUrl = actionUrl
    ? `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}&cluster=${dialCluster(cluster)}`
    : "";

  const totals = useMemo(() => {
    return tips.reduce(
      (sum, tip) => {
        sum[tip.token] += tip.amount;
        return sum;
      },
      { SOL: 0, USDC: 0 },
    );
  }, [tips]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  function share() {
    const text = `Tip me in SOL or USDC straight from this post.\n${blinkUrl}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm uppercase tracking-[0.22em] text-coin">Blink Tip Jar</p>
        <p className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-sm text-mute">
          <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
          {cluster} · live
        </p>
      </header>

      <section className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="font-display text-5xl leading-none text-cream sm:text-6xl">
            Drop a tip
            <span className="block text-coin">from the timeline.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-mute">
            A Solana Action anyone can use from an X post. SOL or USDC, an optional note, and a feed that reads the
            chain. No account, no database.
          </p>

          {warning ? (
            <p className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
              {warning}
            </p>
          ) : null}

          <div className="mt-8 space-y-3">
            <Field label="Creator wallet" value={creator} href={withCluster(`https://solscan.io/account/${creator}`, cluster)} />
            <Field
              label="Blink URL"
              value={blinkUrl || "Preparing link…"}
              onCopy={blinkUrl ? () => copy(blinkUrl, "blink") : undefined}
              copied={copied === "blink"}
            />
            <Field
              label="Action URL"
              value={actionUrl || "Preparing link…"}
              onCopy={actionUrl ? () => copy(actionUrl, "action") : undefined}
              copied={copied === "action"}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={share}
              disabled={!blinkUrl}
              className="rounded-full bg-coin px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Share on X
            </button>
            <a
              href={blinkUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className={`rounded-full border border-line px-5 py-2.5 text-sm ${blinkUrl ? "" : "pointer-events-none opacity-50"}`}
            >
              Open in dial.to
            </a>
          </div>

          <dl className="mt-8 grid grid-cols-3 gap-3">
            <Stat label="SOL in view" value={formatAmount(totals.SOL)} />
            <Stat label="USDC in view" value={formatAmount(totals.USDC)} />
            <Stat label="Tips shown" value={String(tips.length)} />
          </dl>
        </div>

        <section className="rounded-3xl border border-line bg-panel/80 p-4 shadow-coin sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl">Live tips</h2>
            <span className="text-xs uppercase tracking-widest text-mute">every 4s</span>
          </div>
          {feedNote ? <p className="mb-3 text-sm text-amber-200">{feedNote}</p> : null}
          {tips.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-mute">
              No incoming tips yet. Send 0.01 SOL from the Blink and it will show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {tips.map((tip) => (
                <li
                  key={`${tip.signature}-${tip.token}`}
                  className={`rounded-2xl border border-line/80 px-3 py-3 ${fresh.has(tip.signature) ? "tip-new" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {shortKey(tip.sender)}{" "}
                        <span className="text-mute">tipped</span> {formatAmount(tip.amount)}
                      </p>
                      {tip.message ? <p className="mt-1 text-sm text-cream/90">“{tip.message}”</p> : null}
                      <p className="mt-1 text-xs text-mute">{ago(tip.timestamp, now)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          tip.token === "SOL" ? "bg-coin text-ink" : "bg-usdc text-white"
                        }`}
                      >
                        {tip.token}
                      </span>
                      <a
                        className="text-xs text-coin underline-offset-2 hover:underline"
                        href={withCluster(`https://solscan.io/tx/${tip.signature}`, cluster)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Solscan
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section className="mt-12 rounded-3xl border border-line bg-black/20 p-6">
        <h2 className="font-display text-3xl">Try it</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-mute">
          <li>Install Phantom or Solflare and switch the network to Devnet.</li>
          <li>Request devnet SOL from the Solana faucet so the wallet can pay the fee.</li>
          <li>
            USDC tips use mint <span className="break-all text-cream">{usdcMint}</span> (6 decimals). The payer needs a
            balance of that mint. The jar creates the creator token account if it is missing.
          </li>
          <li>
            Open the dial.to link. Pick 0.01 SOL, 0.1 SOL, 1 USDC, 5 USDC, or a custom amount. Custom buttons take an
            optional message, stored on-chain as a <span className="text-cream">tipjar:</span> memo.
          </li>
          <li>Approve the unsigned transaction in your wallet. This page polls the creator account and animates the new row.</li>
        </ol>
        {prettyUrl ? (
          <p className="mt-4 text-sm text-mute">
            Pretty action path via actions.json: <span className="break-all text-cream">{prettyUrl}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  href,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  href?: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-black/25 p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-widest text-mute">{label}</p>
        {onCopy ? (
          <button type="button" onClick={onCopy} className="text-xs text-coin">
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="block break-all text-sm text-cream hover:text-coin">
          {value}
        </a>
      ) : (
        <p className="break-all text-sm text-cream">{value}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-black/25 px-3 py-3">
      <dt className="text-xs uppercase tracking-widest text-mute">{label}</dt>
      <dd className="mt-1 font-display text-2xl text-cream">{value}</dd>
    </div>
  );
}
