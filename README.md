# Blink Tip Jar

Tip a creator in SOL or USDC from an X post. The Blink returns an unsigned Solana transaction. The home page shows a live feed read from the chain. There is no database.

## Setup

```bash
npm install
cp .env.example .env
```

Put a Solana public key in `CREATOR_WALLET`. Generate an icon if you change the artwork:

```bash
npm run icon
npm run dev
```

The action is `GET/POST /api/actions/tip`. `public/actions.json` maps `/tip**` to that route, so `https://<host>/tip?to=<pubkey>` is a valid action URL.

## Environment

| Name | Purpose |
| --- | --- |
| `SOLANA_CLUSTER` | `devnet` (default), `testnet`, or `mainnet-beta` |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | Same value, shown in the UI and used for dial.to / Solscan |
| `NEXT_PUBLIC_RPC_URL` | RPC endpoint. Defaults to the public cluster RPC |
| `CREATOR_WALLET` | Default recipient. `?to=<pubkey>` overrides it when the value is a valid public key |
| `USDC_MINT` | SPL mint used for USDC tips. Optional. See assumptions |
| `TIP_PAYER_SECRET` | Local only. JSON array of 64 secret key bytes for `npm run test:tip`. Never commit `.env` |

### Mainnet switch

```bash
SOLANA_CLUSTER=mainnet-beta
NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

Use a funded mainnet wallet. Do not run `npm run test:tip` against mainnet. The script refuses any cluster other than devnet.

## Send a devnet tip

The script requests a devnet airdrop when the payer balance is under 0.05 SOL. As of this build, `https://api.devnet.solana.com` answers that request with `410` and tells you to use https://faucet.solana.com, which requires a Cloudflare check a script cannot pass. Fund the payer printed by the script (this demo’s payer is `8RYDds5uywHwBNdr1g7ADTDAPHaijkm2ShFLUqd56Fhn`), then run:

```bash
npm run test:tip
```

That sends 0.01 SOL to `CREATOR_WALLET` with the memo `tipjar:demo tip from blink tip jar`.

## Assumptions

- The brief’s mint `6qkijfVTYE7AzweBStGT9PPbEf4H3PpxJfxbGYdPW1Sr` is not an SPL mint. On mainnet it is a system-owned wallet with zero data. On devnet the account does not exist. USDC tips therefore use Circle devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (6 decimals, Token program). Mainnet uses Circle USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. Both are overridable with `USDC_MINT`.
- `<CREATOR_WALLET>` was an unsubstituted placeholder. This repo generates a fresh devnet recipient and stores only the public key in `.env`. The payer secret stays in `.env`, which is gitignored.
- The memo program requires every listed account to be a signer, so the memo instruction only includes the payer. USDC tips still include the creator because the idempotent ATA instruction lists them as owner. `getSignaturesForAddress(creator)` can see both SOL and USDC tips.
- Amounts are converted with integer decimal strings, not binary floating point. SOL uses 9 decimals. USDC decimals are read from the mint account.
- The feed requests `maxSupportedTransactionVersion: 1` and, if a batch fails, fetches signatures one by one. `@solana/web3.js` 1.98 throws on version-1 transactions even when that flag is set, so this project uses 1.99 or newer.
- The public devnet RPC is rate-limited. `/api/tips` caches a creator’s parsed tips for 2.5 seconds. A dedicated RPC is a one-line env change.
- No private keys, API keys, or payer secrets are committed.

## Scripts

- `npm run dev` — local app
- `npm run build` — production build
- `npm run lint` — Next.js lint
- `npm run test:tip` — sign and send a 0.01 SOL devnet tip
- `npm run icon` — regenerate `public/icon.png`
