import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, SIZES } from "../../constants/theme";

/**
 * Empty-state UI when a list/API load failed (HTTP / network).
 * Actions (OK / Retry) live in the error alert — do not duplicate buttons here.
 */
export default function ListLoadError({ message }) {
  return (
    <View style={styles.wrap}>
      <Ionicons
        name="cloud-offline-outline"
        size={40}
        color={COLORS.text.tertiary}
      />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.padding * 2,
    minHeight: 220,
  },
  message: {
    marginTop: SIZES.margin,
    color: COLORS.text.secondary,
    fontSize: SIZES.body3,
    textAlign: "center",
    lineHeight: 20,
  },
});
