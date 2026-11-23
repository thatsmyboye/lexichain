// Native side of the web <-> app bridge.
//
// The web game (src/lib/nativeApp.ts in the web project) posts JSON messages
// through window.ReactNativeWebView.postMessage. Requests that carry an `id`
// get a reply dispatched back into the page as a "lexichain-native-reply"
// CustomEvent. Keep the message shapes here in sync with that file.
import { Linking, Share } from "react-native";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { File, Paths } from "expo-file-system";

export type HapticEvent = "select" | "info" | "valid" | "invalid" | "tierUp" | "gameOver";
export type ShareResult = "shared" | "cancelled" | "error";

export type WebMessage =
  | { type: "ready" }
  | { type: "route"; path: string }
  | { type: "theme"; dark: boolean; background: string }
  | { type: "haptic"; event: HapticEvent }
  | { type: "openExternal"; url: string }
  | { type: "share"; id: number; title?: string; text: string }
  | { type: "shareImage"; id: number; base64: string; filename: string; title?: string; text?: string };

export function parseWebMessage(data: string): WebMessage | null {
  try {
    const message = JSON.parse(data) as unknown;
    if (message && typeof message === "object" && typeof (message as { type?: unknown }).type === "string") {
      return message as WebMessage;
    }
  } catch {
    // Not one of ours (for example a library's own postMessage).
  }
  return null;
}

/** Script that delivers a reply to a request the page made with an id. */
export function replyScript(id: number, result: unknown): string {
  const detail = JSON.stringify({ id, result });
  return `window.dispatchEvent(new CustomEvent("lexichain-native-reply", { detail: ${detail} })); true;`;
}

export async function playHaptic(event: HapticEvent): Promise<void> {
  try {
    switch (event) {
      case "select":
        return await Haptics.selectionAsync();
      case "info":
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case "valid":
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case "invalid":
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case "tierUp":
        return await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case "gameOver":
        return await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {
    // No haptic engine on this device.
  }
}

export async function openExternal(url: string): Promise<void> {
  try {
    if (/^https?:\/\//i.test(url)) {
      await WebBrowser.openBrowserAsync(url);
    } else if (/^(mailto|tel|sms):/i.test(url)) {
      await Linking.openURL(url);
    }
    // Any other scheme is ignored rather than handed to the OS.
  } catch {
    // Nothing can open it; leave the player in the game.
  }
}

export async function shareText(title: string | undefined, text: string): Promise<ShareResult> {
  try {
    const result = await Share.share({ message: text, title }, { dialogTitle: title, subject: title });
    return result.action === Share.dismissedAction ? "cancelled" : "shared";
  } catch {
    return "error";
  }
}

export async function shareImage(base64: string, filename: string, title?: string): Promise<ShareResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return "error";
    const safeName = filename.replace(/[^\w.-]/g, "_").replace(/^\.+/, "") || "lexichain.png";
    const file = new File(Paths.cache, safeName.endsWith(".png") ? safeName : `${safeName}.png`);
    await file.write(base64, { encoding: "base64" });
    await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: title });
    return "shared";
  } catch {
    return "error";
  }
}
