const en = {
  error: {
    walletNotFound:
      "Midnight Lace Wallet not found. Please install the extension.",
    versionMismatch:
      "Lace Wallet version ({{version}}) is outdated. Please update to the latest version.",
    networkMismatch:
      "Network mismatch. Please select {{network}} in Lace Settings.",
    userRejected: "Wallet connection was cancelled.",
    walletTimeout:
      "Connection timed out. Please unlock Lace Wallet and try again.",
    walletSyncing:
      "Lace Wallet is still syncing with the network. Please open the Lace extension, wait for sync to finish, then try again.",
    walletUnavailable:
      "Lace has not finished starting its Midnight wallet. Open the Lace extension, make sure it is unlocked and a Midnight account exists for the selected network, wait for sync to finish, then try again.",
    unsupportedApi:
      "Unsupported Lace Wallet API: neither connect() nor enable() found.",
    connectGeneric: "An error occurred during connection. Please try again.",
    useWalletOutsideProvider: "useWallet must be used inside WalletProvider",
    connectFailed: "Connection failed. Please retry with the button above.",
    balanceFailed: "Failed to retrieve balance",
  },
  label: {
    connected: "Connected",
    shieldedAddress: "Shielded Address",
    balance: "Balance",
    refresh: "Refresh",
    disconnect: "Disconnect",
    loadingBalance: "Fetching balance...",
    shielded: "Shielded",
    unshielded: "Unshielded",
    dust: "Dust",
    selectNetwork: "Select Network",
  },
  aria: {
    copyAddress: "Copy address",
    refreshBalance: "Refresh balance",
    midnightLogo: "Midnight",
  },
  button: {
    connect: "Connect Lace Wallet",
    connecting: "Connecting...",
    disconnect: "Disconnect",
  },
  app: {
    subtitle:
      "Connect Lace to seal a private Lantern Cup forecast on Midnight.",
  },
  toast: {
    copySuccess: "Address copied to clipboard",
  },
  market: {
    season: "MIDNIGHT COMMUNITY LEAGUE · SEASON 01",
    hero: {
      line1: "Who lifts the",
      cup: "Lantern Cup?",
      description:
        "Seal your forecast before the crowd is revealed. Your team stays private until the prediction window closes.",
    },
    privacy: {
      title: "Private by design",
      description:
        "Your browser keeps the team and salt. Midnight records only a commitment and public points.",
    },
    join: {
      aria: "Join prediction market",
      contract: "Market contract",
      placeholder: "Paste a contract address",
      enter: "Enter this market",
      create: "or create a new market as steward →",
    },
    brand: "HIDDEN LEAGUE FORECAST",
    title: { cup: "Lantern Cup", finalFour: "Final Four" },
    phase: {
      label: "LIVE PHASE",
      open: "Predictions open",
      reveal: "Reveal window",
      awaiting: "Awaiting result",
      resolved: "Market resolved",
    },
    teams: {
      heading: "THE CONTENDERS",
      prompt1: "Choose with your heart.",
      prompt2: "Prove it in private.",
      club: "{{place}} Football Club",
      sealed: "SEALED",
      pointsShort: "{{points}} pts",
      amber_foxes: { name: "Amber Foxes", place: "Solvale" },
      cedar_owls: { name: "Cedar Owls", place: "Northwood" },
      harbor_whales: { name: "Harbor Whales", place: "Bluehaven" },
      meadow_bears: { name: "Meadow Bears", place: "Greenbank" },
    },
    stats: {
      forecasts: "{{count}} sealed forecasts",
      pool: "{{points}} points in the pool",
      revealed: "{{revealed}} of {{total}} forecasts revealed.",
    },
    slip: {
      label: "YOUR FORECAST · ADMIT ONE",
      champion: "Champion pick",
      confidence: "Confidence points",
      careful: "10 · careful",
      allIn: "500 · all in",
      commit: "Seal my forecast",
      reveal: "Reveal my forecast",
      claim: "Claim forecast points",
      stamped: "Forecast sealed",
      secretNote:
        "The team and random salt remain in this browser profile until reveal. Keep this device and profile safe.",
    },
    position: {
      label: "YOUR POSITION",
      forecast: "Forecast",
      stake: "Points staked",
      sealed: "Forecast sealed · waiting for predictions to close",
      awaitingReveal: "Reveal your forecast before the window closes",
      revealed: "Forecast revealed · awaiting the match result",
      estimatedReward: "Estimated reward",
      claimed: "Reward claimed",
      notWinner: "This forecast did not win",
      unavailable:
        "This browser's private forecast does not match the on-chain position.",
      noRecord: "No personal forecast is stored in this browser profile.",
    },
    pulse: {
      label: "MARKET PULSE",
      sealedTitle: "The envelopes are still sealed.",
      revealedTitle: "The terraces are speaking.",
      sealedDescription:
        "Team-by-team sentiment stays hidden so every supporter makes an independent call.",
    },
    admin: {
      label: "STEWARD'S DESK",
      title: "Match control",
      description:
        "These actions are final and verified against the steward's private key.",
      closePredictions: "Close predictions",
      closeReveal: "Close reveal window",
    },
    status: {
      idle: "Zero-knowledge privacy active",
      working: "Midnight is {{action}}…",
      deploying: "deploying",
      joining: "joining",
      committing: "sealing your forecast",
      revealing: "revealing your forecast",
      admin: "updating the market",
      claiming: "claiming points",
    },
    errors: {
      transaction:
        "The transaction could not finish. Check Lace and the current market phase, then try again.",
      subscription: "The latest market state could not be loaded.",
      privateMissing:
        "The private prediction is missing from this browser profile. Return to the same device and profile used to commit.",
    },
  },
} as const;

export default en;
