// ═══════════════════════════════════════════════════════════════════════════════
// FILE: app/(tabs)/home.tsx  (Home Screen — Dashboard)
//
// PURPOSE (用途):
//   The main dashboard screen. Shows real-time parking availability,
//   stats, quick-action buttons, and recent activity.
//   主仪表盘页面。显示实时停车可用性、统计数据、快捷操作按钮和最近活动。
//
// KEY FEATURES (主要功能):
//   - Real-time clock + greeting (实时时钟 + 早中晚问候语)
//   - Campus location card with Google Maps navigation button
//     (校园位置卡片，含 Google Maps 导航按钮)
//   - Availability ring (animated number) showing free/total spots
//     (可用性环形图，带动画数字显示空位/总位数)
//   - Stats row: Free / Occupied / OKU / Total (统计行：空位/占用/OKU/总数)
//   - Quick action buttons: Map / Scan / History / Navigate
//     (快捷操作按钮：地图/扫描/历史/导航)
//   - Recent activity list from ParkingContext (最近活动列表，来自 ParkingContext)
//   - Fade + slide-up entrance animation (进场淡入+上滑动画)
//
// DATA SOURCE (数据来源):
//   All parking stats come from useParkingContext() — no local computation needed.
//   所有停车统计数据来自 useParkingContext()，无需本地计算。
//
// IMPORTS (引入):
//   - useRouter              → expo-router navigation (路由导航)
//   - useEffect, useRef,
//     useState               → React hooks
//   - Animated, Image,
//     Linking, ScrollView,
//     StyleSheet, Text,
//     TouchableOpacity,
//     View                   → React Native components
//   - useParkingContext      → parking stats and activity (停车统计和活动)
//   - useTheme               → current theme colors (当前主题颜色)
//
// EXPORTS (导出):
//   - default HomeScreen     → the home screen component (主页组件，默认导出)
// ═══════════════════════════════════════════════════════════════════════════════

import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert, Animated, Image, Linking, Modal,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── Campus GPS Coordinates (校园 GPS 坐标) ──────────────────────────────────
// Used for Google Maps navigation link (用于 Google Maps 导航链接)
const MDIS_LAT = 1.43364;
const MDIS_LNG = 103.615175;

// ─── Sub-components (子组件) ──────────────────────────────────────────────────

/*
   AnimatedNumber — smoothly counts up/down to a target value.
   动画数字 — 平滑地从当前值递增/递减到目标值。
  
   @param value  Target number to display (目标数值)
   @param style  Text style (文字样式)
*/
function AnimatedNumber({ value, style }: { value: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0); // Displayed integer (显示的整数)

  useEffect(() => {
    // Animate the internal value over 1.2 seconds (用1.2秒动画到目标值)
    Animated.timing(anim, { toValue: value, duration: 1200, useNativeDriver: false }).start();
    // Listen to animation progress and update the displayed integer
    // (监听动画进度，实时更新显示的整数)
    anim.addListener(({ value: v }) => setDisplay(Math.floor(v)));
    return () => anim.removeAllListeners(); // Cleanup listener (清理监听器)
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

/*
   AvailabilityRing — circular progress ring showing available spots.
   可用性环形图 — 显示空位数量的圆形进度环。
  
   Color logic (颜色逻辑):
     > 40% available → green (充足)
     > 20% available → orange (偏满)
     ≤ 20% available → red (几乎满)
  
   @param available  Number of free spots (空位数)
   @param total      Total spots (总位数)
   @param T          Theme object (主题对象)
*/
function AvailabilityRing({ available, total, T }: { available: number; total: number; T: any }) {
  const pct   = available / total; // Availability ratio (可用比例)
  const color = pct > 0.4 ? T.green : pct > 0.2 ? T.orange : T.red; // Status color (状态颜色)

  return (
    <View style={styles.ringWrap}>
      {/* Outer faint ring (外层淡色环) */}
      <View style={[styles.ringOuter, { borderColor: color + "33" }]}>
        {/* Inner solid ring (内层实色环) */}
        <View style={[styles.ringInner, { borderColor: color, backgroundColor: "transparent" }]}>
          {/* Animated availability number (动画空位数字) */}
          <AnimatedNumber value={available} style={[styles.ringNumber, { color }]} />
          <Text style={[styles.ringLabel, { color: T.muted }]}>available</Text>
        </View>
      </View>
      <Text style={[styles.ringTotal, { color: T.muted }]}>out of {total} spots</Text>
    </View>
  );
}

// ─── Security contacts (保安联系方式) ────────────────────────────────────────
// Update these numbers for production (生产环境请替换为真实号码)
const SECURITY_CONTACTS = [
  { name: "Main Security Post",   phone: "+607-000-0001" },
  { name: "Campus Control Room",  phone: "+607-000-0002" },
  { name: "Emergency Hotline",    phone: "+607-000-0003" },
];

// ─── Vehicle Registry (车辆注册表) ───────────────────────────────────────────
// Used by the Vehicle Lookup quick action.
// 供"车辆查询"快捷功能使用。
// Replace with real API / database in production. (生产环境请替换为真实 API / 数据库)
const VEHICLE_REGISTRY: Record<string, { name: string; phone: string }> = {
  "WXY 1234": { name: "Ahmad Faiz",   phone: "+60 12-345 6789" },
  "JHB 5678": { name: "Nurul Ain",    phone: "+60 11-234 5678" },
  "JDT 9012": { name: "Raj Kumar",    phone: "+60 16-789 0123" },
  "SGR 3456": { name: "Lee Mei Ling", phone: "+60 17-456 7890" },
};

// ─── Main Screen Component (主页面组件) ──────────────────────────────────────

/*
   HomeScreen — main dashboard with parking overview.
   主页面 — 停车概览仪表盘。
*/
export default function HomeScreen() {

  // ══════════════════════════════════════════════════════════════════════════
  // 1️⃣  CONTEXT & THEME (Context 数据 + 主题)
  // ══════════════════════════════════════════════════════════════════════════

  const { activity, freeCount, occCount, okuFree, totalNormal, okuTotal,
          spots, checkIn: ctxCheckIn, checkOut: ctxCheckOut,
          vehicles, activeSession } = useParkingContext();

  const { theme: T } = useTheme();
  const router       = useRouter();

  // Computed totals (计算汇总数值)
  const TOTAL_SPOTS     = totalNormal + okuTotal;  // All spots (全部车位)
  const AVAILABLE_SPOTS = freeCount + okuFree;     // Free normal + free OKU (空位总数)
  const OCCUPIED_SPOTS  = occCount;                // Occupied normal spots (普通占用数)

  // Status color + label based on availability % (根据可用比例决定状态颜色和标签)
  const pct         = Math.round((AVAILABLE_SPOTS / TOTAL_SPOTS) * 100);
  const statusColor = pct > 40 ? T.green : pct > 20 ? T.orange : T.red;
  const statusLabel = pct > 40 ? "Plenty of Space" : pct > 20 ? "Filling Up" : "Almost Full";

  // ══════════════════════════════════════════════════════════════════════════
  // 2️⃣  ALL STATE (所有状态声明，集中放这里)
  // ══════════════════════════════════════════════════════════════════════════

  // Entrance animation refs (进场动画的 Animated.Value)
  const fadeAnim  = useRef(new Animated.Value(0)).current;  // Opacity 0→1 (透明度)
  const slideAnim = useRef(new Animated.Value(30)).current; // Y offset 30→0 (垂直偏移)

  // Real-time clock (实时时钟)
  const [now, setNow] = useState(new Date());

  // 🚨 Quick Action 1 — Security Modal
  const [securityModal, setSecurityModal] = useState(false);

  // ✅ Quick Action 2 — Quick Check-In / Check-Out Modal
  const [checkInModal, setCheckInModal] = useState(false);
  const [spotInput,    setSpotInput]    = useState("");

  // 🔍 Quick Action 3 — Vehicle Lookup Modal
  const [lookupModal,  setLookupModal]  = useState(false);
  const [plateInput,   setPlateInput]   = useState("");
  const [lookupResult, setLookupResult] = useState<{ name: string; plate: string; phone: string } | null>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // 3️⃣  ALL EFFECTS (所有副作用，集中放这里)
  // ══════════════════════════════════════════════════════════════════════════

  // Real-time clock: tick every second (每秒更新时钟)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Entrance animation: fade + slide up on mount (进场动画：淡入+上滑)
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // 4️⃣  ALL HANDLERS (所有处理函数，集中放这里)
  // ══════════════════════════════════════════════════════════════════════════

  // Derived time values (从 now 派生的时间值)
  const hour     = now.getHours();
  const timeStr  = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const greeting = hour < 12 ? "Good Morning 🌅" : hour < 18 ? "Good Afternoon ☀️" : "Good Evening 🌙";

  /*
     Open Google Maps with directions to MDIS campus.
     打开 Google Maps 导航到 MDIS 校园。
  */
  function openMapsToMDIS() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${MDIS_LAT},${MDIS_LNG}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`geo:${MDIS_LAT},${MDIS_LNG}?q=MDIS+Malaysia+EduCity+Iskandar+Puteri+Johor`)
    );
  }

  /*
     🚨 Quick Action 1 — Security modal handler.
     (保安弹窗由 setSecurityModal(true) 直接开启，无需额外 handler)
  */

  /*
     ✅ Quick Action 2 — Toggle between check-in modal and checkout alert.
     判断当前是否有活动会话：有 → 弹出签出确认；无 → 打开签入弹窗。
  */
  function handleCheckInOutPress() {
    if (activeSession) {
      // Already parked → confirm checkout (已停车 → 确认签出)
      Alert.alert(
        "🚗 Check Out?",
        `You are currently parked at Spot ${activeSession.spotId}.\nAre you sure you want to check out?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Check Out", style: "destructive",
            onPress: () => {
              ctxCheckOut();
              Alert.alert("👋 Checked Out!", `Spot ${activeSession.spotId} is now free.\nDrive safely!`);
            },
          },
        ]
      );
    } else {
      // Not parked → open check-in modal (未停车 → 打开签入弹窗)
      setSpotInput("");
      setCheckInModal(true);
    }
  }

  /*
     ✅ Quick Action 2 — Validate spot input and execute check-in.
     验证车位号输入，执行签入。
  */
  function handleQuickCheckIn() {
    const id = spotInput.trim().toUpperCase();
    if (!id) { Alert.alert("Please enter a spot number."); return; }

    const spot = spots.find(s => s.id === id);
    if (!spot) {
      Alert.alert("Spot not found", `"${id}" does not exist.\nExample formats: OKU-1, R1-1, R12-23`);
      return;
    }
    if (spot.status !== "free") {
      Alert.alert("Spot Occupied", `Spot ${id} is already taken.`);
      return;
    }
    const plate = vehicles[0]?.plate ?? "N/A";
    ctxCheckIn(spot.id, plate);
    setCheckInModal(false);
    setSpotInput("");
    Alert.alert("✅ Checked In!", `Parked at Spot ${id}`);
  }

  /*
     🔍 Quick Action 3 — Look up a vehicle by plate number.
     通过车牌号查询车主信息。
  */
  function handleVehicleLookup() {
    const plate = plateInput.trim().toUpperCase();
    if (!plate) { Alert.alert("Please enter a plate number."); return; }

    const found = VEHICLE_REGISTRY[plate];
    if (found) {
      setLookupResult({ name: found.name, plate, phone: found.phone });
    } else {
      setLookupResult(null);
      Alert.alert("Not Found", `No record for plate "${plate}".`);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      {/* Transparent so the gradient from _layout.tsx shows through
          (透明背景，让 _layout.tsx 的渐变透出来) */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header: greeting + IT Kia logo (顶部：问候语 + IT Kia logo) ── */}
        <Animated.View style={[styles.header, {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }]}>
          <View>
            <Text style={[styles.greeting, { color: T.muted }]}>{timeStr}</Text>
            <Text style={[styles.pageTitle, { color: T.text }]}>{greeting}</Text>
          </View>
          {/* IT Kia logo (IT Kia 标志) */}
          <Image
            source={require("../../assets/images/itkia.png")}
            style={{ width: 80, height: 40, resizeMode: "contain" }}
          />
        </Animated.View>

        {/* ── Campus location card with navigation button
            校园位置卡片，含导航按钮 ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.gpsCard, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={styles.gpsLeft}>
              <Text style={styles.gpsIcon}>📍</Text>
              <View>
                <Text style={[styles.gpsTitle, { color: T.muted }]}>Campus Location</Text>
                <Text style={[styles.gpsVal, { color: T.text }]} numberOfLines={1} ellipsizeMode="tail">
                  EduCity, Iskandar Puteri, Johor
                </Text>
              </View>
            </View>
            {/* Opens Google Maps to MDIS (点击跳转 Google Maps 导航至MDIS) */}
            <TouchableOpacity
              style={[styles.directionsBtn, { backgroundColor: T.accent + "22", borderColor: T.accent + "55" }]}
              onPress={openMapsToMDIS}
              activeOpacity={0.8}
            >
              <Text style={[styles.directionsBtnText, { color: T.accent }]}>Navigate →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Status banner: overall lot status (总体状态横幅) ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.statusBanner, { backgroundColor: T.card, borderColor: statusColor + "55" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor, flex: 1 }]}>{statusLabel}</Text>
            <Text style={[styles.statusTime, { color: T.muted }]}>Updated just now</Text>
          </View>
        </Animated.View>

        {/* ── Main card: availability ring + progress bar
            主卡片：可用性环形图和进度条 ── */}
        <Animated.View style={[styles.card, styles.mainCard, {
          backgroundColor: T.card, borderColor: T.border, opacity: fadeAnim,
        }]}>
          <Text style={[styles.cardLabel, { color: T.muted }]}>MDIS MAIN PARKING LOT</Text>
          <AvailabilityRing available={AVAILABLE_SPOTS} total={TOTAL_SPOTS} T={T} />
          {/* Progress bar showing % availability (进度条显示可用百分比) */}
          <View style={[styles.progressBg, { backgroundColor: T.border }]}>
            <View style={[styles.progressFill, {
              width: `${pct}%` as any,
              backgroundColor: statusColor,
            }]} />
          </View>
          <Text style={[styles.progressLabel, { color: T.muted }]}>{pct}% available</Text>
        </Animated.View>

        {/* ── Stats row: 4 number chips (统计行：4个数字小卡片) ── */}
        <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
          {[
            { label: "Free",     val: AVAILABLE_SPOTS, color: T.green  },
            { label: "Occupied", val: OCCUPIED_SPOTS,  color: T.red    },
            { label: "OKU",      val: okuTotal,         color: T.orange },
            { label: "Total",    val: TOTAL_SPOTS,     color: T.accent },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, {
              backgroundColor: T.card, borderColor: s.color + "44",
            }]}>
              <Text style={[styles.statNumber, { color: s.color }]}>{s.val}</Text>
              <Text style={[styles.statLabel,  { color: T.muted }]}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Quick action buttons (快捷操作按钮) ── */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>QUICK ACTIONS</Text>

        {/* Row 1: Security | Scan Plate (第一行：保安 | 扫描车牌) */}
        <View style={styles.actionsRow}>
          {/* 🚨 Security — opens emergency contacts modal (打开保安联系弹窗) */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={() => setSecurityModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🚨</Text>
            <Text style={[styles.actionText, { color: "red" }]}>Security</Text>
          </TouchableOpacity>

          {/* 📷 Scan Plate — navigates to camera screen (跳转到摄像头扫描页) */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={() => router.push("/camera" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={[styles.actionText, { color: T.text }]}>Scan Plate</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Quick Check-In / Check-Out | Vehicle Lookup (第二行：快速签入/签出 | 车辆查询) */}
        <View style={styles.actionsRow}>
          {/* ✅/🚗 Quick Check-In or Check Out — toggles based on activeSession
              未签入显示 Quick Check-In（绿色），已签入显示 Check Out（红色） */}
          <TouchableOpacity
            style={[styles.actionBtn, activeSession 
              ? {backgroundColor: T.card, borderWidth: 1, borderColor: T.red }
              : {backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={handleCheckInOutPress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>{activeSession ? "🚗" : "✅"}</Text>
            <Text style={[styles.actionText, activeSession
              ? { color: T.red }
              : { color: T.green }]}>
              {activeSession ? "Check Out" : "Quick Check-In"}
            </Text>
          </TouchableOpacity>

          {/* 🔍 Vehicle Lookup — opens plate search modal (打开车牌查询弹窗) */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={() => { setPlateInput(""); setLookupResult(null); setLookupModal(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={[styles.actionText, { color: T.text }]}>Vehicle Lookup</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recent activity list (最近活动列表) ── */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>RECENT ACTIVITY</Text>
        {activity.length === 0 ? (
          /* Empty state (空状态提示) */
          <View style={{ padding: 20, alignItems: "center" }}>
            <Text style={{ color: T.muted, fontSize: 13 }}>No activity yet</Text>
          </View>
        ) : (
          activity.map(item => (
            <View key={item.id} style={[styles.activityCard, {
              backgroundColor: T.card, borderColor: T.border,
            }]}>
              {/* Green dot = check-in, red dot = check-out
                  绿点=签入，红点=签出 */}
              <View style={[styles.activityDot, { backgroundColor: item.isIn ? T.green : T.red }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityPlate,  { color: T.text }]}>{item.plate}</Text>
                <Text style={[styles.activityAction, { color: T.muted }]}>{item.action}</Text>
              </View>
              <Text style={[styles.activityTime, { color: T.muted }]}>{item.time}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════════
          🚨 Security Alert Modal
          Shows security contacts with direct call buttons.
          显示保安联系方式，可直接拨号。
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal transparent animationType="slide" visible={securityModal} onRequestClose={() => setSecurityModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSecurityModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
            {/* Drag handle (拖动把手) */}
            <View style={[styles.handle, { backgroundColor: T.border }]} />

            {/* Header (标题区) */}
            <View style={[styles.modalIconCircle, { backgroundColor: T.red + "20", borderColor: T.red + "44" }]}>
              <Text style={{ fontSize: 28 }}>🚨</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.red }]}>Contact Security</Text>
            <Text style={[styles.modalSub,   { color: T.muted }]}>Contact campus security · Tap a number to call</Text>

            {/* Security contact list (保安联系人列表) */}
            {SECURITY_CONTACTS.map((c, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                onPress={() => Linking.openURL(`tel:${c.phone.replace(/\s|-/g, "")}`)}
                style={[styles.contactRow, { backgroundColor: T.bg, borderColor: T.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName,  { color: T.text }]}>{c.name}</Text>
                </View>
                <View style={[styles.callBadge, { backgroundColor: T.green + "20", borderColor: T.green + "55" }]}>
                  <Text style={{ fontSize: 14 }}>📞</Text>
                  <Text style={[styles.callNum, { color: T.green }]}>{c.phone}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSecurityModal(false)}>
              <Text style={[styles.cancelBtnText, { color: T.muted }]}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          ✅ Quick Check-In Modal
          User enters spot ID → checks in without opening the Map screen.
          用户输入车位号 → 无需打开地图页即可签入。
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal transparent animationType="slide" visible={checkInModal} onRequestClose={() => setCheckInModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCheckInModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={[styles.handle, { backgroundColor: T.border }]} />

            {/* Header (标题区) */}
            <View style={[styles.modalIconCircle, { backgroundColor: T.accent + "20", borderColor: T.accent + "44" }]}>
              <Text style={{ fontSize: 28 }}>✅</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.text }]}>Quick Check-In</Text>
            <Text style={[styles.modalSub,   { color: T.muted }]}>Enter your spot number</Text>

            {/* Spot number input (车位号输入框) */}
            <Text style={[styles.inputLabel, { color: T.muted }]}>Spot Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
              value={spotInput}
              onChangeText={t => setSpotInput(t.toUpperCase())}
              placeholder="e.g. R1-1, R12-23, R12-20"
              placeholderTextColor={T.muted}
              autoCapitalize="characters"
              autoFocus
            />
            {/* Format hint (格式提示) */}
            <Text style={[styles.formatHint, { color: T.muted }]}>
              OKU spots: OKU-1, OKU-2{"\n"}
              Rows 1–12 + Side column(R13) 1-20
            </Text>

            {/* Confirm button (确认按钮) */}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: T.accent }]}
              onPress={handleQuickCheckIn}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>✅  Check In Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCheckInModal(false)}>
              <Text style={[styles.cancelBtnText, { color: T.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          🔍 Vehicle Lookup Modal
          User enters a plate → shows registered owner + phone number.
          用户输入车牌 → 显示车主姓名和电话。
          ══════════════════════════════════════════════════════════════════════ */}
      <Modal transparent animationType="slide" visible={lookupModal} onRequestClose={() => setLookupModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setLookupModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={[styles.handle, { backgroundColor: T.border }]} />

            {/* Header (标题区) */}
            <View style={[styles.modalIconCircle, { backgroundColor: T.blue + "20", borderColor: T.blue + "44" }]}>
              <Text style={{ fontSize: 28 }}>🔍</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.text }]}>Vehicle Lookup</Text>
            <Text style={[styles.modalSub,   { color: T.muted }]}>Enter a plate to find the owner</Text>

            {/* Plate input (车牌输入框) */}
            <Text style={[styles.inputLabel, { color: T.muted }]}>Plate Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
              value={plateInput}
              onChangeText={t => { setPlateInput(t.toUpperCase()); setLookupResult(null); }}
              placeholder="e.g. WXY 1234"
              placeholderTextColor={T.muted}
              autoCapitalize="characters"
              autoFocus
            />

            {/* Search button (搜索按钮) */}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: T.blue ?? T.accent }]}
              onPress={handleVehicleLookup}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>🔍  Search</Text>
            </TouchableOpacity>

            {/* Result card — shown only after a successful lookup (查询成功后显示结果卡片) */}
            {lookupResult && (
              <View style={[styles.resultCard, { backgroundColor: T.bg, borderColor: T.accent + "55" }]}>
                <Text style={[styles.resultPlate, { color: T.accent }]}>🚗 {lookupResult.plate}</Text>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultKey,  { color: T.muted }]}>Owner</Text>
                  <Text style={[styles.resultVal,  { color: T.text  }]}>{lookupResult.name}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultKey,  { color: T.muted }]}>Phone</Text>
                  {/* Tap phone number to call directly (点击电话直接拨号) */}
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${lookupResult.phone.replace(/\s|-/g, "")}`)}>
                    <Text style={[styles.resultPhone, { color: T.green }]}>📞 {lookupResult.phone}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLookupModal(false)}>
              <Text style={[styles.cancelBtnText, { color: T.muted }]}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  // paddingBottom: 100 → leaves space for tab bar (底部留空给标签栏)
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" },

  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  greeting:  { fontSize: 13 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },

  // Campus GPS card (校园位置卡片)
  gpsCard:          { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gpsLeft:          { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, maxWidth: "58%" },
  gpsIcon:          { fontSize: 20 },
  gpsTitle:         { fontSize: 11, marginBottom: 2 },
  gpsVal:           { fontWeight: "600", fontSize: 13 },
  directionsBtn:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 },
  directionsBtnText:{ fontWeight: "700", fontSize: 12 },

  // Status banner (状态横幅)
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 16 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  statusText:   { fontWeight: "700", fontSize: 13 },
  statusTime:   { fontSize: 11 },

  // Main card (主卡片)
  card:         { borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 14 },
  mainCard:     { alignItems: "center" },
  cardLabel:    { fontSize: 11, letterSpacing: 1.5, marginBottom: 16 },

  // Availability ring (可用性环形图)
  ringWrap:  { alignItems: "center", marginBottom: 20 },
  ringOuter: { width: 150, height: 150, borderRadius: 75, borderWidth: 12, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  ringInner: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, justifyContent: "center", alignItems: "center" },
  ringNumber:{ fontSize: 36, fontWeight: "900", lineHeight: 40 },
  ringLabel: { fontSize: 11 },
  ringTotal: { fontSize: 12 },

  // Progress bar (进度条)
  progressBg:   { width: "100%", height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", borderRadius: 999 },
  progressLabel:{ fontSize: 12 },

  // Stats row (统计行)
  statsRow:  { flexDirection: "row", gap: 8, marginBottom: 24 },
  statCard:  { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center" },
  statNumber:{ fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, marginTop: 2 },

  // Quick actions (快捷操作)
  sectionTitle:{ fontSize: 11, letterSpacing: 1.5, marginBottom: 10 },
  actionsRow:  { flexDirection: "row", gap: 10, marginBottom: 10 },
  actionBtn:   { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center", gap: 6 },
  actionIcon:  { fontSize: 24 },
  actionText:  { fontWeight: "700", fontSize: 13 },

  // Recent activity (最近活动)
  activityCard:  { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  activityDot:   { width: 10, height: 10, borderRadius: 5 },
  activityPlate: { fontWeight: "700", fontSize: 14 },
  activityAction:{ fontSize: 12 },
  activityTime:  { fontSize: 12 },

  // Bottom sheet modals — shared (底部弹窗通用样式)
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },     
  // Semi-transparent backdrop (半透明遮罩)
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 }, 
  // Sheet body (弹窗主体)
  handle:     { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },    
  // Drag handle (拖动把手)
  modalIconCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, justifyContent: "center", alignItems: "center", 
    alignSelf: "center", marginBottom: 12 }, 
  // Emoji icon circle (图标圆圈)
  modalTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 4 },             
  // Modal title (弹窗标题)
  modalSub:   { fontSize: 13, textAlign: "center", marginBottom: 20 },                               
  // Modal subtitle (弹窗副标题)
  cancelBtn:  { alignItems: "center", paddingVertical: 12 },                                          
  // Cancel / close button (取消/关闭按钮)
  cancelBtnText: { fontSize: 14 },                                                                    
  // Cancel button text (取消按钮文字)

  // Security Modal — contact rows (保安弹窗联系人行)
  contactRow:    { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 }, 
  // Contact row container (联系人行容器)
  contactName:   { fontWeight: "700", fontSize: 14, marginBottom: 2 },                                
  // Contact English name (联系人英文名)
  contactNameZh: { fontSize: 12 },                                                                    
  // Contact Chinese name (联系人中文名)
  callBadge:     { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, 
    paddingVertical: 6 }, 
  // Call button badge (拨号按钮徽章)
  callNum:       { fontWeight: "700", fontSize: 12 },                                                 
  // Phone number text (电话号码文字)

  // Check-In & Lookup Modals — shared input styles (签入和查询弹窗共用输入样式)
  // Input label (输入框标签)
  inputLabel:  { fontSize: 12, letterSpacing: 0.5, marginBottom: 6 },                               
  // Text input field (文字输入框)
  input:       { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 10 },   
  // Format hint below input (输入框下方格式提示)
  formatHint:  { fontSize: 11, lineHeight: 16, marginBottom: 16, textAlign: "center" },              
  // Confirm / search button (确认/搜索按钮)
  confirmBtn:  { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },    
  // Confirm button text (white bold) (确认按钮文字)
  confirmBtnText: { color: "white", fontWeight: "800", fontSize: 15 },                               
  

  // Vehicle Lookup — result card (车辆查询结果卡片)
  // Result card container (结果卡片容器)
  resultCard:  { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10 },                 
  // Found plate number (查到的车牌号)
  resultPlate: { fontSize: 18, fontWeight: "900", marginBottom: 10, letterSpacing: 1 },             
  // Key-value row (键值行)
  resultRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },          
  // Result label (结果键名)
  resultKey:   { fontSize: 13 },                                                                     
  // Result value text (结果值)
  resultVal:   { fontWeight: "700", fontSize: 13 },                                                  
  // Tappable phone number (可点击的电话号码)
  resultPhone: { fontWeight: "700", fontSize: 13 },                                                  
});