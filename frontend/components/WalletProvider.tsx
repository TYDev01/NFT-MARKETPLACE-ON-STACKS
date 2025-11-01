"use client";

import { createContext, useContext, useMemo } from "react";
import { Connect } from "@stacks/connect-react";
import { AppConfig, UserSession, type UserData } from "@stacks/auth";
import {
  STACKS_TESTNET,
  createNetwork,
  type StacksNetwork
} from "@stacks/network";

const TESTNET_DEFAULT = "https://api.testnet.hiro.so";

const appConfig = new AppConfig(
  ["store_write", "publish_data"],
  process.env.NEXT_PUBLIC_APP_URL
);

const sharedSession = new UserSession({ appConfig });

const testnet: StacksNetwork = createNetwork({
  network: {
    ...STACKS_TESTNET,
    client: {
      ...STACKS_TESTNET.client,
      baseUrl: process.env.NEXT_PUBLIC_STACKS_API || TESTNET_DEFAULT
    }
  }
});

type WalletContextValue = {
  userSession: UserSession;
  network: StacksNetwork;
  isSignedIn: () => boolean;
  loadUserData: () => UserData | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const INVALID_SESSION_SUBSTRING = "JSON data version";

const isInvalidSessionError = (error: unknown) =>
  error instanceof Error && error.message.includes(INVALID_SESSION_SUBSTRING);

const safeIsSignedIn = (session: UserSession) => {
  try {
    return session.isUserSignedIn();
  } catch (error) {
    if (isInvalidSessionError(error)) {
      console.warn("Resetting stale Stacks session data", error);
      session.signUserOut();
      return false;
    }
    throw error;
  }
};

const safeLoadUserData = (session: UserSession): UserData | null => {
  try {
    return session.loadUserData();
  } catch (error) {
    if (isInvalidSessionError(error)) {
      console.warn("Resetting stale Stacks session data", error);
      session.signUserOut();
      return null;
    }
    throw error;
  }
};

// Prime the session store so invalid JSON is cleared immediately.
safeIsSignedIn(sharedSession);

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return value;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<WalletContextValue>(
    () => ({
      userSession: sharedSession,
      network: testnet,
      isSignedIn: () => safeIsSignedIn(sharedSession),
      loadUserData: () => safeLoadUserData(sharedSession)
    }),
    []
  );

  return (
    <WalletContext.Provider value={value}>
      <Connect
        authOptions={{
          appDetails: {
            name: "Stacks NFT Marketplace",
            icon: "https://stacks.co/favicon.ico"
          },
          redirectTo: "/",
          userSession: sharedSession,
          network: testnet,
          onFinish() {
            window.location.reload();
          },
          onCancel() {
            console.warn("Wallet connection cancelled");
          }
        }}
      >
        {children}
      </Connect>
    </WalletContext.Provider>
  );
}
