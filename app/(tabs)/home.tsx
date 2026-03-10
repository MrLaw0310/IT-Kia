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
  Animated, Image, Linking, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
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

// ─── Main Screen Component (主页面组件) ──────────────────────────────────────

/*
   HomeScreen — main dashboard with parking overview.
   主页面 — 停车概览仪表盘。
*/
export default function HomeScreen() {
  // ── Read parking data from context (从 Context 读取停车数据) ─────────────
  const { activity, freeCount, occCount, okuFree, totalNormal, okuTotal } = useParkingContext();

  // ── Compute totals (计算汇总数值) ─────────────────────────────────────────
  const TOTAL_SPOTS     = totalNormal + okuTotal;  // All spots (全部车位)
  const AVAILABLE_SPOTS = freeCount + okuFree;     // Free normal + free OKU (空位总数)
  const OCCUPIED_SPOTS  = occCount;                // Occupied normal spots (普通占用数)

  const { theme: T } = useTheme();
  const router       = useRouter();

  // ── Entrance animation refs (进场动画的 Animated.Value) ──────────────────
  const fadeAnim  = useRef(new Animated.Value(0)).current;  // Opacity 0→1 (透明度)
  const slideAnim = useRef(new Animated.Value(30)).current; // Y offset 30→0 (垂直偏移)

  // ── Real-time clock (实时时钟) ──────────────────────────────────────────
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    // Update every second (每秒更新一次)
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer); // Clear on unmount (组件卸载时清除)
  }, []);

  const hour     = now.getHours();
  const timeStr  = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  // Dynamic greeting based on time of day (根据时间动态问候语)
  const greeting = hour < 12 ? "Good Morning 🌅" : hour < 18 ? "Good Afternoon ☀️" : "Good Evening 🌙";

  // ── Entrance animation (进场动画：淡入+上滑) ──────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  /*
     Open Google Maps with directions to MDIS campus.
     打开 Google Maps 导航到 MDIS 校园。
     Falls back to geo: URI if Google Maps is not available.
     如果 Google Maps 不可用，回退到 geo: URI。
  */
  function openMapsToMDIS() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${MDIS_LAT},${MDIS_LNG}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`geo:${MDIS_LAT},${MDIS_LNG}?q=MDIS+Malaysia+EduCity+Iskandar+Puteri+Johor`)
    );
  }

  // ── Status color and label (状态颜色和标签) ───────────────────────────────
  // Based on % of available spots (根据空位百分比)
  const pct         = Math.round((AVAILABLE_SPOTS / TOTAL_SPOTS) * 100);
  const statusColor = pct > 40 ? T.green : pct > 20 ? T.orange : T.red;
  const statusLabel = pct > 40 ? "Plenty of Space" : pct > 20 ? "Filling Up" : "Almost Full";

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
        {[
          /* Row 1 (第一行) */
          [
            { icon: "🗺️", label: "View Map",   bg: T.accent, textColor: "white", onPress: () => router.push("/(tabs)/map" as any) },
            { icon: "📷", label: "Scan Plate", bg: T.card,   textColor: T.text,  onPress: () => router.push("/camera" as any) },
          ],
          /* Row 2 (第二行) */
          [
            { icon: "🕐", label: "History",    bg: T.card,   textColor: T.text,  onPress: () => router.push("/(tabs)/history" as any) },
            { icon: "🧭", label: "Navigate",   bg: T.card,   textColor: T.text,  onPress: openMapsToMDIS },
          ],
        ].map((row, ri) => (
          <View key={ri} style={styles.actionsRow}>
            {row.map(a => (
              <TouchableOpacity
                key={a.label}
                style={[styles.actionBtn, {
                  backgroundColor: a.bg,
                  borderWidth: a.bg === T.card ? 1 : 0,
                  borderColor: T.border,
                }]}
                onPress={a.onPress}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>{a.icon}</Text>
                <Text style={[styles.actionText, { color: a.textColor }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

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
});