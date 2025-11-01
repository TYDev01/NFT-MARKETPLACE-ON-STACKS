import {
  callReadOnlyFunction,
  ClarityValue,
  cvToJSON,
  ClarityValueJSON,
  uintCV
} from "@stacks/transactions";
import type { StacksNetwork } from "@stacks/network";
import { CONTRACT_ADDRESS, CONTRACT_NAME } from "@/lib/constants";

export type ListingView = {
  tokenId: number;
  owner: string | null;
  listed: boolean;
  priceUstx?: bigint;
  priceLabel?: string;
  seller?: string;
  royaltyBps: number;
  metadataUri?: string | null;
  creator?: string;
};

type OptionalJSON = Extract<ClarityValueJSON, { type: "optional" }>;
type TupleJSON = Extract<ClarityValueJSON, { type: "tuple" }>;
type PrincipalJSON = Extract<ClarityValueJSON, { type: "principal" }>;
type UintJSON = Extract<ClarityValueJSON, { type: "uint" }>;
type AsciiJSON = Extract<ClarityValueJSON, { type: "string-ascii" }>;

const POST_CONDITION_DENOMINATOR = 1_000_000n;

const optionalValue = <T>(value: OptionalJSON | ClarityValueJSON | null, mapper: (inner: ClarityValueJSON) => T): T | null => {
  if (!value) {
    return null;
  }
  if (value.type !== "optional") {
    return mapper(value);
  }
  if (!value.value) {
    return null;
  }
  return mapper(value.value);
};

const tupleToRecord = (tuple: TupleJSON) => {
  return tuple.value.reduce<Record<string, ClarityValueJSON>>((acc, [key, val]) => {
    acc[key] = val;
    return acc;
  }, {});
};

const parseUint = (value: UintJSON) => BigInt(value.value);

const parsePrincipal = (value: PrincipalJSON) => value.value;

const parseAscii = (value: AsciiJSON) => value.value;

export const formatStx = (amountUstx: bigint) => {
  const whole = Number(amountUstx) / Number(POST_CONDITION_DENOMINATOR);
  return `${whole.toLocaleString(undefined, { maximumFractionDigits: 6 })} STX`;
};

async function readOnly(
  network: StacksNetwork,
  functionName: string,
  args: ClarityValue[] = []
) {
  return callReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName,
    functionArgs: args,
    network,
    senderAddress: CONTRACT_ADDRESS
  });
}

export async function fetchMarketplaceState(network: StacksNetwork) {
  const listings: ListingView[] = [];

  const lastIdCv = await readOnly(network, "get-last-token-id");
  const lastIdJson = cvToJSON(lastIdCv) as UintJSON;
  const lastId = Number(lastIdJson.value);

  for (let tokenId = 1; tokenId <= lastId; tokenId += 1) {
    const ownerCv = await readOnly(network, "get-owner", [uintCV(tokenId)]);
    const ownerJson = cvToJSON(ownerCv) as OptionalJSON;
    const owner = optionalValue(ownerJson, (value) => parsePrincipal(value as PrincipalJSON));

    const metadataCv = await readOnly(network, "get-token-metadata", [uintCV(tokenId)]);
    const metadataJson = cvToJSON(metadataCv) as OptionalJSON;
    const metadata = optionalValue(metadataJson, (value) => {
      const tuple = tupleToRecord(value as TupleJSON);
      const royalty = parseUint(tuple["royalty-bps"] as UintJSON);
      const creator = parsePrincipal(tuple["creator"] as PrincipalJSON);
      const uri = optionalValue(tuple["uri"], (inner) => parseAscii(inner as AsciiJSON));
      return { royaltyBps: Number(royalty), creator, uri };
    });

    const listingCv = await readOnly(network, "get-listing", [uintCV(tokenId)]);
    const listingJson = cvToJSON(listingCv) as OptionalJSON;
    const listing = optionalValue(listingJson, (value) => {
      const tuple = tupleToRecord(value as TupleJSON);
      const price = parseUint(tuple["price"] as UintJSON);
      const seller = parsePrincipal(tuple["seller"] as PrincipalJSON);
      return { price, seller };
    });

    listings.push({
      tokenId,
      owner,
      listed: Boolean(listing),
      priceUstx: listing?.price,
      priceLabel: listing ? formatStx(listing.price) : undefined,
      seller: listing?.seller,
      royaltyBps: metadata?.royaltyBps ?? 0,
      metadataUri: metadata?.uri || null,
      creator: metadata?.creator
    });
  }

  return listings;
}
