"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnect } from "@stacks/connect-react";
import {
  FungibleConditionCode,
  PostConditionMode,
  createSTXPostCondition,
  standardPrincipalCV,
  someCV,
  noneCV,
  stringAsciiCV,
  uintCV
} from "@stacks/transactions";
import { useWallet } from "@/components/WalletProvider";
import {
  CONTRACT_ADDRESS,
  CONTRACT_NAME,
  TESTNET_HINT,
  NETWORK_LABEL,
  ROYALTY_DENOMINATOR
} from "@/lib/constants";
import { fetchMarketplaceState, ListingView } from "@/lib/marketplace";

const MICROSTX = 1_000_000n;

export default function MarketplacePage() {
  const { userSession, network, isSignedIn, loadUserData } = useWallet();
  const { doOpenAuth, doContractCall } = useConnect();

  const [items, setItems] = useState<ListingView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<number | null>(null);

  const principal = useMemo(() => {
    if (!isSignedIn()) {
      return null;
    }
    const data = loadUserData();
    if (!data) {
      return null;
    }
    return data.profile?.stxAddress?.testnet ?? null;
  }, [isSignedIn, loadUserData]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await fetchMarketplaceState(network);
      setItems(nextItems);
    } catch (err) {
      console.error(err);
      setError("Unable to fetch marketplace state. Confirm the contract is live on Stacks Testnet.");
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ensureWallet = useCallback(() => {
    if (!isSignedIn()) {
      doOpenAuth();
      return false;
    }
    return true;
  }, [doOpenAuth, isSignedIn]);

  const handleMint = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!ensureWallet() || !principal) return;

      const form = new FormData(event.currentTarget);
      const metadataUri = (form.get("metadataUri") as string)?.trim();
      const royaltyPercent = Number(form.get("royalty"));
      const royaltyBps = Math.min(
        ROYALTY_DENOMINATOR,
        Math.max(0, Math.round(royaltyPercent * 100))
      );

      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "mint",
        functionArgs: [
          standardPrincipalCV(principal),
          metadataUri ? someCV(stringAsciiCV(metadataUri)) : noneCV(),
          uintCV(BigInt(royaltyBps))
        ],
        network,
        postConditionMode: PostConditionMode.Allow,
        onFinish: () => {
          event.currentTarget.reset();
          refresh();
        }
      });
    },
    [ensureWallet, principal, doContractCall, network, refresh]
  );

  const handleList = useCallback(
    async (event: React.FormEvent<HTMLFormElement>, tokenId: number) => {
      event.preventDefault();
      if (!ensureWallet()) return;

      const form = new FormData(event.currentTarget);
      const priceStx = Number(form.get("price"));
      const priceUstx = BigInt(Math.max(0, Math.round(priceStx * Number(MICROSTX))));

      setBusyToken(tokenId);
      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "list-token",
        functionArgs: [uintCV(BigInt(tokenId)), uintCV(priceUstx)],
        network,
        postConditionMode: PostConditionMode.Allow,
        onFinish: () => {
          setBusyToken(null);
          refresh();
        },
        onCancel: () => setBusyToken(null)
      });
    },
    [doContractCall, ensureWallet, network, refresh]
  );

  const handleUpdatePrice = useCallback(
    async (event: React.FormEvent<HTMLFormElement>, tokenId: number) => {
      event.preventDefault();
      if (!ensureWallet()) return;

      const form = new FormData(event.currentTarget);
      const priceStx = Number(form.get("price"));
      const priceUstx = BigInt(Math.max(0, Math.round(priceStx * Number(MICROSTX))));

      setBusyToken(tokenId);
      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "update-listing",
        functionArgs: [uintCV(BigInt(tokenId)), uintCV(priceUstx)],
        network,
        postConditionMode: PostConditionMode.Allow,
        onFinish: () => {
          setBusyToken(null);
          refresh();
        },
        onCancel: () => setBusyToken(null)
      });
    },
    [doContractCall, ensureWallet, network, refresh]
  );

  const handleCancelListing = useCallback(
    async (tokenId: number) => {
      if (!ensureWallet()) return;

      setBusyToken(tokenId);
      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "cancel-listing",
        functionArgs: [uintCV(BigInt(tokenId))],
        network,
        postConditionMode: PostConditionMode.Allow,
        onFinish: () => {
          setBusyToken(null);
          refresh();
        },
        onCancel: () => setBusyToken(null)
      });
    },
    [doContractCall, ensureWallet, network, refresh]
  );

  const handlePurchase = useCallback(
    async (tokenId: number, priceUstx: bigint) => {
      if (!ensureWallet() || !principal) return;

      setBusyToken(tokenId);
      await doContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "purchase",
        functionArgs: [uintCV(BigInt(tokenId))],
        network,
        postConditionMode: PostConditionMode.Deny,
        postConditions: [
          createSTXPostCondition(
            principal,
            FungibleConditionCode.Equal,
            priceUstx
          )
        ],
        onFinish: () => {
          setBusyToken(null);
          refresh();
        },
        onCancel: () => setBusyToken(null)
      });
    },
    [doContractCall, ensureWallet, network, refresh, principal]
  );

  const disconnect = useCallback(() => {
    userSession.signUserOut();
    window.location.reload();
  }, [userSession]);

  return (
    <main className="page">
      <header className="hero">
        <div>
          <h1>Stacks NFT Marketplace</h1>
          <p>
            Mint on-chain collectibles, list them for sale, and close deals with
            automatic creator royalties. Connected to {NETWORK_LABEL}.
          </p>
          <p className="hint">{TESTNET_HINT}</p>
        </div>
        <div className="wallet-card">
          {principal ? (
            <>
              <span className="label">Connected wallet</span>
              <code>{principal}</code>
              <button onClick={disconnect} className="ghost">
                Disconnect
              </button>
            </>
          ) : (
            <button onClick={doOpenAuth}>Connect Hiro Wallet</button>
          )}
        </div>
      </header>

      <section className="panel">
        <h2>Mint a new NFT</h2>
        <form className="form" onSubmit={handleMint}>
          <label>
            Metadata URI
            <input
              type="text"
              name="metadataUri"
              placeholder="ipfs://..."
              required
            />
          </label>
          <label>
            Royalty (%)
            <input
              type="number"
              name="royalty"
              min="0"
              max="100"
              step="0.5"
              defaultValue={5}
            />
          </label>
          <button type="submit" disabled={!principal}>
            Mint NFT
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Marketplace inventory</h2>
          <button onClick={refresh} className="ghost" disabled={loading}>
            Refresh
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {items.length === 0 && !loading ? (
          <p className="muted">No tokens minted yet. Be the first to mint one!</p>
        ) : (
          <div className="grid">
            {items.map((item) => {
              const isOwner = item.owner === principal;
              const isSeller = item.seller === principal;

              return (
                <article className="card" key={item.tokenId}>
                  <header>
                    <span className="token-id">Token #{item.tokenId}</span>
                    <span className="royalty">Royalty: {item.royaltyBps / 100}%</span>
                  </header>
                  <dl>
                    <div>
                      <dt>Owner</dt>
                      <dd>{item.owner ?? "–"}</dd>
                    </div>
                    <div>
                      <dt>Creator</dt>
                      <dd>{item.creator ?? "–"}</dd>
                    </div>
                    <div>
                      <dt>Metadata URI</dt>
                      <dd>
                        {item.metadataUri ? (
                          <a href={item.metadataUri} target="_blank" rel="noreferrer">
                            {item.metadataUri}
                          </a>
                        ) : (
                          "–"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{item.listed ? "Listed" : "Not listed"}</dd>
                    </div>
                    {item.listed && item.priceUstx !== undefined ? (
                      <div>
                        <dt>Price</dt>
                        <dd>{item.priceLabel}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {isOwner && !item.listed && (
                    <form
                      className="form-inline"
                      onSubmit={(evt) => handleList(evt, item.tokenId)}
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        name="price"
                        placeholder="Price in STX"
                        required
                      />
                      <button type="submit" disabled={busyToken === item.tokenId}>
                        List for sale
                      </button>
                    </form>
                  )}

                  {item.listed && isSeller && (
                    <>
                      <form
                        className="form-inline"
                        onSubmit={(evt) => handleUpdatePrice(evt, item.tokenId)}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          name="price"
                          placeholder="New price (STX)"
                          required
                        />
                        <button type="submit" disabled={busyToken === item.tokenId}>
                          Update price
                        </button>
                      </form>
                      <button
                        className="ghost"
                        onClick={() => handleCancelListing(item.tokenId)}
                        disabled={busyToken === item.tokenId}
                      >
                        Cancel listing
                      </button>
                    </>
                  )}

                  {item.listed && item.priceUstx && !isSeller && principal && (
                    <button
                      onClick={() => handlePurchase(item.tokenId, item.priceUstx!)}
                      disabled={busyToken === item.tokenId}
                    >
                      Purchase for {item.priceLabel}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
