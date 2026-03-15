/*
app/camera.tsx — 签入/签出页面 / Check-In & Check-Out Screen

让用户通过输入车牌号签入停车位，以及从当前会话签出。
Allows users to check in by entering their plate number, and to check out.

签入步骤流程 / Check-in step flow:
 Step 1 "entry"   → 用户输入车牌，点击验证 / enter plate, tap Verify
 Step 2 "confirm" → 显示已验证车牌详情，用户确认 / show verified details, confirm
 Step 3 "success" → 成功画面，1.8秒后自动跳转地图页 / success, auto-redirect to Map

签出步骤流程 / Check-out step flow:
 "checkout_confirm" → 签出确认对话框 / confirm checkout
 "checkout_success" → 再见画面，自动跳转地图页 / goodbye screen, auto-redirect

车牌验证 / Plate validation:
 车牌与 ParkingContext 的注册车辆列表匹配，比较前统一去空格和大写。
 Plate matched against vehicles in ParkingContext, spaces stripped and uppercased.

持久化 / Persistence:
 活动签入状态保存到 AsyncStorage 的 "mdis_active_checkin" 下，仅供此页面横幅展示用。
 Active check-in saved to AsyncStorage under "mdis_active_checkin" for banner display only.
*/

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from "../utils/ParkingContext";
import { useTheme } from "../utils/ThemeContext";

// AsyncStorage Key，存储活动签入记录 / storage key for the active check-in record
const CHECKIN_KEY = "mdis_active_checkin";

/* 此页面所有可能的步骤状态 / all possible step states for this screen */
type Step = "entry" | "confirm" | "success" | "checkout_confirm" | "checkout_success";

/* 存储在 AsyncStorage 中的活动签入记录结构 / shape of a check-in record in AsyncStorage */
interface ActiveCheckIn {
  plate: string; // 车牌 / license plate
  time:  string; // 签入时间 / check-in time
  date:  string; // 签入日期 / check-in date
}

// ─── Helper: step index (步骤索引辅助函数) ────────────────────────────────────
/*
根据当前步骤返回步骤指示器索引（0/1/2）。
Returns the step indicator index for a given step value.
*/
function getStepIndex(step: Step): number {
  if (step === "entry") {
    return 0;
  }
  if (step === "confirm") {
    return 1;
  }
  if (step === "success") {
    return 2;
  }
  if (step === "checkout_confirm") {
    return 1;
  }
  return 2; // checkout_success
}

/*
CameraScreen — 步骤式签入/签出流程页面。
Step-by-step check-in / check-out flow screen.
*/
export default function CameraScreen() {
  const { theme: T } = useTheme();
  const router = useRouter();

  // 从 ParkingContext 读取注册车辆，确保与 profile 页面同步
  // Read registered vehicles from ParkingContext so this screen stays in sync with Profile
  const { vehicles } = useParkingContext();

  // 本地状态 / local state
  const [step, setStep]   = useState<Step>("entry"); // 当前步骤 / current step
  const [plate, setPlate]  = useState(""); // 输入框内容 / input value
  const [matchedPlate, setMatched]= useState(""); // 已验证车牌 / verified plate
  const [error, setError]  = useState(""); // 错误提示 / error message
  const [activeCheckIn,setActive] = useState<ActiveCheckIn | null>(null); // 已有会话 / existing session

  // 动画和定时器 Ref / animation and timer refs
  const scaleAnim = useRef(new Animated.Value(1)).current; // 按钮按压缩放 / button press scale
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 自动跳转定时器 / auto-redirect timer

  // 页面获得焦点时加载活动签入状态 / load active check-in when screen comes into focus
  useFocusEffect(useCallback(() => {
    loadActiveCheckIn();
    // 失焦时清除待执行的跳转定时器 / clear pending redirect timer on blur
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []));

  // ─── AsyncStorage 辅助函数 / AsyncStorage helpers ───────────────────────────

  /* 从存储中读取活动签入 / load the active check-in from storage */
  async function loadActiveCheckIn() {
    try {
      const raw = await AsyncStorage.getItem(CHECKIN_KEY);
      if (raw) {
        setActive(JSON.parse(raw));
      } else {
        setActive(null);
      }
    } catch {
      setActive(null);
    }
  }

  /* 将活动签入保存到存储 / save active check-in to storage */
  async function saveActiveCheckIn(data: ActiveCheckIn) {
    try {
      await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify(data));
    } catch {}
  }

  /* 从存储中删除活动签入 / remove active check-in from storage */
  async function clearActiveCheckIn() {
    try {
      await AsyncStorage.removeItem(CHECKIN_KEY);
    } catch {}
  }

  // ─── 按钮按压动画 / Button press animation ──────────────────────────────────
  function animatePress() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
  }

  // ─── 步骤处理函数 / Step handlers ────────────────────────────────────────────

  /* 步骤1：验证输入的车牌 / Step 1: verify the entered plate */
  function handleScan() {
    animatePress();
    const cleaned = plate.trim().toUpperCase();
    if (!cleaned) {
      setError("Please enter your plate number.");
      return;
    }

    // 比较前去除两边的空格 / strip spaces from both sides before comparing
    const match = vehicles.find(
      v => v.plate.toUpperCase().replace(/\s/g, "") === cleaned.replace(/\s/g, "")
    );
    if (!match) {
      setError(`"${cleaned}" is not registered under your account.\nPlease check or register in Profile.`);
      return;
    }
    // 车牌验证通过，进入确认步骤 / plate verified, go to confirm step
    setError("");
    setMatched(match.plate);
    setStep("confirm");
  }

  /* 步骤2：确认并保存签入 / Step 2: confirm and save check-in */
  async function handleConfirm() {
    animatePress();
    const now = new Date();
    const data: ActiveCheckIn = {
      plate: matchedPlate,
      time: now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
      date: now.toLocaleDateString("en-MY",  { day: "numeric", month: "short", year: "numeric" }),
    };
    await saveActiveCheckIn(data); // 持久化 / persist
    setActive(data);
    setStep("success");
    // 1.8秒后自动跳转到地图页 / auto-redirect to map after 1.8s
    timerRef.current = setTimeout(() => router.push("/(tabs)/map" as any), 1800);
  }

  /* 重置到初始输入步骤 / reset to initial entry step */
  function handleReset() {
    setPlate("");
    setMatched("");
    setError("");
    setStep("entry");
  }

  /* 开始签出流程 / begin check-out flow */
  function handleCheckOutPress() {
    animatePress();
    setStep("checkout_confirm");
  }

  /* 签出确认：清除会话 / check-out confirm: clear the session */
  async function handleCheckOutConfirm() {
    animatePress();
    await clearActiveCheckIn(); // 从 AsyncStorage 删除 / remove from AsyncStorage
    setActive(null);
    setStep("checkout_success");
    // 1.8秒后自动跳转到地图页 / auto-redirect to map after 1.8s
    timerRef.current = setTimeout(() => {
      setStep("entry");
      router.push("/(tabs)/map" as any);
    }, 1800);
  }

  // 派生显示值 / derived display values
  const stepIndex = getStepIndex(step);
  const isCheckOut = step === "checkout_confirm" || step === "checkout_success";
  // 根据是签出还是签入决定标题 / pick header title based on flow type
  let headerTitle = "Check In";
  if (isCheckOut) {
    headerTitle = "Check Out";
  }

  // 根据是签出还是签入决定步骤标签 / pick step labels based on flow type
  let stepLabels = ["Enter Plate", "Confirm", "Done"];
  if (isCheckOut) {
    stepLabels = ["Active Session", "Confirm", "Done"];
  }

  // 从注册车辆提取快捷选择车牌 / quick-pick plates from registered vehicles
  const registeredPlates = vehicles.map(v => v.plate);

  // KeyboardAvoidingView 在键盘弹出时上移内容 / pushes content up when keyboard appears
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        style={[styles.screen, { backgroundColor: "transparent" }]}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >

        {/* 顶部：返回按钮 + 标题 + ITKIA logo / Header: back button + title + logo */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
            <Text style={[styles.backArrowText, { color: T.accent }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>{headerTitle}</Text>
          <Image
            source={require("../assets/images/itkia.png")}
            style={{ width: 80, height: 40, resizeMode: "contain" }}
          />
        </View>

        {/* 活动会话横幅，仅在 entry 步骤且已签入时显示
            Active session banner — shown only on entry step when checked in */}
        {activeCheckIn && step === "entry" && (
          <View style={[styles.activeBanner, { backgroundColor: T.green + "15", borderColor: T.green + "44" }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeBannerTitle, { color: T.green }]}>🟢  Currently Checked In</Text>
              <Text style={[styles.activeBannerSub, { color: T.muted }]}>
                {activeCheckIn.plate}  ·  {activeCheckIn.time}  ·  {activeCheckIn.date}
              </Text>
            </View>
            {/* 横幅内的签出按钮 / Check Out button inside the banner */}
            <TouchableOpacity
              style={[styles.checkOutBtn, { backgroundColor: T.red }]}
              onPress={handleCheckOutPress}
              activeOpacity={0.85}
            >
              <Text style={styles.checkOutBtnText}>Check Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 步骤指示器圆点 / step indicator dots */}
        <View style={styles.stepRow}>
          {stepLabels.map((s, i) => {
            const active = i === stepIndex;
            const done = i < stepIndex;
            return (
              <View key={s} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  { backgroundColor: T.border },
                  done && { backgroundColor: T.green },
                  active && { backgroundColor: isCheckOut ? T.red : T.accent },
                ]}>
                  <Text style={styles.stepDotText}>{done ? "✓" : i + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: T.muted }, (active || done) && { color: T.text }]}>{s}</Text>
                {/* 圆点之间的连接线 / connecting line between dots */}
                {i < 2 && (
                  <View style={[styles.stepLine, { backgroundColor: T.border }, done && { backgroundColor: T.green }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* ─── 步骤1：输入车牌 / Step 1 — Entry ─────────────────────────────── */}
        {step === "entry" && (
          <View style={styles.body}>
            {/* 马来西亚车牌预览卡 / Malaysian plate preview card */}
            <View style={[styles.plateIconCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                {/* 显示输入的车牌或占位虚线 / show typed plate or placeholder dashes */}
                <Text style={styles.plateFrameText}>{plate.trim().toUpperCase() || "_ _ _ _ _ _ _"}</Text>
              </View>
              <Text style={[styles.plateIconSub, { color: T.muted }]}>Malaysian vehicle plate preview</Text>
            </View>

            {/* 车牌号输入框 / plate number text input */}
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
            {/* 错误提示 / error message */}
            {error ? <Text style={[styles.errorText, { color: T.red }]}>{error}</Text> : null}

            {/* 已注册车牌快捷选择 / quick-pick buttons for registered plates */}
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

            {/* 带按压动画的验证按钮 / verify plate button with press animation */}
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

        {/* ─── 步骤2：确认签入 / Step 2 — Confirm Check-In ──────────────────── */}
        {step === "confirm" && (
          <View style={styles.body}>
            <View style={[styles.confirmCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <Text style={styles.confirmIcon}>🅿️</Text>
              <Text style={[styles.confirmTitle, { color: T.text }]}>Plate Verified</Text>
              {/* 车牌展示 / plate display */}
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{matchedPlate}</Text>
              </View>
              {/* 详情列表 / details list */}
              <View style={[styles.confirmDetails, { backgroundColor: T.bg }]}>
                {[
                  ["Status", "✅ Registered Vehicle"],
                  ["Pass", "✅ Annual Fee Paid"],
                  ["Check In", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
                  ["Date", new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                    <Text style={[styles.detailVal, { color: T.text }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            {/* 确认按钮 / confirm button */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: T.accent }]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>✅  Confirm Check-In</Text>
              </TouchableOpacity>
            </Animated.View>
            {/* 返回按钮 / back button */}
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: T.card, borderColor: T.border }]}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: T.text }]}>← Enter Different Plate</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── 步骤3：签入成功 / Step 3 — Check-In Success ──────────────────── */}
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

        {/* ─── 签出确认步骤 / Check Out — Confirm ───────────────────────────── */}
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
                  ["Plate", activeCheckIn.plate],
                  ["Checked In", activeCheckIn.time],
                  ["Date", activeCheckIn.date],
                  ["Check Out", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                    <Text style={[styles.detailVal, { color: T.text }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            {/* 红色确认签出按钮 / confirm checkout in red */}
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

        {/* ─── 签出成功步骤 / Check Out — Success ────────────────────────────── */}
        {step === "checkout_success" && (
          <View style={[styles.body, styles.successBody]}>
            <View style={[styles.successCircle, { backgroundColor: T.red + "20", borderColor: T.red + "55" }]}>
              <Text style={styles.successEmoji}>👋</Text>
            </View>
            <Text style={[styles.successTitle, { color: T.text }]}>Checked Out!</Text>
            {/* 签出成功步骤 / Check Out — Success */}
            {/* activeCheckIn 此时应仍有值，但以防万一用空字符串兜底
                activeCheckIn should still have a value here, but we fall back to "" just in case */}
            <Text style={[styles.successSub, { color: T.muted }]}>
              {activeCheckIn ? activeCheckIn.plate : ""} has been released.{"\n"}Drive safely!
            </Text>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles (样式) ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 60, backgroundColor: "transparent" },

  // 顶部导航栏 / header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backArrow: { padding: 4 },
  backArrowText: { fontSize: 16, fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  logoBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  logoText: { fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },

  // 活动会话横幅 / active session banner
  activeBanner: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  activeBannerTitle: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  activeBannerSub: { fontSize: 12 },
  checkOutBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  checkOutBtnText: { color: "white", fontWeight: "800", fontSize: 13 },

  // 步骤指示器 / step indicator
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 32 },
  stepItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  stepDotText:{ color: "white", fontSize: 11, fontWeight: "800" },
  stepLabel: { fontSize: 11, fontWeight: "600" },
  stepLine: { width: 24, height: 2, marginHorizontal: 4 },

  // 主体区域 / body
  body: { flex: 1 },
  plateIconCard: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 24 },

  // 马来西亚车牌样式框 / Malaysian license plate frame
  plateFrame: { backgroundColor: "#FFF8DC", borderWidth: 3, borderColor: "#1a1a1a", borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10, alignItems: "center", minWidth: 200, marginBottom: 8 },
  plateFrameCountry: { color: "#003399", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 2 },
  plateFrameText: { color: "#1a1a1a", fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  plateIconSub: { fontSize: 11 },

  // 输入框 / input
  inputLabel: { fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 20, fontWeight: "800", letterSpacing: 3,
    marginBottom: 8, textAlign: "center" },
  errorText: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  quickPickLabel:{ fontSize: 11, letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  quickPickRow: { flexDirection: "row", gap: 10, marginBottom: 24, flexWrap: "wrap" },
  quickPickBtn: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", gap: 4, minWidth: 100 },
  quickPickIcon: { fontSize: 18 },
  quickPickText: { fontWeight: "700", fontSize: 13 },

  // 按钮 / buttons
  primaryBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  primaryBtnText: { color: "white", fontWeight: "800", fontSize: 16 },
  secondaryBtn: { borderWidth: 1, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText:{ fontWeight: "600", fontSize: 14 },

  // 确认卡片 / confirm card
  confirmCard: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 20 },
  confirmIcon: { fontSize: 40, marginBottom: 10 },
  confirmTitle: { fontSize: 20, fontWeight: "800", marginBottom: 20 },
  confirmDetails: { borderRadius: 14, padding: 16, width: "100%", gap: 12, marginTop: 16 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailKey: { fontSize: 13 },
  detailVal: { fontWeight: "700", fontSize: 13 },

  // 成功画面 / success screen
  successBody: { alignItems: "center", paddingTop: 40 },
  successCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: "center",
    alignItems: "center", marginBottom: 20 },
  successEmoji: { fontSize: 48 },
  successTitle: { fontSize: 28, fontWeight: "900", marginBottom: 12 },
  successSub: { fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24 },
});