// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import type { Logger } from "pino";
import type {
  DockerComposeEnvironment,
  StartedDockerComposeEnvironment,
} from "testcontainers";
import * as api from "./api";
import { type Config, StandaloneConfig } from "./config";
import { DIVIDER, GENESIS_MINT_WALLET_SEED } from "./constants";
import { mapContainerPort } from "./docker-utils";

let logger: Logger;

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                    ClaimShield CLI                            ║
║             Midnight wallet runtime baseline                  ║
╚══════════════════════════════════════════════════════════════╝
`;

const walletMenu = `
${DIVIDER}
  Wallet setup
${DIVIDER}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${"─".repeat(62)}
> `;

const readyMenu = (dustBalance: string) => `
${DIVIDER}
  Wallet ready${dustBalance ? `     DUST: ${dustBalance}` : ""}
${DIVIDER}
  [1] Monitor DUST balance
  [2] Exit
${"─".repeat(62)}
> `;

const buildWallet = async (
  config: Config,
  rli: Interface,
): Promise<api.WalletContext | null> => {
  if (config instanceof StandaloneConfig) {
    return api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED);
  }

  while (true) {
    switch ((await rli.question(walletMenu)).trim()) {
      case "1":
        return api.buildFreshWallet(config);
      case "2":
        return api.buildWalletAndWaitForFunds(
          config,
          await rli.question("Enter your wallet seed: "),
        );
      case "3":
        return null;
      default:
        logger.error("Invalid wallet-menu choice");
    }
  }
};

const getDustLabel = async (wallet: api.WalletContext["wallet"]) => {
  try {
    return (await api.getDustBalance(wallet)).available.toLocaleString();
  } catch {
    return "";
  }
};

const runWalletMenu = async (
  wallet: api.WalletContext["wallet"],
  rli: Interface,
) => {
  while (true) {
    switch ((await rli.question(readyMenu(await getDustLabel(wallet)))).trim()) {
      case "1": {
        const stopSignal = rli.question("  Press Enter to return to menu...\n");
        await api.monitorDustBalance(wallet, stopSignal.then(() => {}));
        break;
      }
      case "2":
        return;
      default:
        console.log("  Invalid choice.");
    }
  }
};

export const run = async (
  config: Config,
  _logger: Logger,
  dockerEnv?: DockerComposeEnvironment,
): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);
  console.log(BANNER);
  const rli = createInterface({ input, output, terminal: true });
  let env: StartedDockerComposeEnvironment | undefined;

  try {
    if (dockerEnv !== undefined) {
      env = await dockerEnv.up();
      if (config instanceof StandaloneConfig) {
        config.indexer = mapContainerPort(env, config.indexer, "indexer-1");
        config.indexerWS = mapContainerPort(env, config.indexerWS, "indexer-1");
        config.node = mapContainerPort(env, config.node, "node-1");
        config.proofServer = mapContainerPort(
          env,
          config.proofServer,
          "proof-server-1",
        );
      }
    }

    const walletCtx = await buildWallet(config, rli);
    if (walletCtx === null) return;
    try {
      await runWalletMenu(walletCtx.wallet, rli);
    } finally {
      await walletCtx.wallet.stop();
    }
  } finally {
    rli.close();
    rli.removeAllListeners();
    if (env !== undefined) await env.down();
    logger.info("Goodbye.");
  }
};
