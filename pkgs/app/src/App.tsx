import { ConnectSection } from "./components/ConnectSection";
import { LanguageToggle } from "./components/LanguageToggle";
import { PredictionMarketView } from "./components/PredictionMarket";
import { useWallet } from "./contexts/useWallet";

/**
 * アプリのルートコンポーネント。
 * ウォレットの接続状態に応じて表示を切り替える：
 * - connected → 予測市場
 * - それ以外  → 接続ボタン画面 (ConnectSection)
 */
function App() {
  const { state } = useWallet();

  return (
    <main className="min-h-screen">
      <LanguageToggle />
      {state.status === "connected" ? (
        <PredictionMarketView />
      ) : (
        <ConnectSection />
      )}
    </main>
  );
}

export default App;
