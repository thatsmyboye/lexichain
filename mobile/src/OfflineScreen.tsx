import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Shown when the game cannot be loaded: usually the first launch without a
 * connection, before the game has been cached for offline play.
 */
export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>Can't reach Lexichain</Text>
      <Text style={styles.body}>
        Check your connection and try again. After the first successful launch, the game also plays
        offline.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#7927EC",
  },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  body: { color: "#EDE4FD", fontSize: 16, lineHeight: 22, textAlign: "center", marginBottom: 28, maxWidth: 360 },
  button: { backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14, minWidth: 160 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: "#4C1D95", fontSize: 17, fontWeight: "700", textAlign: "center" },
});
