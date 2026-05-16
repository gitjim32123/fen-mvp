import { Alert, Platform } from "react-native";

type ConfirmActionOptions = {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function confirmAction({
  title,
  message,
  confirmText,
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmActionOptions) {
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
    if (window.confirm(`${title}\n\n${message}`)) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: "cancel" },
    {
      text: confirmText,
      style: destructive ? "destructive" : "default",
      onPress: () => {
        void onConfirm();
      },
    },
  ]);
}
