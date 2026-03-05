import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { loadPlates } from '../utils/storage';

// ─── Colours ──────────────────────────────────────────────────────────
const C = {
  bg:     "#060D1F",
  card:   "#0D1B38",
  border: "#1A2F5A",
  accent: "#1E90FF",
  green:  "#22C55E",
  red:    "#EF4444",
  orange: "#F97316",
  text:   "#E8F0FF",
  muted:  "#6B7FA8",
};

// 空的，留着不用


type Step = "entry" | "confirm" | "success";

export default function CameraScreen() {
  const router = useRouter();

  const [step, setStep]         = useState<Step>("entry");
  const [plate, setPlate]       = useState("");
  const [matchedPlate, setMatched] = useState("");
  const [error, setError]       = useState("");
  const [registeredPlates, setRegisteredPlates] = useState<string[]>([]);

useFocusEffect(
  useCallback(() => {
    loadPlates().then(setRegisteredPlates);
  }, [])
);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  function animatePress() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
  }

  // ── Step 1: Validate plate ─────────────────────────────────────────
  function handleScan() {
    animatePress();
    const cleaned = plate.trim().toUpperCase();

    if (!cleaned) {
      setError("Please enter your plate number.");
      return;
    }

    // Check against registered vehicles
    const match = registeredPlates.find(p => p.toUpperCase() === cleaned);

    if (!match) {
      setError(`"${cleaned}" is not registered under your account.\nPlease check your plate or register it in Profile.`);
      return;
    }

    setError("");
    setMatched(match);
    setStep("confirm");
  }

  // ── Step 2: Confirm check-in ───────────────────────────────────────
  function handleConfirm() {
    animatePress();
    setStep("success");
    setTimeout(() => {
      router.push("/(tabs)/map" as any);
    }, 1800);
  }

  // ── Reset ──────────────────────────────────────────────────────────
  function handleReset() {
    setPlate("");
    setMatched("");
    setError("");
    setStep("entry");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
            <Text style={styles.backArrowText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check In</Text>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>MDIS</Text>
          </View>
        </View>

        {/* ── Step Indicator ── */}
        <View style={styles.stepRow}>
          {["Enter Plate", "Confirm", "Done"].map((s, i) => {
            const stepIndex = step === "entry" ? 0 : step === "confirm" ? 1 : 2;
            const active    = i === stepIndex;
            const done      = i < stepIndex;
            return (
              <View key={s} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  done   && { backgroundColor: C.green },
                  active && { backgroundColor: C.accent },
                ]}>
                  <Text style={styles.stepDotText}>{done ? "✓" : i + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, (active || done) && { color: C.text }]}>{s}</Text>
                {i < 2 && <View style={[styles.stepLine, done && { backgroundColor: C.green }]} />}
              </View>
            );
          })}
        </View>

        {/* ══════════ STEP 1: ENTRY ══════════ */}
        {step === "entry" && (
          <View style={styles.body}>

            {/* Plate icon card */}
            <View style={styles.plateIconCard}>
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>
                  {plate.trim().toUpperCase() || "_ _ _ _ _ _ _"}
                </Text>
              </View>
              <Text style={styles.plateIconSub}>Malaysian vehicle plate preview</Text>
            </View>

            {/* Input */}
            <Text style={styles.inputLabel}>Enter Your Plate Number</Text>
            <TextInput
              style={[styles.input, error ? { borderColor: C.red } : {}]}
              value={plate}
              onChangeText={(t) => { setPlate(t); setError(""); }}
              placeholder="e.g. WXY 1234"
              placeholderTextColor={C.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Registered vehicles quick-pick */}
            <Text style={styles.quickPickLabel}>Your Registered Vehicles</Text>
            <View style={styles.quickPickRow}>
              {registeredPlates.map(p => (
                <TouchableOpacity
                  key={p}
                  style={styles.quickPickBtn}
                  onPress={() => { setPlate(p); setError(""); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.quickPickIcon}>🚗</Text>
                  <Text style={styles.quickPickText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleScan} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>🔍  Verify Plate</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* ══════════ STEP 2: CONFIRM ══════════ */}
        {step === "confirm" && (
          <View style={styles.body}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmIcon}>🅿️</Text>
              <Text style={styles.confirmTitle}>Plate Verified</Text>

              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{matchedPlate}</Text>
              </View>

              <View style={styles.confirmDetails}>
                {[
                  ["Status",     "✅ Registered Vehicle"],
                  ["Pass",       "✅ Annual Fee Paid"],
                  ["Check In",   new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
                  ["Date",       new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <Text style={styles.detailKey}>{k}</Text>
                    <Text style={styles.detailVal}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirm} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>✅  Confirm Check-In</Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>← Enter Different Plate</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════ STEP 3: SUCCESS ══════════ */}
        {step === "success" && (
          <View style={[styles.body, styles.successBody]}>
            <View style={styles.successCircle}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={styles.successTitle}>Checked In!</Text>
            <Text style={styles.successSub}>
              {matchedPlate} has been recorded.{"\n"}Redirecting to parking map...
            </Text>
            <View style={styles.successPlate}>
              <Text style={styles.successPlateText}>{matchedPlate}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 60 },

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 28,
  },
  backArrow:     { padding: 4 },
  backArrowText: { color: C.accent, fontSize: 16, fontWeight: "600" },
  headerTitle:   { color: C.text, fontSize: 18, fontWeight: "800" },
  logoBadge: {
    backgroundColor: "rgba(30,144,255,0.12)", borderWidth: 1,
    borderColor: "rgba(30,144,255,0.35)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  logoText: { color: C.accent, fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },

  // Step indicator
  stepRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", marginBottom: 32, gap: 0,
  },
  stepItem:  { alignItems: "center", flexDirection: "row", gap: 6 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.border,
    justifyContent: "center", alignItems: "center",
  },
  stepDotText:  { color: "white", fontSize: 11, fontWeight: "800" },
  stepLabel:    { color: C.muted, fontSize: 11, fontWeight: "600" },
  stepLine:     { width: 24, height: 2, backgroundColor: C.border, marginHorizontal: 4 },

  // Body
  body: { flex: 1 },

  // Plate frame
  plateIconCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 24,
  },
  plateFrame: {
    backgroundColor: "#FFF8DC", borderWidth: 3, borderColor: "#1a1a1a",
    borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10,
    alignItems: "center", minWidth: 200, marginBottom: 8,
  },
  plateFrameCountry: { color: "#003399", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 2 },
  plateFrameText:    { color: "#1a1a1a", fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  plateIconSub:      { color: C.muted, fontSize: 11 },

  // Input
  inputLabel: { color: C.muted, fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 16, color: C.text,
    fontSize: 20, fontWeight: "800", letterSpacing: 3,
    marginBottom: 8, textAlign: "center",
  },
  errorText: { color: C.red, fontSize: 12, marginBottom: 12, lineHeight: 18 },

  // Quick pick
  quickPickLabel: { color: C.muted, fontSize: 11, letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  quickPickRow:   { flexDirection: "row", gap: 10, marginBottom: 24 },
  quickPickBtn: {
    flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.accent + "44",
    borderRadius: 12, padding: 12, alignItems: "center", gap: 4,
  },
  quickPickIcon: { fontSize: 18 },
  quickPickText: { color: C.accent, fontWeight: "700", fontSize: 13 },

  // Buttons
  primaryBtn: {
    backgroundColor: C.accent, borderRadius: 16,
    paddingVertical: 16, alignItems: "center", marginBottom: 12,
  },
  primaryBtnText: { color: "white", fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingVertical: 14, alignItems: "center",
  },
  secondaryBtnText: { color: C.text, fontWeight: "600", fontSize: 14 },

  // Confirm step
  confirmCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 20,
  },
  confirmIcon:  { fontSize: 40, marginBottom: 10 },
  confirmTitle: { color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 20 },
  confirmDetails: {
    backgroundColor: C.bg, borderRadius: 14, padding: 16,
    width: "100%", gap: 12, marginTop: 16,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailKey: { color: C.muted, fontSize: 13 },
  detailVal: { color: C.text, fontWeight: "700", fontSize: 13 },

  // Success step
  successBody: { alignItems: "center", paddingTop: 40 },
  successCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.green + "20", borderWidth: 2, borderColor: C.green + "55",
    justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  successEmoji:     { fontSize: 48 },
  successTitle:     { color: C.text, fontSize: 28, fontWeight: "900", marginBottom: 12 },
  successSub:       { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  successPlate: {
    backgroundColor: "#FFF8DC", borderWidth: 3, borderColor: "#1a1a1a",
    borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12,
  },
  successPlateText: { color: "#1a1a1a", fontSize: 28, fontWeight: "900", letterSpacing: 4 },
});