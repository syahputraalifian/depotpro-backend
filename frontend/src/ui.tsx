import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from "react-native";
import Icon from "@react-native-vector-icons/ionicons";
import { makeStyles, useTheme } from "@/src/theme";

// ---------------- Toast ----------------
type ToastType = "success" | "error" | "info";
const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [msg, setMsg] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback((m: string, t: ToastType = "info") => {
    setMsg(m);
    setType(t);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [opacity]);

  const bg = type === "success" ? colors.success : type === "error" ? colors.error : colors.surfaceInverse;

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 60,
          left: 16,
          right: 16,
          opacity,
          backgroundColor: bg,
          padding: 14,
          borderRadius: 12,
          zIndex: 9999,
        }}
      >
        <Text testID="toast-message" style={{ color: "#fff", fontWeight: "500", textAlign: "center" }}>
          {msg}
        </Text>
      </Animated.View>
    </ToastCtx.Provider>
  );
}

// ---------------- Button ----------------
export function AppButton({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  testID?: string;
  style?: any;
}) {
  const { colors } = useTheme();
  const bg =
    variant === "primary" ? colors.brandPrimary :
    variant === "danger" ? colors.error :
    variant === "secondary" ? colors.surfaceTertiary : "transparent";
  const fg =
    variant === "primary" || variant === "danger" ? "#fff" :
    colors.onSurface;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: colors.borderStrong,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          minHeight: 48,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon as any} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontWeight: "600", fontSize: 15 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// ---------------- Field ----------------
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  testID,
  autoCapitalize,
}: any) {
  const styles = useFieldStyles();
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        style={styles.input}
        value={value != null ? String(value) : ""}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize || "sentences"}
      />
    </View>
  );
}

const useFieldStyles = makeStyles((c) => ({
  label: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.onSurface,
  },
}));

// ---------------- Badge ----------------
export function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

// ---------------- Card ----------------
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const styles = useCardStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
}));

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      <Icon name={icon as any} size={56} color={colors.borderStrong} />
      <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700", marginTop: 14, textAlign: "center" }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6, textAlign: "center" }}>{subtitle}</Text> : null}
    </View>
  );
}

const _s = StyleSheet.create({});
