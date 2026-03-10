// ─────────────────────────────────────────────────────────────────────────────
// app/(tabs)/map.tsx  —  停车场地图页
// Parking Map Screen
//
// 功能 / Features:
//   1. 7×10 停车格子可视化（前两格为 OKU 专用）
//      7×10 spot grid (first 2 spots are OKU reserved)
//   2. GPS 定位 → 自动匹配最近车位
//      GPS → auto-find nearest spot
//   3. Check In / Check Out（写入 ParkingContext，同步 Home 页数据）
//      Check In/Out — writes to ParkingContext, syncs with Home screen
//   4. GPS 持续监听 → 离开校园自动 Check Out
//      Continuous GPS → auto checkout when leaving campus
//   5. OKU 车位警告弹窗（非 OKU 用户触发）
//      OKU warning modal for non-OKU users
//   6. 筛选器：全部 / 空位 / 占用
//      Filter: All / Free / Occupied
//
// 常见修改 / Common edits:
//   校园坐标          → CAMPUS / LOT_ORIGIN
//   自动签出距离      → AUTO_CHECKOUT_RADIUS_M
//   格子数量          → generateSpots() 的 row / col 循环
//
// IMPORTS (引入):
//   expo-location              → GPS permission + watch position (GPS定位权限和监听)
//   React hooks                → useEffect, useRef, useState
//   React Native components    → Alert, Animated, Image, Modal, ScrollView, etc.
//   useParkingContext          → spots, setSpots, checkIn, checkOut, vehicles, activeSession
//                                (车位格子, 签入/签出方法, 车辆, 活动会话)
//   SpotStatus, SpotType,
//   ParkingSpot, generateSpots → types & initialiser shared with ParkingContext
//                                (与 ParkingContext 共用的类型和初始化函数)
//   useTheme                   → current theme colors (当前主题颜色)
//
// EXPORTS (导出):
//   default MapScreen          → the map screen component (地图页面，默认导出)
// ─────────────────────────────────────────────────────────────────────────────

import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  Alert, Animated, Image, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";

import {
  ParkingSpot, // eslint-disable-line @typescript-eslint/no-unused-vars
  useParkingContext
} from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── Geographic constants (地理常量) ─────────────────────────────────────────
const CAMPUS                = { lat: 1.42945, lng: 103.63628 }; // Campus center (校园中心坐标)
const AUTO_CHECKOUT_RADIUS_M = 9999;                             // Auto-checkout distance in metres; 9999 = effectively disabled (自动签出距离，9999=实际关闭)
const LOT_ORIGIN            = { lat: 1.42945, lng: 103.63628 }; // Top-left corner of parking lot (停车场左上角坐标)
const SPOT_WIDTH_DEG        = 0.000023;  // Width of one spot in degrees longitude (每格经度宽度)
const SPOT_HEIGHT_DEG       = 0.000045;  // Height of one spot in degrees latitude (每格纬度高度)
const ROW_GAP_DEG           = 0.000010;  // Gap between rows (行间距)

// ─── Utility functions (工具函数) ─────────────────────────────────────────────

/*
   Returns the geographic centre-point of a spot by row/col.
   根据行列计算车位地理坐标中心点。
*/
function spotCoords(row: number, col: number) {
  return {
    lat: LOT_ORIGIN.lat - row * (SPOT_HEIGHT_DEG + ROW_GAP_DEG) - SPOT_HEIGHT_DEG / 2,
    lng: LOT_ORIGIN.lng + col * SPOT_WIDTH_DEG + SPOT_WIDTH_DEG / 2,
  };
}

/*
   Haversine distance in metres between two lat/lng points.
   用于 GPS 定位最近车位的两点间距离计算（米）。
*/
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R  = 6371000;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ OKUWarningModal
// Shown when a non-OKU user tries to park in an OKU spot.
// 非 OKU 用户尝试停 OKU 专用位时弹出警告。
// Animation: shake left-right on appear (弹出时左右抖动动画)
// ═════════════════════════════════════════════════════════════════════════════
function OKUWarningModal({ visible, onClose, onProceed, plate, T }: {
  visible:   boolean;
  onClose:   () => void;
  onProceed: () => void;
  plate:     string;
  T:         any;
}) {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Trigger shake animation when modal becomes visible (弹出时触发抖动动画)
  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.warningOverlay}>
        <Animated.View style={[styles.warningBox, {
          backgroundColor: T.card,
          borderColor: T.red + "55",
          transform: [{ translateX: shakeAnim }],
        }]}>
          {/* Warning icon circle (警告图标圆圈) */}
          <View style={[styles.warningIconCircle, { backgroundColor: T.red + "20", borderColor: T.red + "55" }]}>
            <Text style={{ fontSize: 38 }}>⚠️</Text>
          </View>

          <Text style={[styles.warningTitle, { color: T.red }]}>OKU Spot Warning</Text>
          <Text style={[styles.warningBody, { color: T.muted }]}>
            This spot is reserved for{" "}
            <Text style={{ color: T.blue, fontWeight: "800" }}>registered OKU students</Text> only.{"\n\n"}
            Your account <Text style={{ color: T.red, fontWeight: "800" }}>({plate})</Text> does not have OKU parking rights.{"\n\n"}
            Parking here may result in a <Text style={{ color: T.red, fontWeight: "800" }}>penalty or towing.</Text>
          </Text>

          {/* Primary: go back and find another spot (主按钮：返回另找车位) */}
          <TouchableOpacity style={[styles.warningCloseBtn, { backgroundColor: T.green }]} onPress={onClose}>
            <Text style={styles.warningCloseBtnText}>✅  Find Another Spot</Text>
          </TouchableOpacity>

          {/* Secondary: override — user claims OKU status not yet in system (次按钮：声称有OKU身份但未更新) */}
          <TouchableOpacity onPress={onProceed} style={styles.warningOverrideBtn}>
            <Text style={[styles.warningOverrideText, { color: T.muted }]}>I have OKU status (not yet updated)</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 🅿️ SpotModal
// Bottom sheet shown when the user taps a spot in the grid.
// 点击车位格子后弹出的底部详情弹窗。
//
// Button logic (按钮逻辑):
//   isMySpot → Check Out button (我的车位 → 签出按钮)
//   isFree   → Check In button  (空位 → 签入按钮)
//   else     → Spot taken (已占用 → 不可操作)
// ═════════════════════════════════════════════════════════════════════════════
function SpotModal({ spot, mySpotId, onClose, onCheckIn, onCheckOut, T }: {
  spot:       ParkingSpot | null;
  mySpotId:   string | null;
  onClose:    () => void;
  onCheckIn:  (s: ParkingSpot) => void;
  onCheckOut: (s: ParkingSpot) => void;
  T:          any;
}) {
  if (!spot) return null;

  const isMySpot = spot.id === mySpotId;
  const isOKU    = spot.type === "oku";
  const isFree   = spot.status === "free";

  // Color logic (颜色逻辑):
  //   my spot = yellow, OKU free = blue, OKU occupied = muted, normal free = green, normal occupied = red
  //   我的车位=黄, OKU空=蓝, OKU占=灰, 普通空=绿, 普通占=红
  const color = isMySpot ? T.yellow
    : isOKU ? (isFree ? T.blue : T.muted)
    : (isFree ? T.green : T.red);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      {/* Tap outside to close (点击外部关闭) */}
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />

          {/* Spot ID badge + status pill (车位编号徽章 + 状态标签) */}
          <View style={styles.modalHeader}>
            <View style={[styles.spotBadge, { borderColor: color + "66", backgroundColor: color + "18" }]}>
              <Text style={[styles.spotBadgeText, { color }]}>
                {isMySpot ? "📍" : isOKU ? "♿" : "🅿️"}  {spot.id}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[styles.statusPillText, { color }]}>
                {isMySpot ? "YOUR SPOT" : isOKU ? "OKU" : spot.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Details table (车位详情列表) */}
          <View style={[styles.detailBox, { backgroundColor: T.bg }]}>
            {([
              ["Row",    `Row ${spot.row + 1}`],
              ["Spot",   `#${spot.col + 1}`],
              ["Type",   isOKU ? "♿ OKU Reserved" : "Student Parking"],
              ["Status", isFree ? "✅ Available" : "🔴 Occupied"],
              ...(spot.plate     ? [["Plate",      spot.plate]]                as [string, string][] : []),
              ...(spot.checkedIn ? [["Checked In", spot.checkedIn]]            as [string, string][] : []),
              ...(isMySpot       ? [["GPS",        "📍 Your current location"]] as [string, string][] : []),
            ] as [string, string][]).map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: isMySpot && k === "GPS" ? T.yellow : T.text }]}>{v}</Text>
              </View>
            ))}
          </View>

          {/* OKU notice bar (OKU 提示条) */}
          {isOKU && (
            <View style={[styles.okuNote, { backgroundColor: T.blue + "15", borderColor: T.blue + "44" }]}>
              <Text style={[styles.okuNoteText, { color: T.blue }]}>♿  Reserved for registered OKU students only.</Text>
            </View>
          )}

          {/* Action button (操作按钮) */}
          {isMySpot ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: T.red }]} onPress={() => onCheckOut(spot)}>
              <Text style={styles.actionBtnText}>🚗  Check Out & Free Spot</Text>
            </TouchableOpacity>
          ) : isFree ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isOKU ? T.blue : T.accent }]} onPress={() => onCheckIn(spot)}>
              <Text style={styles.actionBtnText}>{isOKU ? "♿  Check In (OKU)" : "✅  Check In Here"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionBtn, { backgroundColor: T.border }]}>
              <Text style={[styles.actionBtnText, { color: T.muted }]}>🔴  Spot Already Taken</Text>
            </View>
          )}

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: T.muted }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 🗺️ MapScreen — Main screen component (主页面组件)
// ═════════════════════════════════════════════════════════════════════════════
export default function MapScreen() {
  const { theme: T } = useTheme();

  // ✅ FIX 2: Destructure `spots` and `setSpots` directly from ParkingContext
  //    instead of keeping a separate local useState copy.
  //    This means Home and Map always share the same spot data — no drift.
  //
  //    修复2：直接从 ParkingContext 获取 spots 和 setSpots，
  //    不再在本地另建一份 useState。Home 和 Map 从此共用同一份车位数据。
  const {
    vehicles,
    spots, setSpots,            // ✅ FIX 2: from context, not local state (从 context 获取，非本地 state)
    freeCount, occCount, okuFree, // ✅ FIX 2: pre-computed in context, no need to recompute here (context已计算好，无需在此重算)
    activeSession,
    checkIn:  ctxCheckIn,
    checkOut: ctxCheckOut,
  } = useParkingContext();

  // Current user's plate + OKU status (read from first registered vehicle)
  // 当前用户车牌和 OKU 身份（从第一辆车读取）
  const currentPlate = vehicles[0]?.plate ?? "";
  const isOKUUser    = vehicles[0]?.isOKU ?? false;

  // mySpotId comes from context's activeSession — always in sync
  // mySpotId 直接读 context 的 activeSession，永不失同步
  const mySpotId = activeSession?.spotId ?? null;

  // ── Local UI state (本地 UI 状态，不需要持久化) ─────────────────────────────
  const [selected,       setSelected]       = useState<ParkingSpot | null>(null);              // Currently tapped spot → opens SpotModal (当前点击的车位)
  const [filter,         setFilter]         = useState<"all" | "free" | "occupied">("all");    // Grid filter (格子筛选器)
  const [gpsStatus,      setGpsStatus]      = useState<"idle" | "scanning" | "found" | "outside">("idle");
  const [okuWarning,     setOkuWarning]     = useState(false);                                 // OKU warning modal visibility (OKU警告弹窗是否可见)
  const [pendingSpot,    setPendingSpot]    = useState<ParkingSpot | null>(null);              // OKU spot awaiting user override (等待用户确认的OKU车位)
  const [distFromCampus, setDistFromCampus] = useState<number | null>(null);                  // Distance from campus in metres (距校园距离，米)

  // ── Animation & refs (动画和 Ref) ─────────────────────────────────────────
  const pulseAnim   = useRef(new Animated.Value(1)).current;              // My-spot pulse animation (我的车位脉冲动画)
  const locationSub = useRef<Location.LocationSubscription | null>(null); // GPS subscription handle (GPS 订阅句柄)
  const mySpotIdRef = useRef<string | null>(null);                        // Stale-closure-safe ref for GPS callback (GPS回调中读取 mySpotId 用，避免陈旧闭包)
  useEffect(() => { mySpotIdRef.current = mySpotId; }, [mySpotId]);

  // ── Pulse animation: start on check-in, stop on check-out ────────────────
  // 脉冲动画：签入时启动，签出时停止
  useEffect(() => {
    if (mySpotId) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => { loop.stop(); pulseAnim.setValue(1.0); };
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1.0);
    }
  }, [mySpotId]);

  // ── GPS watch: start when checked in, stop when checked out ──────────────
  // GPS 监听：签入时开始，签出时停止
  useEffect(() => {
    if (mySpotId) startWatchingLocation();
    else stopWatchingLocation();
    return () => stopWatchingLocation(); // Cleanup on screen unmount (页面卸载时清理)
  }, [mySpotId]);

  // ── Sync GPS status indicator when session is restored from storage ───────
  // 当 activeSession 从 AsyncStorage 恢复时，同步更新 GPS 状态指示器
  // ✅ FIX 2 NOTE: The old `setSpots(...)` call that was here is REMOVED because
  //    context now owns the spots — they are already persisted & loaded correctly.
  //    修复2说明：此处原有的 setSpots(...) 调用已删除，
  //    因为 context 现在负责维护 spots，启动时已从 AsyncStorage 正确恢复。
  useEffect(() => {
    if (activeSession) {
      setGpsStatus("found");
    }
  }, [activeSession]);

  // ── GPS: start continuous location watching (开始持续 GPS 监听) ────────────
  async function startWatchingLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    stopWatchingLocation(); // Clear any old subscription first (先清理旧订阅)
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 30000 },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        const dist = distanceM(latitude, longitude, CAMPUS.lat, CAMPUS.lng);
        setDistFromCampus(Math.round(dist));
        // Auto checkout if user has left campus (超出自动签出半径则自动签出)
        if (dist > AUTO_CHECKOUT_RADIUS_M && mySpotIdRef.current) {
          doAutoCheckout(mySpotIdRef.current);
        }
      }
    );
  }

  // ── GPS: stop watching (停止 GPS 监听) ────────────────────────────────────
  function stopWatchingLocation() {
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
  }

  // ── Auto checkout when leaving campus (离开校园时自动签出) ─────────────────
  function doAutoCheckout(spotId: string) {
    // ✅ FIX 2: Removed local setSpots(...) call — ctxCheckOut() already updates
    //    context spots, which this component reads directly.
    //    修复2：删除了本地 setSpots(...) 调用 — ctxCheckOut() 已更新 context 中的
    //    spots，本组件直接读取 context，无需再本地更新一次。
    ctxCheckOut();
    setGpsStatus("idle");
    setDistFromCampus(null);
    stopWatchingLocation();
    Alert.alert(
      "🚗 Auto Checked Out",
      `You have left the MDIS campus.\nSpot ${spotId} has been automatically freed.`,
      [{ text: "OK" }]
    );
  }

  // ── GPS: find nearest spot to user's current location ─────────────────────
  // GPS 定位：找到用户当前位置最近的车位
  async function handleFindMySpot() {
    setGpsStatus("scanning");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location Required", "Please allow location access.");
      setGpsStatus("idle");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude } = loc.coords;

    // Find spot with minimum distance (找距离最近的车位)
    let closest: ParkingSpot | null = null, minDist = Infinity;
    for (const spot of spots) {
      const c = spotCoords(spot.row, spot.col);
      const dist = distanceM(latitude, longitude, c.lat, c.lng);
      if (dist < minDist) { minDist = dist; closest = spot; }
    }

    if (closest && minDist < 4) {
      // Within 4 m → considered at that spot (在4米内，认为在该车位)
      setGpsStatus("found");
      setSelected(closest);
    } else {
      setGpsStatus("outside");
      Alert.alert("📍 Not in Parking Lot", `Nearest spot: ${Math.round(minDist)}m away`);
      setTimeout(() => setGpsStatus("idle"), 3000);
    }
  }

  // ── Check-in flow (签入流程) ───────────────────────────────────────────────
  function handleCheckIn(spot: ParkingSpot) {
    setSelected(null);
    if (mySpotId) {
      Alert.alert("Already Checked In", `You are at Spot ${mySpotId}. Check out first.`);
      return;
    }
    // Non-OKU user taps OKU spot → show warning (非OKU用户点OKU位 → 弹警告)
    if (spot.type === "oku" && !isOKUUser) {
      setPendingSpot(spot);
      setOkuWarning(true);
      return;
    }
    confirmCheckIn(spot);
  }

  // Confirm and execute check-in (确认并执行签入)
  function confirmCheckIn(spot: ParkingSpot) {
    // ✅ FIX 2: Removed local setSpots(...) — ctxCheckIn() handles spot update in context.
    //    修复2：删除本地 setSpots(...) — ctxCheckIn() 已在 context 中更新车位状态。
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctxCheckIn(spot.id, currentPlate); // Updates context spots + session + activity (更新 context 的 spots、session 和 activity)
    setGpsStatus("found");
    Alert.alert("✅ Checked In!", `Parked at Spot ${spot.id} · ${timeNow}\n\n📍 GPS monitoring started.`);
  }

  // ── Check-out flow with confirmation alert (签出流程，含二次确认) ─────────
  function handleCheckOut(spot: ParkingSpot) {
    setSelected(null); // Close modal before Alert to avoid overlap (先关弹窗，避免与 Alert 叠加)
    Alert.alert("🚗 Check Out", `Leave Spot ${spot.id}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Check Out", style: "destructive", onPress: () => {
          // ✅ FIX 2: Removed local setSpots(...) — ctxCheckOut() handles it.
          //    修复2：删除本地 setSpots(...) — ctxCheckOut() 已处理。
          ctxCheckOut(); // Updates context spots + clears session + logs activity (更新 context spots、清除 session、记录活动)
          setGpsStatus("idle");
          setDistFromCampus(null);
          Alert.alert("👋 Checked Out!", `Spot ${spot.id} is now free.\nDrive safely!`);
        },
      },
    ]);
  }

  // ── Helper: get spot object by row + col (通过行列获取车位对象) ─────────────
  function getSpot(row: number, col: number) {
    return spots.find(s => s.row === row && s.col === col) ?? null;
  }

  // ── Helper: should a spot be dimmed by the filter? (格子是否因筛选器变暗) ──
  function isDimmed(spot: ParkingSpot) {
    if (spot.id === mySpotId) return false;   // My spot never dims (我的车位永远不变暗)
    if (filter === "free")     return spot.status !== "free";
    if (filter === "occupied") return spot.status !== "occupied";
    return false;
  }

  // ── Helper: colour for a spot cell (获取格子颜色) ─────────────────────────
  function spotColor(spot: ParkingSpot, isMySpot = false) {
    if (isMySpot)            return T.yellow;                                   // My spot → yellow (我的车位→黄)
    if (spot.type === "oku") return spot.status === "free" ? T.blue : T.muted;  // OKU → blue/grey (OKU→蓝/灰)
    return spot.status === "free" ? T.green : T.red;                            // Normal → green/red (普通→绿/红)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Background transparent so _layout.tsx LinearGradient shows through.
  // 背景 transparent，让 _layout.tsx 的渐变透出来。
  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header (顶部标题栏) ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>Parking Map</Text>
            <Text style={[styles.subtitle, { color: T.muted }]}>MDIS Educity · Student Lot</Text>
          </View>
          <Image source={require("../../assets/images/itkia.png")} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </View>

        {/* ── GPS monitoring banner — shown while checked in (GPS监听横幅，签入时显示) ── */}
        {mySpotId && (
          <View style={[styles.autoBanner, { backgroundColor: T.accent + "12", borderColor: T.accent + "44" }]}>
            <Text style={styles.autoBannerIcon}>📡</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.autoBannerTitle, { color: T.accent }]}>GPS Monitoring Active</Text>
              <Text style={[styles.autoBannerSub, { color: T.muted }]}>
                {distFromCampus !== null
                  ? `${distFromCampus}m from campus · Auto checkout at ${AUTO_CHECKOUT_RADIUS_M}m`
                  : "Tracking your distance..."}
              </Text>
            </View>
            {/* Distance progress bar (距离进度条) */}
            {distFromCampus !== null && (
              <View style={[styles.distBarWrap, { backgroundColor: T.border }]}>
                <View style={[styles.distBarFill, {
                  width: `${Math.min((distFromCampus / AUTO_CHECKOUT_RADIUS_M) * 100, 100)}%` as any,
                  backgroundColor: distFromCampus > 400 ? T.red : distFromCampus > 200 ? T.orange : T.green,
                }]} />
              </View>
            )}
          </View>
        )}

        {/* ── GPS find-my-spot button (GPS 定位按钮) ── */}
        <TouchableOpacity
          style={[styles.gpsBtn,
            gpsStatus === "scanning" && { borderColor: T.orange + "55", backgroundColor: T.orange + "12" },
            gpsStatus === "found"    && { borderColor: T.green  + "55", backgroundColor: T.green  + "12" },
            gpsStatus === "outside"  && { borderColor: T.red    + "55", backgroundColor: T.red    + "12" },
            gpsStatus === "idle"     && { borderColor: T.accent + "55", backgroundColor: T.accent + "12" },
          ]}
          onPress={handleFindMySpot}
          activeOpacity={0.8}
          disabled={gpsStatus === "scanning"}
        >
          <Text style={styles.gpsBtnIcon}>
            {gpsStatus === "scanning" ? "🔄" : gpsStatus === "found" ? "📍" : gpsStatus === "outside" ? "❌" : "📍"}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.gpsBtnTitle, {
              color: gpsStatus === "found"    ? T.green
                   : gpsStatus === "outside"  ? T.red
                   : gpsStatus === "scanning" ? T.orange
                   : T.accent,
            }]}>
              {gpsStatus === "scanning" ? "Scanning GPS..."
               : gpsStatus === "found"   ? `Parked at ${mySpotId}`
               : gpsStatus === "outside" ? "Not in parking lot"
               : "Find My Parking Spot"}
            </Text>
            <Text style={[styles.gpsBtnSub, { color: T.muted }]}>
              {gpsStatus === "found"
                ? "Tap your yellow spot 📍 to check out"
                : "Tap to detect which spot you're in"}
            </Text>
          </View>
          {/* Quick checkout button shown while parked (停车时显示的快速签出按钮) */}
          {mySpotId && (
            <TouchableOpacity
              onPress={() => { ctxCheckOut(); setGpsStatus("idle"); setDistFromCampus(null); }}
              style={styles.gpsClearBtn}
            >
              <Text style={[styles.gpsClearText, { color: T.muted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* ── Stats row (统计数据行) ── */}
        <View style={styles.statsRow}>
          {[
            { label: "Free",     val: freeCount,      color: T.green  },
            { label: "Occupied", val: occCount,        color: T.red    },
            { label: "OKU Free", val: `${okuFree}/2`,  color: T.blue   },
            { label: "Total",    val: 70,              color: T.accent },
          ].map(s => (
            <View key={s.label} style={[styles.statChip, { backgroundColor: T.card + "CC", borderColor: s.color + "44" }]}>
              <Text style={[styles.statNum,   { color: s.color }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: T.muted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Filter pills (筛选器) ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[
            { key: "all",      label: "All Spots", color: T.accent },
            { key: "free",     label: "Free",      color: T.green  },
            { key: "occupied", label: "Occupied",  color: T.red    },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key as any)}
              style={[styles.filterPill,
                filter === f.key
                  ? { backgroundColor: f.color,      borderColor: f.color  }
                  : { backgroundColor: "transparent", borderColor: T.border },
              ]}
            >
              <Text style={[styles.filterText, { color: filter === f.key ? "#fff" : T.muted }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Parking grid card (停车格子卡片) ── */}
        <View style={[styles.gridCard, { backgroundColor: T.card + "E8", borderColor: T.border }]}>

          {/* Top row: title + EXIT badge (顶部：标题 + EXIT 标签) */}
          <View style={styles.topRow}>
            <Text style={[styles.gridTitle, { color: T.muted }]}>🅿️ MDIS Student Parking</Text>
            <View style={[styles.exitBadge, { backgroundColor: T.green + "20", borderColor: T.green + "55" }]}>
              <Text style={[styles.exitText, { color: T.green }]}>EXIT ↗</Text>
            </View>
          </View>

          {/* 7 rows × 10 cols grid (7行×10列格子) */}
          {Array.from({ length: 7 }, (_, row) => (
            <View key={row} style={styles.rowWrap}>
              {/* Row label R1–R7 (行标签 R1~R7) */}
              <Text style={[styles.rowLabel, { color: T.muted }]}>R{row + 1}</Text>
              <View style={styles.rowSpots}>
                {Array.from({ length: 10 }, (_, col) => {
                  const spot = getSpot(row, col);
                  if (!spot) return null;
                  const isMySpot = spot.id === mySpotId;
                  const color    = spotColor(spot, isMySpot);
                  const dim      = isDimmed(spot);
                  const isOKU    = spot.type === "oku";

                  {/* My spot: pulse animation spotWrapper holds fixed layout size; scale transform applied to inner View only, preventing the pulse from pushing other spots around. 我的车位：脉冲动画。spotWrapper 固定占位，scale 动画在内层，防止撑大布局。 */}
                  if (isMySpot) return (
                    <TouchableOpacity
                      key={spot.id}
                      onPress={() => setSelected(spot)}
                      activeOpacity={0.7}
                      style={styles.spotWrapper}
                    >
                      <Animated.View style={[styles.spot, {
                        backgroundColor: T.yellow + "35",
                        borderColor:     T.yellow,
                        borderWidth:     2,
                        transform:       [{ scale: pulseAnim }],
                      }]}>
                        <Text style={{ fontSize: 9 }}>📍</Text>
                      </Animated.View>
                    </TouchableOpacity>
                  );

                  {/* Normal / OKU spot (普通 / OKU 格子) */}
                  return (
                    <TouchableOpacity
                      key={spot.id}
                      onPress={() => setSelected(spot)}
                      activeOpacity={0.7}
                      style={styles.spotWrapper}
                    >
                      <View style={[styles.spot, isOKU && styles.okuSpot, {
                        backgroundColor: dim ? color + "0D" : color + "28",
                        borderColor:     dim ? color + "25" : color + "99",
                        opacity:         dim ? 0.3 : 1,
                      }]}>
                        <Text style={[styles.spotText, { color: dim ? color + "60" : color }]}>
                          {isOKU ? "♿" : col + 1}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Bottom row: ENTRANCE badge (底部：ENTRANCE 标签) */}
          <View style={styles.bottomRow}>
            <View style={[styles.entranceBadge, { backgroundColor: T.red + "20", borderColor: T.red + "55" }]}>
              <Text style={[styles.entranceText, { color: T.red }]}>ENTRANCE ↘</Text>
            </View>
          </View>
        </View>

        {/* ── Legend (图例) ── */}
        <View style={styles.legend}>
          {[[T.green, "Free"], [T.red, "Occupied"], [T.blue, "OKU"], [T.yellow, "My Spot"]].map(([color, label]) => (
            <View key={label as string} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color as string }]} />
              <Text style={[styles.legendLabel, { color: T.muted }]}>{label as string}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.hint, { color: T.muted }]}>Tap any spot to check in · Tap 📍 to check out</Text>
      </ScrollView>

      {/* Modals are outside ScrollView so they render above everything (弹窗在 ScrollView 外，确保层级最高) */}

      {/* Spot detail bottom sheet (车位详情底部弹窗) */}
      <SpotModal
        spot={selected} mySpotId={mySpotId} T={T}
        onClose={() => setSelected(null)}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

      {/* OKU warning modal (OKU 警告弹窗) */}
      <OKUWarningModal
        visible={okuWarning} T={T} plate={currentPlate}
        onClose={()    => { setOkuWarning(false); setPendingSpot(null); }}
        onProceed={() => { setOkuWarning(false); if (pendingSpot) confirmCheckIn(pendingSpot); setPendingSpot(null); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" },

  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle:  { fontSize: 13 },

  autoBanner:      { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  autoBannerIcon:  { fontSize: 22 },
  autoBannerTitle: { fontSize: 13, fontWeight: "800" },
  autoBannerSub:   { fontSize: 11, marginTop: 2 },
  distBarWrap:     { width: 50, height: 5, borderRadius: 999, overflow: "hidden" },
  distBarFill:     { height: "100%", borderRadius: 999 },

  gpsBtn:      { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  gpsBtnIcon:  { fontSize: 26 },
  gpsBtnTitle: { fontSize: 14, fontWeight: "800" },
  gpsBtnSub:   { fontSize: 11, marginTop: 2 },
  gpsClearBtn: { padding: 6 },
  gpsClearText:{ fontSize: 16 },

  statsRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },
  statChip:  { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  statNum:   { fontSize: 18, fontWeight: "900" },
  statLabel: { fontSize: 10, marginTop: 2 },

  filterRow:  { marginBottom: 14 },
  filterPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  filterText: { fontSize: 13, fontWeight: "600" },

  gridCard:  { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 16 },
  topRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  gridTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  exitBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  exitText:  { fontWeight: "800", fontSize: 12 },
  rowWrap:   { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  rowLabel:  { fontSize: 10, width: 22, fontWeight: "600" },
  rowSpots:  { flexDirection: "row", gap: 5, flex: 1 },

  spotWrapper: { flex: 1, aspectRatio: 0.7, justifyContent: "center", alignItems: "center" },
  spot:        { width: "100%", height: "100%", borderRadius: 6, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  okuSpot:     { borderWidth: 2 },
  spotText:    { fontSize: 9, fontWeight: "800" },

  bottomRow:    { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  entranceBadge:{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  entranceText: { fontWeight: "800", fontSize: 12 },

  legend:      { flexDirection: "row", justifyContent: "center", gap: 18, marginBottom: 10 },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:   { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 12 },
  hint:        { fontSize: 12, textAlign: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle:  { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },

  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  spotBadge:      { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  spotBadgeText:  { fontSize: 18, fontWeight: "900" },
  statusPill:     { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  detailBox:      { borderRadius: 14, padding: 14, marginBottom: 14, gap: 12 },
  detailRow:      { flexDirection: "row", justifyContent: "space-between" },
  detailKey:      { fontSize: 13 },
  detailVal:      { fontWeight: "700", fontSize: 13 },
  okuNote:        { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  okuNoteText:    { fontSize: 12, fontWeight: "600" },
  actionBtn:      { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  actionBtnText:  { color: "white", fontWeight: "800", fontSize: 15 },
  closeBtn:       { alignItems: "center", paddingVertical: 8 },
  closeBtnText:   { fontSize: 14 },

  warningOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 24 },
  warningBox:          { borderRadius: 24, padding: 28, width: "100%", borderWidth: 1, alignItems: "center" },
  warningIconCircle:   { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  warningTitle:        { fontSize: 20, fontWeight: "900", marginBottom: 14 },
  warningBody:         { fontSize: 13, lineHeight: 22, textAlign: "center", marginBottom: 24 },
  warningCloseBtn:     { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", width: "100%", marginBottom: 10 },
  warningCloseBtnText: { color: "white", fontWeight: "800", fontSize: 15 },
  warningOverrideBtn:  { paddingVertical: 8 },
  warningOverrideText: { fontSize: 12 },
});