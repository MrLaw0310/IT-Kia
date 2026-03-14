/*
/(tabs)/map.tsx — 停车场地图页 / Parking Map Screen

功能 / Features:
1. 多行停车格子可视化（首行含 2 OKU 专用位）
   Multi-row parking spot grid (first row has 2 OKU reserved spots)
2. Check In / Check Out — 写入 ParkingContext，同步 Home 页数据
   Check In/Out — writes to ParkingContext, syncs with Home screen
3. OKU 车位警告弹窗（非 OKU 用户触发）
   OKU warning modal for non-OKU users
4. 筛选器：全部 / 空位 / 占用 | Filter: All / Free / Occupied

如何修改格子数量 / How to change spot counts:
 → 修改 ParkingContext.tsx 的 generateSpots() 里的 addRow() 调用
   Edit addRow() calls in generateSpots() inside ParkingContext.tsx
 → 修改后务必更新 ParkingContext.tsx 里的 LAYOUT_VERSION 字符串（清除缓存）
   Then bump LAYOUT_VERSION in ParkingContext.tsx to clear the cache
 → 如果某行需要通道（左右分组），在 WIDE_AISLE_SECTIONS 里添加该行的 section ID
   If a row needs an aisle, add its section ID to WIDE_AISLE_SECTIONS below
*/

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Animated, Image, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import {
  ParkingSpot, // eslint-disable-line @typescript-eslint/no-unused-vars
  useParkingContext,
} from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── Section layout (区域布局定义) ────────────────────────────────────────────
// 镜像 ParkingContext.tsx 的 generateSpots()，供渲染器分组并添加视觉间距。
// Mirrors generateSpots() in ParkingContext.tsx — used to group rows and add spacing.
//
// rowLabels: 左侧显示的行标签 / display labels shown at the left of each row
// paired:    true → 两行背靠背渲染 / true → rows rendered back-to-back with tighter margin
const SECTION_LAYOUT = [
  { id: "S1", rowLabels: ["R1"], paired: false }, // 独立行 / independent row
  { id: "S2", rowLabels: ["R2",  "R3"],  paired: true  }, // 背靠背，无通道 / paired, no aisle
  { id: "S3", rowLabels: ["R4",  "R5"],  paired: true  },
  { id: "S4", rowLabels: ["R6",  "R7"],  paired: true  },
  { id: "S5", rowLabels: ["R8",  "R9"],  paired: true  },
  { id: "S6", rowLabels: ["R10", "R11"], paired: true  }, // 背靠背，有通道 / paired, with aisle
  { id: "S7", rowLabels: ["R12"], paired: false }, // 独立行 / independent
  { id: "SR", rowLabels: ["Side"], paired: false }, // 右侧竖排 / right-side column
] as const;

// ─── Row alignment / aisle constants (行对齐 / 通道常量) ───────────────────────

// 左侧3格+大通道，使第4格对齐 R1 第6格 / 3 spots left group + wide aisle to align spot-4 with R1 spot-6
const WIDE_AISLE_SECTIONS = new Set(["S2", "S6"]);
const WIDE_AISLE_WIDTH = 60; // S2/S6 通道格宽度（px）/ aisle width for S2/S6 rows

// S3–S5 行左缩进，使第1格对齐 R3 第4格（x=124px）
// Left padding for S3–S5 so spot-1 aligns with R3 spot-4 at x=124
const MAIN_SECTION_INDENT = 22;

// SR 竖排顶部间距，经视觉校准使其从 R4 高度开始
// SR column marginTop — visually calibrated to start beside R4
const SR_MARGIN_TOP = 120;

// ─── Colour helpers (颜色辅助函数) ────────────────────────────────────────────

/*
返回车位格子的显示颜色。
Returns the display colour for a spot cell.
 我的车位 → 黄 / my spot → yellow
 OKU 空位 → 蓝 / OKU free → blue
 OKU 占用 → 灰 / OKU occupied → muted
 普通空位 → 绿 / normal free → green
 普通占用 → 红 / normal occupied → red
*/
function getSpotColor(spot: ParkingSpot, isMySpot: boolean, T: any): string {
  if (isMySpot) return T.yellow;
  if (spot.type === "oku") return spot.status === "free" ? T.blue : T.muted;
  return spot.status === "free" ? T.green : T.red;
}

/*
SpotModal 里的车位颜色逻辑（参数与格子版不同，单独提取）。
Colour logic for the SpotModal (different params from grid version).
*/
function getModalSpotColor(isMySpot: boolean, isOKU: boolean, isFree: boolean, T: any): string {
  if (isMySpot) return T.yellow;
  if (isOKU)    return isFree ? T.blue : T.muted;
  return isFree ? T.green : T.red;
}

// ─── SpotCell (单个停车格子) ───────────────────────────────────────────────────
/*
单个停车格子，用 React.memo 包装，只在自身数据变化时重新渲染。
Single parking spot cell, wrapped in React.memo to avoid re-rendering all 241 cells.
*/
const SpotCell = memo(function SpotCell({ spot, isMySpot, color, dim, pulseAnim, onPress }: {
  spot: ParkingSpot;
  isMySpot: boolean;
  color: string;
  dim: boolean;
  pulseAnim: Animated.Value;
  onPress: (spot: ParkingSpot) => void;
}) {
  const isOKU = spot.type === "oku";
  return (
    <TouchableOpacity onPress={() => onPress(spot)} activeOpacity={0.7} style={styles.spotWrapper}>
      {isMySpot ? (
        // 我的车位，脉冲黄色 / my spot: pulsing yellow
        <Animated.View style={[styles.spot, {
          backgroundColor: "#FFD70035",
          borderColor: "#FFD700",
          borderWidth: 2,
          transform: [{ scale: pulseAnim }],
        }]}>
          <Text style={{ fontSize: 9 }}>📍</Text>
        </Animated.View>
      ) : (
        // 普通 / OKU 格子 / normal or OKU spot
        <View style={[styles.spot, isOKU && styles.okuSpot, {
          backgroundColor: dim ? color + "0D" : color + "28",
          borderColor: dim ? color + "25" : color + "99",
          opacity: dim ? 0.3 : 1,
        }]}>
          <Text style={[styles.spotText, { color: dim ? color + "60" : color }]}>
            {isOKU ? "♿" : spot.col + 1}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// SR 格子，横向，编号旋转 –90° / SR spot: landscape orientation, number rotated –90°
const SRSpotCell = memo(function SRSpotCell({ spot, index, isMySpot, color, dim, pulseAnim, onPress }: {
  spot: ParkingSpot;
  index: number;
  isMySpot: boolean;
  color: string;
  dim: boolean;
  pulseAnim: Animated.Value;
  onPress: (spot: ParkingSpot) => void;
}) {
  return (
    <TouchableOpacity onPress={() => onPress(spot)} activeOpacity={0.7} style={styles.srSpotWrapper}>
      {isMySpot ? (
        <Animated.View style={[styles.srSpot, {
          backgroundColor: "#FFD70035",
          borderColor: "#FFD700",
          borderWidth: 2,
          transform: [{ scale: pulseAnim }],
        }]}>
          <Text style={styles.srSpotText}>📍</Text>
        </Animated.View>
      ) : (
        <View style={[styles.srSpot, {
          backgroundColor: dim ? color + "0D" : color + "28",
          borderColor: dim ? color + "25" : color + "99",
          opacity: dim ? 0.3 : 1,
        }]}>
          <Text style={[styles.srSpotText, { color: dim ? color + "60" : color }]}>
            {index + 1}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ─── OKUWarningModal (OKU 警告弹窗) ──────────────────────────────────────────
/*
非 OKU 用户尝试停 OKU 专用位时弹出警告，弹出时有左右抖动动画。
Shown when a non-OKU user tries to park in an OKU spot. Shakes on appear.
*/
function OKUWarningModal({ visible, onClose, onProceed, plate, T }: {
  visible: boolean;
  onClose: () => void;
  onProceed: () => void;
  plate: string;
  T: any;
}) {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // 弹出时触发左右抖动动画 / trigger shake animation when modal becomes visible
  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
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
          {/* 警告图标圆圈 / warning icon circle */}
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

          {/* 主按钮：返回另找车位 / primary: go back and find another spot */}
          <TouchableOpacity style={[styles.warningCloseBtn, { backgroundColor: T.green }]} onPress={onClose}>
            <Text style={styles.warningCloseBtnText}>✅  Find Another Spot</Text>
          </TouchableOpacity>

          {/* 次按钮：声称有 OKU 身份但未更新 / secondary: user claims OKU status not yet in system */}
          <TouchableOpacity onPress={onProceed} style={styles.warningOverrideBtn}>
            <Text style={[styles.warningOverrideText, { color: T.muted }]}>I have OKU status (not yet updated)</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── SpotModal (车位详情底部弹窗) ─────────────────────────────────────────────
/*
点击车位格子后弹出的底部详情弹窗。
Bottom sheet shown when the user taps a spot in the grid.

按钮逻辑 / Button logic:
 isMySpot → Check Out 按钮 / check out button
 isFree   → Check In 按钮 / check in button
 else     → 已占用，不可操作 / spot taken, no action
*/
function SpotModal({ spot, mySpotId, onClose, onCheckIn, onCheckOut, T }: {
  spot: ParkingSpot | null;
  mySpotId: string | null;
  onClose: () => void;
  onCheckIn: (s: ParkingSpot) => void;
  onCheckOut: (s: ParkingSpot) => void;
  T: any;
}) {
  if (!spot) return null;

  const isMySpot = spot.id === mySpotId;
  const isOKU = spot.type === "oku";
  const isFree = spot.status === "free";
  const color = getModalSpotColor(isMySpot, isOKU, isFree, T);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      {/* 点击外部关闭 / tap outside to close */}
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />

          {/* 车位编号徽章 + 状态标签 / spot ID badge + status pill */}
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

          {/* 车位详情列表 / details table */}
          <View style={[styles.detailBox, { backgroundColor: T.bg }]}>
            {([
              ["Row", `Row ${spot.row + 1}`],
              ["Spot", `#${spot.col + 1}`],
              ["Type", isOKU ? "♿ OKU Reserved" : "Student Parking"],
              ["Status", isFree ? "✅ Available" : "🔴 Occupied"],
              ...(spot.plate ? [["Plate", spot.plate]] as [string, string][] : []),
              ...(spot.checkedIn ? [["Checked In", spot.checkedIn]] as [string, string][] : []),
              ...(isMySpot ? [["GPS", "📍 Your current location"]] as [string, string][] : []),
            ] as [string, string][]).map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: isMySpot && k === "GPS" ? T.yellow : T.text }]}>{v}</Text>
              </View>
            ))}
          </View>

          {/* OKU 专用位提示条 / OKU reserved notice bar */}
          {isOKU && (
            <View style={[styles.okuNote, { backgroundColor: T.blue + "15", borderColor: T.blue + "44" }]}>
              <Text style={[styles.okuNoteText, { color: T.blue }]}>♿  Reserved for registered OKU students only.</Text>
            </View>
          )}

          {/* 操作按钮 / action button */}
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

// ─── MapScreen (地图主页面) ────────────────────────────────────────────────────
export default function MapScreen() {

  const { theme: T } = useTheme();
  const {
    vehicles, spots,
    freeCount, occCount, okuFree, okuTotal,
    activeSession,
    checkIn: ctxCheckIn,
    checkOut: ctxCheckOut,
  } = useParkingContext();

  // 从 context 派生，不需要存入 state / derived from context, not stored in state
  const currentPlate = vehicles[0]?.plate ?? ""; // 第一辆车的车牌 / first vehicle's plate
  const isOKUUser = vehicles[0]?.isOKU ?? false; // 第一辆车的 OKU 身份 / first vehicle's OKU flag
  const mySpotId = activeSession?.spotId ?? null;  // 当前停车位 ID / active spot ID

  // 状态 / state
  const [selected, setSelected] = useState<ParkingSpot | null>(null); // 点击的车位，触发弹窗 / tapped spot, opens SpotModal
  const [filter, setFilter] = useState<"all" | "free" | "occupied">("all"); // 格子筛选器 / grid filter
  const [okuWarning, setOkuWarning]  = useState(false); // OKU 警告弹窗可见性 / OKU warning modal visibility
  const [pendingSpot, setPendingSpot] = useState<ParkingSpot | null>(null); // 等待用户确认的 OKU 车位 / OKU spot awaiting user override

  const pulseAnim = useRef(new Animated.Value(1)).current; // 我的车位脉冲缩放动画 / my-spot pulse animation

  // 签入时循环脉冲，签出时停止 / loop pulse while checked in, stop when checked out
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

  // ─── 签入 / 签出处理函数 / Check-in & Check-out handlers ─────────────────────

  /* 用户点击空位时触发 / called when user taps a free spot */
  function handleCheckIn(spot: ParkingSpot) {
    setSelected(null);
    if (mySpotId) {
      Alert.alert("Already Checked In", `You are at Spot ${mySpotId}. Check out first.`);
      return;
    }
    if (spot.type === "oku" && !isOKUUser) {
      setPendingSpot(spot);
      setOkuWarning(true); // 非 OKU 用户显示警告 / show warning for non-OKU users
      return;
    }
    confirmCheckIn(spot);
  }

  /** 通过所有检查后执行实际签入 / executes the actual check-in after all guards pass */
  function confirmCheckIn(spot: ParkingSpot) {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctxCheckIn(spot.id, currentPlate);
    Alert.alert("✅ Checked In!", `Parked at Spot ${spot.id} · ${timeNow}`);
  }

  /** 用户点击自己的车位时触发签出 / called when user taps their own spot to check out */
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

  // ─── 格子渲染辅助函数 / Grid helpers ─────────────────────────────────────────

  // 每次 spots 变化时预计算所有区域行，避免每次 render 重复 filter/sort 241 个格子
  // Pre-compute section rows once per spots change — avoids re-filtering 241 spots on every render
  const sectionRowsMap = useMemo(() => {
    const map: Record<string, ParkingSpot[][]> = {};
    for (const sec of SECTION_LAYOUT) {
      const secSpots = spots.filter(s => s.section === sec.id);
      const rowNums = [...new Set(secSpots.map(s => s.row))].sort((a, b) => a - b);
      map[sec.id] = rowNums.map(r => secSpots.filter(s => s.row === r).sort((a, b) => a.col - b.col));
    }
    return map;
  }, [spots]);

  // 供 JSX 使用的稳定取值函数 / stable getter used in JSX
  const getSectionRows = useCallback(
    (sectionId: string) => sectionRowsMap[sectionId] ?? [],
    [sectionRowsMap]
  );

  // 当前筛选器是否使该车位变暗 / whether the current filter should dim this spot
  const isDimmed = useCallback((spot: ParkingSpot) => {
    if (spot.id === mySpotId)  return false;
    if (filter === "free")     return spot.status !== "free";
    if (filter === "occupied") return spot.status !== "occupied";
    return false;
  }, [filter, mySpotId]);

  // 返回车位格子的显示颜色 / returns display colour for a spot cell
  const spotColor = useCallback(
    (spot: ParkingSpot, isMySpot = false) => getSpotColor(spot, isMySpot, T),
    [T]
  );

  // 稳定的 onPress 传入 SpotCell，防止父组件 render 时触发子组件重渲染
  // Stable onPress passed to SpotCell — avoids re-renders when parent re-renders
  const handleSpotPress = useCallback((spot: ParkingSpot) => setSelected(spot), []);

  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* 顶部标题栏 / page header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>Parking Map</Text>
            <Text style={[styles.subtitle,  { color: T.muted }]}>MDIS Educity · Student Lot</Text>
          </View>
          <Image source={require("../../assets/images/itkia.png")} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </View>

        {/* 统计数据行 / stats row */}
        <View style={styles.statsRow}>
          {[
            { label: "Free", val: freeCount, color: T.green },
            { label: "Occupied", val: occCount, color: T.red },
            { label: "OKU Free", val: `${okuFree}/${okuTotal}`, color: T.blue },
            { label: "Total", val: spots.length, color: T.accent },
          ].map(s => (
            <View key={s.label} style={[styles.statChip, { backgroundColor: T.card + "CC", borderColor: s.color + "44" }]}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: T.muted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* 筛选器 / filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[
            { key: "all", label: "All Spots", color: T.accent },
            { key: "free", label: "Free", color: T.green },
            { key: "occupied", label: "Occupied",  color: T.red },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key as any)}
              style={[styles.filterPill,
                filter === f.key
                  ? { backgroundColor: f.color, borderColor: f.color  }
                  : { backgroundColor: "transparent", borderColor: T.border },
              ]}
            >
              <Text style={[styles.filterText, { color: filter === f.key ? "#fff" : T.muted }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 停车格子卡片 / parking grid card */}
        <View style={[styles.gridCard, { backgroundColor: T.card + "E8", borderColor: T.border }]}>
          <View style={styles.topRow}>
            <Text style={[styles.gridTitle, { color: T.muted }]}>🅿️ MDIS Student Parking</Text>
          </View>

          {/* 横向可滑动：左侧主格，右侧 SR 竖排
              Horizontal scroll: main grid on left, SR column on right */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingRight: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", flexShrink: 0 }}>

              {/* 主格 S1–S7 / main grid S1–S7 */}
              <View style={{ alignSelf: "flex-start" }}>
                {SECTION_LAYOUT.filter(sec => sec.id !== "SR").map((sec) => {
                  const sectionRows = getSectionRows(sec.id);
                  if (sectionRows.length === 0) return null;

                  // S3/S4/S5 整行缩进 / S3/S4/S5 indent whole row
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
                          {/* 行标签 e.g. R1, R2 / row label */}
                          <Text style={[styles.rowLabel, { color: T.muted }]}>
                            {sec.rowLabels[ri] ?? sec.rowLabels[0]}
                          </Text>

                          {/* 格子排列：S3-S5 整行缩进，S2/S6 使用大通道对齐
                              Spots: S3-S5 padded, S2/S6 use wide aisle */}
                          <View style={[styles.rowSpots, rowIndent > 0 && { paddingLeft: rowIndent }]}>
                            {rowSpots.map((spot, si) => {
                              const isMySpot = spot.id === mySpotId;
                              const color = spotColor(spot, isMySpot);
                              const dim = isDimmed(spot);
                              const showGap = si > 0 && spot.group !== rowSpots[si - 1].group;

                              return (
                                <View key={spot.id} style={{ flexDirection: "row", alignItems: "center" }}>
                                  {/* S2/S6 用大通道，其余用普通通道 / wide aisle for S2/S6, normal aisle elsewhere */}
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

              {/* SR 右侧竖排，从 R4 旁边开始（marginTop = S1+S2 高度 = 116px）
                  SR vertical column — starts beside R4 (marginTop = S1+S2 height).
                  格子横向（宽>高），编号旋转 –90°，模拟垂直停车位。
                  Spots are landscape (30w×22h) with numbers rotated –90° for perpendicular parking. */}
              <View style={[styles.srColumn, { marginTop: SR_MARGIN_TOP, borderLeftColor: T.border + "88" }]}>
                <Text style={[styles.srColLabel, { color: T.muted }]}>SR</Text>
                {(getSectionRows("SR")[0] ?? []).map((spot, si) => {
                  const isMySpot = spot.id === mySpotId;
                  const color = spotColor(spot, isMySpot);
                  const dim = isDimmed(spot);
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

        {/* 图例 / legend */}
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

      {/* 弹窗在 ScrollView 外，确保层级最高 / modals outside ScrollView so they render above everything */}

      {/* 车位详情底部弹窗 / spot detail bottom sheet */}
      <SpotModal
        spot={selected} mySpotId={mySpotId} T={T}
        onClose={() => setSelected(null)}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

      {/* OKU 警告弹窗 / OKU warning modal */}
      <OKUWarningModal
        visible={okuWarning} T={T} plate={currentPlate}
        onClose={()    => { setOkuWarning(false); setPendingSpot(null); }}
        onProceed={() => { setOkuWarning(false); if (pendingSpot) confirmCheckIn(pendingSpot); setPendingSpot(null); }}
      />
    </View>
  );
}

// ─── Styles (样式) ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // 页面容器 / page containers
  screen: { flex: 1 }, // 全屏容器，背景由 _layout.tsx 渐变填充 / gradient bg from _layout.tsx
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" },

  // 顶部标题栏 / page header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13 },

  // 统计数据行 / stats chips row
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statChip: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  statNum: { fontSize: 18, fontWeight: "900" },
  statLabel: { fontSize: 10, marginTop: 2 },

  // 筛选器 / filter pills
  filterRow: { marginBottom: 14 },
  filterPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  filterText: { fontSize: 13, fontWeight: "600" },

  // 停车格子卡片 / parking grid card
  gridCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 16 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  gridTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  // 区域分组 / section grouping
  sectionBlock: { marginBottom: 18, alignSelf: "flex-start" },              // 每个区域外层容器 / outer wrapper per section
  pairedBlock: { marginBottom: 63 },                                        // 背靠背双排间距 / tighter margin for paired sections
  pairedTopRow: { marginBottom: 14 },                                        // 双排上排 / top row of paired section
  pairedBottomRow: { marginBottom: 0 },                                         // 双排下排 / bottom row of paired section

  // SR 竖排容器，位于主格右侧，从 R4 高度开始
  // SR vertical column container — sits right of main grid, starts at R4 level
  srColumn: { flexDirection: "column", alignItems: "center", marginLeft: -38, paddingTop: 2 },
  srColLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 }, // "SR" 顶部标签 / top label
  srSpotWrapper: { width: 30, height: 22, justifyContent: "center", alignItems: "center", marginBottom: 2 }, // 横向格子容器 / landscape cell
  srSpot: { width: "100%", height: "100%", borderRadius: 3, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  srSpotText: { fontSize: 6, fontWeight: "800", transform: [{ rotate: "-90deg" }] }, // 编号旋转 –90° / number rotated

  aisle: { width: 82, height: "100%" as any, marginHorizontal: 3, borderRadius: 2, opacity: 0 }, // 行内通道间隙 / aisle gap

  // 行 / row
  rowWrap:  { flexDirection: "row", alignItems: "center", marginBottom: 18, alignSelf: "flex-start" }, // 行标签 + 格子横排 / label + spots
  rowLabel: { fontSize: 10, width: 28, fontWeight: "600" }, // 行标签固定28px宽 / fixed 28px label
  rowSpots: { flexDirection: "row", flexWrap: "nowrap" },   // 格子横排不换行 / single-line spots

  // 停车格子 / spot cells
  spotWrapper: { width: 22, height: 30, justifyContent: "center", alignItems: "center" }, // 固定尺寸容器 / fixed-size wrapper
  spot: { width: "100%", height: "100%", borderRadius: 4, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  okuSpot: { borderWidth: 2 }, // OKU 专用位加粗边框 / thicker border for OKU spots
  spotText: { fontSize: 7, fontWeight: "800" }, // 格子内文字（列号 或 ♿）/ spot text

  // 图例 + 提示 / legend and hint
  legend: { flexDirection: "row", justifyContent: "center", gap: 18, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 12 },
  hint: { fontSize: 12, textAlign: "center" },

  // 底部弹窗通用 / bottom sheet shared styles
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle: { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },

  // 车位详情弹窗 / spot detail modal
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  spotBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  spotBadgeText: { fontSize: 18, fontWeight: "900" },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  detailBox: { borderRadius: 14, padding: 14, marginBottom: 14, gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailKey: { fontSize: 13 },
  detailVal: { fontWeight: "700", fontSize: 13 },
  okuNote: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  okuNoteText: { fontSize: 12, fontWeight: "600" },
  actionBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  actionBtnText: { color: "white", fontWeight: "800", fontSize: 15 },
  closeBtn: { alignItems: "center", paddingVertical: 8 },
  closeBtnText: { fontSize: 14 },

  // OKU 警告弹窗 / OKU warning modal
  warningOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 24 },
  warningBox: { borderRadius: 24, padding: 28, width: "100%", borderWidth: 1, alignItems: "center" },
  warningIconCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  warningTitle: { fontSize: 20, fontWeight: "900", marginBottom: 14 },
  warningBody: { fontSize: 13, lineHeight: 22, textAlign: "center", marginBottom: 24 },
  warningCloseBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", width: "100%", marginBottom: 10 },
  warningCloseBtnText: { color: "white", fontWeight: "800", fontSize: 15 },
  warningOverrideBtn: { paddingVertical: 8 },
  warningOverrideText: { fontSize: 12 },
});