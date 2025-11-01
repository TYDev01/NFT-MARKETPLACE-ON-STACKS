# Stacks NFT Marketplace

Full-stack marketplace for minting, listing, and purchasing NFTs on the Stacks blockchain. The project pairs a Clarity smart contract with a Next.js front-end that is pre-configured for Testnet usage with the Hiro wallet.

## Contract

- **Deployment target (Testnet)**: `ST2S0QHZC65P50HFAA2P7GD9CJBT48KDJ9DNYGDSK.marketplace`
- Language: Clarity v3
- Location: `contracts/marketplace.clar`

### Core capabilities

- Mint new NFTs to any recipient with optional metadata URIs and creator-defined royalty splits.
- List NFTs for sale, purchase with STX, and transfer ownership atomically.
- Automatic payout of creator royalties on every primary or secondary sale.
- Seller controls to update listing prices or cancel listings without delisting fees.

These last two items (royalties and advanced listing management) are the additional marketplace features implemented beyond the base mint/list/buy requirements.

### Data structures

- `marketplace-nft`: SIP-009 style token keyed by incremental `uint` IDs.
- `token-metadata`: stores optional metadata URI, creator principal, and royalty basis points.
- `listings`: keeps active listings with seller principal and price (in micro-STX).
- `last-token-id`: counter for mint sequencing.

### Public entrypoints

| Function | Purpose |
| --- | --- |
| `mint(recipient, metadata-uri?, royalty-bps)` | Mint a new NFT and configure royalty share (0-10000 bps). |
| `list-token(token-id, price)` | List an NFT owned by the caller for sale. |
| `update-listing(token-id, new-price)` | Adjust the sale price without cancelling the listing. |
| `cancel-listing(token-id)` | Remove an active listing. |
| `purchase(token-id)` | Purchase a listed NFT; handles STX transfers, royalties, and ownership updates. |

Read-only helpers expose current owners, metadata, listings, and the last minted token ID.

## Front-end

- Framework: Next.js 14 (App Router, TypeScript).
- Location: `frontend/`
- Wallet integration: `@stacks/connect-react` with a `StacksTestnet` network instance pointing to `https://api.testnet.hiro.so` by default.
- Key screens:
  - Wallet connect card (with disconnect flow).
  - Mint form with royalty configuration.
  - Marketplace inventory grid showing ownership, metadata, royalties, and listing state.
  - Inline actions to list, update price, cancel, or purchase NFTs depending on the connected wallet.

The UI queries the smart contract through read-only calls (`get-last-token-id`, `get-token-metadata`, `get-owner`, `get-listing`) and generates contract-call transactions for all marketplace actions. Purchase flows attach STX post-conditions so the wallet clearly surfaces outgoing funds.

## Getting started

### Prerequisites

- [Clarinet](https://docs.hiro.so/clarinet) (v1.0 or later)
- Node.js 18+
- Hiro Wallet (desktop or browser extension) configured for Stacks Testnet

### Smart contract workflow

```bash
# Lint and type-check the Clarity contract
clarinet check

# Run unit tests (installs deps the first time)
npm install
npm test
```

### Deploying to Stacks Testnet

1. Add the 24-word mnemonic for your deployer account to `settings/Testnet.toml` under `[accounts.deployer]`.
2. If you redeploy under a different principal, update the contract address in:
   - `deployments/default.testnet-plan.yaml`
   - `frontend/.env.local` (`NEXT_PUBLIC_CONTRACT_ADDRESS`)
   - `frontend/lib/constants.ts` (fallback value if the env var is missing)
   - This `README.md` file (contract address bullet above)
3. Fund the deployer with testnet STX via the [Stacks faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet) if needed.
4. Publish the contract to testnet:

   ```bash
   clarinet deployments apply -p deployments/default.testnet-plan.yaml
   ```

5. Note the contract identifier returned by Clarinet and update the address in your `.env` file and README.

> If you still need a local sandbox, `clarinet integrate` continues to spin up a Devnet instance for rapid testing.

### Next.js UI (Stacks Testnet)

Create `frontend/.env.local` (if it does not exist) with your deployment details:

```bash
NEXT_PUBLIC_STACKS_API="https://api.testnet.hiro.so"
NEXT_PUBLIC_CONTRACT_ADDRESS="ST...your-testnet-address..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Then run the web client:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000> and connect your Hiro wallet to the Stacks Testnet.

### Using the marketplace

1. **Mint** – Provide a metadata URI (e.g., IPFS link) and optional royalty percentage. The contract stores royalties in basis points (1% = 100 bps).
2. **List** – Owners can list NFTs with custom prices expressed in STX (automatically converted to micro-STX on-chain).
3. **Maintain listings** – Sellers can update prices or cancel a listing without fees. These capabilities serve as advanced listing management functionality.
4. **Purchase** – Buyers confirm an STX transfer enforced by post-conditions; royalties are routed to the creator, and ownership is transferred atomically.

### Configuration

- `frontend/.env.local` controls runtime configuration:

  ```bash
  NEXT_PUBLIC_STACKS_API="https://api.testnet.hiro.so"
  NEXT_PUBLIC_CONTRACT_ADDRESS="ST2S0QHZC65P50HFAA2P7GD9CJBT48KDJ9DNYGDSK.marketplace"
  NEXT_PUBLIC_APP_URL="http://localhost:3000"
  ```

- Adjust royalties and listing behaviour by editing `contracts/marketplace.clar`.

## Repository structure

```
contracts/             Clarity smart contracts
tests/                 Vitest + Clarinet integration tests
frontend/              Next.js app (UI + wallet integration)
Clarinet.toml          Clarinet project configuration
settings/              Network configuration presets (Devnet, Testnet, Mainnet)
```

## Testing notes

- The contract-level tests in `tests/marketplace.test.ts` cover minting, access control, listing management, and purchase flows.
- The repository’s root `package.json` is retained for running Clarinet/Vitest tests; the frontend has its own `package.json` inside `frontend/`.

## Roadmap ideas

- Add marketplace analytics (volume, floor price) to the UI.
- Extend royalties to support multiple beneficiary splits.
- Introduce off-chain metadata caching for faster gallery rendering.

---
# NFT-MARKETPLACE-ON-STACKS
