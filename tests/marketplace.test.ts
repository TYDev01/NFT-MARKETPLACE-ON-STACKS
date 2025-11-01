
import { describe, expect, it } from "vitest";
import { uintCV, someCV, principalCV, stringAsciiCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const creator = accounts.get("wallet_1")!;
const seller = accounts.get("wallet_2")!;
const buyer = accounts.get("wallet_3")!;

const contractName = "marketplace";

const expectOk = (result: any) => {
  expect(result.type).toBe("ok");
  return result.value;
};

const expectUint = (cv: any): bigint => {
  expect(cv.type).toBe("uint");
  return cv.value as bigint;
};

const expectOptional = (cv: any) => {
  if (cv.type === "none") {
    return null;
  }
  if (cv.type === "some") {
    return cv.value;
  }
  expect(cv.type).toBe("optional");
  return cv.value;
};

const expectTuple = (cv: any) => {
  expect(cv.type).toBe("tuple");
  return Array.isArray(cv.value) ? Object.fromEntries(cv.value) : cv.value;
};

const expectPrincipal = (cv: any): string => {
  expect(["principal", "standard-principal", "address"]).toContain(cv.type);
  return cv.value as string;
};

const expectAscii = (cv: any): string => {
  expect(["string-ascii", "ascii"]).toContain(cv.type);
  return cv.value as string;
};

const mintToken = (recipient = seller, royaltyBps = 500n, uri = "ipfs://token") => {
  const mint = simnet.callPublicFn(
    contractName,
    "mint",
    [principalCV(recipient), someCV(stringAsciiCV(uri)), uintCV(royaltyBps)],
    creator,
  );
  return expectUint(expectOk(mint.result));
};

const listToken = (tokenId: bigint, price = 10_000_000n) => {
  const response = simnet.callPublicFn(
    contractName,
    "list-token",
    [uintCV(tokenId), uintCV(price)],
    seller,
  );
  expectOk(response.result);
};

describe("marketplace contract", () => {
  it("mints NFTs with metadata and royalty configuration", () => {
    const mint = simnet.callPublicFn(
      contractName,
      "mint",
      [
        principalCV(creator),
        someCV(stringAsciiCV("ipfs://creator-asset")),
        uintCV(1000n),
      ],
      creator,
    );

    const tokenId = expectUint(expectOk(mint.result));
    expect(tokenId).toBe(1n);
    const { result: metadata } = simnet.callReadOnlyFn(
      contractName,
      "get-token-metadata",
      [uintCV(tokenId)],
      creator,
    );

    const metadataOptional = expectOptional(metadata);
    expect(metadataOptional).not.toBeNull();
    const metadataTuple = expectTuple(metadataOptional);
    expect(expectPrincipal(metadataTuple["creator"])).toBe(creator);
    expect(expectUint(metadataTuple["royalty-bps"])).toBe(1000n);
    const uriOptional = expectOptional(metadataTuple["uri"]);
    expect(uriOptional).not.toBeNull();
    expect(expectAscii(uriOptional)).toBe("ipfs://creator-asset");
  });

  it("prevents non-owners from listing tokens", () => {
    const mint = simnet.callPublicFn(
      contractName,
      "mint",
      [
        principalCV(creator),
        someCV(stringAsciiCV("ipfs://protected")),
        uintCV(0n),
      ],
      creator,
    );
    const tokenId = expectUint(expectOk(mint.result));
    expect(tokenId).toBe(1n);

    const attempt = simnet.callPublicFn(
      contractName,
      "list-token",
      [uintCV(tokenId), uintCV(1_000_000n)],
      seller,
    );

    expect(attempt.result.type).toBe("err");
  });

  it("allows updating listings and removing them", () => {
    const tokenId = mintToken();
    listToken(tokenId);

    const update = simnet.callPublicFn(
      contractName,
      "update-listing",
      [uintCV(tokenId), uintCV(5_000_000n)],
      seller,
    );
    expectOk(update.result);

    const cancel = simnet.callPublicFn(
      contractName,
      "cancel-listing",
      [uintCV(tokenId)],
      seller,
    );
    expectOk(cancel.result);

    const { result: listing } = simnet.callReadOnlyFn(
      contractName,
      "get-listing",
      [uintCV(tokenId)],
      seller,
    );
    const listingOptional = expectOptional(listing);
    expect(listingOptional).toBeNull();
  });

  it("transfers ownership on purchase and clears listings", () => {
    const tokenId = mintToken();
    listToken(tokenId);

    const purchase = simnet.callPublicFn(
      contractName,
      "purchase",
      [uintCV(tokenId)],
      buyer,
    );
    const purchaseTokenId = expectUint(expectOk(purchase.result));
    expect(purchaseTokenId).toBe(tokenId);

    const { result: owner } = simnet.callReadOnlyFn(
      contractName,
      "get-owner",
      [uintCV(tokenId)],
      buyer,
    );
    const ownerOptional = expectOptional(owner);
    expect(ownerOptional).not.toBeNull();
    expect(expectPrincipal(ownerOptional)).toBe(buyer);

    const { result: listing } = simnet.callReadOnlyFn(
      contractName,
      "get-listing",
      [uintCV(tokenId)],
      deployer,
    );
    expect(expectOptional(listing)).toBeNull();
  });
});
