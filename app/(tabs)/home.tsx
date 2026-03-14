/*
app/(tabs)/home.tsx — 主仪表盘页面 / Home Dashboard Screen

显示实时停车可用性、统计数据、快捷操作按钮和最近活动。
Shows real-time parking availability, stats, quick-action buttons, and recent activity.

数据来源 / Data source:
 所有停车统计来自 useParkingContext()，无需本地计算。
 All parking stats come from useParkingContext() — no local computation needed.
*/

import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert, Animated, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── Campus GPS Coordinates (校园 GPS 坐标) ──────────────────────────────────
// 用于 Google Maps 导航链接 / used for the Google Maps navigation link
const MDIS_LAT = 1.43364;
const MDIS_LNG = 103.615175;

// ─── Security contacts (保安联系方式) ────────────────────────────────────────
// 生产环境请替换为真实号码 / replace with real numbers in production
const SECURITY_CONTACTS = [
  { name: "Main Security Post", phone: "+607-000-0001" },
  { name: "Campus Control Room", phone: "+607-000-0002" },
  { name: "Emergency Hotline", phone: "+607-000-0003" },
];

// ─── Vehicle Registry (车辆注册表) ───────────────────────────────────────────
// 供"车辆查询"快捷功能使用。生产环境请替换为真实 API。
// Used by the Vehicle Lookup feature. Replace with a real API in production.
const VEHICLE_REGISTRY: Record<string, { name: string; phone: string }> = {
  "WXY 1234": { name: "Ahmad Faiz", phone: "+60 12-345 6789" },
  "JHB 5678": { name: "Nurul Ain", phone: "+60 11-234 5678" },
  "JDT 9012": { name: "Raj Kumar", phone: "+60 16-789 0123" },
  "SGR 3456": { name: "Lee Mei Ling", phone: "+60 17-456 7890" },
};

// ─── Colour helpers (颜色辅助函数) ───────────────────────────────────────────

/*
根据可用百分比返回状态颜色。
Returns a status colour based on availability percentage.
 > 40% → 绿色 green (充足)
 > 20% → 橙色 orange (偏满)
 ≤ 20% → 红色 red (几乎满)
*/
function getAvailabilityColor(pct: number, T: any): string {
  if (pct > 40) return T.green;
  if (pct > 20) return T.orange;
  return T.red;
}

/*
根据可用百分比返回状态文字标签。
Returns a human-readable status label based on availability percentage.
*/
function getStatusLabel(pct: number): string {
  if (pct > 40) return "Plenty of Space";
  if (pct > 20) return "Filling Up";
  return "Almost Full";
}

// ─── Sub-components (子组件) ──────────────────────────────────────────────────

/*
AnimatedNumber — 平滑地从当前值递增/递减到目标值。
Smoothly counts up/down to a target value over 1.2 seconds.

@param value 目标数值 / target number to display
@param style 文字样式 / text style
*/
function AnimatedNumber({ value, style }: { value: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0); // 当前显示的整数 / currently displayed integer

  useEffect(() => {
    // 1.2秒动画到目标值 / animate to target over 1.2s
    Animated.timing(anim, { toValue: value, duration: 1200, useNativeDriver: false }).start();
    // 实时更新显示整数 / update the displayed integer on each frame
    anim.addListener(({ value: v }) => setDisplay(Math.floor(v)));
    return () => anim.removeAllListeners(); // 清理监听器 / cleanup
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

/*
AvailabilityRing — 显示空位数量的圆形进度环。
Circular ring showing the number of available parking spots.

@param available = 空位数 / number of free spots
@param total = 总位数 / total spot count
@param T = 主题对象 / theme object
*/
function AvailabilityRing({ available, total, T }: { available: number; total: number; T: any }) {
  const pct = (available / total) * 100; // 可用百分比 / percentage available
  const color = getAvailabilityColor(pct, T); // 状态颜色 / status colour

  return (
    <View style={styles.ringWrap}>
      {/* 外层淡色环 / outer faint ring */}
      <View style={[styles.ringOuter, { borderColor: color + "33" }]}>
        {/* 内层实色环 / inner solid ring */}
        <View style={[styles.ringInner, { borderColor: color, backgroundColor: "transparent" }]}>
          {/* 动画空位数字 / animated available count */}
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
HomeScreen — 停车概览仪表盘主页面。
Main dashboard with real-time parking overview.
*/
export default function HomeScreen() {

  // 从 Context 读取停车数据 / read parking data from context
  const {
    activity, freeCount, occCount, okuFree, totalNormal, okuTotal, spots, checkIn: ctxCheckIn, checkOut: ctxCheckOut, vehicles, activeSession,
  } = useParkingContext();

  const { theme: T } = useTheme();
  const router = useRouter();

  // 计算汇总数值 / computed totals
  const TOTAL_SPOTS = totalNormal + okuTotal; // 所有车位 / all spots
  const AVAILABLE_SPOTS = freeCount + okuFree; // 空位总数 / total free spots
  const OCCUPIED_SPOTS = occCount; // 普通占用数 / occupied normal spots

  // 根据可用比例计算状态颜色和标签 / derive status colour and label from availability
  const pct = Math.round((AVAILABLE_SPOTS / TOTAL_SPOTS) * 100);
  const statusColor = getAvailabilityColor(pct, T);
  const statusLabel = getStatusLabel(pct);

  // 进场动画 / entrance animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current; // 透明度 0→1 / opacity
  const slideAnim = useRef(new Animated.Value(30)).current; // 垂直偏移 30→0 / y offset

  // 实时时钟 / real-time clock
  const [now, setNow] = useState(new Date());

  // 快捷操作弹窗状态 / quick-action modal states
  const [securityModal, setSecurityModal] = useState(false);
  const [checkInModal, setCheckInModal] = useState(false);
  const [spotInput, setSpotInput] = useState("");
  const [lookupModal, setLookupModal] = useState(false);
  const [plateInput, setPlateInput] = useState("");
  const [lookupResult, setLookupResult] = useState<{ name: string; plate: string; phone: string } | null>(null);

  // 每秒更新时钟 / tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 进场动画：淡入 + 上滑 / entrance animation: fade + slide up on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // 从 now 派生时间值 / time values derived from current Date
  const hour = now.getHours();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const greeting = hour < 12 ? "Good Morning 🌅" : hour < 18 ? "Good Afternoon ☀️" : "Good Evening 🌙";

  /*
  打开 Google Maps 导航到 MDIS 校园。
  Opens Google Maps with directions to the MDIS campus.
  */
  function openMapsToMDIS() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${MDIS_LAT},${MDIS_LNG}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`geo:${MDIS_LAT},${MDIS_LNG}?q=MDIS+Malaysia+EduCity+Iskandar+Puteri+Johor`)
    );
  }

  /*
  判断当前是否有活动会话：有 → 弹签出确认；无 → 打开签入弹窗。
  Toggles between check-in modal and check-out confirmation based on active session.
  */
  function handleCheckInOutPress() {
    if (activeSession) {
      // 已停车 → 确认签出 / already parked, confirm checkout
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
      // 未停车 → 打开签入弹窗 / not parked, open check-in modal
      setSpotInput("");
      setCheckInModal(true);
    }
  }

  /*
  验证车位号输入并执行签入。
  Validates the spot input and performs the check-in.
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
  通过车牌号查询车主信息。
  Looks up a vehicle owner by plate number.
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
      {/* 透明背景，让 _layout.tsx 的渐变透出来 / transparent so gradient from _layout.tsx shows through */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* 顶部：问候语 + IT Kia logo / Header: greeting + logo */}
        <Animated.View style={[styles.header, {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }]}>
          <View>
            <Text style={[styles.greeting, { color: T.muted }]}>{timeStr}</Text>
            <Text style={[styles.pageTitle, { color: T.text  }]}>{greeting}</Text>
          </View>
          <Image
            source={require("../../assets/images/itkia.png")}
            style={{ width: 80, height: 40, resizeMode: "contain" }}
          />
        </Animated.View>

        {/* 校园位置卡片，含导航按钮 / Campus location card with nav button */}
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
            {/* 点击跳转 Google Maps 导航 / opens Google Maps navigation */}
            <TouchableOpacity
              style={[styles.directionsBtn, { backgroundColor: T.accent + "22", borderColor: T.accent + "55" }]}
              onPress={openMapsToMDIS}
              activeOpacity={0.8}
            >
              <Text style={[styles.directionsBtnText, { color: T.accent }]}>Navigate →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* 总体状态横幅 / Overall lot status banner */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.statusBanner, { backgroundColor: T.card, borderColor: statusColor + "55" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor, flex: 1 }]}>{statusLabel}</Text>
            <Text style={[styles.statusTime, { color: T.muted }]}>Updated just now</Text>
          </View>
        </Animated.View>

        {/* 主卡片：可用性环形图 + 进度条 / Main card: availability ring + progress bar */}
        <Animated.View style={[styles.card, styles.mainCard, {
          backgroundColor: T.card, borderColor: T.border, opacity: fadeAnim,
        }]}>
          <Text style={[styles.cardLabel, { color: T.muted }]}>MDIS MAIN PARKING LOT</Text>
          <AvailabilityRing available={AVAILABLE_SPOTS} total={TOTAL_SPOTS} T={T} />
          {/* 进度条显示可用百分比 / progress bar showing % availability */}
          <View style={[styles.progressBg, { backgroundColor: T.border }]}>
            <View style={[styles.progressFill, {
              width: `${pct}%` as any,
              backgroundColor: statusColor,
            }]} />
          </View>
          <Text style={[styles.progressLabel, { color: T.muted }]}>{pct}% available</Text>
        </Animated.View>

        {/* 统计行：4个数字小卡片 / Stats row: 4 number chips */}
        <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
          {[
            { label: "Free",  val: AVAILABLE_SPOTS, color: T.green  },
            { label: "Occupied", val: OCCUPIED_SPOTS, color: T.red },
            { label: "OKU", val: okuTotal, color: T.orange },
            { label: "Total", val: TOTAL_SPOTS, color: T.accent },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, {
              backgroundColor: T.card, borderColor: s.color + "44",
            }]}>
              <Text style={[styles.statNumber, { color: s.color }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: T.muted }]}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* 快捷操作按钮 / Quick action buttons */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>QUICK ACTIONS</Text>

        {/* 第一行：保安 | 扫描车牌 / Row 1: Security | Scan Plate */}
        <View style={styles.actionsRow}>
          {/* 🚨 保安弹窗 / opens emergency contacts modal */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={() => setSecurityModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🚨</Text>
            <Text style={[styles.actionText, { color: "red" }]}>Security</Text>
          </TouchableOpacity>

          {/* 📷 跳转到摄像头扫描页 / navigates to camera screen */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={() => router.push("/camera" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={[styles.actionText, { color: T.text }]}>Scan Plate</Text>
          </TouchableOpacity>
        </View>

        {/* 第二行：快速签入/签出 | 车辆查询 / Row 2: Quick Check-In / Check-Out | Vehicle Lookup */}
        <View style={styles.actionsRow}>
          {/* 未签入显示 Quick Check-In（绿色），已签入显示 Check Out（红色）
              Shows Quick Check-In (green) or Check Out (red) depending on active session */}
          <TouchableOpacity
            style={[styles.actionBtn, activeSession
              ? { backgroundColor: T.card, borderWidth: 1, borderColor: T.red }
              : { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
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

          {/* 🔍 打开车牌查询弹窗 / opens plate search modal */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={() => { setPlateInput(""); setLookupResult(null); setLookupModal(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={[styles.actionText, { color: T.text }]}>Vehicle Lookup</Text>
          </TouchableOpacity>
        </View>

        {/* 最近活动列表 / Recent activity list */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>RECENT ACTIVITY</Text>
        {activity.length === 0 ? (
          // 空状态提示 / empty state
          <View style={{ padding: 20, alignItems: "center" }}>
            <Text style={{ color: T.muted, fontSize: 13 }}>No activity yet</Text>
          </View>
        ) : (
          activity.map(item => (
            <View key={item.id} style={[styles.activityCard, {
              backgroundColor: T.card, borderColor: T.border,
            }]}>
              {/* 绿点=签入，红点=签出 / green dot = check-in, red dot = check-out */}
              <View style={[styles.activityDot, { backgroundColor: item.isIn ? T.green : T.red }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityPlate, { color: T.text }]}>{item.plate}</Text>
                <Text style={[styles.activityAction, { color: T.muted }]}>{item.action}</Text>
              </View>
              <Text style={[styles.activityTime, { color: T.muted }]}>{item.time}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* ─── 🚨 保安弹窗 / Security Modal ─────────────────────────────────────
          显示保安联系方式，可直接拨号。
          Shows campus security contacts with direct-call buttons. */}
      <Modal transparent animationType="slide" visible={securityModal} onRequestClose={() => setSecurityModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSecurityModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={[styles.handle, { backgroundColor: T.border }]} />
            <View style={[styles.modalIconCircle, { backgroundColor: T.red + "20", borderColor: T.red + "44" }]}>
              <Text style={{ fontSize: 28 }}>🚨</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.red }]}>Contact Security</Text>
            <Text style={[styles.modalSub,{ color: T.muted }]}>Contact campus security {"\n"} Tap a number to call</Text>

            {/* 保安联系人列表 / security contact list */}
            {SECURITY_CONTACTS.map((c, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                onPress={() => Linking.openURL(`tel:${c.phone.replace(/\s|-/g, "")}`)}
                style={[styles.contactRow, { backgroundColor: T.bg, borderColor: T.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: T.text }]}>{c.name}</Text>
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

      {/* ─── ✅ 快速签入弹窗 / Quick Check-In Modal ──────────────────────────
          用户输入车位号，无需打开地图页即可签入。
          User enters a spot ID to check in without opening the Map screen. */}
      <Modal transparent animationType="slide" visible={checkInModal} onRequestClose={() => setCheckInModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setCheckInModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={[styles.handle, { backgroundColor: T.border }]} />
            <View style={[styles.modalIconCircle, { backgroundColor: T.accent + "20", borderColor: T.accent + "44" }]}>
              <Text style={{ fontSize: 28 }}>✅</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.text }]}>Quick Check-In</Text>
            <Text style={[styles.modalSub, { color: T.muted }]}>Enter your spot number</Text>

            {/* 车位号输入框 / spot number input */}
            <Text style={[styles.inputLabel, { color: T.muted }]}>Spot Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
              value={spotInput}
              onChangeText={t => setSpotInput(t.toUpperCase())}
              placeholder="e.g. R1-1, R12-23, R13-20"
              placeholderTextColor={T.muted}
              autoCapitalize="characters"
              autoFocus
            />
            {/* 格式提示 / format hint */}
            <Text style={[styles.formatHint, { color: T.muted }]}>
              OKU spots: OKU-1, OKU-2{"\n"}
              Rows 1–12 + Side column(R13) 1-20
            </Text>

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

      {/* ─── 🔍 车辆查询弹窗 / Vehicle Lookup Modal ──────────────────────────
          用户输入车牌 → 显示车主姓名和电话。
          User enters a plate → shows registered owner + phone number. */}
      <Modal transparent animationType="slide" visible={lookupModal} onRequestClose={() => setLookupModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setLookupModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={[styles.handle, { backgroundColor: T.border }]} />
            <View style={[styles.modalIconCircle, { backgroundColor: T.blue + "20", borderColor: T.blue + "44" }]}>
              <Text style={{ fontSize: 28 }}>🔍</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.text }]}>Vehicle Lookup</Text>
            <Text style={[styles.modalSub, { color: T.muted }]}>Enter a plate to find the owner</Text>

            {/* 车牌输入框 / plate number input */}
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

            {/* 搜索按钮 / search button */}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: T.blue ?? T.accent }]}
              onPress={handleVehicleLookup}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>🔍  Search</Text>
            </TouchableOpacity>

            {/* 查询成功后显示结果卡片 / result card shown after a successful lookup */}
            {lookupResult && (
              <View style={[styles.resultCard, { backgroundColor: T.bg, borderColor: T.accent + "55" }]}>
                <Text style={[styles.resultPlate, { color: T.accent }]}>🚗 {lookupResult.plate}</Text>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultKey, { color: T.muted }]}>Owner</Text>
                  <Text style={[styles.resultVal, { color: T.text  }]}>{lookupResult.name}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultKey, { color: T.muted }]}>Phone</Text>
                  {/* 点击电话直接拨号 / tap to call directly */}
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

// ─── Styles (样式) ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  // 底部留空给标签栏 / paddingBottom leaves space for tab bar
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  greeting: { fontSize: 13 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },

  // 校园位置卡片 / campus GPS card
  gpsCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gpsLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, maxWidth: "58%" },
  gpsIcon: { fontSize: 20 },
  gpsTitle: { fontSize: 11, marginBottom: 2 },
  gpsVal: { fontWeight: "600", fontSize: 13 },
  directionsBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0 },
  directionsBtnText: { fontWeight: "700", fontSize: 12 },

  // 状态横幅 / status banner
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontWeight: "700", fontSize: 13 },
  statusTime: { fontSize: 11 },

  // 主卡片 / main card
  card: { borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 14 },
  mainCard: { alignItems: "center" },
  cardLabel: { fontSize: 11, letterSpacing: 1.5, marginBottom: 16 },

  // 可用性环形图 / availability ring
  ringWrap: { alignItems: "center", marginBottom: 20 },
  ringOuter: { width: 150, height: 150, borderRadius: 75, borderWidth: 12, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  ringInner: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, justifyContent: "center", alignItems: "center" },
  ringNumber: { fontSize: 36, fontWeight: "900", lineHeight: 40 },
  ringLabel: { fontSize: 11 },
  ringTotal: { fontSize: 12 },

  // 进度条 / progress bar
  progressBg: { width: "100%", height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", borderRadius: 999 },
  progressLabel: { fontSize: 12 },

  // 统计行 / stats row
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, marginTop: 2 },

  // 快捷操作 / quick actions
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, marginBottom: 10 },
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center", gap: 6 },
  actionIcon: { fontSize: 24 },
  actionText: { fontWeight: "700", fontSize: 13 },

  // 最近活动 / recent activity
  activityCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  activityDot: { width: 10, height: 10, borderRadius: 5 },
  activityPlate: { fontWeight: "700", fontSize: 14 },
  activityAction: { fontSize: 12 },
  activityTime: { fontSize: 12 },

  // 底部弹窗通用样式 / bottom sheet modal shared styles
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle: { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  modalIconCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, justifyContent: "center", alignItems: "center", alignSelf: "center", marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  modalSub: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontSize: 14 },

  // 保安弹窗联系人行 / security modal contact rows
  contactRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  contactName: { fontWeight: "700", fontSize: 14, marginBottom: 2 },
  callBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  callNum: { fontWeight: "700", fontSize: 12 },

  // 签入和查询弹窗共用输入样式 / shared input styles for check-in and lookup modals
  inputLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 10 },
  formatHint: { fontSize: 11, lineHeight: 16, marginBottom: 16, textAlign: "center" },
  confirmBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  confirmBtnText: { color: "white", fontWeight: "800", fontSize: 15 },

  // 车辆查询结果卡片 / vehicle lookup result card
  resultCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10 },
  resultPlate: { fontSize: 18, fontWeight: "900", marginBottom: 10, letterSpacing: 1 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  resultKey: { fontSize: 13 },
  resultVal: { fontWeight: "700", fontSize: 13 },
  resultPhone: { fontWeight: "700", fontSize: 13 },
});