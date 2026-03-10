// ═══════════════════════════════════════════════════════════════════════════════
// FILE: app/camera.tsx  (Check-In / Check-Out Screen)
//
// PURPOSE (用途):
//   Allows users to check in to a parking spot by entering their plate number,
//   and to check out from an active session.
//   让用户通过输入车牌号签入停车位，以及从当前会话签出。
//
// STEP FLOW — CHECK IN (签入步骤流程):
//   Step 1 "entry"    → User types plate number, taps "Verify Plate"
//                        (用户输入车牌，点击"验证车牌")
//   Step 2 "confirm"  → Shows verified plate details, user confirms
//                        (显示已验证的车牌详情，用户确认)
//   Step 3 "success"  → Success screen, auto-redirects to Map after 1.8s
//                        (成功画面，1.8秒后自动跳转到地图页)
//
// STEP FLOW — CHECK OUT (签出步骤流程):
//   (If active session exists, banner shows on entry screen)
//   (如果有活动会话，进入页面时显示横幅)
//   step "checkout_confirm" → Confirm checkout dialog
//                              (签出确认对话框)
//   step "checkout_success" → Goodbye screen, auto-redirect to Map
//                              (再见画面，自动跳转到地图页)
//
// PLATE VALIDATION (车牌验证):
//   Plate is matched against vehicles from ParkingContext (useParkingContext).
//   车牌与 ParkingContext 中的注册车辆列表进行匹配（useParkingContext）。
//   Spaces are stripped and both strings are uppercased before comparing.
//   比较前去掉空格并统一转为大写。
//
// PERSISTENCE (持久化):
//   Active check-in state is saved to AsyncStorage under key "mdis_active_checkin".
//   活动签入状态保存到 AsyncStorage 的 "mdis_active_checkin" Key 下。
//   This key is SEPARATE from ParkingContext's session — it's used for this
//   screen's local banner display only.
//   此 Key 与 ParkingContext 的 session 分开 — 仅供此页面的横幅展示使用。
//
// IMPORTS (引入):
//   - AsyncStorage              → local storage for active check-in (本地存储活动签入)
//   - useFocusEffect, useRouter → expo-router navigation (路由导航)
//   - useCallback, useRef,
//     useState                  → React hooks
//   - Animated, KeyboardAvoidingView,
//     Platform, ScrollView,
//     StyleSheet, Text,
//     TextInput, TouchableOpacity,
//     View                      → React Native components
//   - useParkingContext          → registered vehicles list (注册车辆列表)
//   - useTheme                   → current theme colors (当前主题颜色)
//
// EXPORTS (导出):
//   - default CameraScreen       → the check-in/out screen (签入/签出页面，默认导出)
// ═══════════════════════════════════════════════════════════════════════════════

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from "../utils/ParkingContext";
import { useTheme } from "../utils/ThemeContext";

// AsyncStorage key for the active check-in record (活动签入记录的存储 Key)
const CHECKIN_KEY = "mdis_active_checkin";

/** All possible step states for this screen (此页面所有可能的步骤状态) */
type Step = "entry" | "confirm" | "success" | "checkout_confirm" | "checkout_success";

/* 
   Shape of an active check-in record stored in AsyncStorage
   存储在 AsyncStorage 中的活动签入记录结构 
*/
interface ActiveCheckIn {
  plate: string;  // License plate (车牌)
  time:  string;  // Check-in time (签入时间)
  date:  string;  // Check-in date (签入日期)
}

/*
   CameraScreen — step-by-step check-in / check-out flow.
   步骤式签入/签出流程页面。
*/
export default function CameraScreen() {
  const { theme: T } = useTheme();
  const router       = useRouter();

  // Read registered vehicles from ParkingContext (从 ParkingContext 读取注册车辆)
  // This ensures camera screen and profile screen always see the same vehicles.
  // 确保 camera 页面和 profile 页面看到的是同一份车辆数据。
  const { vehicles } = useParkingContext();

  // ── Local state (本地状态) ─────────────────────────────────────────────────
  const [step,          setStep]   = useState<Step>("entry");          // Current step (当前步骤)
  const [plate,         setPlate]  = useState("");                     // Input value (输入框内容)
  const [matchedPlate,  setMatched]= useState("");                     // Verified plate (已验证的车牌)
  const [error,         setError]  = useState("");                     // Error message (错误提示)
  const [activeCheckIn, setActive] = useState<ActiveCheckIn | null>(null); // Existing session (已有会话)

  // ── Animation and timer refs (动画和定时器 Ref) ───────────────────────────
  const scaleAnim = useRef(new Animated.Value(1)).current; // Button press scale (按钮按下缩放)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null); // Auto-redirect timer (自动跳转定时器)

  // ── Load active check-in when screen comes into focus
  //    页面获得焦点时加载活动签入状态 ───────────────────────────────────────
  useFocusEffect(useCallback(() => {
    loadActiveCheckIn();
    // Cleanup: clear any pending redirect timer on blur (失焦时清除待执行的跳转定时器)
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []));

  // ── AsyncStorage helpers (AsyncStorage 辅助函数) ─────────────────────────

  /* Load the active check-in from storage (从存储中读取活动签入) */
  async function loadActiveCheckIn() {
    try {
      const raw = await AsyncStorage.getItem(CHECKIN_KEY);
      setActive(raw ? JSON.parse(raw) : null);
    } catch { setActive(null); }
  }

  /* Save active check-in to storage (将活动签入保存到存储) */
  async function saveActiveCheckIn(data: ActiveCheckIn) {
    try { await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify(data)); } catch {}
  }

  /* Remove active check-in from storage (从存储中删除活动签入) */
  async function clearActiveCheckIn() {
    try { await AsyncStorage.removeItem(CHECKIN_KEY); } catch {}
  }

  // ── Button press animation (按钮按压动画) ─────────────────────────────────
  function animatePress() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
  }

  // ── Step 1: Verify the entered plate (步骤1：验证输入的车牌) ─────────────
  function handleScan() {
    animatePress();
    const cleaned = plate.trim().toUpperCase();
    if (!cleaned) { setError("Please enter your plate number."); return; }

    // Strip spaces from both sides before comparing (比较前去除两边的空格)
    const match = vehicles.find(
      v => v.plate.toUpperCase().replace(/\s/g, "") === cleaned.replace(/\s/g, "")
    );
    if (!match) {
      setError(`"${cleaned}" is not registered under your account.\nPlease check or register in Profile.`);
      return;
    }
    // Plate verified — go to confirm step (车牌验证通过，进入确认步骤)
    setError(""); setMatched(match.plate); setStep("confirm");
  }

  // ── Step 2: Confirm and save check-in (步骤2：确认并保存签入) ────────────
  async function handleConfirm() {
    animatePress();
    const now = new Date();
    const data: ActiveCheckIn = {
      plate: matchedPlate,
      time:  now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
      date:  now.toLocaleDateString("en-MY",  { day: "numeric", month: "short", year: "numeric" }),
    };
    await saveActiveCheckIn(data); // Persist (持久化)
    setActive(data);
    setStep("success");
    // Auto-redirect to map after 1.8s (1.8秒后自动跳转到地图页)
    timerRef.current = setTimeout(() => router.push("/(tabs)/map" as any), 1800);
  }

  /** Reset to initial entry step (重置到初始输入步骤) */
  function handleReset() {
    setPlate(""); setMatched(""); setError(""); setStep("entry");
  }

  /** Begin check-out flow (开始签出流程) */
  function handleCheckOutPress() {
    animatePress(); setStep("checkout_confirm");
  }

  // ── Check-out confirm: clear session (签出确认：清除会话) ─────────────────
  async function handleCheckOutConfirm() {
    animatePress();
    await clearActiveCheckIn(); // Remove from AsyncStorage (从 AsyncStorage 删除)
    setActive(null);
    setStep("checkout_success");
    // Auto-redirect to map after 1.8s (1.8秒后自动跳转到地图页)
    timerRef.current = setTimeout(() => {
      setStep("entry");
      router.push("/(tabs)/map" as any);
    }, 1800);
  }

  // ── Step indicator index (步骤指示器索引) ─────────────────────────────────
  const stepIndex =
    step === "entry"            ? 0 :
    step === "confirm"          ? 1 :
    step === "success"          ? 2 :
    step === "checkout_confirm" ? 1 : 2;

  // ── Dynamic header and labels based on flow type (根据流程类型动态设置标题和标签) ─
  const isCheckOut  = step === "checkout_confirm" || step === "checkout_success";
  const headerTitle = isCheckOut ? "Check Out" : "Check In";
  const stepLabels  = isCheckOut
    ? ["Active Session", "Confirm", "Done"]
    : ["Enter Plate",    "Confirm", "Done"];

  // Quick-pick plates from registered vehicles (从注册车辆提取快捷选择车牌)
  const registeredPlates = vehicles.map(v => v.plate);

  // KeyboardAvoidingView pushes content up when keyboard appears
  // KeyboardAvoidingView 在键盘弹出时上移内容
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={[styles.screen, { backgroundColor: "transparent" }]}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header: back button + title + MDIS badge ──
            顶部：返回按钮 + 标题 + MDIS 徽章 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
            <Text style={[styles.backArrowText, { color: T.accent }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>{headerTitle}</Text>
          <View style={[styles.logoBadge, { backgroundColor: T.accent + "18", borderColor: T.accent + "44" }]}>
            <Text style={[styles.logoText, { color: T.accent }]}>MDIS</Text>
          </View>
        </View>

        {/* ── Active session banner (shown only on entry step when checked in)
            活动会话横幅（仅在 entry 步骤且已签入时显示） ── */}
        {activeCheckIn && step === "entry" && (
          <View style={[styles.activeBanner, { backgroundColor: T.green + "15", borderColor: T.green + "44" }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeBannerTitle, { color: T.green }]}>🟢  Currently Checked In</Text>
              <Text style={[styles.activeBannerSub, { color: T.muted }]}>
                {activeCheckIn.plate}  ·  {activeCheckIn.time}  ·  {activeCheckIn.date}
              </Text>
            </View>
            {/* Check Out button in the banner (横幅内的签出按钮) */}
            <TouchableOpacity
              style={[styles.checkOutBtn, { backgroundColor: T.red }]}
              onPress={handleCheckOutPress}
              activeOpacity={0.85}
            >
              <Text style={styles.checkOutBtnText}>Check Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step indicator dots (步骤指示器圆点) ── */}
        <View style={styles.stepRow}>
          {stepLabels.map((s, i) => {
            const active = i === stepIndex, done = i < stepIndex;
            return (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, { backgroundColor: T.border },
                  done   && { backgroundColor: T.green },
                  active && { backgroundColor: isCheckOut ? T.red : T.accent },
                ]}>
                  <Text style={styles.stepDotText}>{done ? "✓" : i + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: T.muted }, (active || done) && { color: T.text }]}>{s}</Text>
                {/* Connecting line between dots (圆点之间的连接线) */}
                {i < 2 && <View style={[styles.stepLine, { backgroundColor: T.border }, done && { backgroundColor: T.green }]} />}
              </View>
            );
          })}
        </View>

        {/* ══════════════════════ STEP 1 — Entry ══════════════════════
            步骤1：输入车牌 */}
        {step === "entry" && (
          <View style={styles.body}>
            {/* Malaysian plate preview card (马来西亚车牌预览卡) */}
            <View style={[styles.plateIconCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                {/* Show typed plate or placeholder dashes (显示输入的车牌或占位虚线) */}
                <Text style={styles.plateFrameText}>{plate.trim().toUpperCase() || "_ _ _ _ _ _ _"}</Text>
              </View>
              <Text style={[styles.plateIconSub, { color: T.muted }]}>Malaysian vehicle plate preview</Text>
            </View>

            {/* Plate number text input (车牌号输入框) */}
            <Text style={[styles.inputLabel, { color: T.muted }]}>Enter Your Plate Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: T.card, borderColor: error ? T.red : T.border, color: T.text }]}
              value={plate}
              onChangeText={t => { setPlate(t); setError(""); }}
              placeholder="e.g. JHR 1234"
              placeholderTextColor={T.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />
            {/* Error message (错误提示) */}
            {error ? <Text style={[styles.errorText, { color: T.red }]}>{error}</Text> : null}

            {/* Quick-pick buttons for registered plates (已注册车牌的快捷选择按钮) */}
            <Text style={[styles.quickPickLabel, { color: T.muted }]}>Your Registered Vehicles</Text>
            <View style={styles.quickPickRow}>
              {registeredPlates.length === 0
                ? <Text style={{ color: T.muted, fontSize: 12 }}>No vehicles registered. Go to Profile to add one.</Text>
                : registeredPlates.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.quickPickBtn, { backgroundColor: T.card, borderColor: T.accent + "44" }]}
                    onPress={() => { setPlate(p); setError(""); }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.quickPickIcon}>🚗</Text>
                    <Text style={[styles.quickPickText, { color: T.accent }]}>{p}</Text>
                  </TouchableOpacity>
                ))
              }
            </View>

            {/* Verify plate button with press animation (带按压动画的验证按钮) */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: T.accent }]}
                onPress={handleScan}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>🔍  Verify Plate</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* ══════════════════════ STEP 2 — Confirm Check-In ══════════════════════
            步骤2：确认签入 */}
        {step === "confirm" && (
          <View style={styles.body}>
            <View style={[styles.confirmCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <Text style={styles.confirmIcon}>🅿️</Text>
              <Text style={[styles.confirmTitle, { color: T.text }]}>Plate Verified</Text>
              {/* Plate display (车牌展示) */}
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{matchedPlate}</Text>
              </View>
              {/* Details list (详情列表) */}
              <View style={[styles.confirmDetails, { backgroundColor: T.bg }]}>
                {[
                  ["Status",   "✅ Registered Vehicle"],
                  ["Pass",     "✅ Annual Fee Paid"],
                  ["Check In", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
                  ["Date",     new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                    <Text style={[styles.detailVal, { color: T.text }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            {/* Confirm button (确认按钮) */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: T.accent }]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>✅  Confirm Check-In</Text>
              </TouchableOpacity>
            </Animated.View>
            {/* Back button (返回按钮) */}
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: T.card, borderColor: T.border }]}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: T.text }]}>← Enter Different Plate</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════ STEP 3 — Check-In Success ══════════════════════
            步骤3：签入成功 */}
        {step === "success" && (
          <View style={[styles.body, styles.successBody]}>
            <View style={[styles.successCircle, { backgroundColor: T.green + "20", borderColor: T.green + "55" }]}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={[styles.successTitle, { color: T.text }]}>Checked In!</Text>
            <Text style={[styles.successSub, { color: T.muted }]}>
              {matchedPlate} has been recorded.{"\n"}Redirecting to parking map...
            </Text>
            <View style={styles.plateFrame}>
              <Text style={styles.plateFrameCountry}>MYS</Text>
              <Text style={styles.plateFrameText}>{matchedPlate}</Text>
            </View>
          </View>
        )}

        {/* ══════════════════════ CHECK OUT — Confirm ══════════════════════
            签出确认步骤 */}
        {step === "checkout_confirm" && activeCheckIn && (
          <View style={styles.body}>
            <View style={[styles.confirmCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <Text style={styles.confirmIcon}>🚗</Text>
              <Text style={[styles.confirmTitle, { color: T.text }]}>Confirm Check-Out</Text>
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{activeCheckIn.plate}</Text>
              </View>
              <View style={[styles.confirmDetails, { backgroundColor: T.bg }]}>
                {[
                  ["Plate",      activeCheckIn.plate],
                  ["Checked In", activeCheckIn.time],
                  ["Date",       activeCheckIn.date],
                  ["Check Out",  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                    <Text style={[styles.detailVal, { color: T.text }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            {/* Confirm checkout in red (红色确认签出按钮) */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: T.red }]}
                onPress={handleCheckOutConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>🚗  Confirm Check-Out</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: T.card, borderColor: T.border }]}
              onPress={() => setStep("entry")}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: T.text }]}>← Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════ CHECK OUT — Success ══════════════════════
            签出成功步骤 */}
        {step === "checkout_success" && (
          <View style={[styles.body, styles.successBody]}>
            <View style={[styles.successCircle, { backgroundColor: T.red + "20", borderColor: T.red + "55" }]}>
              <Text style={styles.successEmoji}>👋</Text>
            </View>
            <Text style={[styles.successTitle, { color: T.text }]}>Checked Out!</Text>
            <Text style={[styles.successSub, { color: T.muted }]}>
              {activeCheckIn?.plate ?? ""} has been released.{"\n"}Drive safely!
            </Text>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 60, backgroundColor: "transparent" },

  // Header (顶部导航栏)
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backArrow:     { padding: 4 },
  backArrowText: { fontSize: 16, fontWeight: "600" },
  headerTitle:   { fontSize: 18, fontWeight: "800" },
  logoBadge:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  logoText:      { fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },

  // Active banner (活动会话横幅)
  activeBanner:      { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  activeBannerTitle: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  activeBannerSub:   { fontSize: 12 },
  checkOutBtn:       { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  checkOutBtnText:   { color: "white", fontWeight: "800", fontSize: 13 },

  // Step indicator (步骤指示器)
  stepRow:    { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 32 },
  stepItem:   { alignItems: "center", flexDirection: "row", gap: 6 },
  stepDot:    { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  stepDotText:{ color: "white", fontSize: 11, fontWeight: "800" },
  stepLabel:  { fontSize: 11, fontWeight: "600" },
  stepLine:   { width: 24, height: 2, marginHorizontal: 4 },

  // Body (主体区域)
  body:          { flex: 1 },
  plateIconCard: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 24 },

  // Malaysian license plate frame (马来西亚车牌样式框)
  plateFrame:        { backgroundColor: "#FFF8DC", borderWidth: 3, borderColor: "#1a1a1a", borderRadius: 10, 
    paddingHorizontal: 24, paddingVertical: 10, alignItems: "center", minWidth: 200, marginBottom: 8 },
  plateFrameCountry: { color: "#003399", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 2 },
  plateFrameText:    { color: "#1a1a1a", fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  plateIconSub:      { fontSize: 11 },

  // Input (输入框)
  inputLabel:    { fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  input:         { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 20, fontWeight: "800", letterSpacing: 3, 
    marginBottom: 8, textAlign: "center" },
  errorText:     { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  quickPickLabel:{ fontSize: 11, letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  quickPickRow:  { flexDirection: "row", gap: 10, marginBottom: 24, flexWrap: "wrap" },
  quickPickBtn:  { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 4, minWidth: 100 },
  quickPickIcon: { fontSize: 18 },
  quickPickText: { fontWeight: "700", fontSize: 13 },

  // Buttons (按钮)
  primaryBtn:    { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  primaryBtnText:{ color: "white", fontWeight: "800", fontSize: 16 },
  secondaryBtn:  { borderWidth: 1, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText:{ fontWeight: "600", fontSize: 14 },

  // Confirm card (确认卡片)
  confirmCard:    { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 20 },
  confirmIcon:    { fontSize: 40, marginBottom: 10 },
  confirmTitle:   { fontSize: 20, fontWeight: "800", marginBottom: 20 },
  confirmDetails: { borderRadius: 14, padding: 16, width: "100%", gap: 12, marginTop: 16 },
  detailRow:      { flexDirection: "row", justifyContent: "space-between" },
  detailKey:      { fontSize: 13 },
  detailVal:      { fontWeight: "700", fontSize: 13 },

  // Success screen (成功画面)
  successBody:   { alignItems: "center", paddingTop: 40 },
  successCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: "center", 
    alignItems: "center", marginBottom: 20 },
  successEmoji:  { fontSize: 48 },
  successTitle:  { fontSize: 28, fontWeight: "900", marginBottom: 12 },
  successSub:    { fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24 },
});