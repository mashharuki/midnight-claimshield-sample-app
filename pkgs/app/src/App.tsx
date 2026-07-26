import { PolicyWorkspace } from "./components/ClaimShield/PolicyWorkspace";

/** The browser entry point for the complete ClaimShield workflow. */
export const CLAIMSHIELD_ROUTE = "/";

export function ClaimShieldRoute() {
  return <PolicyWorkspace />;
}

function App() {
  return <ClaimShieldRoute />;
}

export default App;
