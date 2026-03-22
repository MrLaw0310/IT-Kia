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
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useParkingContext } from "../../utils/ParkingContext";
import type { Theme } from "../../utils/ThemeContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── 常量 / Constants ─────────────────────────────────────────────────────────

// MDIS 校园 GPS 坐标，用于 Google Maps 导航
// MDIS campus GPS coordinates — used for the Google Maps navigation link
const MDIS_LAT = 1.43364;
const MDIS_LNG = 103.615175;

// 保安联系方式列表（生产环境替换为真实号码）
// Security contact list — replace with real numbers in production
const SECURITY_CONTACTS = [
  { name: "Main Security Post",  phone: "+607-000-0001" },
  { name: "Campus Control Room", phone: "+607-000-0002" },
  { name: "Emergency Hotline",   phone: "+607-000-0003" },
];

// 车辆查询注册表（演示数据，生产环境改为真实 API）
// Vehicle lookup registry — demo data, replace with real API in production
const VEHICLE_REGISTRY: Record<string, { name: string; phone: string }> = {
  "WXY 1234": { name: "Ahmad Faiz",   phone: "+60 12-345 6789" },
  "JHB 5678": { name: "Nurul Ain",    phone: "+60 11-234 5678" },
  "JDT 9012": { name: "Raj Kumar",    phone: "+60 16-789 0123" },
  "SGR 3456": { name: "Lee Mei Ling", phone: "+60 17-456 7890" },
};

// ─── 辅助函数 / Helper functions ──────────────────────────────────────────────

/*
根据可用车位百分比返回状态颜色。
Returns a status colour based on availability percentage.
  > 40% → 绿色 / green   (充足 / plenty)
  > 20% → 橙色 / orange  (偏满 / filling up)
  ≤ 20% → 红色 / red     (几乎满 / almost full)
*/
function getAvailabilityColor(pct: number, T: Theme): string {
  if (pct > 40) {
    return T.green;
  }
  if (pct > 20) {
    return T.orange;
  }
  return T.red;
}

/*
根据可用车位百分比返回状态文字标签。
Returns a human-readable status label based on availability percentage.
*/
function getStatusLabel(pct: number): string {
  if (pct > 40) {
    return "Plenty of Space";
  }
  if (pct > 20) {
    return "Filling Up";
  }
  return "Almost Full";
}

/*
根据当前小时返回问候语文字。
Returns a greeting string based on the current hour.
*/
function getGreeting(hour: number): string {
  if (hour < 12) {
    return "Good Morning 🌅";
  }
  if (hour < 18) {
    return "Good Afternoon ☀️";
  }
  return "Good Evening 🌙";
}

// ─── Styles for LiveClock ─────────────────────────────────────────────────────
// LiveClock 是独立组件，只有它本身每秒重渲染，不会牵连整个 HomeScreen
// LiveClock is an isolated component — only it re-renders every second, not HomeScreen
// (no StyleSheet needed — it reuses the parent's text style via the style prop)

// ─── LiveClock ────────────────────────────────────────────────────────────────
/*
独立实时时钟组件。
每秒更新一次，与 HomeScreen 隔离，防止 HomeScreen 每秒重渲染。

Standalone real-time clock component.
Updates every second but is isolated from HomeScreen to prevent full-page re-renders.
*/
function LiveClock({ style }: { style?: any }) {

  const [now, setNow] = useState(new Date());

  useEffect(function startClock() {
    const timer = setInterval(function tick() {
      setNow(new Date());
    }, 1000);
    return function stopClock() { clearInterval(timer); };
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return <Text style={style}>{timeStr}</Text>;
}

// ─── Styles for AnimatedNumber ────────────────────────────────────────────────
// AnimatedNumber 使用父组件传入的 style prop，无独立 StyleSheet

// ─── AnimatedNumber ───────────────────────────────────────────────────────────
/*
平滑地从当前值过渡到目标值，1.2 秒动画。
Smoothly animates to a target number value over 1.2 seconds.

@param value 目标数值 / target number to display
@param style 文字样式 / text style
*/
function AnimatedNumber({ value, style }: { value: number; style?: any }) {

  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(function animateToValue() {
    // 注册 listener 并记录 ID，保证 cleanup 时只移除这一个
    // Register listener and store its ID so cleanup removes only this one
    const listenerId = anim.addListener(function onFrame({ value: v }) {
      setDisplay(Math.floor(v));
    });

    const animation = Animated.timing(anim, {
      toValue:         value,
      duration:        1200,
      useNativeDriver: false,
    });
    animation.start();

    return function cleanup() {
      animation.stop();
      anim.removeListener(listenerId);
    };
  }, [value, anim]);

  return <Text style={style}>{display}</Text>;
}

// ─── Styles for AvailabilityRing ──────────────────────────────────────────────
const ringStyles = StyleSheet.create({

  // 环形图外层容器（居中）
  // Outer wrapper — centred
  wrap: {
    alignItems:   "center",
    marginBottom: 20,
  },

  // 外层大圆环（淡色边框）
  // Outer large ring — faint border
  outer: {
    width:          150,
    height:         150,
    borderRadius:   75,
    borderWidth:    12,
    justifyContent: "center",
    alignItems:     "center",
    marginBottom:   8,
  },

  // 内层小圆环（实色边框）
  // Inner small ring — solid border
  inner: {
    width:          110,
    height:         110,
    borderRadius:   55,
    borderWidth:    3,
    justifyContent: "center",
    alignItems:     "center",
  },

  // 空位数量大数字
  // Large available count number
  number: {
    fontSize:   36,
    fontWeight: "900",
    lineHeight: 40,
  },

  // "available" 小标签
  // "available" small label
  label: {
    fontSize: 11,
  },

  // "out of X spots" 文字
  // "out of X spots" text
  total: {
    fontSize: 12,
  },
});

// ─── AvailabilityRing ─────────────────────────────────────────────────────────
/*
显示空位数量的圆形进度环。
Circular ring showing the number of available parking spots.

@param available 空位数 / number of free spots
@param total     总位数 / total spot count
@param T         主题对象 / theme object
*/
function AvailabilityRing({ available, total, T }: {
  available: number;
  total:     number;
  T:         Theme;
}) {
  // 可用百分比和对应颜色
  // Availability percentage and its corresponding colour
  const pct   = (available / total) * 100;
  const color = getAvailabilityColor(pct, T);

  // 外圈边框：同色但透明度极低 / outer ring border: same colour but very faint
  const outerBorderColor = color + "33";

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <View style={ringStyles.wrap}>
      {/* 外层淡色环 / Outer faint ring */}
      <View style={[ringStyles.outer, { borderColor: outerBorderColor }]}>
        {/* 内层实色环 / Inner solid ring */}
        <View style={[ringStyles.inner, { borderColor: color, backgroundColor: "transparent" }]}>
          {/* 动画空位数字 / Animated available count */}
          <AnimatedNumber value={available} style={[ringStyles.number, { color }]} />
          <Text style={[ringStyles.label, { color: T.muted }]}>available</Text>
        </View>
      </View>
      <Text style={[ringStyles.total, { color: T.muted }]}>out of {total} spots</Text>
    </View>
  );
}

// ─── Styles for HomeScreen ────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // 全屏容器
  // Full-screen container
  screen: { flex: 1 },

  // 滚动内容区域（底部留空给标签栏）
  // Scroll content — bottom padding for tab bar
  scroll: {
    padding:         20,
    paddingTop:      56,
    paddingBottom:   100,
    backgroundColor: "transparent",
  },

  // 顶部问候语 + logo 横排
  // Header row — greeting and logo
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   16,
  },

  // 时间小字（在问候语上方）
  // Time small text — above the greeting
  greeting: { fontSize: 13 },

  // 问候语大字
  // Greeting large text
  pageTitle: {
    fontSize:      24,
    fontWeight:    "800",
    letterSpacing: -0.5,
  },

  // 校园位置卡片
  // Campus location card
  gpsCard: {
    borderWidth:    1,
    borderRadius:   14,
    padding:        14,
    marginBottom:   12,
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },

  // 位置卡左侧（图标 + 文字）
  // GPS card left side — icon and text
  gpsLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
    flexShrink:    1,
    maxWidth:      "58%",
  },

  // 位置图标
  // Location icon
  gpsIcon: { fontSize: 20 },

  // 位置卡小标题
  // GPS card small title
  gpsTitle: {
    fontSize:     11,
    marginBottom: 2,
  },

  // 位置名称文字
  // Location name text
  gpsVal: {
    fontWeight: "600",
    fontSize:   13,
  },

  // 导航按钮
  // Navigate button
  directionsBtn: {
    borderWidth:       1,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   7,
    flexShrink:        0,
  },

  // 导航按钮文字
  // Navigate button text
  directionsBtnText: {
    fontWeight: "700",
    fontSize:   12,
  },

  // 状态横幅（绿/橙/红点 + 文字）
  // Status banner — coloured dot and text
  statusBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    borderWidth:       1,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   9,
    marginBottom:      16,
  },

  // 状态颜色小圆点
  // Status colour dot
  statusDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },

  // 状态文字
  // Status text
  statusText: {
    fontWeight: "700",
    fontSize:   13,
  },

  // 状态更新时间文字
  // Status update time text
  statusTime: { fontSize: 11 },

  // 通用卡片
  // Generic card
  card: {
    borderWidth:  1,
    borderRadius: 20,
    padding:      20,
    marginBottom: 14,
  },

  // 主卡片（居中内容）
  // Main card — centred content
  mainCard: { alignItems: "center" },

  // 卡片小标签（如 "MDIS MAIN PARKING LOT"）
  // Card small label e.g. "MDIS MAIN PARKING LOT"
  cardLabel: {
    fontSize:      11,
    letterSpacing: 1.5,
    marginBottom:  16,
  },

  // 进度条背景轨道
  // Progress bar background track
  progressBg: {
    width:        "100%",
    height:       8,
    borderRadius: 999,
    overflow:     "hidden",
    marginBottom: 6,
  },

  // 进度条填充块
  // Progress bar fill
  progressFill: {
    height:       "100%",
    borderRadius: 999,
  },

  // 进度百分比文字
  // Progress percentage text
  progressLabel: { fontSize: 12 },

  // 统计数字行
  // Stats number row
  statsRow: {
    flexDirection: "row",
    gap:           8,
    marginBottom:  24,
  },

  // 单个统计卡片
  // Single stat card
  statCard: {
    flex:         1,
    borderWidth:  1,
    borderRadius: 14,
    padding:      12,
    alignItems:   "center",
  },

  // 统计大数字
  // Stat large number
  statNumber: {
    fontSize:   22,
    fontWeight: "900",
  },

  // 统计标签
  // Stat label
  statLabel: {
    fontSize:  10,
    marginTop: 2,
  },

  // 区域标题（小字全大写）
  // Section title — small uppercase label
  sectionTitle: {
    fontSize:      11,
    letterSpacing: 1.5,
    marginBottom:  10,
  },

  // 快捷操作按钮横排
  // Quick action button row
  actionsRow: {
    flexDirection: "row",
    gap:           10,
    marginBottom:  10,
  },

  // 单个快捷操作按钮
  // Single quick action button
  actionBtn: {
    flex:            1,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      "center",
    gap:             6,
  },

  // 快捷按钮图标
  // Action button icon
  actionIcon: { fontSize: 24 },

  // 快捷按钮文字
  // Action button text
  actionText: {
    fontWeight: "700",
    fontSize:   13,
  },

  // 活动记录卡片
  // Activity record card
  activityCard: {
    flexDirection: "row",
    alignItems:    "center",
    borderWidth:   1,
    borderRadius:  12,
    padding:       14,
    marginBottom:  8,
    gap:           12,
  },

  // 活动状态小圆点（绿=签入，红=签出）
  // Activity dot — green = check-in, red = check-out
  activityDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },

  // 活动车牌文字
  // Activity plate text
  activityPlate: {
    fontWeight: "700",
    fontSize:   14,
  },

  // 活动动作描述文字
  // Activity action description
  activityAction: { fontSize: 12 },

  // 活动时间文字
  // Activity time text
  activityTime: { fontSize: 12 },

  // 底部弹窗遮罩层
  // Bottom modal overlay
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent:  "flex-end",
  },

  // 底部弹出面板
  // Bottom sheet panel
  sheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              24,
    borderTopWidth:       1,
  },

  // 拖动把手
  // Drag handle
  handle: {
    width:        40,
    height:       4,
    borderRadius: 999,
    alignSelf:    "center",
    marginBottom: 20,
  },

  // 弹窗图标圆形背景
  // Modal icon circle background
  modalIconCircle: {
    width:          60,
    height:         60,
    borderRadius:   30,
    borderWidth:    1.5,
    justifyContent: "center",
    alignItems:     "center",
    alignSelf:      "center",
    marginBottom:   12,
  },

  // 弹窗标题
  // Modal title
  modalTitle: {
    fontSize:     20,
    fontWeight:   "800",
    textAlign:    "center",
    marginBottom: 4,
  },

  // 弹窗副标题
  // Modal subtitle
  modalSub: {
    fontSize:     13,
    textAlign:    "center",
    marginBottom: 20,
  },

  // 取消按钮
  // Cancel button
  cancelBtn: {
    alignItems:      "center",
    paddingVertical: 12,
  },

  // 取消按钮文字
  // Cancel button text
  cancelBtnText: { fontSize: 14 },

  // 保安联系人行容器
  // Security contact row container
  contactRow: {
    flexDirection: "row",
    alignItems:    "center",
    borderWidth:   1,
    borderRadius:  14,
    padding:       14,
    marginBottom:  10,
  },

  // 联系人姓名
  // Contact name
  contactName: {
    fontWeight:   "700",
    fontSize:     14,
    marginBottom: 2,
  },

  // 拨号按钮（徽章样式）
  // Call badge button
  callBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    borderWidth:       1,
    borderRadius:      10,
    paddingHorizontal: 10,
    paddingVertical:   6,
  },

  // 电话号码文字
  // Phone number text in call badge
  callNum: {
    fontWeight: "700",
    fontSize:   12,
  },

  // 输入框标签（签入和查询弹窗共用）
  // Input label — shared by check-in and lookup modals
  inputLabel: {
    fontSize:      12,
    letterSpacing: 0.5,
    marginBottom:  6,
  },

  // 输入框（签入和查询弹窗共用）
  // Input field — shared by check-in and lookup modals
  input: {
    borderWidth:   1,
    borderRadius:  12,
    padding:       13,
    fontSize:      15,
    marginBottom:  10,
  },

  // 格式提示文字（签入弹窗）
  // Format hint text in check-in modal
  formatHint: {
    fontSize:     11,
    lineHeight:   16,
    marginBottom: 16,
    textAlign:    "center",
  },

  // 确认按钮（弹窗内主操作按钮）
  // Confirm button — primary action in modals
  confirmBtn: {
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      "center",
    marginBottom:    10,
  },

  // 确认按钮文字
  // Confirm button text
  confirmBtnText: {
    color:      "white",
    fontWeight: "800",
    fontSize:   15,
  },

  // 查询结果卡片
  // Vehicle lookup result card
  resultCard: {
    borderWidth:  1,
    borderRadius: 14,
    padding:      16,
    marginBottom: 10,
  },

  // 查询结果车牌文字
  // Lookup result plate text
  resultPlate: {
    fontSize:      18,
    fontWeight:    "900",
    marginBottom:  10,
    letterSpacing: 1,
  },

  // 查询结果行
  // Lookup result row
  resultRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    marginBottom:   6,
  },

  // 查询结果 key 文字
  // Lookup result key text
  resultKey: { fontSize: 13 },

  // 查询结果 value 文字
  // Lookup result value text
  resultVal: {
    fontWeight: "700",
    fontSize:   13,
  },

  // 查询结果电话文字（可点击拨号）
  // Lookup result phone text — tappable to call
  resultPhone: {
    fontWeight: "700",
    fontSize:   13,
  },
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────
/*
停车概览仪表盘主页面。
Main parking overview dashboard screen.
*/
export default function HomeScreen() {

  // 从 Context 读取停车数据
  // Read parking data from context
  const {
    activity,
    freeCount,
    occCount,
    okuFree,
    totalNormal,
    okuTotal,
    spots,
    checkIn:       ctxCheckIn,
    checkOut:      ctxCheckOut,
    vehicles,
    activeSession,
  } = useParkingContext();

  const { theme: T } = useTheme();
  const router       = useRouter();

  // ── 计算汇总数值 / Computed totals ──────────────────────────────────────────
  const TOTAL_SPOTS     = totalNormal + okuTotal;  // 所有车位 / all spots
  const AVAILABLE_SPOTS = freeCount + okuFree;     // 空位总数 / total free spots
  const OCCUPIED_SPOTS  = occCount;                // 普通占用数 / occupied normal spots

  // 可用百分比和状态
  // Availability percentage and derived status
  const availPct    = Math.round((AVAILABLE_SPOTS / TOTAL_SPOTS) * 100);
  const statusColor = getAvailabilityColor(availPct, T);
  const statusLabel = getStatusLabel(availPct);

  // ── 进场动画 / Entrance animation ───────────────────────────────────────────
  const fadeAnim  = useRef(new Animated.Value(0)).current;  // 透明度 0→1 / opacity
  const slideAnim = useRef(new Animated.Value(30)).current; // 垂直偏移 30→0 / y offset

  useEffect(function playEntranceAnimation() {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── 当前小时（用于问候语，只需计算一次）/ Current hour for greeting ─────────
  const currentHour = new Date().getHours();
  const greeting    = getGreeting(currentHour);

  // ── 弹窗状态 / Modal states ──────────────────────────────────────────────────
  const [securityModal,     setSecurityModal]     = useState(false);
  const [checkInModal,      setCheckInModal]      = useState(false);
  const [spotInput,         setSpotInput]         = useState("");
  const [lookupModal,       setLookupModal]       = useState(false);
  const [plateInput,        setPlateInput]        = useState("");

  // 快速签入弹窗中用户选中的车辆 ID（空字符串 = 尚未选择）
  // Vehicle ID selected in the quick check-in modal — empty string means not yet chosen
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  // 查询结果（null = 未查询或无结果）
  // Lookup result — null when not yet searched or no match found
  const [lookupResult, setLookupResult] = useState<{
    name:  string;
    plate: string;
    phone: string;
  } | null>(null);

  // ── 快捷操作处理函数 / Quick action handlers ─────────────────────────────────

  /*
  打开 Google Maps 导航到 MDIS 校园，失败时回退到 geo: 链接。
  Opens Google Maps to MDIS campus; falls back to geo: URI on failure.
  */
  function openMapsToMDIS() {
    const googleMapsUrl = (
      "https://www.google.com/maps/dir/?api=1" +
      "&destination=" + MDIS_LAT + "," + MDIS_LNG +
      "&travelmode=driving"
    );
    const geoFallbackUrl = (
      "geo:" + MDIS_LAT + "," + MDIS_LNG +
      "?q=MDIS+Malaysia+EduCity+Iskandar+Puteri+Johor"
    );
    Linking.openURL(googleMapsUrl).catch(function fallback() {
      Linking.openURL(geoFallbackUrl);
    });
  }

  /*
  快捷签入/签出切换。
  已有活动会话 → 弹签出确认；无活动会话 → 打开签入弹窗。

  Toggles between check-in and check-out based on active session.
  Active session → show check-out confirm alert; no session → open check-in modal.
  */
  function handleCheckInOutPress() {
    if (activeSession) {
      // 已停车，弹确认签出
      // Already parked — show check-out confirmation
      Alert.alert(
        "🚗 Check Out?",
        "You are currently parked at Spot " + activeSession.spotId + ".\nAre you sure you want to check out?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text:    "Check Out",
            style:   "destructive",
            onPress: function confirmCheckOut() {
              ctxCheckOut();
              Alert.alert(
                "👋 Checked Out!",
                "Spot " + activeSession.spotId + " is now free.\nDrive safely!"
              );
            },
          },
        ]
      );
    } else {
      // 未停车，打开签入弹窗
      // Not parked — open check-in modal
      setSpotInput("");
      setSelectedVehicleId(""); // 重置车辆选择，防止上次选择残留 / reset so previous selection does not carry over
      setCheckInModal(true);
    }
  }

  /*
  验证车位号和选中车辆，执行快速签入。
  Validates the spot number and selected vehicle, then performs a quick check-in.
  */
  function handleQuickCheckIn() {
    // 必须有注册车辆
    // Must have at least one registered vehicle
    if (vehicles.length === 0) {
      Alert.alert("No Vehicle", "Please register a vehicle in Profile first.");
      return;
    }

    // 必须已在弹窗内选择车辆
    // Must have selected a vehicle inside the modal
    if (!selectedVehicleId) {
      Alert.alert("Select Vehicle", "Please tap a vehicle to select it before checking in.");
      return;
    }

    const spotId = spotInput.trim().toUpperCase();

    // 车位号不能为空
    // Spot number cannot be empty
    if (!spotId) {
      Alert.alert("Please enter a spot number.");
      return;
    }

    // 在车位列表中查找
    // Find the spot in the spots list
    let foundSpot = null;
    for (let i = 0; i < spots.length; i++) {
      if (spots[i].id === spotId) {
        foundSpot = spots[i];
        break;
      }
    }

    // 车位编号不存在
    // Spot ID does not exist
    if (!foundSpot) {
      Alert.alert("Spot not found", '"' + spotId + '" does not exist.\nExample formats: OKU-1, R1-1, R12-23');
      return;
    }

    // 车位已被占用
    // Spot is already occupied
    if (foundSpot.status !== "free") {
      Alert.alert("Spot Occupied", "Spot " + spotId + " is already taken.");
      return;
    }

    // 用选中的车辆签入（而非硬编码第一辆）
    // Check in with the user-selected vehicle — not hardcoded to vehicles[0]
    let selectedPlate = "";
    for (let i = 0; i < vehicles.length; i++) {
      if (vehicles[i].id === selectedVehicleId) {
        selectedPlate = vehicles[i].plate;
        break;
      }
    }

    // 找不到选中车辆（理论上不会发生，防御性检查）
    // Selected vehicle not found — defensive guard, should not happen in practice
    if (!selectedPlate) {
      Alert.alert("Error", "Selected vehicle not found. Please try again.");
      return;
    }

    ctxCheckIn(foundSpot.id, selectedPlate);
    setCheckInModal(false);
    setSpotInput("");
    setSelectedVehicleId(""); // 重置车辆选择 / reset vehicle selection
    Alert.alert("✅ Checked In!", "Parked at Spot " + spotId);
  }

  /*
  通过车牌号查询车主信息。
  Looks up a vehicle owner by plate number.
  */
  function handleVehicleLookup() {
    const plate = plateInput.trim().toUpperCase();

    // 不能为空
    // Cannot be empty
    if (!plate) {
      Alert.alert("Please enter a plate number.");
      return;
    }

    // [BUG 5 FIX] 去掉所有内部空格后再与 VEHICLE_REGISTRY 的 key 比较。
    // 原来直接用 VEHICLE_REGISTRY[plate] 精确匹配，key 带空格（如 "WXY 1234"），
    // 用户输入 "WXY1234"（无空格）时查不到，反之亦然。
    // [BUG 5 FIX] Strip all internal spaces before matching against VEHICLE_REGISTRY keys.
    // Previously VEHICLE_REGISTRY[plate] did an exact key lookup — keys contain spaces
    // (e.g. "WXY 1234") so input like "WXY1234" (no space) would never match, and vice versa.
    const plateNoSpaces = plate.replace(/\s/g, "");
    let foundKey: string | undefined;
    let foundEntry: { name: string; phone: string } | undefined;
    const registryKeys = Object.keys(VEHICLE_REGISTRY);
    for (let i = 0; i < registryKeys.length; i++) {
      if (registryKeys[i].replace(/\s/g, "").toUpperCase() === plateNoSpaces) {
        foundKey   = registryKeys[i];
        foundEntry = VEHICLE_REGISTRY[registryKeys[i]];
        break;
      }
    }

    if (foundEntry && foundKey) {
      // 展示原始 key 的车牌格式（保留空格），保持一致性
      // Display the canonical plate format from the registry key (preserving spaces)
      setLookupResult({ name: foundEntry.name, plate: foundKey, phone: foundEntry.phone });
    } else {
      setLookupResult(null);
      Alert.alert("Not Found", 'No record for plate "' + plate + '".');
    }
  }

  // ── 派生显示值 / Derived display values ─────────────────────────────────────

  // 统计行数据（提取为具名数组）
  // Stats row data — extracted as a named array
  const statItems = [
    { label: "Free",     val: AVAILABLE_SPOTS, color: T.green  },
    { label: "Occupied", val: OCCUPIED_SPOTS,  color: T.red    },
    { label: "OKU",      val: okuTotal,        color: T.orange },
    { label: "Total",    val: TOTAL_SPOTS,     color: T.accent },
  ];

  // 进度条宽度（百分比字符串）
  // Progress bar width as a percentage string
  const progressWidth = availPct + "%";

  // 保安弹窗图标颜色
  // Security modal icon colours
  const securityIconBg     = T.red + "20";
  const securityIconBorder = T.red + "44";

  // 签入弹窗图标颜色
  // Check-in modal icon colours
  const checkInIconBg     = T.accent + "20";
  const checkInIconBorder = T.accent + "44";

  // 查询弹窗图标颜色
  // Lookup modal icon colours
  const lookupIconBg     = (T as any).blue + "20";
  const lookupIconBorder = (T as any).blue + "44";

  // 导航按钮颜色
  // Directions button colours
  const dirBtnBg     = T.accent + "22";
  const dirBtnBorder = T.accent + "55";

  // 签入/签出按钮的边框颜色（有活动会话时红色边框）
  // Check-in/out button border — red when active session exists
  let checkInOutBorderColor: string;
  if (activeSession) {
    checkInOutBorderColor = T.red;
  } else {
    checkInOutBorderColor = T.border;
  }

  // 签入/签出按钮文字颜色
  // Check-in/out button text colour
  let checkInOutTextColor: string;
  if (activeSession) {
    checkInOutTextColor = T.red;
  } else {
    checkInOutTextColor = T.green;
  }

  // 签入/签出按钮图标和文字
  // Check-in/out button icon and label
  let checkInOutIcon:  string;
  let checkInOutLabel: string;
  if (activeSession) {
    checkInOutIcon  = "🚗";
    checkInOutLabel = "Check Out";
  } else {
    checkInOutIcon  = "✅";
    checkInOutLabel = "Quick Check-In";
  }

  // ── 最近活动列表渲染 / Recent activity list renderer ────────────────────────
  /*
  抽取为函数，使 JSX 更简洁，与团队其他页面风格保持一致。
  Extracted as a function to keep JSX concise and consistent with other screens.
  */
  function renderActivityList() {
    if (activity.length === 0) {
      return (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ color: T.muted, fontSize: 13 }}>No activity yet</Text>
        </View>
      );
    }

    return activity.map(function renderActivityItem(item) {
      // 绿点=签入，红点=签出 / green dot = check-in, red dot = check-out
      let dotColor = T.red;
      if (item.isIn) {
        dotColor = T.green;
      }
      return (
        <View
          key={item.id}
          style={[styles.activityCard, { backgroundColor: T.card, borderColor: T.border }]}
        >
          <View style={[styles.activityDot, { backgroundColor: dotColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.activityPlate, { color: T.text }]}>{item.plate}</Text>
            <Text style={[styles.activityAction, { color: T.muted }]}>{item.action}</Text>
          </View>
          <Text style={[styles.activityTime, { color: T.muted }]}>{item.time}</Text>
        </View>
      );
    });
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* 顶部：问候语 + logo / Header: greeting and logo */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View>
            {/* 实时时钟（独立组件，隔离重渲染）
                Live clock — isolated component prevents full-screen re-renders */}
            <LiveClock style={[styles.greeting, { color: T.muted }]} />
            <Text style={[styles.pageTitle, { color: T.text }]}>{greeting}</Text>
          </View>
          <Image
            source={require("../../assets/images/itkia.png")}
            style={{ width: 80, height: 40, resizeMode: "contain" }}
          />
        </Animated.View>

        {/* 校园位置卡片 / Campus location card */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.gpsCard, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={styles.gpsLeft}>
              <Text style={styles.gpsIcon}>📍</Text>
              <View>
                <Text style={[styles.gpsTitle, { color: T.muted }]}>Campus Location</Text>
                <Text
                  style={[styles.gpsVal, { color: T.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  EduCity, Iskandar Puteri, Johor
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.directionsBtn, { backgroundColor: dirBtnBg, borderColor: dirBtnBorder }]}
              onPress={openMapsToMDIS}
              activeOpacity={0.8}
            >
              <Text style={[styles.directionsBtnText, { color: T.accent }]}>Navigate →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* 总体状态横幅 / Overall status banner */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View
            style={[
              styles.statusBanner,
              { backgroundColor: T.card, borderColor: statusColor + "55" },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor, flex: 1 }]}>
              {statusLabel}
            </Text>
            <Text style={[styles.statusTime, { color: T.muted }]}>Updated just now</Text>
          </View>
        </Animated.View>

        {/* 主卡片：环形图 + 进度条 / Main card: ring and progress bar */}
        <Animated.View
          style={[
            styles.card,
            styles.mainCard,
            { backgroundColor: T.card, borderColor: T.border, opacity: fadeAnim },
          ]}
        >
          <Text style={[styles.cardLabel, { color: T.muted }]}>MDIS MAIN PARKING LOT</Text>
          <AvailabilityRing available={AVAILABLE_SPOTS} total={TOTAL_SPOTS} T={T} />

          {/* 进度条 / Progress bar */}
          <View style={[styles.progressBg, { backgroundColor: T.border }]}>
            <View
              style={[
                styles.progressFill,
                { width: progressWidth as any, backgroundColor: statusColor },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: T.muted }]}>{availPct}% available</Text>
        </Animated.View>

        {/* 统计数字行 / Stats number row */}
        <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
          {statItems.map(function renderStatCard(stat) {
            const cardBorderColor = stat.color + "44";
            return (
              <View
                key={stat.label}
                style={[
                  styles.statCard,
                  { backgroundColor: T.card, borderColor: cardBorderColor },
                ]}
              >
                <Text style={[styles.statNumber, { color: stat.color }]}>{stat.val}</Text>
                <Text style={[styles.statLabel,  { color: T.muted    }]}>{stat.label}</Text>
              </View>
            );
          })}
        </Animated.View>

        {/* 快捷操作区域标题 / Quick actions section title */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>QUICK ACTIONS</Text>

        {/* 第一行：保安 | 扫描车牌 / Row 1: Security | Scan Plate */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={function openSecurity() { setSecurityModal(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🚨</Text>
            <Text style={[styles.actionText, { color: "red" }]}>Security</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={function goToCamera() { router.push("/camera" as any); }}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={[styles.actionText, { color: T.text }]}>Scan Plate</Text>
          </TouchableOpacity>
        </View>

        {/* 第二行：快速签入/签出 | 车辆查询 / Row 2: Quick Check-In/Out | Vehicle Lookup */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: T.card, borderWidth: 1, borderColor: checkInOutBorderColor },
            ]}
            onPress={handleCheckInOutPress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>{checkInOutIcon}</Text>
            <Text style={[styles.actionText, { color: checkInOutTextColor }]}>
              {checkInOutLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: T.card, borderWidth: 1, borderColor: T.border }]}
            onPress={function openLookup() {
              setPlateInput("");
              setLookupResult(null);
              setLookupModal(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={[styles.actionText, { color: T.text }]}>Vehicle Lookup</Text>
          </TouchableOpacity>
        </View>

        {/* 最近活动列表 / Recent activity list */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>RECENT ACTIVITY</Text>
        {renderActivityList()}

      </ScrollView>

      {/* ── 保安弹窗 / Security Modal ──────────────────────────────────────── */}
      <Modal
        transparent
        animationType="slide"
        visible={securityModal}
        onRequestClose={function closeModal() { setSecurityModal(false); }}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={function closeModal() { setSecurityModal(false); }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}
          >
            <View style={[styles.handle, { backgroundColor: T.border }]} />
            <View style={[styles.modalIconCircle, { backgroundColor: securityIconBg, borderColor: securityIconBorder }]}>
              <Text style={{ fontSize: 28 }}>🚨</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.red }]}>Contact Security</Text>
            <Text style={[styles.modalSub, { color: T.muted }]}>
              Contact campus security{"\n"}Tap a number to call
            </Text>

            {/* 联系人列表 / Contact list */}
            {SECURITY_CONTACTS.map(function renderContact(contact) {
              const phoneNoSpaces = contact.phone.replace(/\s|-/g, "");
              return (
                <TouchableOpacity
                  key={contact.name}
                  activeOpacity={0.8}
                  onPress={function callContact() { Linking.openURL("tel:" + phoneNoSpaces); }}
                  style={[styles.contactRow, { backgroundColor: T.bg, borderColor: T.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contactName, { color: T.text }]}>{contact.name}</Text>
                  </View>
                  <View style={[styles.callBadge, { backgroundColor: T.green + "20", borderColor: T.green + "55" }]}>
                    <Text style={{ fontSize: 14 }}>📞</Text>
                    <Text style={[styles.callNum, { color: T.green }]}>{contact.phone}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={function closeModal() { setSecurityModal(false); }}
            >
              <Text style={[styles.cancelBtnText, { color: T.muted }]}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 快速签入弹窗 / Quick Check-In Modal ──────────────────────────── */}
      <Modal
        transparent
        animationType="slide"
        visible={checkInModal}
        onRequestClose={function closeModal() { setCheckInModal(false); }}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={function closeModal() { setCheckInModal(false); }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}
          >
            <View style={[styles.handle, { backgroundColor: T.border }]} />
            <View style={[styles.modalIconCircle, { backgroundColor: checkInIconBg, borderColor: checkInIconBorder }]}>
              <Text style={{ fontSize: 28 }}>✅</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.text }]}>Quick Check-In</Text>
            <Text style={[styles.modalSub, { color: T.muted }]}>Enter your spot number</Text>

            {/* 车辆选择列表 / Vehicle selection list */}
            <Text style={[styles.inputLabel, { color: T.muted }]}>Select Vehicle</Text>
            {vehicles.length === 0 ? (
              <Text style={{ color: T.red, fontSize: 12, marginBottom: 12 }}>
                No vehicles registered. Go to Profile to add one.
              </Text>
            ) : (
              <View style={{ marginBottom: 14 }}>
                {vehicles.map(function renderVehicleOption(v) {
                  // 是否是当前选中的车辆
                  // Whether this vehicle is currently selected
                  const isSelected = selectedVehicleId === v.id;

                  // 选中时使用主题色边框和淡色背景，未选中时用默认边框
                  // Selected: accent border + tinted bg; unselected: default border
                  let vehicleBorderColor: string;
                  let vehicleBgColor: string;
                  if (isSelected) {
                    vehicleBorderColor = T.accent;
                    vehicleBgColor     = T.accent + "18";
                  } else {
                    vehicleBorderColor = T.border;
                    vehicleBgColor     = T.bg;
                  }

                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={function selectVehicle() { setSelectedVehicleId(v.id); }}
                      activeOpacity={0.75}
                      style={{
                        flexDirection:  "row",
                        alignItems:     "center",
                        padding:        12,
                        borderRadius:   12,
                        borderWidth:    1.5,
                        borderColor:    vehicleBorderColor,
                        backgroundColor: vehicleBgColor,
                        marginBottom:   8,
                        gap:            10,
                      }}
                    >
                      {/* 选中状态指示圆点 / Selection indicator dot */}
                      <View style={{
                        width:        20,
                        height:       20,
                        borderRadius: 10,
                        borderWidth:  2,
                        borderColor:  isSelected ? T.accent : T.border,
                        backgroundColor: isSelected ? T.accent : "transparent",
                        justifyContent: "center",
                        alignItems:   "center",
                      }}>
                        {isSelected && (
                          <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>✓</Text>
                        )}
                      </View>
                      {(function renderVehicleEmoji() {
                        let vehicleEmoji: string;
                        if (v.isOKU) {
                          vehicleEmoji = "♿";
                        } else {
                          vehicleEmoji = "🚗";
                        }
                        return <Text style={{ fontSize: 16 }}>{vehicleEmoji}</Text>;
                      })()}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: T.text, fontWeight: "700", fontSize: 14 }}>{v.plate}</Text>
                        <Text style={{ color: T.muted, fontSize: 11, marginTop: 1 }}>{v.model}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 车位号输入框 / Spot number input */}
            <Text style={[styles.inputLabel, { color: T.muted }]}>Spot Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
              value={spotInput}
              onChangeText={function handleSpotInput(t) { setSpotInput(t.toUpperCase()); }}
              placeholder="e.g. R1-1, R12-23, R13-20"
              placeholderTextColor={T.muted}
              autoCapitalize="characters"
              autoFocus
            />
            <Text style={[styles.formatHint, { color: T.muted }]}>
              OKU spots: OKU-1, OKU-2{"\n"}
              Rows 1–12 + Side column(R13) 1-20
            </Text>

            {/* 签入按钮 / Check-in button */}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: T.accent }]}
              onPress={handleQuickCheckIn}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>✅  Check In Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={function closeModal() { setCheckInModal(false); }}
            >
              <Text style={[styles.cancelBtnText, { color: T.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 车辆查询弹窗 / Vehicle Lookup Modal ────────────────────────────── */}
      <Modal
        transparent
        animationType="slide"
        visible={lookupModal}
        onRequestClose={function closeModal() { setLookupModal(false); }}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={function closeModal() { setLookupModal(false); }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}
          >
            <View style={[styles.handle, { backgroundColor: T.border }]} />
            <View style={[styles.modalIconCircle, { backgroundColor: lookupIconBg, borderColor: lookupIconBorder }]}>
              <Text style={{ fontSize: 28 }}>🔍</Text>
            </View>
            <Text style={[styles.modalTitle, { color: T.text }]}>Vehicle Lookup</Text>
            <Text style={[styles.modalSub, { color: T.muted }]}>Enter a plate to find the owner</Text>

            {/* 车牌输入框 / Plate input */}
            <Text style={[styles.inputLabel, { color: T.muted }]}>Plate Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
              value={plateInput}
              onChangeText={function handlePlateInput(t) {
                setPlateInput(t.toUpperCase());
                setLookupResult(null);
              }}
              placeholder="e.g. WXY 1234"
              placeholderTextColor={T.muted}
              autoCapitalize="characters"
              autoFocus
            />

            {/* 搜索按钮 / Search button */}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: (function getLookupBtnColor() {
                  const themeBlue = (T as any).blue;
                  if (themeBlue) { return themeBlue; }
                  return T.accent;
                })() }]}
              onPress={handleVehicleLookup}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>🔍  Search</Text>
            </TouchableOpacity>

            {/* 查询结果卡片（有结果时显示）/ Result card — shown when a match is found */}
            {lookupResult && (
              <View
                style={[
                  styles.resultCard,
                  { backgroundColor: T.bg, borderColor: T.accent + "55" },
                ]}
              >
                <Text style={[styles.resultPlate, { color: T.accent }]}>
                  🚗 {lookupResult.plate}
                </Text>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultKey, { color: T.muted }]}>Owner</Text>
                  <Text style={[styles.resultVal, { color: T.text  }]}>{lookupResult.name}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultKey, { color: T.muted }]}>Phone</Text>
                  {/* 点击电话直接拨号 / Tap to call */}
                  <TouchableOpacity
                    onPress={function callOwner() {
                      const phoneNoSpaces = lookupResult.phone.replace(/\s|-/g, "");
                      Linking.openURL("tel:" + phoneNoSpaces);
                    }}
                  >
                    <Text style={[styles.resultPhone, { color: T.green }]}>
                      📞 {lookupResult.phone}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={function closeModal() { setLookupModal(false); }}
            >
              <Text style={[styles.cancelBtnText, { color: T.muted }]}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}