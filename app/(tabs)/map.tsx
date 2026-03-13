// ─────────────────────────────────────────────────────────────────────────────
// app/(tabs)/map.tsx  —  停车场地图页
// Parking Map Screen
//
// 功能 / Features:
//   1. 多行停车格子可视化（首行含 2 OKU 专用位）
//      Multi-row parking spot grid (first row has 2 OKU reserved spots)
//   2. Check In / Check Out（写入 ParkingContext，同步 Home 页数据）
//      Check In/Out — writes to ParkingContext, syncs with Home screen
//   3. OKU 车位警告弹窗（非 OKU 用户触发）
//      OKU warning modal for non-OKU users
//   4. 筛选器：全部 / 空位 / 占用
//      Filter: All / Free / Occupied
//
// 如何修改格子数量 / HOW TO CHANGE SPOT COUNTS:
//   ➜ 修改 ParkingContext.tsx 的 generateSpots() 里的 addRow() 调用
//     Edit addRow() calls in generateSpots() inside ParkingContext.tsx
//   ➜ 修改后务必更新 ParkingContext.tsx 里的 LAYOUT_VERSION 字符串
//     Then bump LAYOUT_VERSION in ParkingContext.tsx — this clears the cache
//   ➜ 如果某行需要通道（左右分组），在 WIDE_AISLE_SECTIONS 集合里添加该行的 section ID
//     If a row needs an aisle between left/right groups, add its section ID to
//     WIDE_AISLE_SECTIONS below.
//
// IMPORTS (引入):
//   React hooks       → memo, useCallback, useEffect, useMemo, useRef, useState
//   React Native      → Alert, Animated, Image, Modal, ScrollView, etc.
//   useParkingContext → spots, checkIn, checkOut, vehicles, activeSession, stats
//                       (车位数据, 签入/签出, 车辆, 会话, 统计)
//   ParkingSpot       → spot type shared with ParkingContext (车位类型，与 ParkingContext 共用)
//   useTheme          → current theme colors (当前主题颜色)
//
// EXPORTS (导出):
//   default MapScreen → the map screen component (地图页面，默认导出)
// ─────────────────────────────────────────────────────────────────────────────

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Animated, Image, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";

import {
  ParkingSpot, // eslint-disable-line @typescript-eslint/no-unused-vars
  useParkingContext
} from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── Section layout — mirrors generateSpots() in ParkingContext (区域布局定义) ──
// Used by the renderer to group rows and add visual spacing between sections.
// 供渲染器使用，将行分组并在区域间添加视觉间距。
//
// rowLabels: display labels shown at the left of each row (左侧显示的行标签)
// paired:    true → the two rows are rendered back-to-back with a pairedBlock margin
//            true → 两行背靠背渲染，外层用 pairedBlock 间距
const SECTION_LAYOUT = [
  { id: "S1", rowLabels: ["R1"],          paired: false },  // Row 1  — independent (独立行)
  { id: "S2", rowLabels: ["R2",  "R3"],   paired: true  },  // Rows 2–3  — paired, NO aisle (背靠背，无通道)
  { id: "S3", rowLabels: ["R4",  "R5"],   paired: true  },  // Rows 4–5  — paired
  { id: "S4", rowLabels: ["R6",  "R7"],   paired: true  },  // Rows 6–7  — paired
  { id: "S5", rowLabels: ["R8",  "R9"],   paired: true  },  // Rows 8–9  — paired
  { id: "S6", rowLabels: ["R10", "R11"],  paired: true  },  // Rows 10–11 — paired, WITH aisle (背靠背，有通道)
  { id: "S7", rowLabels: ["R12"],         paired: false },  // Row 12 — independent (独立行)
  { id: "SR", rowLabels: ["Side"],        paired: false },  // Right-side column (右侧竖排)
] as const;

// ─── Row alignment / aisle constants (行对齐 / 通道常量) ───────────────────────

const WIDE_AISLE_SECTIONS = new Set(["S2", "S6"]);
// Sections whose rows have 3 spots left group + wide aisle to align spot-4 with R1 spot-6
// (左侧3格+大通道，使第4格对齐R1第6格)

const WIDE_AISLE_WIDTH = 60;
// Width of the aisle View for S2/S6 rows (px); margins add 6 → total 58px ✓
// S2/S6通道格宽度（像素），加边距共58px

const MAIN_SECTION_INDENT = 22;
// Left padding for S3–S5 rows so spot-1 aligns with R3 spot-4 at x=124
// S3–S5行左缩进量，使第1格对齐R3第4格（x=124px）

// SR marginTop: vertical offset so the side column starts beside R4.
// SR竖排的顶部间距，使其从主格的 R4 行高度开始。
// S1: 1 row (30px spot) + rowWrap marginBottom(18) + sectionBlock marginBottom(18) ≈ 66px
// S2: pairedTopRow(30+14=44) + pairedBottomRow(30+18=48) + pairedBlock marginBottom(63) ≈ 155px  (but SR starts at R4, not after S2)
// Keep at 120 — visually calibrated to align SR beside S3 row 1 (R4).
// 保持 120 — 经视觉校准，使 SR 竖排与 S3 第一行（R4）左侧对齐。
const SR_MARGIN_TOP = 120;


// ═════════════════════════════════════════════════════════════════════════════
// 🟩 SpotCell — single parking spot cell (单个停车格子)
// Wrapped in React.memo so it only re-renders when its own data changes.
// 用 React.memo 包装，只在自身数据变化时重新渲染，避免 241 个格子全部重渲染。
// ═════════════════════════════════════════════════════════════════════════════
const SpotCell = memo(function SpotCell({ spot, isMySpot, color, dim, pulseAnim, onPress }: {
  spot:      ParkingSpot;
  isMySpot:  boolean;
  color:     string;
  dim:       boolean;
  pulseAnim: Animated.Value;
  onPress:   (spot: ParkingSpot) => void;
}) {
  const isOKU = spot.type === "oku";
  return (
    <TouchableOpacity onPress={() => onPress(spot)} activeOpacity={0.7} style={styles.spotWrapper}>
      {isMySpot ? (
        // My spot — pulsing yellow (我的车位，脉冲黄色)
        <Animated.View style={[styles.spot, {
          backgroundColor: "#FFD70035",
          borderColor:     "#FFD700",
          borderWidth:     2,
          transform:       [{ scale: pulseAnim }],
        }]}>
          <Text style={{ fontSize: 9 }}>📍</Text>
        </Animated.View>
      ) : (
        // Normal / OKU spot (普通/OKU格子)
        <View style={[styles.spot, isOKU && styles.okuSpot, {
          backgroundColor: dim ? color + "0D" : color + "28",
          borderColor:     dim ? color + "25" : color + "99",
          opacity:         dim ? 0.3 : 1,
        }]}>
          <Text style={[styles.spotText, { color: dim ? color + "60" : color }]}>
            {isOKU ? "♿" : spot.col + 1}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// SR variant — landscape orientation, number rotated –90° (SR格子，横向，编号旋转–90°)
const SRSpotCell = memo(function SRSpotCell({ spot, index, isMySpot, color, dim, pulseAnim, onPress }: {
  spot:      ParkingSpot;
  index:     number;
  isMySpot:  boolean;
  color:     string;
  dim:       boolean;
  pulseAnim: Animated.Value;
  onPress:   (spot: ParkingSpot) => void;
}) {
  return (
    <TouchableOpacity onPress={() => onPress(spot)} activeOpacity={0.7} style={styles.srSpotWrapper}>
      {isMySpot ? (
        <Animated.View style={[styles.srSpot, {
          backgroundColor: "#FFD70035",
          borderColor:     "#FFD700",
          borderWidth:     2,
          transform:       [{ scale: pulseAnim }],
        }]}>
          <Text style={styles.srSpotText}>📍</Text>
        </Animated.View>
      ) : (
        <View style={[styles.srSpot, {
          backgroundColor: dim ? color + "0D" : color + "28",
          borderColor:     dim ? color + "25" : color + "99",
          opacity:         dim ? 0.3 : 1,
        }]}>
          <Text style={[styles.srSpotText, { color: dim ? color + "60" : color }]}>
            {index + 1}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});


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

  // ══════════════════════════════════════════════════════════════════════════
  // 1️⃣  CONTEXT & THEME (Context 数据 + 主题)
  // ══════════════════════════════════════════════════════════════════════════

  const { theme: T } = useTheme();
  const {
    vehicles,
    spots,
    freeCount, occCount, okuFree, okuTotal,
    activeSession,
    checkIn:  ctxCheckIn,
    checkOut: ctxCheckOut,
  } = useParkingContext();

  // Derived from context — not stored in state (从 context 派生，不需要存入 state)
  const currentPlate = vehicles[0]?.plate ?? "";       // First vehicle's plate (第一辆车的车牌)
  const isOKUUser    = vehicles[0]?.isOKU ?? false;    // OKU status of first vehicle (第一辆车的OKU身份)
  const mySpotId     = activeSession?.spotId ?? null;  // Active spot ID, always in sync with context (当前停车位ID，始终与 context 同步)

  // ══════════════════════════════════════════════════════════════════════════
  // 2️⃣  ALL STATE & REFS (所有状态和 Ref，集中放这里)
  // ══════════════════════════════════════════════════════════════════════════

  const [selected,   setSelected]   = useState<ParkingSpot | null>(null);           // Tapped spot → opens SpotModal (点击的车位，触发弹窗)
  const [filter,     setFilter]     = useState<"all" | "free" | "occupied">("all"); // Grid display filter (格子筛选器)
  const [okuWarning, setOkuWarning] = useState(false);                              // OKU warning modal visibility (OKU警告弹窗是否可见)
  const [pendingSpot,setPendingSpot]= useState<ParkingSpot | null>(null);           // OKU spot waiting for user override (等待用户确认的OKU车位)

  const pulseAnim = useRef(new Animated.Value(1)).current; // My-spot pulse scale animation (我的车位脉冲缩放动画)

  // ══════════════════════════════════════════════════════════════════════════
  // 3️⃣  ALL EFFECTS (所有副作用，集中放这里)
  // ══════════════════════════════════════════════════════════════════════════

  // Pulse animation: loop while checked in, stop when checked out (签入时循环脉冲，签出时停止)
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

  // ══════════════════════════════════════════════════════════════════════════
  // 4️⃣  ALL HANDLERS & HELPERS (所有处理函数和辅助函数，集中放这里)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Check-In / Check-Out Handlers (签入 / 签出处理函数) ───────────────────

  // Called when user taps a free spot in the grid (用户点击空位时触发)
  function handleCheckIn(spot: ParkingSpot) {
    setSelected(null);
    if (mySpotId) {
      Alert.alert("Already Checked In", `You are at Spot ${mySpotId}. Check out first.`);
      return;
    }
    if (spot.type === "oku" && !isOKUUser) {
      setPendingSpot(spot);
      setOkuWarning(true); // Show OKU warning for non-OKU users (非OKU用户显示警告)
      return;
    }
    confirmCheckIn(spot);
  }

  // Executes the actual check-in after all guards pass (通过所有检查后执行签入)
  function confirmCheckIn(spot: ParkingSpot) {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctxCheckIn(spot.id, currentPlate);
    Alert.alert("✅ Checked In!", `Parked at Spot ${spot.id} · ${timeNow}`);
  }

  // Called when user taps their own spot to check out (用户点击自己的车位时触发签出)
  function handleCheckOut(spot: ParkingSpot) {
    setSelected(null);
    Alert.alert("🚗 Check Out", `Leave Spot ${spot.id}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Check Out", style: "destructive", onPress: () => {
          ctxCheckOut();
          Alert.alert("👋 Checked Out!", `Spot ${spot.id} is now free.\nDrive safely!`);
        },
      },
    ]);
  }

  // ── Grid Helpers (格子渲染辅助函数) ──────────────────────────────────────

  // Pre-compute all section rows once per spots change — avoids re-filtering 241 spots on every render
  // 每次 spots 变化时预计算所有区域行，避免每次 render 重复 filter/sort 241 个格子
  const sectionRowsMap = useMemo(() => {
    const map: Record<string, ParkingSpot[][]> = {};
    for (const sec of SECTION_LAYOUT) {
      const secSpots = spots.filter(s => s.section === sec.id);
      const rowNums  = [...new Set(secSpots.map(s => s.row))].sort((a, b) => a - b);
      map[sec.id]    = rowNums.map(r => secSpots.filter(s => s.row === r).sort((a, b) => a.col - b.col));
    }
    return map;
  }, [spots]);

  // Stable getter used by JSX (供 JSX 使用的稳定取值函数)
  const getSectionRows = useCallback(
    (sectionId: string) => sectionRowsMap[sectionId] ?? [],
    [sectionRowsMap]
  );

  // Returns true if spot should be greyed out by the current filter (当前筛选器是否使该车位变暗)
  const isDimmed = useCallback((spot: ParkingSpot) => {
    if (spot.id === mySpotId)  return false;
    if (filter === "free")     return spot.status !== "free";
    if (filter === "occupied") return spot.status !== "occupied";
    return false;
  }, [filter, mySpotId]);

  // Returns the display colour for a spot cell (返回车位格子的显示颜色)
  const spotColor = useCallback((spot: ParkingSpot, isMySpot = false): string => {
    if (isMySpot)            return T.yellow;
    if (spot.type === "oku") return spot.status === "free" ? T.blue : T.muted;
    return spot.status === "free" ? T.green : T.red;
  }, [T]);

  // Stable onPress passed to SpotCell — avoids re-renders when parent re-renders
  // 稳定的 onPress 传入 SpotCell，防止父组件 render 时触发子组件重渲染
  const handleSpotPress = useCallback((spot: ParkingSpot) => setSelected(spot), []);

  // ── Render ────────────────────────────────────────────────────────────────
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

        {/* ── Stats row (统计数据行) ── */}
        <View style={styles.statsRow}>
          {[
            { label: "Free",     val: freeCount,                  color: T.green  },
            { label: "Occupied", val: occCount,                    color: T.red    },
            { label: "OKU Free", val: `${okuFree}/${okuTotal}`,   color: T.blue   },
            { label: "Total",    val: spots.length,               color: T.accent },
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

          {/* Top row: title (顶部：标题) */}
          <View style={styles.topRow}>
            <Text style={[styles.gridTitle, { color: T.muted }]}>🅿️ MDIS Student Parking</Text>
          </View>

          {/* Horizontal scroll — main grid left, SR vertical column right
              横向可滑动：左侧主格，右侧 SR 竖排 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingRight: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", flexShrink: 0 }}>

              {/* ── Main grid S1–S7 ───────────────────────────────────────── */}
              <View style={{alignSelf:"flex-start"}}>
                {SECTION_LAYOUT.filter(sec => sec.id !== "SR").map((sec) => {
                  const sectionRows = getSectionRows(sec.id);
                  if (sectionRows.length === 0) return null;

                  // S3/S4/S5 indent whole row (单组行整体缩进)
                  const rowIndent = (sec.id === "S3" || sec.id === "S4" || sec.id === "S5")
                    ? MAIN_SECTION_INDENT : 0;

                  return (
                    <View key={sec.id} style={[styles.sectionBlock, sec.paired && styles.pairedBlock]}>
                      {sectionRows.map((rowSpots, ri) => (
                        <View key={ri} style={[
                          styles.rowWrap,
                          sec.paired && ri === 0 && styles.pairedTopRow,
                          sec.paired && ri === 1 && styles.pairedBottomRow,
                        ]}>
                          {/* Row label e.g. R1, R2 (行标签) */}
                          <Text style={[styles.rowLabel, { color: T.muted }]}>
                            {sec.rowLabels[ri] ?? sec.rowLabels[0]}
                          </Text>

                          {/* Spots row — indent S3-S5; use wide aisle for S2/S6
                              格子排列：S3-S5整行缩进，S2/S6使用大通道对齐 */}
                          <View style={[styles.rowSpots, rowIndent > 0 && { paddingLeft: rowIndent }]}>
                            {rowSpots.map((spot, si) => {
                              const isMySpot = spot.id === mySpotId;
                              const color    = spotColor(spot, isMySpot);
                              const dim      = isDimmed(spot);
                              const showGap  = si > 0 && spot.group !== rowSpots[si - 1].group;

                              return (
                                <View key={spot.id} style={{ flexDirection: "row", alignItems: "center" }}>
                                  {/* Wide aisle for S2/S6, normal aisle elsewhere (S2/S6用大通道，其余用普通通道) */}
                                  {showGap && (
                                    <View style={[
                                      styles.aisle,
                                      WIDE_AISLE_SECTIONS.has(sec.id) && { width: WIDE_AISLE_WIDTH },
                                      { backgroundColor: T.border + "55" },
                                    ]} />
                                  )}
                                  <SpotCell
                                    spot={spot}
                                    isMySpot={isMySpot}
                                    color={color}
                                    dim={dim}
                                    pulseAnim={pulseAnim}
                                    onPress={handleSpotPress}
                                  />
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}

              </View>

              {/* ── SR vertical column (SR右侧竖排) ────────────────────────────
                  Starts beside R4 (marginTop = S1+S2 height = 116px).
                  从R4旁边开始（marginTop = S1+S2高度 = 116px）。
                  Spots are landscape (30w×22h) with numbers rotated –90° to
                  represent perpendicular parking spaces.
                  格子横向（宽>高），编号旋转–90°，模拟垂直停车位。 */}
              <View style={[styles.srColumn, { marginTop: SR_MARGIN_TOP, borderLeftColor: T.border + "88" }]}>
                <Text style={[styles.srColLabel, { color: T.muted }]}>SR</Text>
                {(getSectionRows("SR")[0] ?? []).map((spot, si) => {
                  const isMySpot = spot.id === mySpotId;
                  const color    = spotColor(spot, isMySpot);
                  const dim      = isDimmed(spot);
                  return (
                    <SRSpotCell
                      key={spot.id}
                      spot={spot}
                      index={si}
                      isMySpot={isMySpot}
                      color={color}
                      dim={dim}
                      pulseAnim={pulseAnim}
                      onPress={handleSpotPress}
                    />
                  );
                })}
              </View>

            </View>
          </ScrollView>
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

  // ── 页面容器 / Page containers ─────────────────────────────────────────────
  screen: { flex: 1 },
  // 全屏容器，背景由 _layout.tsx 渐变填充 / Full-screen wrapper, gradient bg from _layout.tsx                                                                             
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" }, 
  // 可滚动内容区，底部留空给 tab bar / Scrollable content, bottom pad for tab bar  

  // ── 顶部标题栏 / Page header ───────────────────────────────────────────────
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }, 
  // 标题 + 校徽横排 / Title row with school logo
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },                              
  // 页面主标题 "Parking Map" / Main page title
  subtitle:  { fontSize: 13 },
  // 副标题 "MDIS Educity · Student Lot" / Subtitle text

  // ── 统计数据行 / Stats chips row ───────────────────────────────────────────
  statsRow:  { flexDirection: "row", gap: 8, marginBottom: 14 },                                    
  // 四个统计数据横排容器 / Row container for four stat chips
  statChip:  { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" }, 
  // 单个统计数据卡片（Free / Occupied / OKU / Total）/ Individual stat chip
  statNum:   { fontSize: 18, fontWeight: "900" },                                                   
  // 统计数字（大号加粗）/ Stat number (large bold)
  statLabel: { fontSize: 10, marginTop: 2 },                                                        
  // 统计标签文字（如 "Free"）/ Stat label text

  // ── 筛选器 / Filter pills ──────────────────────────────────────────────────
  filterRow:  { marginBottom: 14 },                                                                  
  // 横向滚动筛选器容器行 / Horizontal scrollable filter row
  filterPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 }, 
  // 单个筛选胶囊按钮（All / Free / Occupied）/ Individual filter pill button
  filterText: { fontSize: 13, fontWeight: "600" },                                                  
  // 筛选按钮文字 / Filter button text

  // ── 停车格子卡片 / Parking grid card ──────────────────────────────────────
  gridCard:  { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 16 },
  topRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  gridTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  // ── 区域分组 / Section grouping ────────────────────────────────────────────
  sectionBlock:    { marginBottom: 18, alignSelf: "flex-start" },                                       
  // 每个区域（S1~S7, SR）的外层容器 / Outer wrapper for each section
  pairedBlock:     { marginBottom: 63},                                        
  // 背靠背双排区域：上下两行间距更紧 / Tighter margin for paired back-to-back sections
  pairedTopRow:    { marginBottom: 14 },                                        
  // 双排上排：底部间距极小（模拟背靠背）/ Top row of paired section: minimal bottom gap
  pairedBottomRow: { marginBottom: 0 },                                        
  // 双排下排 / Bottom row of paired section
  srColumn: {
    flexDirection: "column",
    alignItems: "center",
    marginLeft: -38,
    paddingTop: 2,
  },
  // SR vertical column container — sits to the right of main grid, starts at R4 level
  // SR 竖排容器，位于主格右侧，从 R4 高度开始

  srColLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  // "SR" label at top of the side column (竖排顶部标签)

  srSpotWrapper: { width: 30, height: 22, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  // Landscape spot cell (30×22) — rotated proportions to simulate perpendicular parking
  // 横向格子（宽×高），模拟垂直停车位的旋转视觉效果

  srSpot: { width: "100%", height: "100%", borderRadius: 3, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  // SR spot body, same colour logic as normal spots (SR格子主体，颜色逻辑同普通格子)

  srSpotText: { fontSize: 6, fontWeight: "800", transform: [{ rotate: "-90deg" }] },
  // Spot number rotated –90° to read along the column (格子编号旋转–90°，沿竖排阅读)
  aisle:           { width: 82, height: "100%" as any, marginHorizontal: 3, borderRadius: 2, opacity: 0 }, 
  // 行内通道间隙（左右子组之间）/ Aisle gap between left and right spot clusters in a row

  rowWrap:   { flexDirection: "row", alignItems: "center", marginBottom: 18, alignSelf: "flex-start" },
  // 每行：行标签 + 格子横排，不限宽度随内容伸展 / Row: label + spots inline, unconstrained width
  rowLabel:  { fontSize: 10, width: 28, fontWeight: "600" },
  // 行标签（R1 / R2 …）固定28px宽 / Row label fixed 28px width
  rowSpots:  { flexDirection: "row", flexWrap: "nowrap" },
  // 格子横排，不换行（横向 ScrollView 保证显示完整）/ Spots in a single line, no wrap (horizontal scroll handles overflow)

  // ── 停车格子 / Spot cells ──────────────────────────────────────────────────
  spotWrapper: { width: 22, height: 30, justifyContent: "center", alignItems: "center" },
  // 格子固定尺寸容器（22×30px，防止脉冲动画撑大布局）/ Fixed-size cell wrapper (prevents pulse from shifting layout)
  spot:        { width: "100%", height: "100%", borderRadius: 4, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  // 格子本体（颜色和边框通过 inline style 动态传入）/ Spot cell body (color/border via inline style)
  okuSpot:     { borderWidth: 2 },
  // OKU 专用位加粗边框覆盖样式 / Thicker border override for OKU spots
  spotText:    { fontSize: 7, fontWeight: "800" },
  // 格子内文字（列号 或 ♿）/ Spot cell text (col number or wheelchair emoji)

  // ── 图例 + 提示 / Legend & hint ────────────────────────────────────────────
  legend:      { flexDirection: "row", justifyContent: "center", gap: 18, marginBottom: 10 },      
  // 颜色图例横排（Free / Occupied / OKU / My Spot）/ Colour legend row
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 },                             
  // 单个图例项（圆点 + 文字）/ Single legend item (dot + label)
  legendDot:   { width: 10, height: 10, borderRadius: 3 },                                         
  // 图例颜色方块 / Legend colour square dot
  legendLabel: { fontSize: 12 },                                                                    
  // 图例文字（如 "Free"）/ Legend label text
  hint:        { fontSize: 12, textAlign: "center" },                                              
  // 底部操作提示文字 / Bottom hint text ("Tap any spot…")

  // ── 底部弹窗（通用）/ Bottom sheet (shared) ────────────────────────────────
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },            
  // 半透明遮罩，弹窗从底部弹出 / Semi-transparent overlay, sheet slides from bottom
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 }, 
  // 弹窗主体（圆角顶部）/ Bottom sheet body (rounded top corners)
  handle:  { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },    
  // 弹窗顶部拖动把手条 / Drag handle bar at top of sheet

  // ── 车位详情弹窗（SpotModal）/ Spot detail modal ───────────────────────────
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }, 
  // 车位编号徽章 + 状态标签横排 / Spot ID badge + status pill row
  spotBadge:      { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }, 
  // 车位编号徽章（如 "🅿️ R1-3"）/ Spot ID badge
  spotBadgeText:  { fontSize: 18, fontWeight: "900" },                                             
  // 车位编号文字（大号加粗）/ Spot ID text (large bold)
  statusPill:     { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  // 车位状态胶囊标签（FREE / OCCUPIED / YOUR SPOT）/ Status pill label
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },                           
  // 状态标签文字（全大写）/ Status pill text (uppercase)
  detailBox:      { borderRadius: 14, padding: 14, marginBottom: 14, gap: 12 },                    
  // 车位详情信息表容器 / Spot detail info table container
  detailRow:      { flexDirection: "row", justifyContent: "space-between" },                       
  // 单行详情（Key : Value）/ Single detail row (key : value)
  detailKey:      { fontSize: 13 },                                                                 
  // 详情键名文字（如 "Row"、"Type"）/ Detail key text
  detailVal:      { fontWeight: "700", fontSize: 13 },                                             
  // 详情值文字（加粗）/ Detail value text (bold)
  okuNote:        { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },             
  // OKU 专用位提示条 / OKU reserved notice bar
  okuNoteText:    { fontSize: 12, fontWeight: "600" },                                              
  // OKU 提示文字 / OKU notice text
  actionBtn:      { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 }, 
  // 主操作按钮（Check In / Check Out / Taken）/ Primary action button
  actionBtnText:  { color: "white", fontWeight: "800", fontSize: 15 },                             
  // 主操作按钮文字（白色）/ Action button text (white)
  closeBtn:       { alignItems: "center", paddingVertical: 8 },                                    
  // 底部关闭按钮 / Bottom close button
  closeBtnText:   { fontSize: 14 },                                                                 
  // 关闭按钮文字 / Close button text

  // ── OKU 警告弹窗（OKUWarningModal）/ OKU warning modal ─────────────────────
  warningOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 24 }, 
  // 更深的遮罩（居中显示警告框）/ Darker overlay, warning box centered
  warningBox:          { borderRadius: 24, padding: 28, width: "100%", borderWidth: 1, alignItems: "center" },                        
  // 警告框主体（红色边框）/ Warning box body (red border)
  warningIconCircle:   { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: "center", alignItems: "center", marginBottom: 16 }, 
  // ⚠️ 图标圆圈 / Warning icon circle
  warningTitle:        { fontSize: 20, fontWeight: "900", marginBottom: 14 },                      
  // 警告标题 "OKU Spot Warning" / Warning title text
  warningBody:         { fontSize: 13, lineHeight: 22, textAlign: "center", marginBottom: 24 },    
  // 警告详细说明文字（多行居中）/ Warning body text (multi-line centered)
  warningCloseBtn:     { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", width: "100%", marginBottom: 10 }, 
  // 主按钮 "Find Another Spot"（绿色）/ Primary button "Find Another Spot" (green)
  warningCloseBtnText: { color: "white", fontWeight: "800", fontSize: 15 },                        
  // 主按钮文字（白色粗体）/ Primary button text (white bold)
  warningOverrideBtn:  { paddingVertical: 8 },                                                      
  // 次按钮 "I have OKU status"（仅文字）/ Secondary override button (text only)
  warningOverrideText: { fontSize: 12 },                                                            
  // 次按钮文字 / Override button text
});