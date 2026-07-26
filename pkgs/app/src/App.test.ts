import "@/i18n";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { CLAIMSHIELD_ROUTE } from "./App";
import { NetworkContext } from "./contexts/networkContextDef";
import { WalletContext } from "./contexts/walletContextDef";
import i18n from "./i18n";

function renderApp(): string {
  return renderToStaticMarkup(
    createElement(
      NetworkContext.Provider,
      { value: { networkId: "preview", setNetworkId: vi.fn() } },
      createElement(
        WalletContext.Provider,
        {
          value: {
            state: { status: "disconnected" },
            connect: async () => undefined,
            disconnect: vi.fn(),
          },
        },
        createElement(App),
      ),
    ),
  );
}

describe("ClaimShield application entry route", () => {
  afterEach(async () => {
    await i18n.changeLanguage("ja");
  });

  it("renders the root ClaimShield route with localized workflow navigation", async () => {
    await i18n.changeLanguage("en");

    const markup = renderApp();

    expect(CLAIMSHIELD_ROUTE).toBe("/");
    expect(markup).toContain(
      "Manage private claims without publishing claim details.",
    );
    expect(markup).toContain('href="#policy"');
    expect(markup).toContain('href="#claim"');
    expect(markup).toContain('href="#review"');
    expect(markup).toContain('href="#redeem"');
  });
});
