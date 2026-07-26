import { AddressCard } from "./components/AddressCard";
import { ConnectSection } from "./components/ConnectSection";
import { LanguageToggle } from "./components/LanguageToggle";
import { useWallet } from "./contexts/useWallet";

function App() {
  const { state } = useWallet();

  return (
    <main className="min-h-screen">
      <LanguageToggle />
      {state.status === "connected" ? (
        <div className="flex min-h-screen items-center justify-center px-6 py-20">
          <AddressCard />
        </div>
      ) : (
        <ConnectSection />
      )}
    </main>
  );
}

export default App;
