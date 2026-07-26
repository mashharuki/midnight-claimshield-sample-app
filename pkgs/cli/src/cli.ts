// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import type { Logger } from "pino";
import {
  type DeployedPredictionMarketContract,
  MarketPhase,
  type PredictionMarketProviders,
  TEAM_KEYS,
  type Team,
} from "shared";
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
║              Midnight Prediction Market                      ║
║              Four-outcome sealed forecast demo               ║
╚══════════════════════════════════════════════════════════════╝
`;

const WALLET_MENU = `
${DIVIDER}
  Wallet Setup
${DIVIDER}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${"─".repeat(62)}
> `;

const marketContractMenu = (dustBalance: string) => `
${DIVIDER}
  Prediction Market Setup${dustBalance ? `     DUST: ${dustBalance}` : ""}
${DIVIDER}
  [1] Deploy a new prediction market
  [2] Join an existing prediction market
  [3] Monitor DUST balance
  [4] Exit
${"─".repeat(62)}
> `;

const marketActionsMenu = (address: string, dustBalance: string) => `
${DIVIDER}
  Prediction Market Actions${dustBalance ? `    DUST: ${dustBalance}` : ""}
  Contract: ${address}
${DIVIDER}
  [1] Commit a prediction
  [2] Reveal my prediction
  [3] Show market state
  [4] Close predictions (steward)
  [5] Close reveal (steward)
  [6] Resolve market (steward)
  [7] Claim reward
  [8] Exit
${"─".repeat(62)}
> `;

const teamMenu = `
${DIVIDER}
  Select a team
${DIVIDER}
  [1] Amber Foxes
  [2] Cedar Owls
  [3] Harbor Whales
  [4] Meadow Bears
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
    switch ((await rli.question(WALLET_MENU)).trim()) {
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

const startDustMonitor = async (
  wallet: api.WalletContext["wallet"],
  rli: Interface,
) => {
  const stopPromise = rli.question("  Press Enter to return to menu...\n");
  await api.monitorDustBalance(
    wallet,
    stopPromise.then(() => {}),
  );
};

const selectTeam = async (rli: Interface): Promise<Team> => {
  while (true) {
    const choice = Number((await rli.question(teamMenu)).trim());
    if (choice >= 1 && choice <= 4) return (choice - 1) as Team;
    console.log("  Invalid choice. Please enter 1 through 4.");
  }
};

const selectStake = async (rli: Interface): Promise<bigint> => {
  while (true) {
    const value = (await rli.question("Stake (10–500 demo points): ")).trim();
    try {
      const stake = BigInt(value);
      if (stake >= 10n && stake <= 500n) return stake;
    } catch {}
    console.log("  Enter a whole-number stake from 10 through 500.");
  }
};

const deployOrJoinMarket = async (
  providers: PredictionMarketProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedPredictionMarketContract | null> => {
  while (true) {
    switch (
      (
        await rli.question(
          marketContractMenu(await getDustLabel(walletCtx.wallet)),
        )
      ).trim()
    ) {
      case "1":
        try {
          const contract = await api.withStatus(
            "Deploying prediction market",
            () => api.deployPredictionMarket(providers),
          );
          console.log(
            `  Contract deployed at: ${(contract as any).deployTxData.public.contractAddress}\n`,
          );
          return contract;
        } catch (error) {
          console.log(
            `  ✗ Deploy failed: ${error instanceof Error ? error.message : String(error)}\n`,
          );
        }
        break;
      case "2":
        try {
          const address = await rli.question(
            "Enter the prediction-market contract address (hex): ",
          );
          const contract = await api.withStatus(
            "Joining prediction market",
            () => api.joinPredictionMarket(providers, address.trim()),
          );
          console.log(
            `  Joined contract at: ${(contract as any).deployTxData.public.contractAddress}\n`,
          );
          return contract;
        } catch (error) {
          console.log(
            `  ✗ Failed to join market: ${error instanceof Error ? error.message : String(error)}\n`,
          );
        }
        break;
      case "3":
        await startDustMonitor(walletCtx.wallet, rli);
        break;
      case "4":
        return null;
      default:
        console.log("  Invalid choice.");
    }
  }
};

const printState = async (
  providers: PredictionMarketProviders,
  address: string,
) => {
  const state = await api.getPredictionMarketState(providers, address);
  if (state === null) {
    console.log("  No state found at this contract address.\n");
    return null;
  }
  console.log(`
  Phase:        ${Object.keys(MarketPhase)[state.phase] ?? state.phase}
  Participants: ${state.participant_count}
  Revealed:     ${state.revealed_count}
  Total pool:   ${state.total_pool}
  Result:       ${state.result_set ? TEAM_KEYS[state.winning_team] : "not set"}
  Team pools:   amber=${state.amber_foxes_pool}, cedar=${state.cedar_owls_pool}, harbor=${state.harbor_whales_pool}, meadow=${state.meadow_bears_pool}
`);
  return state;
};

const marketMainLoop = async (
  providers: PredictionMarketProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
) => {
  const contract = await deployOrJoinMarket(providers, walletCtx, rli);
  if (contract === null) return;
  const address = (contract as any).deployTxData.public
    .contractAddress as string;

  while (true) {
    try {
      switch (
        (
          await rli.question(
            marketActionsMenu(address, await getDustLabel(walletCtx.wallet)),
          )
        ).trim()
      ) {
        case "1": {
          const team = await selectTeam(rli);
          const stake = await selectStake(rli);
          await api.withStatus(
            "Committing prediction — generating ZK proof",
            () => api.commitPrediction(providers, contract, team, stake),
          );
          break;
        }
        case "2":
          await api.withStatus(
            "Revealing prediction — generating ZK proof",
            () => api.revealPrediction(contract),
          );
          break;
        case "3":
          await printState(providers, address);
          break;
        case "4":
          await api.withStatus("Closing predictions", () =>
            api.closePredictions(contract),
          );
          break;
        case "5":
          await api.withStatus("Closing reveal", () =>
            api.closeReveal(contract),
          );
          break;
        case "6":
          await api.withStatus("Resolving market", async () =>
            api.resolveMarket(contract, await selectTeam(rli)),
          );
          break;
        case "7": {
          const state = await api.getPredictionMarketState(providers, address);
          if (state === null)
            throw new Error("No state found at this contract address");
          await api.withStatus("Claiming floor-rounded reward", () =>
            api.claimReward(providers, contract, state),
          );
          break;
        }
        case "8":
          return;
        default:
          console.log("  Invalid choice.");
      }
    } catch (error) {
      console.log(
        `  ✗ Action failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
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
      const providers = await api.withStatus(
        "Configuring prediction-market providers",
        () => api.configurePredictionMarketProviders(walletCtx, config),
      );
      await marketMainLoop(providers, walletCtx, rli);
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
