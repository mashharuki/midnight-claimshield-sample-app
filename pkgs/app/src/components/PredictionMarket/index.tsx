import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MarketPhase,
  TEAM_KEYS,
  Team,
  type Team as TeamType,
  teamPool,
} from "shared";
import { AddressCard } from "@/components/AddressCard";
import { Button } from "@/components/ui/button";
import { useCountUp } from "@/hooks/useCountUp";
import { usePredictionMarket } from "@/hooks/usePredictionMarket";

// Design context: newcomers predict a fictional football champion; mood is warm/community-minded;
// visual reference is a printed neighbourhood football festival programme, not a finance dashboard.
const teams = {
  amber_foxes: {
    mark: "AF",
    color: "#c9683a",
  },
  cedar_owls: {
    mark: "CO",
    color: "#356859",
  },
  harbor_whales: {
    mark: "HW",
    color: "#376e86",
  },
  meadow_bears: {
    mark: "MB",
    color: "#b58a32",
  },
} as const;

const phaseKeys = ["open", "reveal", "awaiting", "resolved"] as const;

export function PredictionMarketView() {
  const { t } = useTranslation();
  const market = usePredictionMarket();
  const [team, setTeam] = useState<TeamType>(Team.amber_foxes);
  const [stake, setStake] = useState(100);
  const [stamped, setStamped] = useState(false);
  const prevAction = useRef(market.action);
  const busy = market.action !== "idle";

  // commit → idle への遷移（エラーなし）を封印成功とみなしスタンプを押す
  useEffect(() => {
    const was = prevAction.current;
    prevAction.current = market.action;
    if (was === "committing" && market.action === "idle" && !market.error) {
      setStamped(true);
      const id = setTimeout(() => setStamped(false), 2600);
      return () => clearTimeout(id);
    }
  }, [market.action, market.error]);
  const currentLedger = market.ledger;
  const revealedPool = currentLedger
    ? TEAM_KEYS.reduce(
        (sum, key) => sum + teamPool(currentLedger, Team[key]),
        0n,
      )
    : 0n;

  if (!market.connected) {
    return (
      <div className="market-shell join-layout">
        <section className="league-intro animate-fade-in-up">
          <p className="eyebrow">{t("market.season")}</p>
          <h1>
            {t("market.hero.line1")}
            <br />
            <em>{t("market.hero.cup")}</em>
          </h1>
          <p className="lede">{t("market.hero.description")}</p>
          <div className="privacy-note">
            <span aria-hidden="true">◉</span>
            <div>
              <strong>{t("market.privacy.title")}</strong>
              <br />
              {t("market.privacy.description")}
            </div>
          </div>
        </section>
        <section
          className="join-ticket animate-fade-in-up"
          style={{ animationDelay: "120ms" }}
          aria-label={t("market.join.aria")}
        >
          <AddressCard />
          <label htmlFor="contract">{t("market.join.contract")}</label>
          <input
            id="contract"
            value={market.address}
            onChange={(event) => market.setAddress(event.target.value)}
            placeholder={t("market.join.placeholder")}
          />
          <Button onClick={market.join} disabled={!market.address || busy}>
            {t("market.join.enter")}
          </Button>
          <button
            type="button"
            className="text-action"
            onClick={market.deploy}
            disabled={busy}
          >
            {t("market.join.create")}
          </button>
          {market.error ? (
            <p className="market-error" role="alert">
              {market.error}
            </p>
          ) : null}
        </section>
      </div>
    );
  }

  const phase = market.ledger?.phase ?? MarketPhase.open;
  const position = market.position;
  const committed = position?.isCommitted ?? false;
  return (
    <div className="market-page">
      <header className="market-header animate-fade-in-up">
        <div>
          <p className="eyebrow">{t("market.brand")}</p>
          <h1>
            {t("market.title.cup")} <em>{t("market.title.finalFour")}</em>
          </h1>
        </div>
        <div className="phase-stamp">
          <span>{t("market.phase.label")}</span>
          <strong key={phase}>{t(`market.phase.${phaseKeys[phase]}`)}</strong>
        </div>
      </header>

      <main className="market-grid">
        <section className="team-board" aria-labelledby="team-heading">
          <div className="section-heading">
            <div>
              <p className="kicker">{t("market.teams.heading")}</p>
              <h2 id="team-heading">
                {t("market.teams.prompt1")}
                <br />
                {t("market.teams.prompt2")}
              </h2>
            </div>
            <p>
              {t("market.stats.forecasts", {
                count: Number(market.ledger?.participant_count ?? 0n),
              })}
              <br />
              {t("market.stats.pool", {
                points: market.ledger?.total_pool.toString() ?? "0",
              })}
            </p>
          </div>
          <div className="team-list">
            {TEAM_KEYS.map((key, index) => {
              const value = Team[key];
              const item = teams[key];
              const pool = market.ledger ? teamPool(market.ledger, value) : 0n;
              const percent =
                revealedPool === 0n ? 0 : Number((pool * 100n) / revealedPool);
              return (
                <button
                  type="button"
                  key={key}
                  className={`team-row animate-fade-in-up ${team === value ? "selected" : ""}`}
                  style={{ animationDelay: `${100 + index * 60}ms` }}
                  onClick={() => setTeam(value)}
                  disabled={phase !== MarketPhase.open || committed}
                  aria-pressed={team === value}
                >
                  <span className="team-number">0{index + 1}</span>
                  <span
                    className="crest"
                    style={
                      { "--team-color": item.color } as React.CSSProperties
                    }
                  >
                    {item.mark}
                  </span>
                  <span className="team-name">
                    <strong>{t(`market.teams.${key}.name`)}</strong>
                    <small>
                      {t("market.teams.club", {
                        place: t(`market.teams.${key}.place`),
                      })}
                    </small>
                  </span>
                  {phase === MarketPhase.open ? (
                    <span
                      className="sealed-label"
                      style={
                        {
                          "--row-delay": `${index * 60}ms`,
                        } as React.CSSProperties
                      }
                    >
                      {t("market.teams.sealed")}
                    </span>
                  ) : (
                    <span
                      className="odds"
                      style={
                        {
                          "--row-delay": `${index * 60}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <OddsPercent percent={percent} />
                      <small>
                        {t("market.teams.pointsShort", {
                          points: pool.toString(),
                        })}
                      </small>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside
          className="forecast-slip animate-fade-in-up"
          style={{ animationDelay: "220ms" }}
        >
          <p className="ticket-label">{t("market.slip.label")}</p>
          {stamped ? (
            <span className="ticket-stamp" aria-hidden="true">
              {t("market.slip.stamped")}
            </span>
          ) : null}
          <div className="ticket-team">
            <span
              className="crest large"
              style={
                {
                  "--team-color": teams[TEAM_KEYS[team]].color,
                } as React.CSSProperties
              }
            >
              {teams[TEAM_KEYS[team]].mark}
            </span>
            <div>
              <small>{t("market.slip.champion")}</small>
              <h3>{t(`market.teams.${TEAM_KEYS[team]}.name`)}</h3>
            </div>
          </div>
          <section className="position-ledger" aria-live="polite">
            <p className="ticket-label">{t("market.position.label")}</p>
            {position?.stake !== null && position?.stake !== undefined ? (
              <>
                <div className="position-row">
                  <span>{t("market.position.forecast")}</span>
                  <strong>
                    {position.selectedTeam !== null
                      ? t(
                          `market.teams.${TEAM_KEYS[position.selectedTeam]}.name`,
                        )
                      : "—"}
                  </strong>
                </div>
                <div className="position-row">
                  <span>{t("market.position.stake")}</span>
                  <strong>{position.stake.toString()} pts</strong>
                </div>
                {!position.hasPrivatePrediction ? (
                  <p className="position-status warning">
                    {t("market.position.unavailable")}
                  </p>
                ) : null}
                {position.hasPrivatePrediction && !position.isRevealed ? (
                  <p className="position-status">
                    {phase === MarketPhase.open
                      ? t("market.position.sealed")
                      : t("market.position.awaitingReveal")}
                  </p>
                ) : null}
                {position.isRevealed && phase !== MarketPhase.resolved ? (
                  <p className="position-status">
                    {t("market.position.revealed")}
                  </p>
                ) : null}
                {phase === MarketPhase.resolved && position.isClaimed ? (
                  <div className="position-reward claimed">
                    <span>{t("market.position.claimed")}</span>
                    <strong>{position.reward?.toString() ?? "0"} pts</strong>
                  </div>
                ) : null}
                {phase === MarketPhase.resolved &&
                !position.isClaimed &&
                position.isWinner ? (
                  <div className="position-reward">
                    <span>{t("market.position.estimatedReward")}</span>
                    <strong>{position.reward?.toString() ?? "0"} pts</strong>
                  </div>
                ) : null}
                {phase === MarketPhase.resolved &&
                !position.isClaimed &&
                !position.isWinner ? (
                  <p className="position-status">
                    {t("market.position.notWinner")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="position-status">{t("market.position.noRecord")}</p>
            )}
          </section>
          <label htmlFor="stake">
            {t("market.slip.confidence")} <strong>{stake}</strong>
          </label>
          <input
            id="stake"
            type="range"
            min="10"
            max="500"
            step="10"
            value={stake}
            onChange={(event) => setStake(Number(event.target.value))}
            disabled={phase !== MarketPhase.open || committed}
          />
          <div className="range-ends">
            <span>{t("market.slip.careful")}</span>
            <span>{t("market.slip.allIn")}</span>
          </div>
          {phase === MarketPhase.open ? (
            <Button
              onClick={() => market.commit(team, BigInt(stake))}
              disabled={busy || committed}
            >
              {t("market.slip.commit")}
            </Button>
          ) : null}
          {phase === MarketPhase.reveal &&
          position?.hasPrivatePrediction &&
          !position.isRevealed ? (
            <Button onClick={market.reveal} disabled={busy}>
              {t("market.slip.reveal")}
            </Button>
          ) : null}
          {phase === MarketPhase.resolved && position?.canClaim ? (
            <Button onClick={market.claim} disabled={busy}>
              {t("market.slip.claim")}
            </Button>
          ) : null}
          <p className="ticket-foot">{t("market.slip.secretNote")}</p>
          {market.error ? (
            <p className="market-error" role="alert">
              {market.error}
            </p>
          ) : null}
        </aside>

        <section className="market-pulse">
          <div>
            <p className="kicker">{t("market.pulse.label")}</p>
            <h2 key={phase}>
              {phase === MarketPhase.open
                ? t("market.pulse.sealedTitle")
                : t("market.pulse.revealedTitle")}
            </h2>
            <p key={`pulse-${phase}`}>
              {phase === MarketPhase.open
                ? t("market.pulse.sealedDescription")
                : t("market.stats.revealed", {
                    revealed: market.ledger?.revealed_count.toString() ?? "0",
                    total: market.ledger?.participant_count.toString() ?? "0",
                  })}
            </p>
          </div>
          <div className="pulse-mark" aria-hidden="true">
            {phase === MarketPhase.open ? "✦" : `${revealedPool}`}
          </div>
        </section>

        {market.isAdmin ? (
          <section className="steward-desk">
            <p className="kicker">{t("market.admin.label")}</p>
            <h2>{t("market.admin.title")}</h2>
            <p>{t("market.admin.description")}</p>
            {phase < MarketPhase.awaiting_result ? (
              <Button onClick={market.advance} disabled={busy}>
                {phase === MarketPhase.open
                  ? t("market.admin.closePredictions")
                  : t("market.admin.closeReveal")}
              </Button>
            ) : null}
            {phase === MarketPhase.awaiting_result ? (
              <div className="winner-actions">
                {TEAM_KEYS.map((key) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => market.resolve(Team[key])}
                  >
                    {t(`market.teams.${key}.name`)}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
      <div
        className="transaction-status"
        aria-live="polite"
        data-visible={busy}
      >
        {busy
          ? t("market.status.working", {
              action: t(`market.status.${market.action}`),
            })
          : null}
      </div>
    </div>
  );
}

/** リビール後のオッズ % をカウントアップ表示する。 */
function OddsPercent({ percent }: { percent: number }) {
  const shown = useCountUp(percent);
  return <strong>{shown}%</strong>;
}
