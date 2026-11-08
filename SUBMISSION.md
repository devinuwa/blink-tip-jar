# Blink Tip Jar

**Tagline:** Tip a creator in SOL or USDC from an X post, and watch it land on a live on-chain feed.

## Problem

Creators get attention in a social post and then lose the payment. A viewer has to leave X, copy a wallet address, open a wallet, pick a token, and hope they sent the right amount. Most people drop off before the tip exists.

## Solution

Blink Tip Jar is a Solana Action. The creator shares one link. X (via dial.to) renders amount buttons and an optional note. The server returns an unsigned transaction: a SOL transfer or a USDC `transferChecked`, plus a `tipjar:` memo. The home page reads the creator’s recent transactions from the cluster and shows who tipped, how much, and what they wrote. There is no database and no custody.

## Why Solana

A tip has to feel like a like. Solana’s sub-second finality means the feed can update while the post is still on screen. Fees are a fraction of a cent, so a 0.01 SOL or 1 USDC tip is not eaten by the network. Actions and Blinks make the payment social-native: the transaction starts from the post itself.

## Features

- Action API at `/api/actions/tip` with preset tips (0.01 SOL, 0.1 SOL, 1 USDC, 5 USDC), custom SOL and USDC amounts, and an optional 140-character message.
- SOL via `SystemProgram.transfer`. USDC via an idempotent associated-token-account create (payer pays) and `createTransferCheckedInstruction`.
- Memo instruction `tipjar:<message>` so the note is on-chain.
- `?to=<pubkey>` overrides the default creator after a public-key check.
- `public/actions.json` maps `/tip**` to `/api/actions/tip**`.
- Live feed at `GET /api/tips`, polling every 4 seconds, with shortened sender, token badge, relative time, and a Solscan link.
- Share on X opens a tweet intent whose link is the dial.to Blink.

## Tech stack

Next.js 14 App Router, TypeScript, Tailwind CSS, `@solana/actions`, `@solana/web3.js`, `@solana/spl-token`. Deployed on Vercel. Devnet by default. No database.

## How it works

1. Someone opens the Blink. dial.to calls `GET /api/actions/tip`.
2. They pick an amount. dial.to calls `POST` with their wallet address.
3. The route builds an unsigned transaction, sets the fee payer and a recent blockhash, and returns it as base64.
4. The wallet signs and submits.
5. The home page calls `getSignaturesForAddress` on the creator, parses the transfers and the `tipjar:` memo, and renders the row.

## How to test

1. Open the live demo and copy the Blink URL.
2. In Phantom or Solflare, switch to Devnet and fund the wallet from https://faucet.solana.com.
3. For USDC, hold Circle devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). The tip creates the creator’s token account if needed.
4. Open the dial.to link, choose 0.01 SOL or a custom amount with a message, and approve.
5. Return to the demo. Within a few seconds the row appears with the amount, the note, and a Solscan devnet link.
6. Optional local seed, after funding the payer in `.env`: `npm run test:tip`.

## Links

- Live demo: https://blink-tip-jar.vercel.app
- Blink: https://dial.to/?action=solana-action:https%3A%2F%2Fblink-tip-jar.vercel.app%2Fapi%2Factions%2Ftip%3Fto%3DFfr7zj2fw9h1LSMwUCSJBSmKhztHJprZ3Sw2GS5KNxS6&cluster=devnet
- Repo: https://github.com/devinuwa/blink-tip-jar

## What’s next

- Mainnet is already an environment-variable switch (`SOLANA_CLUSTER`, `NEXT_PUBLIC_RPC_URL`, `USDC_MINT`).
- Tip goals with a progress bar.
- Leaderboards of top tippers, still read from the chain.
- An SNS `.sol` name resolver so the jar can be shared as a name instead of a public key.
- An AI-written thank-you reply posted back to the thread after a tip confirms.
