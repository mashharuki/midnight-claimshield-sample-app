import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import type { PredictionMarketPrivateState } from "contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Subscription } from "rxjs";
import {
  type DeployedPredictionMarketContract,
  floorReward,
  MarketPhase,
  type PredictionMarketLedgerState,
  type Team,
  teamPool,
} from "shared";
import { useNetwork } from "@/contexts/useNetwork";
import { useWallet } from "@/contexts/useWallet";
import { toHex } from "@/lib/hex";
import {
  claimReward,
  closePredictions,
  closeReveal,
  commitPrediction,
  deployPredictionMarket,
  getPredictionIdentity,
  joinPredictionMarket,
  resolveMarket,
  revealPrediction,
  savePrediction,
  subscribeToPredictionMarket,
} from "@/lib/prediction-market";
import { createPredictionMarketProviders } from "@/lib/prediction-market-providers";

export type MarketAction =
  | "idle"
  | "deploying"
  | "joining"
  | "committing"
  | "revealing"
  | "admin"
  | "claiming";

const addressKey = (network: string) => `hidden-league:${network}:contract`;

export type PersonalPosition = {
  selectedTeam: Team | null;
  stake: bigint | null;
  isCommitted: boolean;
  isRevealed: boolean;
  isClaimed: boolean;
  isWinner: boolean;
  hasPrivatePrediction: boolean;
  reward: bigint | null;
  canClaim: boolean;
};

const hasParticipant = (
  keys: Iterable<Uint8Array>,
  participantKeyHex: string,
) => Array.from(keys).some((key) => toHex(key) === participantKeyHex);

const participantReward = (
  rewards: Iterable<readonly [Uint8Array, bigint]>,
  participantKeyHex: string,
) =>
  Array.from(rewards).find(
    ([key]) => toHex(key) === participantKeyHex,
  )?.[1] ?? null;

export const participantStake = (
  stakes: Iterable<readonly [Uint8Array, bigint]>,
  participantKeyHex: string,
) =>
  Array.from(stakes).find(
    ([key]) => toHex(key) === participantKeyHex,
  )?.[1] ?? null;

export function usePredictionMarket() {
  const { t } = useTranslation();
  const { state: walletState } = useWallet();
  const { networkId } = useNetwork();
  const connection =
    walletState.status === "connected" ? walletState.connection : null;
  const providers = useMemo(
    () =>
      connection
        ? createPredictionMarketProviders(connection, networkId)
        : null,
    [connection, networkId],
  );
  const [address, setAddressValue] = useState(
    () => localStorage.getItem(addressKey(networkId)) ?? "",
  );
  const [contract, setContract] =
    useState<DeployedPredictionMarketContract | null>(null);
  const [ledger, setLedger] = useState<PredictionMarketLedgerState | null>(
    null,
  );
  const [action, setAction] = useState<MarketAction>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [participantKeyHex, setParticipantKeyHex] = useState<string | null>(
    null,
  );
  const [privateState, setPrivateState] =
    useState<PredictionMarketPrivateState | null>(null);
  const subscription = useRef<Subscription | null>(null);

  const position = useMemo<PersonalPosition | null>(() => {
    if (!ledger || !privateState || !participantKeyHex) return null;
    const isCommitted = hasParticipant(ledger.participants, participantKeyHex);
    const isRevealed = hasParticipant(ledger.revealed, participantKeyHex);
    const isClaimed = hasParticipant(ledger.claimed, participantKeyHex);
    const publicStake = participantStake(ledger.stakes, participantKeyHex);
    const selectedTeam =
      privateState.selectedTeam === null
        ? null
        : (privateState.selectedTeam as Team);
    const hasPrivatePrediction =
      selectedTeam !== null &&
      privateState.stake !== null &&
      privateState.salt !== null &&
      privateState.stake === publicStake;
    const isWinner =
      ledger.result_set &&
      hasPrivatePrediction &&
      selectedTeam === ledger.winning_team;
    const estimatedReward =
      isWinner && publicStake !== null
        ? floorReward(
            ledger.total_pool,
            publicStake,
            teamPool(ledger, ledger.winning_team),
          )
        : null;
    const claimedReward = participantReward(ledger.rewards, participantKeyHex);

    return {
      selectedTeam,
      stake: publicStake,
      isCommitted,
      isRevealed,
      isClaimed,
      isWinner,
      hasPrivatePrediction,
      reward: claimedReward ?? estimatedReward,
      canClaim:
        ledger.phase === MarketPhase.resolved &&
        hasPrivatePrediction &&
        isRevealed &&
        isWinner &&
        !isClaimed,
    };
  }, [ledger, participantKeyHex, privateState]);

  useEffect(() => {
    setAddressValue(localStorage.getItem(addressKey(networkId)) ?? "");
  }, [networkId]);
  useEffect(() => () => subscription.current?.unsubscribe(), []);

  const persistAddress = useCallback(
    (value: string) => {
      setAddressValue(value);
      localStorage.setItem(addressKey(networkId), value);
    },
    [networkId],
  );

  const attach = useCallback(
    async (deployed: DeployedPredictionMarketContract, value: string) => {
      if (!providers) return;
      setContract(deployed);
      persistAddress(value);
      const identity = await getPredictionIdentity(providers);
      setParticipantKeyHex(identity.publicKeyHex);
      setPrivateState(identity.privateState);
      subscription.current?.unsubscribe();
      subscription.current = subscribeToPredictionMarket(
        providers,
        value as ContractAddress,
      ).subscribe({
        next: (next) => {
          setLedger(next);
          setIsAdmin(toHex(next.admin_key) === identity.publicKeyHex);
        },
        error: () => setError(t("market.errors.subscription")),
      });
    },
    [providers, persistAddress, t],
  );

  const run = useCallback(
    async (nextAction: MarketAction, operation: () => Promise<void>) => {
      setAction(nextAction);
      setError(null);
      try {
        await operation();
      } catch (cause) {
        const privateMissing = t("market.errors.privateMissing");
        setError(
          cause instanceof Error && cause.message === privateMissing
            ? privateMissing
            : t("market.errors.transaction"),
        );
      } finally {
        setAction("idle");
      }
    },
    [t],
  );

  const deploy = () =>
    run("deploying", async () => {
      if (!providers) return;
      const deployed = await deployPredictionMarket(providers);
      const value = (
        deployed as unknown as {
          deployTxData: { public: { contractAddress: string } };
        }
      ).deployTxData.public.contractAddress;
      await attach(deployed, value);
    });
  const join = () =>
    run("joining", async () => {
      if (!providers || !address) return;
      await attach(await joinPredictionMarket(providers, address), address);
    });
  const commit = (team: Team, stake: bigint) =>
    run("committing", async () => {
      if (!providers || !contract) return;
      await savePrediction(providers, team, stake);
      await commitPrediction(contract, stake);
      const identity = await getPredictionIdentity(providers);
      setParticipantKeyHex(identity.publicKeyHex);
      setPrivateState(identity.privateState);
    });
  const reveal = () =>
    run("revealing", async () => {
      if (!contract) return;
      await revealPrediction(contract);
    });
  const advance = () =>
    run("admin", async () => {
      if (!contract || !ledger) return;
      if (ledger.phase === MarketPhase.open) await closePredictions(contract);
      else if (ledger.phase === MarketPhase.reveal) await closeReveal(contract);
    });
  const resolve = (winner: Team) =>
    run("admin", async () => {
      if (contract) await resolveMarket(contract, winner);
    });
  const claim = () =>
    run("claiming", async () => {
      if (!providers || !contract || !ledger) return;
      const { privateState } = await getPredictionIdentity(providers);
      if (privateState.stake === null) {
        throw new Error(t("market.errors.privateMissing"));
      }
      await claimReward(contract, ledger, privateState.stake);
    });

  return {
    address,
    setAddress: persistAddress,
    ledger,
    position,
    action,
    error,
    isAdmin,
    connected: Boolean(contract),
    deploy,
    join,
    commit,
    reveal,
    advance,
    resolve,
    claim,
  };
}
