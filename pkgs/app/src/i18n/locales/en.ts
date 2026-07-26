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
  app: { subtitle: "Connect Lace Wallet to use ClaimShield on Midnight." },
  claimShield: {
    workspace: {
      eyebrow: "Midnight privacy demo",
      subtitle: "Manage private claims without publishing claim details.",
      walletConnected: "Wallet connected",
      walletRequired: "Wallet required",
      administratorSetup: "Administrator setup",
      publicView: "Public view",
    },
    navigation: {
      ariaLabel: "ClaimShield workflow navigation",
      policy: "Public policy",
      claim: "Private claim",
      review: "Review",
      redeem: "Redeem",
    },
    review: {
      eyebrow: "Administrator review",
      ariaLabel: "Administrator closure and review",
      title: "Close intake and record reviews",
      description:
        "Only the policy administrator can record intake status and submitted claim status.",
      materialsTitle: "Review supporting material outside the dApp.",
      materialsBody:
        "This screen shows only a pseudonymous claimant ID and public status. It never shows amounts, merchants, receipts, wallet addresses, or secrets.",
      reasonBody:
        "A rejection reason is not sent to or stored by ClaimShield. Keep and communicate it through your organisation's secure off-dApp process.",
      intakeTitle: "New claim intake",
      intakeBody:
        "After intake closes, submitted claims can still be reviewed and approved claims can still be redeemed.",
      close: "Close intake and record",
      closed: "Intake closed",
      claimsTitle: "Review public claims",
      claimCount_one: "{{count}} public claim",
      claimCount_other: "{{count}} public claims",
      empty: "There are no public claims to review yet.",
      publicStatus: "Public status: {{status}}",
      pending: "Pending review",
      decided: "Decided",
      approve: "Record approval",
      rejectionReason: "Rejection reason kept outside the dApp",
      rejectionPlaceholder: "Enter a reason before recording rejection",
      reject: "Record rejection",
      reasonRequired: "Enter a reason before a rejection can start.",
      decidedBody: "A decided claim cannot be approved or rejected again.",
      walletRequired: "Administrator actions require a Lace Wallet connection.",
      connectWallet: "Connect Lace Wallet",
      statusSubmitted: "Not decided",
      statusApproved: "Approved",
      statusRejected: "Rejected",
      statusRedeemed: "Redeemed",
      statusNone: "No claim",
      errorBusiness:
        "The public state may have changed. Refresh the policy and claim status.",
      errorWallet:
        "Check the Lace Wallet connection or signature, then try again.",
      errorUnknown:
        "The administrator action could not be recorded. You can retry safely without revealing private review data.",
    },
    redeem: {
      eyebrow: "Applicant redemption",
      ariaLabel: "Applicant redemption",
      title: "Redeem an entitlement once",
      description:
        "Redemption records eligibility for a fixed benefit. It does not transfer an asset or make a payment.",
      deviceClaim: "This device's claim status",
      payloadAvailable: " ・ Private payload is available in this browser.",
      payloadUnavailable: " ・ Private payload is unavailable.",
      readyTitle: "This approved claim can be redeemed.",
      readyBody:
        "This action uses the existing private payload as a witness. It does not re-enter or display the amount, merchant, receipt, or salt.",
      redeem: "Record entitlement as redeemed",
      unavailable:
        "Only an approved claim with its matching private payload on this device can be redeemed.",
      recovery:
        "This browser cannot use the private payload. Redemption is unavailable until it is restored from a backup.",
      succeeded:
        "The redeemed entitlement record was confirmed. It does not transfer an asset or make a payment.",
      walletRequired: "Redemption requires a Lace Wallet connection.",
      connectWallet: "Connect Lace Wallet",
      statusSubmitted: "Pending review",
      statusApproved: "Approved",
      statusRejected: "Rejected",
      statusRedeemed: "Redeemed",
      statusNone: "No claim",
      errorPrivate:
        "This browser cannot use the private payload. Restore it from a backup before trying again.",
      errorBusiness: "This claim is not redeemable. Check its public status.",
      errorWallet:
        "Check the Lace Wallet connection or signature, then try again.",
      errorUnknown:
        "The entitlement record could not be completed. You can retry safely without revealing secrets.",
    },
    claim: {
      eyebrow: "Private claim",
      ariaLabel: "Private claim",
      title: "Create a private claim",
      description:
        "Input values never appear in the public UI or public ledger.",
      beforeTitle: "Understand this before submitting",
      beforePublic:
        "The policy terms, pseudonymous ID, claim status, commitment, nullifier, counts, and totals are public. Amount, merchant, receipt identifier, and wallet address are not public.",
      beforePrivate:
        "This browser stores the amount, digests, and salt needed for redemption, not the original text. If the private payload is lost, restore a backup to inspect details or redeem.",
      deviceClaim: "This device's claim status",
      payloadAvailable: "Private payload is available in this browser.",
      payloadUnavailable: "Private payload is unavailable.",
      amountLabel: "Amount ({{minimum}}–{{maximum}})",
      amountPlaceholder: "Example: 720",
      merchantLabel: "Merchant (digested locally)",
      merchantPlaceholder: "Example: Sora Coffee",
      receiptLabel: "Random receipt identifier (digested locally)",
      receiptPlaceholder: "A random identifier of at least 32 bytes",
      receiptHelp:
        "Do not enter receipt images or common short numbers. Reuse the issued random identifier exactly to prevent duplicates within the same policy.",
      closed: "This policy is closed on-chain. New claims cannot be submitted.",
      submit: "Submit private claim",
      connectAndSubmit: "Connect to submit private claim",
      walletRequired:
        "A Lace Wallet connection is required to submit. Connect it, then start the private claim again.",
      connectWallet: "Connect Lace Wallet",
      recovery:
        "This browser cannot use the private payload. Restore the user's backup to inspect details or redeem.",
      privacyTitle: "Public visibility and limits after submission",
      privacyPseudonym:
        "The public claim identifier is a pseudonym that links actions within this policy. It does not guarantee complete anonymity, identity, or Sybil resistance.",
      privacyRetry:
        "If submission fails, input remains in this form and can be retried safely. Original form input is cleared after success.",
      statusSubmitted: "Submitted",
      statusApproved: "Approved",
      statusRejected: "Rejected",
      statusRedeemed: "Redeemed",
      statusNone: "Not submitted",
      errorRange: "Enter an amount from {{minimum}} to {{maximum}}.",
      errorMerchant: "Enter a merchant.",
      errorReceipt: "Check the random receipt identifier and try again.",
      errorDuplicate:
        "This receipt identifier has already been used in this policy.",
      errorClosed: "This policy is closed on-chain.",
      errorWallet:
        "Check Lace Wallet and the selected network, then try again.",
      errorUnknown:
        "The request could not be processed without displaying private input. You can retry safely.",
    },
    policy: {
      ariaLabel: "Public policy",
      publicPolicy: "Public policy",
      open: "On-chain: open",
      closed: "On-chain: closed",
      contractAddress: "Public policy contract address",
      intakePeriod: "Public intake period",
      amountRange: "Eligible amount (public terms)",
      fixedBenefit: "Fixed benefit",
      submittedCount: "Claims submitted",
      approvedCount: "Claims approved",
      plannedBenefitTotal: "Planned benefit total",
      advisorySuffix:
        "Actual eligibility is decided by the on-chain state above.",
      publicBoundary:
        "This view exposes only policy terms, status, counts, and totals. It never displays amounts, merchants, receipt contents, wallet addresses, or secrets.",
      readError:
        "Unable to load public state. Check the network and Lace Wallet connection, then try again.",
      createTitle: "Publish a new policy",
      createDescription:
        "Name, terms, and totals are public. Applicant details and wallet addresses are not public.",
      label: "Policy name",
      labelPlaceholder: "Example: Lunch support",
      category: "Category",
      categoryPlaceholder: "Example: Wellbeing",
      startAt: "Intake starts (device local time)",
      endAt: "Intake ends (device local time)",
      minimumAmount: "Minimum amount",
      maximumAmount: "Maximum amount",
      timingNote:
        "The intake period is public operational information. Device time is advisory; policy state decides on-chain eligibility.",
      create: "Publish and create policy",
      connectAndCreate: "Connect to create policy",
      walletRequired:
        "A Lace Wallet connection is required to continue. Connect it, then start the action again.",
      connectWallet: "Connect Lace Wallet",
      openTitle: "Open an existing policy",
      openDescription:
        "Enter the contract address shared by the administrator.",
      address: "Contract address",
      addressRequired: "Enter the public policy contract address.",
      show: "Show public policy",
      boundaryTitle: "Public boundary",
      boundaryPublic:
        "Public: policy terms, intake status, submitted and approved counts, planned benefit total.",
      boundaryPrivate:
        "Private: amount, merchant, receipt contents, secrets, and the real wallet address.",
      beforeStart: "The device time is before the displayed intake start.",
      afterEnd: "The device time is after the displayed intake end.",
      validation: {
        label: "Use 1–32 UTF-8 bytes for the name.",
        category: "Use 1–32 UTF-8 bytes for the category.",
        startRequired: "Enter the start date and time.",
        endRequired: "Enter the end date and time.",
        startBeforeEnd: "The start must be before the end.",
        endAfterStart: "The end must be after the start.",
        nonNegative: "Enter a non-negative integer.",
        minimum: "The minimum must not exceed the maximum.",
        maximum: "The maximum must not be below the minimum.",
        benefit: "The fixed benefit must be at least 1.",
      },
    },
    transaction: {
      preparing: "Preparing transaction.",
      proving: "Generating a proof without publishing private information.",
      awaitingSignature: "Confirm the signature in Lace Wallet.",
      submitting: "Submitting to the Midnight network.",
      confirming: "Checking the public policy in the Indexer.",
      succeeded: "Public policy confirmed.",
      failed:
        "The operation could not be completed. Check the input and connection, then retry.",
      submitConfirming: "Checking the public claim status in the Indexer.",
      submitSucceeded:
        "Private claim recorded. Details are not shown in the public view.",
      closeConfirming: "Checking the public intake closure in the Indexer.",
      closeSucceeded: "The closure of new claims was recorded.",
      reviewConfirming: "Checking the public review result in the Indexer.",
      reviewSucceeded:
        "Review result recorded. The rejection reason is not stored by ClaimShield.",
      redeemConfirming:
        "Checking the redeemed entitlement record in the Indexer.",
      redeemSucceeded:
        "One-time entitlement record completed. No asset is transferred.",
      retry: " You can retry safely.",
    },
  },
  toast: { copySuccess: "Address copied to clipboard" },
};

export default en;
