import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GameScreen } from "./src/GameScreen";

// Keep the native splash up until the web game has painted its first screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <SafeAreaProvider>
      <GameScreen />
    </SafeAreaProvider>
  );
}
