/*
app/(tabs)/map.tsx — 停车场地图页 / Parking Map Screen

功能 / Features:
 1. 多行停车格子可视化（首行含 2 OKU 专用位）
    Multi-row parking spot grid (first row has 2 OKU reserved spots)
 2. Check In / Check Out — 写入 ParkingContext，同步 Home 页数据
    Check In/Out — writes to ParkingContext, syncs with Home screen
 3. OKU 车位警告弹窗（非 OKU 用户触发）
    OKU warning modal for non-OKU users
 4. 筛选器：全部 / 空位 / 占用 / Filter: All / Free / Occupied

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
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { ParkingSpot, useParkingContext } from "../../utils/ParkingContext";
import type { Theme } from "../../utils/ThemeContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── 区域布局定义 / Section layout definitions ────────────────────────────────
/*
镜像 ParkingContext.tsx 的 generateSpots()，供渲染器分组并添加视觉间距。
Mirrors generateSpots() in ParkingContext.tsx — used to group rows and add spacing.

rowLabels: 左侧显示的行标签 / display labels shown at the left of each row
paired:    true → 两行背靠背渲染 / true → rows rendered back-to-back with tighter margin
*/
const SECTION_LAYOUT = [
  { id: "S1", rowLabels: ["R1"],          paired: false }, // 独立行 / independent row
  { id: "S2", rowLabels: ["R2",  "R3"],   paired: true  }, // 背靠背，有通道 / paired, with wide aisle
  { id: "S3", rowLabels: ["R4",  "R5"],   paired: true  }, // 背靠背，无通道 / paired, no aisle
  { id: "S4", rowLabels: ["R6",  "R7"],   paired: true  },
  { id: "S5", rowLabels: ["R8",  "R9"],   paired: true  },
  { id: "S6", rowLabels: ["R10", "R11"],  paired: true  }, // 背靠背，有通道 / paired, with wide aisle
  { id: "S7", rowLabels: ["R12"],         paired: false }, // 独立行 / independent row
  { id: "SR", rowLabels: ["Side"],        paired: false }, // 右侧竖排 / right-side column
];

// ─── 需要大通道对齐的区域 ID 列表 / Section IDs that use a wide aisle for alignment ──
// S2/S6 左侧3格 + 大通道，使第4格对齐 R1 第6格
// S2/S6: 3 spots left group + wide aisle so spot-4 aligns with R1 spot-6
const WIDE_AISLE_SECTIONS = ["S2", "S6"];

// ─── S3–S5 的左缩进区域 ID 列表 / Section IDs that indent the whole row left ────
// S3/S4/S5 整行缩进对齐
// S3/S4/S5 whole row is indented left for alignment
const INDENTED_SECTIONS = ["S3", "S4", "S5"];

// ─── 响应式尺寸基准 / Responsive sizing baseline ──────────────────────────────
// 基准屏幕宽 390px（iPhone 14）→ scale = 1.0
// Baseline screen width 390px (iPhone 14) → scale = 1.0
const BASE_SCREEN_WIDTH = 390;

// ─── 静态 UI 数据 / Static UI data ───────────────────────────────────────────

// 筛选器选项，key 必须和 filter state 类型一致
// Filter pill options — key must match the filter state type
const FILTER_OPTIONS = [
  { key: "all",      label: "All Spots" },
  { key: "free",     label: "Free"      },
  { key: "occupied", label: "Occupied"  },
];

// 图例项目，颜色在 JSX 里从主题取
// Legend items — colour is read from theme object in JSX
const LEGEND_ITEMS = [
  { themeKey: "green",  label: "Free"     },
  { themeKey: "red",    label: "Occupied" },
  { themeKey: "blue",   label: "OKU"      },
  { themeKey: "yellow", label: "My Spot"  },
];

// ─── 辅助函数 / Helper functions ──────────────────────────────────────────────

/*
根据屏幕宽度计算所有格子尺寸。
Computes all spot dimensions from the current screen width.

缩放范围限制在 0.75–1.5，避免极小或极大屏幕变形。
Scale is clamped to 0.75–1.5 to prevent distortion on very small/large screens.
*/
function calcSizes(screenWidth: number) {
  const rawScale = screenWidth / BASE_SCREEN_WIDTH;

  // 限制缩放范围 / clamp scale to a sensible range
  let scale: number;
  if (rawScale < 0.75) {
    scale = 0.75;
  } else if (rawScale > 1.5) {
    scale = 1.5;
  } else {
    scale = rawScale;
  }

  return {
    spotW:         Math.round(22  * scale), // 普通格子宽 / normal spot width
    spotH:         Math.round(30  * scale), // 普通格子高 / normal spot height
    spotFont:      Math.round(7   * scale), // 格子内文字大小 / spot text font size
    srSpotW:       Math.round(30  * scale), // SR 格子宽（横向）/ SR spot width (landscape)
    srSpotH:       Math.round(22  * scale), // SR 格子高（横向）/ SR spot height (landscape)
    srFont:        Math.round(6   * scale), // SR 格子文字大小 / SR spot text font size
    aisleWidth:    Math.round(60  * scale), // S2/S6 大通道宽度 / wide aisle width
    sectionIndent: Math.round(22  * scale), // S3–S5 左缩进量 / S3–S5 left indent
    srMarginTop:   Math.round(135 * scale), // SR 竖排顶部间距 / SR column top margin
    rowLabelWidth: Math.round(28  * scale), // 行标签宽度 / row label width
  };
}

/*
返回车位格子的显示颜色。
Returns the display colour for a parking spot cell.

规则 / Rules:
 我的车位 → 黄 / my spot → yellow
 OKU 空位 → 蓝 / OKU free → blue
 OKU 占用 → 白灰 / OKU occupied → whitegrey
 普通空位 → 绿 / normal free → green
 普通占用 → 红 / normal occupied → red
*/
function getSpotColor(
  isMySpot: boolean,
  isOKU:    boolean,
  isFree:   boolean,
  T:        Theme
): string {
  // 我的车位优先，显示黄色
  // My spot takes highest priority — show yellow
  if (isMySpot) {
    return T.yellow;
  }

  // OKU 专用位：空位蓝，占用白灰
  // OKU reserved: free = blue, occupied = whitegrey
  if (isOKU) {
    if (isFree) {
      return T.blue;
    }
    return T.muted;
  }

  // 普通车位：空位绿，占用红
  // Normal spot: free = green, occupied = red
  if (isFree) {
    return T.green;
  }
  return T.red;
}

/*
根据格子是否变暗，返回对应的背景色、边框色、透明度、文字色。
Returns background colour, border colour, opacity, and text colour based on dim state.
正常状态 / Normal state: 标准透明度颜色 / standard alpha colours
变暗状态 / Dimmed state: 极低透明度颜色 / very low alpha colours
*/
function getCellColors(color: string, dim: boolean): {
  bgColor:     string;
  bdColor:     string;
  cellOpacity: number;
  textColor:   string;
} {
  if (dim) {
    return {
      bgColor:     color + "0D", // 变暗背景极透明 / heavily dimmed background
      bdColor:     color + "25", // 变暗边框极透明 / heavily dimmed border
      cellOpacity: 0.3,          // 整格半透明 / semi-transparent cell
      textColor:   color + "60", // 文字极浅 / very light text
    };
  }

  return {
    bgColor:     color + "28", // 正常背景 / normal background
    bdColor:     color + "99", // 正常边框 / normal border
    cellOpacity: 1,
    textColor:   color,
  };
}

// ─── ⚡ 性能说明 / Performance notes ─────────────────────────────────────────
/*
这里用了三个 React 性能工具，专门解决"240+ 个格子同时重新渲染"的卡顿问题。
These three tools solve lag caused by re-rendering 240+ spot cells at once.

问题说明 / Why this matters:
  每次用户签入/签出，spots 状态改变 → 整个 MapScreen 重新渲染
  → 如果不优化，所有 240 个 SpotCell 全部重新渲染 → 明显卡顿

解决方案 / Solution:
  1. memo(SpotCell)        — 格子只在自己的 props 变化时才重渲染
                             Cell only re-renders when its own props change
  2. useMemo(sectionRows)  — spots 不变时，不重新计算行分组
                             Avoid re-sorting 241 spots if spots didn't change
  3. useCallback(fn)       — 传给格子的 onPress 引用保持不变
                             Keep onPress reference stable so memo() works
*/

// ─── Styles for SpotCell ─────────────────────────────────────────────────────
const spotCellStyles = StyleSheet.create({

  // 停车格子内层方块
  // Inner block of a parking spot cell
  // 注意：宽高由 spotW/spotH props 控制，不在此处写死
  // Note: width/height are controlled by spotW/spotH props, not hardcoded here
  spot: {
    width:          "100%",
    height:         "100%",
    borderRadius:   4,
    borderWidth:    1,
    justifyContent: "center",
    alignItems:     "center",
  },

  // OKU 专用位加粗边框以示区分
  // Thicker border for OKU reserved spots
  okuSpot: {
    borderWidth: 2,
  },
});

// ─── SpotCell ─────────────────────────────────────────────────────────────────
/*
单个停车格子，用 React.memo 包装，只在自身数据变化时重新渲染。
Single parking spot cell, wrapped in React.memo to prevent re-rendering all 241 cells.
*/
const SpotCell = memo(function SpotCell({
  spot,
  isMySpot,
  color,
  dim,
  pulseAnim,
  onPress,
  spotW,
  spotH,
  spotFont,
}: {
  spot:      ParkingSpot;
  isMySpot:  boolean;
  color:     string;
  dim:       boolean;
  pulseAnim: Animated.Value;
  onPress:   (spot: ParkingSpot) => void;
  spotW:     number; // 格子宽度（由屏幕宽度计算）/ spot width (computed from screen width)
  spotH:     number; // 格子高度 / spot height
  spotFont:  number; // 格子文字大小 / text font size
}) {
  // 是否是 OKU 专用位
  // Whether this is an OKU reserved spot
  const isOKU = spot.type === "oku";

  // ── 我的车位：脉冲黄色格子 / My spot: pulsing yellow cell ──────────────────
  if (isMySpot) {
    return (
      <TouchableOpacity
        onPress={function pressSpot() { onPress(spot); }}
        activeOpacity={0.7}
        style={{ width: spotW, height: spotH, justifyContent: "center", alignItems: "center" }}
      >
        <Animated.View
          style={[
            spotCellStyles.spot,
            {
              backgroundColor: "#FFD70035",
              borderColor:     "#FFD700",
              borderWidth:     2,
              transform:       [{ scale: pulseAnim }],
            },
          ]}
        >
          <Text style={{ fontSize: spotFont + 2 }}>📍</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  // ── 普通 / OKU 格子 / Normal or OKU cell ────────────────────────────────────

  // 根据变暗状态计算各颜色值，避免 JSX 里写三元
  // Pre-compute colour values based on dim state to keep JSX free of ternaries
  const { bgColor, bdColor, cellOpacity, textColor } = getCellColors(color, dim);

  // OKU 显示轮椅图标，普通格子显示列号
  // OKU shows wheelchair icon; normal spot shows column number
  let spotLabel: string;
  if (isOKU) {
    spotLabel = "♿";
  } else {
    spotLabel = String(spot.col + 1);
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      onPress={function pressSpot() { onPress(spot); }}
      activeOpacity={0.7}
      style={{ width: spotW, height: spotH, justifyContent: "center", alignItems: "center" }}
    >
      <View
        style={[
          spotCellStyles.spot,
          isOKU ? spotCellStyles.okuSpot : null,
          {
            backgroundColor: bgColor,
            borderColor:     bdColor,
            opacity:         cellOpacity,
          },
        ]}
      >
        <Text style={{ fontSize: spotFont, fontWeight: "800", color: textColor }}>
          {spotLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Styles for SRSpotCell ────────────────────────────────────────────────────
const srCellStyles = StyleSheet.create({

  // SR 竖排格子内层方块（横向，宽大于高）
  // Inner block of an SR spot cell (landscape: wider than tall)
  // 注意：宽高由 srW/srH props 控制，不在此处写死
  // Note: width/height are controlled by srW/srH props, not hardcoded here
  srSpot: {
    width:          "100%",
    height:         "100%",
    borderRadius:   3,
    borderWidth:    1,
    justifyContent: "center",
    alignItems:     "center",
  },
});

// ─── SRSpotCell ───────────────────────────────────────────────────────────────
/*
SR 竖排格子，横向布局，编号旋转 –90°。
同样用 React.memo 包裹，防止卡顿。

SR column spot: landscape orientation, number rotated –90°.
Also wrapped in React.memo to prevent lag.
*/
const SRSpotCell = memo(function SRSpotCell({
  spot,
  index,
  isMySpot,
  color,
  dim,
  pulseAnim,
  onPress,
  srW,
  srH,
  srFont,
}: {
  spot:      ParkingSpot;
  index:     number;
  isMySpot:  boolean;
  color:     string;
  dim:       boolean;
  pulseAnim: Animated.Value;
  onPress:   (spot: ParkingSpot) => void;
  srW:       number; // SR 格子宽度（横向，宽>高）/ SR spot width (landscape, wider than tall)
  srH:       number; // SR 格子高度 / SR spot height
  srFont:    number; // SR 格子文字大小 / SR spot text font size
}) {
  // ── 我的车位：脉冲黄色 / My spot: pulsing yellow ────────────────────────────
  if (isMySpot) {
    return (
      <TouchableOpacity
        onPress={function pressSpot() { onPress(spot); }}
        activeOpacity={0.7}
        style={{ width: srW, height: srH, justifyContent: "center", alignItems: "center", marginBottom: 2 }}
      >
        <Animated.View
          style={[
            srCellStyles.srSpot,
            {
              backgroundColor: "#FFD70035",
              borderColor:     "#FFD700",
              borderWidth:     2,
              transform:       [{ scale: pulseAnim }],
            },
          ]}
        >
          <Text
            style={{
              fontSize:   srFont,
              fontWeight: "800",
              transform:  [{ rotate: "-90deg" }],
            }}
          >
            📍
          </Text>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  // ── 普通 SR 格子 / Normal SR cell ────────────────────────────────────────────

  // 根据变暗状态计算颜色值
  // Pre-compute colour values based on dim state
  const { bgColor, bdColor, cellOpacity, textColor } = getCellColors(color, dim);

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      onPress={function pressSpot() { onPress(spot); }}
      activeOpacity={0.7}
      style={{ width: srW, height: srH, justifyContent: "center", alignItems: "center", marginBottom: 2 }}
    >
      <View
        style={[
          srCellStyles.srSpot,
          {
            backgroundColor: bgColor,
            borderColor:     bdColor,
            opacity:         cellOpacity,
          },
        ]}
      >
        <Text
          style={{
            fontSize:   srFont,
            fontWeight: "800",
            transform:  [{ rotate: "-90deg" }],
            color:      textColor,
          }}
        >
          {index + 1}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Styles for OKUWarningModal ───────────────────────────────────────────────
const okuModalStyles = StyleSheet.create({

  // 全屏半透明遮罩（居中弹窗）
  // Full-screen overlay — centred dialog
  warningOverlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent:  "center",
    alignItems:      "center",
    padding:         24,
  },

  // 警告弹窗主体方块
  // Warning dialog box
  warningBox: {
    borderRadius: 24,
    padding:      28,
    width:        "100%",
    borderWidth:  1,
    alignItems:   "center",
  },

  // 警告图标圆形背景
  // Warning icon circle background
  warningIconCircle: {
    width:          72,
    height:         72,
    borderRadius:   36,
    borderWidth:    2,
    justifyContent: "center",
    alignItems:     "center",
    marginBottom:   16,
  },

  // 警告标题
  // Warning title
  warningTitle: {
    fontSize:     20,
    fontWeight:   "900",
    marginBottom: 14,
  },

  // 警告正文
  // Warning body text
  warningBody: {
    fontSize:     13,
    lineHeight:   22,
    textAlign:    "center",
    marginBottom: 24,
  },

  // 主要按钮（返回找其他车位）
  // Primary button — go back and find another spot
  warningCloseBtn: {
    borderRadius:    14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems:      "center",
    width:           "100%",
    marginBottom:    10,
  },

  // 主要按钮文字
  // Primary button text
  warningCloseBtnText: {
    color:      "white",
    fontWeight: "800",
    fontSize:   15,
  },

  // 次要按钮（声称有 OKU 身份）
  // Secondary button — user claims OKU status not yet in system
  warningOverrideBtn: {
    paddingVertical: 8,
  },

  // 次要按钮文字
  // Secondary button text
  warningOverrideText: {
    fontSize: 12,
  },
});

// ─── OKUWarningModal ──────────────────────────────────────────────────────────
/*
非 OKU 用户尝试停 OKU 专用位时弹出警告，弹出时有左右抖动动画。
Shown when a non-OKU user tries to park in an OKU spot. Shakes on appear.
*/
function OKUWarningModal({
  visible,
  onClose,
  onProceed,
  plate,
  T,
}: {
  visible:   boolean;
  onClose:   () => void;
  onProceed: () => void;
  plate:     string;
  T:         Theme;
}) {
  // 左右抖动动画值
  // Shake animation value (translates X)
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // 弹窗变为可见时触发抖动
  // Trigger shake when modal becomes visible
  useEffect(function playShakeOnVisible() {
    if (!visible) {
      return;
    }

    // 依次左右摆动后归位
    // Shake left-right then return to centre
    const shakeSequence = Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 60, useNativeDriver: true }),
    ]);
    shakeSequence.start();
  }, [visible]);

  // 弹窗颜色变量
  // Modal colour variables
  const iconBgColor     = T.red + "20";
  const iconBorderColor = T.red + "55";
  const boxBorderColor  = T.red + "55";

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={okuModalStyles.warningOverlay}>
        <Animated.View
          style={[
            okuModalStyles.warningBox,
            {
              backgroundColor: T.card,
              borderColor:     boxBorderColor,
              transform:       [{ translateX: shakeAnim }],
            },
          ]}
        >
          {/* 警告图标圆圈 / Warning icon circle */}
          <View
            style={[
              okuModalStyles.warningIconCircle,
              { backgroundColor: iconBgColor, borderColor: iconBorderColor },
            ]}
          >
            <Text style={{ fontSize: 38 }}>⚠️</Text>
          </View>

          {/* 标题 / Title */}
          <Text style={[okuModalStyles.warningTitle, { color: T.red }]}>OKU Spot Warning</Text>

          {/* 正文 / Body */}
          <Text style={[okuModalStyles.warningBody, { color: T.muted }]}>
            This spot is reserved for{" "}
            <Text style={{ color: T.blue, fontWeight: "800" }}>registered OKU students</Text>
            {" "}only.{"\n\n"}
            Your account{" "}
            <Text style={{ color: T.red, fontWeight: "800" }}>({plate})</Text>
            {" "}does not have OKU parking rights.{"\n\n"}
            Parking here may result in a{" "}
            <Text style={{ color: T.red, fontWeight: "800" }}>penalty or towing.</Text>
          </Text>

          {/* 主按钮：返回找其他车位 / Primary button: find another spot */}
          <TouchableOpacity
            style={[okuModalStyles.warningCloseBtn, { backgroundColor: T.green }]}
            onPress={onClose}
          >
            <Text style={okuModalStyles.warningCloseBtnText}>✅  Find Another Spot</Text>
          </TouchableOpacity>

          {/* 次按钮：声称有 OKU 身份但未更新系统 / Secondary: user claims OKU not yet updated */}
          <TouchableOpacity
            onPress={onProceed}
            style={okuModalStyles.warningOverrideBtn}
          >
            <Text style={[okuModalStyles.warningOverrideText, { color: T.muted }]}>
              I have OKU status (not yet updated)
            </Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles for SpotModal ─────────────────────────────────────────────────────
const spotModalStyles = StyleSheet.create({

  // 半透明遮罩层
  // Semi-transparent overlay
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.6)",
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

  // 顶部拖动把手
  // Drag handle at the top of the sheet
  handle: {
    width:        40,
    height:       4,
    borderRadius: 999,
    alignSelf:    "center",
    marginBottom: 20,
  },

  // 车位编号徽章 + 状态标签的横排容器
  // Row containing the spot ID badge and status pill
  modalHeader: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   16,
  },

  // 车位编号徽章
  // Spot ID badge
  spotBadge: {
    borderWidth:       1,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },

  // 徽章内车位编号大字
  // Spot ID text inside the badge
  spotBadgeText: {
    fontSize:   18,
    fontWeight: "900",
  },

  // 状态标签胶囊
  // Status pill
  statusPill: {
    borderWidth:       1,
    borderRadius:      999,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },

  // 状态标签文字
  // Status pill text
  statusPillText: {
    fontSize:      11,
    fontWeight:    "800",
    letterSpacing: 1,
  },

  // 详情列表容器
  // Details table container
  detailBox: {
    borderRadius: 14,
    padding:      14,
    marginBottom: 14,
    gap:          12,
  },

  // 详情行（key + value 横排）
  // Detail row — key and value side by side
  detailRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
  },

  // 详情 key 文字
  // Detail key text
  detailKey: {
    fontSize: 13,
  },

  // 详情 value 文字
  // Detail value text
  detailVal: {
    fontWeight: "700",
    fontSize:   13,
  },

  // OKU 专用提示条
  // OKU reserved notice bar
  okuNote: {
    borderWidth:  1,
    borderRadius: 12,
    padding:      12,
    marginBottom: 14,
  },

  // OKU 提示条文字
  // OKU notice text
  okuNoteText: {
    fontSize:   12,
    fontWeight: "600",
  },

  // 操作按钮（签入/签出/禁用状态共用外形）
  // Action button — shared shape for check-in, check-out, and disabled states
  actionBtn: {
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      "center",
    marginBottom:    10,
  },

  // 操作按钮文字
  // Action button text
  actionBtnText: {
    color:      "white",
    fontWeight: "800",
    fontSize:   15,
  },

  // 关闭按钮
  // Close button
  closeBtn: {
    alignItems:      "center",
    paddingVertical: 8,
  },

  // 关闭按钮文字
  // Close button text
  closeBtnText: {
    fontSize: 14,
  },
});

// ─── SpotModal ────────────────────────────────────────────────────────────────
/*
点击车位格子后从底部弹出的详情弹窗。
Bottom sheet shown when the user taps a spot in the grid.

按钮逻辑 / Button logic:
 isMySpot → Check Out 按钮
 isFree   → Check In 按钮
 else     → 已占用，禁用状态
*/
function SpotModal({
  spot,
  mySpotId,
  onClose,
  onCheckIn,
  onCheckOut,
  T,
}: {
  spot:       ParkingSpot | null;
  mySpotId:   string | null;
  onClose:    () => void;
  onCheckIn:  (s: ParkingSpot) => void;
  onCheckOut: (s: ParkingSpot) => void;
  T:          Theme;
}) {
  // ── 辅助渲染函数必须在所有条件分支之前定义，避免违反 Rules of Hooks
  // Helper render functions must be defined before any early-return branches
  // to avoid violating the Rules of Hooks if hooks are added later.

  /*
  GPS 行的 value 用黄色，其余 value 用普通文字颜色。
  GPS row value uses yellow; all other rows use the normal text colour.

  @param key   详情行的 key / detail row key
  @param value 详情行的 value / detail row value
  @param isGPSRow 是否是 GPS 行且是我的车位 / whether this is the GPS row for my spot
  */
  function renderDetailValue(key: string, value: string, isGPSRow: boolean) {
    if (key === "GPS" && isGPSRow) {
      return (
        <Text style={[spotModalStyles.detailVal, { color: T.yellow }]}>{value}</Text>
      );
    }
    return (
      <Text style={[spotModalStyles.detailVal, { color: T.text }]}>{value}</Text>
    );
  }

  /*
  根据车位状态决定操作按钮样式和回调。
  Decides the action button style and callback based on spot state.

  isMySpotArg → 红色签出按钮 / red check-out button
  isFreeArg   → 签入按钮（OKU 蓝色，普通强调色）/ check-in button
  否则        → 禁用灰色按钮 / disabled grey button

  接收所有需要的值作为参数，因为此函数在 early return 之前定义，
  无法直接访问 early return 之后才存在的派生变量。
  Receives all needed values as parameters because this function is defined
  before the early return and therefore before the derived variables exist.
  */
  function renderActionButton(
    confirmedSpot: ParkingSpot,
    isMySpotArg:   boolean,
    isOKUArg:      boolean,
    isFreeArg:     boolean
  ) {
    // 我的车位 → 签出按钮（红色）
    // My spot → red check-out button
    if (isMySpotArg) {
      return (
        <TouchableOpacity
          style={[spotModalStyles.actionBtn, { backgroundColor: T.red }]}
          onPress={function pressCheckOut() { onCheckOut(confirmedSpot); }}
        >
          <Text style={spotModalStyles.actionBtnText}>🚗  Check Out & Free Spot</Text>
        </TouchableOpacity>
      );
    }

    // 空位 → 签入按钮
    // Free spot → check-in button
    if (isFreeArg) {
      // OKU 车位用蓝色按钮，普通车位用主题强调色
      // OKU spot uses blue button; normal spot uses theme accent colour
      let btnColor: string;
      let btnLabel: string;
      if (isOKUArg) {
        btnColor = T.blue;
        btnLabel = "♿  Check In (OKU)";
      } else {
        btnColor = T.accent;
        btnLabel = "✅  Check In Here";
      }
      return (
        <TouchableOpacity
          style={[spotModalStyles.actionBtn, { backgroundColor: btnColor }]}
          onPress={function pressCheckIn() { onCheckIn(confirmedSpot); }}
        >
          <Text style={spotModalStyles.actionBtnText}>{btnLabel}</Text>
        </TouchableOpacity>
      );
    }

    // 已被占用 → 禁用状态按钮（不可点击）
    // Already taken → disabled button (not tappable)
    return (
      <View style={[spotModalStyles.actionBtn, { backgroundColor: T.border }]}>
        <Text style={[spotModalStyles.actionBtnText, { color: T.muted }]}>
          🔴  Spot Already Taken
        </Text>
      </View>
    );
  }

  // ── early return：没有选中车位时不渲染 / Early return: don't render if no spot selected ──
  if (!spot) {
    return null;
  }

  // ── 派生状态 / Derived state ─────────────────────────────────────────────────

  const isMySpot = spot.id === mySpotId;
  const isOKU    = spot.type === "oku";
  const isFree   = spot.status === "free";

  // 格子颜色
  // Cell colour
  const color = getSpotColor(isMySpot, isOKU, isFree, T);

  // ── 详情列表文字 / Detail row strings ────────────────────────────────────────

  // 车位类型显示文字（OKU 或普通）
  // Type label — OKU or normal
  let typeLabel: string;
  if (isOKU) {
    typeLabel = "♿ OKU Reserved";
  } else {
    typeLabel = "Student Parking";
  }

  // 状态显示文字（可用或占用）
  // Status label — available or occupied
  let statusLabel: string;
  if (isFree) {
    statusLabel = "✅ Available";
  } else {
    statusLabel = "🔴 Occupied";
  }

  // 详情列表基础数据
  // Base detail rows
  const details: [string, string][] = [
    ["Row",    "Row " + (spot.row + 1)],
    ["Spot",   "#" + (spot.col + 1)  ],
    ["Type",   typeLabel              ],
    ["Status", statusLabel            ],
  ];

  // 有车牌时追加车牌行
  // Append plate row if spot has a plate
  if (spot.plate) {
    details.push(["Plate", spot.plate]);
  }

  // 有签入时间时追加时间行
  // Append check-in row if available
  if (spot.checkedIn) {
    details.push(["Checked In", spot.checkedIn]);
  }

  // 我的车位时追加 GPS 行
  // Append GPS row for my spot
  if (isMySpot) {
    details.push(["GPS", "📍 Your current location"]);
  }

  // ── 弹窗顶部图标 / Header icon emoji ─────────────────────────────────────────
  let headerIcon: string;
  if (isMySpot) {
    headerIcon = "📍";
  } else if (isOKU) {
    headerIcon = "♿";
  } else {
    headerIcon = "🅿️";
  }

  // ── 状态标签文字 / Status pill text ──────────────────────────────────────────
  let statusPillText: string;
  if (isMySpot) {
    statusPillText = "YOUR SPOT";
  } else if (isOKU) {
    statusPillText = "OKU";
  } else {
    statusPillText = spot.status.toUpperCase();
  }

  // ── 弹窗颜色变量 / Modal colour variables ────────────────────────────────────
  const badgeBgColor     = color + "18";
  const badgeBorderColor = color + "66";
  const pillBgColor      = color + "22";
  const pillBorderColor  = color + "55";
  const okuNoteBg        = T.blue + "15";
  const okuNoteBorder    = T.blue + "44";

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={onClose}
    >
      {/* 点击外部关闭弹窗 / Tap outside to close */}
      <TouchableOpacity
        style={spotModalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* 弹窗面板本体，点击内部不关闭 / Sheet itself — tapping inside does not dismiss */}
        <TouchableOpacity
          activeOpacity={1}
          style={[spotModalStyles.sheet, { backgroundColor: T.card, borderColor: T.border }]}
        >
          {/* 拖动把手 / Drag handle */}
          <View style={[spotModalStyles.handle, { backgroundColor: T.border }]} />

          {/* 车位编号徽章 + 状态标签横排 / Spot ID badge + status pill row */}
          <View style={spotModalStyles.modalHeader}>
            <View
              style={[
                spotModalStyles.spotBadge,
                { borderColor: badgeBorderColor, backgroundColor: badgeBgColor },
              ]}
            >
              <Text style={[spotModalStyles.spotBadgeText, { color }]}>
                {headerIcon}  {spot.id}
              </Text>
            </View>
            <View
              style={[
                spotModalStyles.statusPill,
                { backgroundColor: pillBgColor, borderColor: pillBorderColor },
              ]}
            >
              <Text style={[spotModalStyles.statusPillText, { color }]}>
                {statusPillText}
              </Text>
            </View>
          </View>

          {/* 详情列表 / Details table */}
          <View style={[spotModalStyles.detailBox, { backgroundColor: T.bg }]}>
            {details.map(function renderDetailRow([key, value]) {
              return (
                <View key={key} style={spotModalStyles.detailRow}>
                  <Text style={[spotModalStyles.detailKey, { color: T.muted }]}>{key}</Text>
                  {renderDetailValue(key, value, isMySpot)}
                </View>
              );
            })}
          </View>

          {/* OKU 专用提示条（仅 OKU 车位显示）
              OKU reserved notice — only shown for OKU spots */}
          {isOKU && (
            <View
              style={[
                spotModalStyles.okuNote,
                { backgroundColor: okuNoteBg, borderColor: okuNoteBorder },
              ]}
            >
              <Text style={[spotModalStyles.okuNoteText, { color: T.blue }]}>
                ♿  Reserved for registered OKU students only.
              </Text>
            </View>
          )}

          {/* 操作按钮（根据车位状态切换）
              Action button — switches based on spot state */}
          {renderActionButton(spot, isMySpot, isOKU, isFree)}

          {/* 关闭按钮 / Close button */}
          <TouchableOpacity onPress={onClose} style={spotModalStyles.closeBtn}>
            <Text style={[spotModalStyles.closeBtnText, { color: T.muted }]}>Close</Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles for MapScreen ─────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // 全屏容器，背景由 _layout.tsx 渐变填充
  // Full-screen container — gradient bg provided by _layout.tsx
  screen: {
    flex: 1,
  },

  // 滚动内容区域
  // Scroll content area
  scroll: {
    padding:         20,
    paddingTop:      56,
    paddingBottom:   100,
    backgroundColor: "transparent",
  },

  // 顶部标题栏（标题 + logo 横排）
  // Page header row — title and logo
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   16,
  },

  // 页面标题大字
  // Page title — large bold text
  pageTitle: {
    fontSize:      24,
    fontWeight:    "800",
    letterSpacing: -0.5,
  },

  // 页面副标题
  // Page subtitle
  subtitle: {
    fontSize: 13,
  },

  // 统计数据横排
  // Stats chips row
  statsRow: {
    flexDirection: "row",
    gap:           8,
    marginBottom:  14,
  },

  // 单个统计数据卡片
  // Single stat chip card
  statChip: {
    flex:          1,
    borderWidth:   1,
    borderRadius:  12,
    paddingVertical: 10,
    alignItems:    "center",
  },

  // 统计数字大字
  // Stat number — large bold text
  statNum: {
    fontSize:   18,
    fontWeight: "900",
  },

  // 统计标签小字
  // Stat label — small text
  statLabel: {
    fontSize:  10,
    marginTop: 2,
  },

  // 筛选器横向滚动行
  // Horizontal scrollable filter row
  filterRow: {
    marginBottom: 14,
  },

  // 单个筛选胶囊按钮
  // Single filter pill button
  filterPill: {
    borderWidth:       1,
    borderRadius:      999,
    paddingHorizontal: 16,
    paddingVertical:   7,
    marginRight:       8,
  },

  // 筛选胶囊文字
  // Filter pill text
  filterText: {
    fontSize:   13,
    fontWeight: "600",
  },

  // 停车格子卡片容器
  // Parking grid card container
  gridCard: {
    borderWidth:  1,
    borderRadius: 20,
    padding:      16,
    marginBottom: 16,
  },

  // 格子卡片顶部行（标题）
  // Grid card top row — title
  topRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   14,
  },

  // 格子卡片标题文字
  // Grid card title text
  gridTitle: {
    fontSize:      11,
    fontWeight:    "700",
    letterSpacing: 0.5,
  },

  // 区域块外层容器
  // Outer container for each section block
  sectionBlock: {
    marginBottom: 18,
    alignSelf:    "flex-start",
  },

  // 背靠背双排区域的间距
  // Tighter margin for paired section blocks
  pairedBlock: {
    marginBottom: 63,
  },

  // 双排区域上排
  // Top row of a paired section
  pairedTopRow: {
    marginBottom: 14,
  },

  // 双排区域下排
  // Bottom row of a paired section
  pairedBottomRow: {
    marginBottom: 0,
  },

  // SR 竖排容器（位于主格右侧，从 R4 高度开始）
  // SR vertical column container — right of main grid, starts at R4 level
  srColumn: {
    flexDirection: "column",
    alignItems:    "center",
    marginLeft:    -38,
    paddingTop:    2,
  },

  // SR 顶部标签 "SR(R13)"
  // SR column top label — "SR(R13)"
  srColLabel: {
    fontSize:      9,
    fontWeight:    "700",
    letterSpacing: 0.5,
    marginBottom:  4,
  },

  // 行内通道间隙（透明占位）
  // Aisle gap between spot groups — transparent spacer
  aisle: {
    width:           82,
    height:          "100%" as any,
    marginHorizontal: 3,
    borderRadius:    2,
    opacity:         0,
  },

  // 行容器（行标签 + 格子横排）
  // Row container — label + spots side by side
  rowWrap: {
    flexDirection: "row",
    alignItems:    "center",
    marginBottom:  18,
    alignSelf:     "flex-start",
  },

  // 行标签文字（固定宽度）
  // Row label text — fixed width
  rowLabel: {
    fontSize:   10,
    width:      28,
    fontWeight: "600",
  },

  // 格子横排容器（单行不换行）
  // Spots container — single line, no wrap
  rowSpots: {
    flexDirection: "row",
    flexWrap:      "nowrap",
  },

  // 图例横排容器
  // Legend row container
  legend: {
    flexDirection:  "row",
    justifyContent: "center",
    gap:            18,
    marginBottom:   10,
  },

  // 单个图例项（色点 + 标签）
  // Single legend item — dot and label
  legendItem: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },

  // 图例色点
  // Legend colour dot
  legendDot: {
    width:        10,
    height:       10,
    borderRadius: 3,
  },

  // 图例文字
  // Legend label text
  legendLabel: {
    fontSize: 12,
  },

  // 底部操作提示文字
  // Bottom hint text
  hint: {
    fontSize:   12,
    textAlign:  "center",
  },
});

// ─── MapScreen ────────────────────────────────────────────────────────────────
/*
停车场格子地图主页面。
Main parking spot grid map screen.
*/
export default function MapScreen() {

  const { theme: T }             = useTheme();
  const { width: screenWidth }   = useWindowDimensions(); // 屏幕宽度 / screen width

  // 根据屏幕宽度计算所有格子尺寸
  // Compute all spot dimensions from screen width
  const sizes = calcSizes(screenWidth);

  // 从 Context 读取停车数据和操作函数
  // Read parking data and action functions from context
  const {
    vehicles,
    spots,
    freeCount,
    occCount,
    okuFree,
    okuTotal,
    activeSession,
    checkIn:  ctxCheckIn,
    checkOut: ctxCheckOut,
  } = useParkingContext();

  // ── 从 Context 派生的显示值（不需要存 state）/ Context-derived values (no state needed) ──

  // 第一辆已注册车辆的车牌（无车辆时为空字符串）
  // First registered vehicle's plate — empty string when no vehicles registered
  let currentPlate: string;
  if (vehicles[0]) {
    currentPlate = vehicles[0].plate;
  } else {
    currentPlate = "";
  }

  // 第一辆车的 OKU 身份标志
  // First vehicle's OKU flag
  let isOKUUser: boolean;
  if (vehicles[0]) {
    isOKUUser = vehicles[0].isOKU;
  } else {
    isOKUUser = false;
  }

  // 当前停车的车位 ID（未停车时为 null）
  // Active spot ID — null when not parked
  let mySpotId: string | null;
  if (activeSession) {
    mySpotId = activeSession.spotId;
  } else {
    mySpotId = null;
  }

  // ── 本地状态 / Local state ───────────────────────────────────────────────────

  // 当前点击的车位（null = 没有选中，弹窗关闭）
  // Currently tapped spot — null means no selection, SpotModal is closed
  const [selected,    setSelected]    = useState<ParkingSpot | null>(null);

  // 格子筛选器状态
  // Grid filter state
  const [filter,      setFilter]      = useState<"all" | "free" | "occupied">("all");

  // OKU 警告弹窗可见性
  // OKU warning modal visibility
  const [okuWarning,  setOkuWarning]  = useState(false);

  // 等待用户 OKU 确认的车位
  // Spot awaiting user OKU override confirmation
  const [pendingSpot, setPendingSpot] = useState<ParkingSpot | null>(null);

  // ── 动画 / Animation ─────────────────────────────────────────────────────────

  // 我的车位脉冲缩放动画值（1.0 = 正常大小）
  // My-spot pulse scale animation value — 1.0 = normal size
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 签入时循环脉冲，签出时停止
  // Loop pulse while checked in; stop when checked out
  useEffect(function controlPulseAnimation() {
    if (mySpotId) {
      // 有活动车位：循环脉冲放大缩小
      // Active spot: loop scale up and down
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return function stopPulse() {
        loop.stop();
        pulseAnim.setValue(1.0);
      };
    }

    // 无活动车位：停止动画并重置
    // No active spot: stop animation and reset
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1.0);
    return undefined;
  }, [mySpotId]);

  // ── 签入 / 签出处理函数 / Check-in & check-out handlers ─────────────────────

  /*
  用户点击空位时触发。
  进行 OKU 检查，通过后调用 confirmCheckIn。
  Called when the user taps a free spot.
  Performs OKU check; calls confirmCheckIn if guards pass.
  */
  function handleCheckIn(spot: ParkingSpot) {
    setSelected(null);

    // 已停车不能再次签入
    // Cannot check in again while already parked
    if (mySpotId) {
      Alert.alert("Already Checked In", "You are at Spot " + mySpotId + ". Check out first.");
      return;
    }

    // 非 OKU 用户尝试停 OKU 位，弹警告
    // Non-OKU user trying to park in OKU spot — show warning
    if (spot.type === "oku" && !isOKUUser) {
      setPendingSpot(spot);
      setOkuWarning(true);
      return;
    }

    // 通过所有检查，执行签入
    // All guards passed — proceed with check-in
    confirmCheckIn(spot);
  }

  /*
  通过所有检查后执行实际签入，写入 ParkingContext。
  Executes the actual check-in after all guards pass — writes to ParkingContext.
  */
  function confirmCheckIn(spot: ParkingSpot) {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctxCheckIn(spot.id, currentPlate);
    Alert.alert("✅ Checked In!", "Parked at Spot " + spot.id + " · " + timeNow);
  }

  /*
  用户点击自己的车位时触发签出流程，弹二次确认对话框。
  Called when the user taps their own spot — shows a confirmation alert before checking out.
  */
  function handleCheckOut(spot: ParkingSpot) {
    setSelected(null);
    Alert.alert("🚗 Check Out", "Leave Spot " + spot.id + "?", [
      { text: "Cancel", style: "cancel" },
      {
        text:    "Check Out",
        style:   "destructive",
        onPress: function confirmCheckOut() {
          ctxCheckOut();
          Alert.alert("👋 Checked Out!", "Spot " + spot.id + " is now free.\nDrive safely!");
        },
      },
    ]);
  }

  /*
  OKU 警告弹窗"我有 OKU 身份"按钮的处理逻辑。
  Handler for the OKU override option in the warning modal.
  关闭警告弹窗后，直接执行之前等待的签入。
  Closes the warning modal then executes the previously pending check-in.
  */
  function handleOKUProceed() {
    setOkuWarning(false);
    if (pendingSpot) {
      confirmCheckIn(pendingSpot);
    }
    setPendingSpot(null);
  }

  // ── ⚡ 格子渲染性能优化 / Grid render performance optimisation ──────────────

  /*
  每次 spots 变化时预计算所有区域行，避免每次 render 重复 filter/sort 241 个格子。
  Pre-compute section rows once per spots change — avoids re-filtering 241 spots on every render.
  */
  const sectionRowsMap = useMemo(function buildSectionRowsMap() {
    const map: Record<string, ParkingSpot[][]> = {};

    for (const sec of SECTION_LAYOUT) {
      // 筛出属于该区域的格子
      // Filter spots belonging to this section
      const secSpots = spots.filter(function belongsToSection(s) {
        return s.section === sec.id;
      });

      // 取出不重复的行号（用 Set 去重，O(n)）
      // Get unique row numbers — use Set for O(n) deduplication
      const uniqueRows = [...new Set(secSpots.map(function getRow(s) { return s.row; }))];
      uniqueRows.sort(function ascending(a, b) { return a - b; });

      // 每行格子按列号排序后存入
      // Sort each row's spots by column number and store
      const rowsForSection: ParkingSpot[][] = [];
      for (const rowNum of uniqueRows) {
        const rowSpots = secSpots
          .filter(function inThisRow(s) { return s.row === rowNum; })
          .sort(function byColumn(a, b) { return a.col - b.col; });
        rowsForSection.push(rowSpots);
      }

      map[sec.id] = rowsForSection;
    }

    return map;
  }, [spots]); // spots 改变时才重新计算 / only recompute when spots changes

  // 供 JSX 使用的稳定取值函数
  // Stable getter for use in JSX
  const getSectionRows = useCallback(function getRows(sectionId: string): ParkingSpot[][] {
    const rows = sectionRowsMap[sectionId];
    if (rows) {
      return rows;
    }
    return [];
  }, [sectionRowsMap]);

  // 判断当前筛选器是否应该使某格变暗
  // Returns true if the current filter should dim this spot
  const isDimmed = useCallback(function checkDimmed(spot: ParkingSpot): boolean {
    // 我的车位永远不变暗
    // My spot is never dimmed
    if (spot.id === mySpotId) {
      return false;
    }

    // 只看空位：占用格变暗
    // Free filter: dim occupied spots
    if (filter === "free") {
      return spot.status !== "free";
    }

    // 只看占用：空位格变暗
    // Occupied filter: dim free spots
    if (filter === "occupied") {
      return spot.status !== "occupied";
    }

    // 全部显示：不变暗
    // All filter: no dimming
    return false;
  }, [filter, mySpotId]);

  // 返回格子显示颜色的稳定函数
  // Stable function returning spot display colour
  const spotColor = useCallback(function computeSpotColor(
    spot:      ParkingSpot,
    isMySpot:  boolean
  ): string {
    return getSpotColor(isMySpot, spot.type === "oku", spot.status === "free", T);
  }, [T]); // 主题切换时才重新生成 / only regenerate when theme changes

  // 传给 SpotCell 的稳定 onPress，防止父组件 render 触发子组件重渲染
  // Stable onPress passed to SpotCell — prevents parent re-renders from re-rendering cells
  const handleSpotPress = useCallback(function pressSpot(spot: ParkingSpot) {
    setSelected(spot);
  }, []);

  // ── 统计数据行 / Stats chips ─────────────────────────────────────────────────
  // 提取为具名常量，避免 JSX 里写内联数组
  // Extracted as a named constant to avoid inline arrays in JSX
  const statChips = useMemo(function buildStatChips() {
    return [
      { label: "Free",     val: freeCount,                  color: T.green  },
      { label: "Occupied", val: occCount,                   color: T.red    },
      { label: "OKU Free", val: okuFree + "/" + okuTotal,   color: T.blue   },
      { label: "Total",    val: spots.length,               color: T.accent },
    ];
  }, [freeCount, occCount, okuFree, okuTotal, spots.length, T]);

  // ── 筛选器胶囊样式辅助函数 / Filter pill style helpers ────────────────────────

  /*
  返回筛选胶囊按钮的背景色和边框色。
  Returns background and border colour for a filter pill.
  激活时填充颜色 / Active: filled with the pill colour
  未激活时透明背景 / Inactive: transparent background
  */
  function getFilterPillStyle(isActive: boolean, pillColor: string) {
    if (isActive) {
      return { backgroundColor: pillColor, borderColor: pillColor };
    }
    return { backgroundColor: "transparent", borderColor: T.border };
  }

  /*
  返回筛选胶囊文字颜色。
  Returns text colour for a filter pill.
  激活时白色 / Active: white
  未激活时次要色 / Inactive: muted
  */
  function getFilterTextColor(isActive: boolean): string {
    if (isActive) {
      return "#fff";
    }
    return T.muted;
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* 顶部标题栏 / Page header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>Parking Map</Text>
            <Text style={[styles.subtitle,  { color: T.muted }]}>MDIS Educity · Student Lot</Text>
          </View>
          <Image
            source={require("../../assets/images/itkia.png")}
            style={{ width: 80, height: 40, resizeMode: "contain" }}
          />
        </View>

        {/* 统计数据行 / Stats chips row */}
        <View style={styles.statsRow}>
          {statChips.map(function renderStatChip(chip) {
            const chipBorderColor = chip.color + "44";
            return (
              <View
                key={chip.label}
                style={[
                  styles.statChip,
                  { backgroundColor: T.card + "CC", borderColor: chipBorderColor },
                ]}
              >
                <Text style={[styles.statNum,   { color: chip.color }]}>{chip.val}</Text>
                <Text style={[styles.statLabel, { color: T.muted    }]}>{chip.label}</Text>
              </View>
            );
          })}
        </View>

        {/* 筛选器胶囊行 / Filter pill row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
        >
          {FILTER_OPTIONS.map(function renderFilterPill(option) {
            const isActive = filter === option.key;

            // 每个筛选器对应不同强调色
            // Each filter option has a distinct accent colour
            let pillColor: string;
            if (option.key === "free") {
              pillColor = T.green;
            } else if (option.key === "occupied") {
              pillColor = T.red;
            } else {
              pillColor = T.accent;
            }

            // 胶囊背景/边框样式和文字颜色
            // Pill background/border and text colour
            const pillStyle = getFilterPillStyle(isActive, pillColor);
            const textColor = getFilterTextColor(isActive);

            return (
              <TouchableOpacity
                key={option.key}
                onPress={function selectFilter() { setFilter(option.key as "all" | "free" | "occupied"); }}
                style={[styles.filterPill, pillStyle]}
              >
                <Text style={[styles.filterText, { color: textColor }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 停车格子卡片 / Parking grid card */}
        <View style={[styles.gridCard, { backgroundColor: T.card + "E8", borderColor: T.border }]}>
          <View style={styles.topRow}>
            <Text style={[styles.gridTitle, { color: T.muted }]}>🅿️ MDIS Student Parking</Text>
          </View>

          {/*
            横向可滑动：左侧主格（S1–S7），右侧 SR 竖排
            Horizontal scroll: main grid (S1–S7) on left, SR column on right
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", flexShrink: 0 }}>

              {/* 主格 S1–S7 / Main grid sections S1–S7 */}
              <View style={{ alignSelf: "flex-start" }}>
                {SECTION_LAYOUT
                  .filter(function excludeSR(sec) { return sec.id !== "SR"; })
                  .map(function renderSection(sec) {
                    const sectionRows = getSectionRows(sec.id);

                    // 该区域无格子时跳过渲染
                    // Skip rendering if this section has no spots
                    if (sectionRows.length === 0) {
                      return null;
                    }

                    // S3/S4/S5 整行需要左缩进
                    // S3/S4/S5 rows need left indent for alignment
                    let rowIndent: number;
                    if (INDENTED_SECTIONS.includes(sec.id)) {
                      rowIndent = sizes.sectionIndent;
                    } else {
                      rowIndent = 0;
                    }

                    // 区域是否使用大通道对齐
                    // Whether this section uses a wide aisle
                    const useWideAisle = WIDE_AISLE_SECTIONS.includes(sec.id);

                    return (
                      <View
                        key={sec.id}
                        style={[
                          styles.sectionBlock,
                          sec.paired ? styles.pairedBlock : null,
                        ]}
                      >
                        {sectionRows.map(function renderRow(rowSpots, rowIndex) {

                          // 背靠背区域：上排加下间距，下排不加
                          // Paired section: top row has bottom margin, bottom row has none
                          let rowExtraStyle = null;
                          if (sec.paired) {
                            if (rowIndex === 0) {
                              rowExtraStyle = styles.pairedTopRow;
                            } else {
                              rowExtraStyle = styles.pairedBottomRow;
                            }
                          }

                          // 行标签文字（优先取对应 rowLabels，不存在时取第一个）
                          // Row label text — prefer matching rowLabels entry, fall back to first
                          let rowLabelText: string;
                          if (sec.rowLabels[rowIndex]) {
                            rowLabelText = sec.rowLabels[rowIndex];
                          } else {
                            rowLabelText = sec.rowLabels[0];
                          }

                          // 缩进样式（rowIndent > 0 才加左内边距）
                          // Indent style — only add paddingLeft when indent is positive
                          let indentStyle = null;
                          if (rowIndent > 0) {
                            indentStyle = { paddingLeft: rowIndent };
                          }

                          return (
                            <View
                              key={rowIndex}
                              style={[styles.rowWrap, rowExtraStyle]}
                            >
                              {/* 行标签 / Row label */}
                              <Text
                                style={[
                                  styles.rowLabel,
                                  { color: T.muted, width: sizes.rowLabelWidth },
                                ]}
                              >
                                {rowLabelText}
                              </Text>

                              {/* 格子行（S3–S5 加左缩进）/ Spot row (S3–S5 indented) */}
                              <View style={[styles.rowSpots, indentStyle]}>
                                {rowSpots.map(function renderSpot(spot, spotIndex) {
                                  const isMySpot   = spot.id === mySpotId;
                                  const color      = spotColor(spot, isMySpot);
                                  const dim        = isDimmed(spot);

                                  // 相邻格子 group 不同时显示通道
                                  // Show aisle when adjacent spots have different group values
                                  let showGap: boolean;
                                  if (spotIndex > 0 && spot.group !== rowSpots[spotIndex - 1].group) {
                                    showGap = true;
                                  } else {
                                    showGap = false;
                                  }

                                  // 通道宽度：S2/S6 使用大通道，其余用默认通道
                                  // Aisle width: wide for S2/S6, default otherwise
                                  let aisleStyle = null;
                                  if (showGap && useWideAisle) {
                                    aisleStyle = { width: sizes.aisleWidth };
                                  }

                                  return (
                                    <View
                                      key={spot.id}
                                      style={{ flexDirection: "row", alignItems: "center" }}
                                    >
                                      {/* 通道占位块（仅在组切换时渲染）
                                          Aisle spacer — only rendered at group boundary */}
                                      {showGap && (
                                        <View
                                          style={[
                                            styles.aisle,
                                            aisleStyle,
                                            { backgroundColor: T.border + "55" },
                                          ]}
                                        />
                                      )}

                                      {/* 格子组件 / Spot cell */}
                                      <SpotCell
                                        spot={spot}
                                        isMySpot={isMySpot}
                                        color={color}
                                        dim={dim}
                                        pulseAnim={pulseAnim}
                                        onPress={handleSpotPress}
                                        spotW={sizes.spotW}
                                        spotH={sizes.spotH}
                                        spotFont={sizes.spotFont}
                                      />
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
              </View>

              {/*
                SR 右侧竖排，从 R4 旁边开始（marginTop = S1+S2 高度约 135px）
                SR vertical column — starts beside R4 (marginTop ≈ S1+S2 height)
                格子横向（宽>高），编号旋转 –90°，模拟垂直停车位
                Spots are landscape (30w×22h) with numbers rotated –90° for perpendicular parking
              */}
              <View
                style={[
                  styles.srColumn,
                  { marginTop: sizes.srMarginTop, borderLeftColor: T.border + "88" },
                ]}
              >
                <Text style={[styles.srColLabel, { color: T.muted }]}>SR(R13)</Text>

                {getSectionRows("SR")[0]
                  ? getSectionRows("SR")[0].map(function renderSRSpot(spot, spotIndex) {
                      const isMySpot = spot.id === mySpotId;
                      const color    = spotColor(spot, isMySpot);
                      const dim      = isDimmed(spot);
                      return (
                        <SRSpotCell
                          key={spot.id}
                          spot={spot}
                          index={spotIndex}
                          isMySpot={isMySpot}
                          color={color}
                          dim={dim}
                          pulseAnim={pulseAnim}
                          onPress={handleSpotPress}
                          srW={sizes.srSpotW}
                          srH={sizes.srSpotH}
                          srFont={sizes.srFont}
                        />
                      );
                    })
                  : null
                }
              </View>

            </View>
          </ScrollView>
        </View>

        {/* 图例 / Legend */}
        <View style={styles.legend}>
          {LEGEND_ITEMS.map(function renderLegendItem(item) {
            // 从主题对象取对应颜色键的颜色值
            // Read colour from theme object by key
            const dotColor = (T as any)[item.themeKey];
            return (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: dotColor }]} />
                <Text style={[styles.legendLabel, { color: T.muted }]}>{item.label}</Text>
              </View>
            );
          })}
        </View>

        {/* 操作提示文字 / Hint text */}
        <Text style={[styles.hint, { color: T.muted }]}>
          Tap any spot to check in · Tap 📍 to check out
        </Text>

      </ScrollView>

      {/*
        弹窗放在 ScrollView 外，确保层级最高。
        Modals outside ScrollView so they render above all content.
      */}

      {/* 车位详情底部弹窗 / Spot detail bottom sheet */}
      <SpotModal
        spot={selected}
        mySpotId={mySpotId}
        T={T}
        onClose={function closeSpotModal() { setSelected(null); }}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

      {/* OKU 警告弹窗 / OKU warning modal */}
      <OKUWarningModal
        visible={okuWarning}
        T={T}
        plate={currentPlate}
        onClose={function closeOKUWarning() {
          setOkuWarning(false);
          setPendingSpot(null);
        }}
        onProceed={handleOKUProceed}
      />

    </View>
  );
}