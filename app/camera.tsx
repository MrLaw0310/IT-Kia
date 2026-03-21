/*
app/camera.tsx — 签入/签出页面 / Check-In & Check-Out Screen

让用户通过输入车牌号签入停车位，以及从当前会话签出。
Allows users to check in by entering their plate number, and to check out.

签入步骤流程 / Check-in step flow:
 Step 1 "entry"   → 用户输入车牌，点击验证 / enter plate, tap Verify
 Step 2 "confirm" → 显示已验证车牌详情，用户确认 / show verified details, confirm
 Step 3 "success" → 成功画面，1.8 秒后自动跳转地图页 / success, auto-redirect to Map

签出步骤流程 / Check-out step flow:
 "checkout_confirm" → 签出确认对话框 / confirm checkout dialog
 "checkout_success" → 再见画面，自动跳转地图页 / goodbye screen, auto-redirect

车牌验证 / Plate validation:
 车牌与 ParkingContext 的注册车辆列表匹配，比较前统一去空格和大写。
 Plate matched against vehicles in ParkingContext, spaces stripped and uppercased.

数据来源 / Data source:
 签入/签出均通过 ParkingContext 操作，确保与 Map 和 Home 页面同步。
 Check-in and check-out use ParkingContext so Map and Home stay in sync.
*/

import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useParkingContext } from "../utils/ParkingContext";
import { useTheme } from "../utils/ThemeContext";

// ─── 类型定义 / Type definitions ──────────────────────────────────────────────

// 此页面所有可能的步骤状态
// All possible step states for this screen
type Step = "entry" | "confirm" | "success" | "checkout_confirm" | "checkout_success";

// 本地显示用的活动签入快照结构
// Shape of an active check-in snapshot used for local display
interface ActiveCheckInSnapshot {
  plate: string; // 车牌号 / license plate
  time:  string; // 签入时间字符串 / check-in time string
  date:  string; // 签入日期字符串 / check-in date string
}

// ─── 辅助函数 / Helper functions ──────────────────────────────────────────────

/*
根据当前步骤返回步骤指示器的索引（0 / 1 / 2）。
Returns the step indicator index (0, 1, or 2) for the given step.
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
  // checkout_success
  return 2;
}

/*
根据步骤类型判断当前是否处于签出流程。
Returns true when the current step belongs to the check-out flow.
*/
function isCheckOutStep(step: Step): boolean {
  if (step === "checkout_confirm" || step === "checkout_success") {
    return true;
  }
  return false;
}

/*
根据步骤流程返回页面标题文字。
Returns the header title text based on which flow is active.
*/
function getHeaderTitle(step: Step): string {
  if (isCheckOutStep(step)) {
    return "Check Out";
  }
  return "Check In";
}

/*
根据步骤流程返回步骤标签数组。
Returns the step label array based on which flow is active.
*/
function getStepLabels(step: Step): string[] {
  if (isCheckOutStep(step)) {
    return ["Active Session", "Confirm", "Done"];
  }
  return ["Enter Plate", "Confirm", "Done"];
}

/*
将车牌字符串标准化：去两端空格 + 全部大写。
Normalises a plate string: trim whitespace and convert to uppercase.
*/
function normalisePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

/*
去掉车牌中所有空格后比较两个车牌是否相同。
Returns true if two plate strings match after removing all internal spaces.
*/
function platesMatch(a: string, b: string): boolean {
  return a.toUpperCase().replace(/\s/g, "") === b.toUpperCase().replace(/\s/g, "");
}

// ─── Styles for CameraScreen ──────────────────────────────────────────────────
const styles = StyleSheet.create({

  // 全屏容器
  // Full-screen container
  screen: {
    flex: 1,
  },

  // 滚动内容区域
  // Scroll content area
  scroll: {
    padding:         20,
    paddingTop:      56,
    paddingBottom:   60,
    backgroundColor: "transparent",
  },

  // 顶部导航栏（返回按钮 + 标题 + logo）
  // Header row — back button, title, logo
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   20,
  },

  // 返回按钮触控区
  // Back button touch target
  backArrow: {
    padding: 4,
  },

  // 返回按钮文字
  // Back button text
  backArrowText: {
    fontSize:   16,
    fontWeight: "600",
  },

  // 页面标题
  // Page title
  headerTitle: {
    fontSize:   18,
    fontWeight: "800",
  },

  // 活动签入横幅
  // Active check-in session banner
  activeBanner: {
    borderWidth:   1,
    borderRadius:  16,
    padding:       14,
    marginBottom:  20,
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },

  // 横幅标题文字（当前签入状态）
  // Banner title text — current session status
  activeBannerTitle: {
    fontSize:     13,
    fontWeight:   "800",
    marginBottom: 3,
  },

  // 横幅副标题文字（车牌 + 时间）
  // Banner subtitle — plate and time
  activeBannerSub: {
    fontSize: 12,
  },

  // 横幅内的签出按钮
  // Check-out button inside the banner
  checkOutBtn: {
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   10,
  },

  // 签出按钮文字
  // Check-out button text
  checkOutBtnText: {
    color:      "white",
    fontWeight: "800",
    fontSize:   13,
  },

  // 步骤指示器横排
  // Step indicator row
  stepRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   32,
  },

  // 单个步骤项（圆点 + 标签 + 连接线）
  // Single step item — dot, label, connector line
  stepItem: {
    alignItems:    "center",
    flexDirection: "row",
    gap:           6,
  },

  // 步骤圆点
  // Step indicator dot
  stepDot: {
    width:          28,
    height:         28,
    borderRadius:   14,
    justifyContent: "center",
    alignItems:     "center",
  },

  // 步骤圆点内文字
  // Text inside the step dot
  stepDotText: {
    color:      "white",
    fontSize:   11,
    fontWeight: "800",
  },

  // 步骤标签文字
  // Step label text beside the dot
  stepLabel: {
    fontSize:   11,
    fontWeight: "600",
  },

  // 步骤之间的连接线
  // Connector line between step dots
  stepLine: {
    width:           24,
    height:          2,
    marginHorizontal: 4,
  },

  // 步骤内容主体区域
  // Main body area for step content
  body: {
    flex: 1,
  },

  // 马来西亚车牌预览卡（Step 1 上方的卡片）
  // Malaysian plate preview card — shown above the input in Step 1
  plateIconCard: {
    borderWidth:  1,
    borderRadius: 20,
    padding:      24,
    alignItems:   "center",
    marginBottom: 24,
  },

  // 马来西亚车牌样式边框（黄底黑边）
  // Malaysian licence plate frame — yellow background, black border
  plateFrame: {
    backgroundColor:   "#FFF8DC",
    borderWidth:       3,
    borderColor:       "#1a1a1a",
    borderRadius:      10,
    paddingHorizontal: 24,
    paddingVertical:   10,
    alignItems:        "center",
    minWidth:          200,
    marginBottom:      8,
  },

  // 车牌国家代码小字（"MYS"）
  // Plate country code small text — "MYS"
  plateFrameCountry: {
    color:         "#003399",
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 2,
    marginBottom:  2,
  },

  // 车牌号大字
  // Plate number — large bold text
  plateFrameText: {
    color:         "#1a1a1a",
    fontSize:      26,
    fontWeight:    "900",
    letterSpacing: 4,
  },

  // 车牌预览卡副标题
  // Plate preview card subtitle
  plateIconSub: {
    fontSize: 11,
  },

  // 输入框标签
  // Input field label
  inputLabel: {
    fontSize:      12,
    letterSpacing: 1,
    marginBottom:  8,
  },

  // 车牌输入框
  // Plate number text input
  input: {
    borderWidth:   1,
    borderRadius:  14,
    padding:       16,
    fontSize:      20,
    fontWeight:    "800",
    letterSpacing: 3,
    marginBottom:  8,
    textAlign:     "center",
  },

  // 错误提示文字
  // Error message text
  errorText: {
    fontSize:     12,
    marginBottom: 12,
    lineHeight:   18,
  },

  // 快捷选择区域标签
  // Quick-pick section label
  quickPickLabel: {
    fontSize:      11,
    letterSpacing: 1,
    marginBottom:  10,
    marginTop:     4,
  },

  // 快捷选择按钮横排
  // Quick-pick button row
  quickPickRow: {
    flexDirection: "row",
    gap:           10,
    marginBottom:  24,
    flexWrap:      "wrap",
  },

  // 单个快捷选择按钮
  // Single quick-pick button
  quickPickBtn: {
    borderWidth:  1,
    borderRadius: 12,
    padding:      12,
    alignItems:   "center",
    gap:          4,
    minWidth:     100,
  },

  // 快捷选择按钮图标
  // Quick-pick button icon
  quickPickIcon: {
    fontSize: 18,
  },

  // 快捷选择按钮文字
  // Quick-pick button text
  quickPickText: {
    fontWeight: "700",
    fontSize:   13,
  },

  // 主要操作按钮（蓝色或红色背景）
  // Primary action button — blue or red background
  primaryBtn: {
    borderRadius:    16,
    paddingVertical: 16,
    alignItems:      "center",
    marginBottom:    12,
  },

  // 主要按钮文字
  // Primary button text
  primaryBtnText: {
    color:      "white",
    fontWeight: "800",
    fontSize:   16,
  },

  // 次要操作按钮（边框样式）
  // Secondary action button — outlined style
  secondaryBtn: {
    borderWidth:     1,
    borderRadius:    16,
    paddingVertical: 14,
    alignItems:      "center",
  },

  // 次要按钮文字
  // Secondary button text
  secondaryBtnText: {
    fontWeight: "600",
    fontSize:   14,
  },

  // 确认卡片容器（Step 2 / 签出确认页）
  // Confirmation card — Step 2 and checkout confirm
  confirmCard: {
    borderWidth:  1,
    borderRadius: 20,
    padding:      24,
    alignItems:   "center",
    marginBottom: 20,
  },

  // 确认卡片顶部大图标
  // Large icon at the top of the confirm card
  confirmIcon: {
    fontSize:     40,
    marginBottom: 10,
  },

  // 确认卡片标题
  // Confirm card title
  confirmTitle: {
    fontSize:     20,
    fontWeight:   "800",
    marginBottom: 20,
  },

  // 确认卡片详情表格容器
  // Detail table container inside the confirm card
  confirmDetails: {
    borderRadius: 14,
    padding:      16,
    width:        "100%",
    gap:          12,
    marginTop:    16,
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

  // 成功画面主体（居中排列）
  // Success screen body — centred layout
  successBody: {
    alignItems: "center",
    paddingTop: 40,
  },

  // 成功圆形图标背景
  // Success circle background
  successCircle: {
    width:          100,
    height:         100,
    borderRadius:   50,
    borderWidth:    2,
    justifyContent: "center",
    alignItems:     "center",
    marginBottom:   20,
  },

  // 成功图标 emoji
  // Success icon emoji
  successEmoji: {
    fontSize: 48,
  },

  // 成功标题
  // Success title
  successTitle: {
    fontSize:     28,
    fontWeight:   "900",
    marginBottom: 12,
  },

  // 成功副标题
  // Success subtitle
  successSub: {
    fontSize:     14,
    textAlign:    "center",
    lineHeight:   22,
    marginBottom: 24,
  },
});

// ─── CameraScreen ─────────────────────────────────────────────────────────────
/*
步骤式签入/签出流程页面。
Step-by-step check-in / check-out flow screen.
*/
export default function CameraScreen() {

  const { theme: T }  = useTheme();
  const router        = useRouter();

  // 从 ParkingContext 读取注册车辆和签入/签出函数
  // Read registered vehicles and check-in/out functions from ParkingContext
  const { vehicles, checkOut: ctxCheckOut, activeSession } = useParkingContext(); // camera 只签出，不签入；签入在 Map 页面完成 / camera uses checkOut only; check-in happens in Map

  // ── 本地状态 / Local state ───────────────────────────────────────────────────

  // 当前步骤 / Current step
  const [step, setStep] = useState<Step>("entry");

  // 输入框内容 / Text input value
  const [plate, setPlate] = useState("");

  // 已通过验证的车牌（进入 confirm 步骤后使用）
  // Verified plate — used after passing Step 1 validation
  const [matchedPlate, setMatchedPlate] = useState("");

  // 已匹配的车辆对象（用于 confirm 步骤读取 isPaid 等字段）
  // Matched vehicle object — used in confirm step to read fields such as isPaid
  const [matchedVehicle, setMatchedVehicle] = useState<typeof vehicles[0] | null>(null);

  // 错误提示文字 / Error message text
  const [error, setError] = useState("");

  // 本地活动签入快照（从 activeSession 同步而来）
  // Local active check-in snapshot — synced from activeSession
  const [localCheckIn, setLocalCheckIn] = useState<ActiveCheckInSnapshot | null>(null);

  // ── Refs / Refs ──────────────────────────────────────────────────────────────

  // 按钮按压缩放动画值
  // Button press scale animation value
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 自动跳转定时器 ID（页面失焦时清除，防止内存泄漏）
  // Auto-redirect timer ID — cleared on blur to prevent memory leaks
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 页面焦点处理 / Focus effect ──────────────────────────────────────────────
  // 每次页面获得焦点时，从 ParkingContext 同步活动签入状态
  // On every focus, sync the active session from ParkingContext
  useFocusEffect(useCallback(function onFocus() {
    if (activeSession) {
      // 有活动会话：建立本地快照供横幅显示
      // Active session exists — build a local snapshot for banner display
      const now      = new Date();
      const timeStr  = now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
      const dateStr  = now.toLocaleDateString("en-MY",  { day: "numeric", month: "short", year: "numeric" });
      setLocalCheckIn({ plate: activeSession.plate, time: timeStr, date: dateStr });
    } else {
      setLocalCheckIn(null);
    }

    // 返回清理函数：失焦时清除自动跳转定时器
    // Return cleanup: clear the auto-redirect timer on blur
    return function onBlur() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [activeSession]));

  // ── 按压动画 / Press animation ───────────────────────────────────────────────
  /*
  按钮被按下时播放轻微缩小再恢复的动画。
  Plays a subtle scale-down-then-restore animation when a button is pressed.
  */
  function animatePress() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
  }

  // ── 步骤处理函数 / Step handlers ─────────────────────────────────────────────

  /*
  Step 1：验证输入的车牌是否在已注册车辆列表内。
  Step 1: Validate the entered plate against the registered vehicle list.
  */
  function handleScan() {
    animatePress();
    const cleaned = normalisePlate(plate);

    // 输入不能为空
    // Input cannot be empty
    if (!cleaned) {
      setError("Please enter your plate number.");
      return;
    }

    // 在注册车辆列表中查找匹配车牌
    // Find a matching plate in the registered vehicle list
    // 注意：这里用 foundVehicle 而不是 matchedVehicle，避免与外层 state 同名（变量遮蔽）
    // Note: named foundVehicle here to avoid shadowing the matchedVehicle state above
    let foundVehicle = null;
    for (let i = 0; i < vehicles.length; i++) {
      if (platesMatch(vehicles[i].plate, cleaned)) {
        foundVehicle = vehicles[i];
        break;
      }
    }

    // 未找到匹配车辆
    // No matching vehicle found
    if (!foundVehicle) {
      setError(
        '"' + cleaned + '" is not registered under your account.\n' +
        "Please check or register in Profile."
      );
      return;
    }

    // 验证通过，进入确认步骤
    // Validation passed — proceed to confirm step
    setError("");
    setMatchedPlate(foundVehicle.plate);
    setMatchedVehicle(foundVehicle); // 保存完整车辆对象，供 confirm 步骤读取 isPaid 等字段
                                     // Save full vehicle object so confirm step can read isPaid etc.
    setStep("confirm");
  }

  /*
  Step 2：确认签入，写入 ParkingContext，触发地图和主页同步。
  Step 2: Confirm check-in, write to ParkingContext so Map and Home sync.
  */
  function handleConfirm() {
    animatePress();

    // 生成当前时间快照供本地显示
    // Build a time snapshot for local display
    const now      = new Date();
    const timeStr  = now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
    const dateStr  = now.toLocaleDateString("en-MY",  { day: "numeric", month: "short", year: "numeric" });

    // 更新本地快照（横幅显示用）
    // Update local snapshot for banner display
    setLocalCheckIn({ plate: matchedPlate, time: timeStr, date: dateStr });

    // 进入成功步骤，1.8 秒后跳转到地图页
    // Move to success step, redirect to Map after 1.8s
    setStep("success");
    timerRef.current = setTimeout(function redirectToMap() {
      router.push("/(tabs)/map" as any);
    }, 1800);
  }

  /*
  重置到初始输入步骤（清空输入和错误）。
  Reset to the initial entry step — clears input and error.
  */
  function handleReset() {
    setPlate("");
    setMatchedPlate("");
    setError("");
    setStep("entry");
  }

  /*
  开始签出流程（进入签出确认步骤）。
  Begin the check-out flow — moves to checkout_confirm step.
  */
  function handleCheckOutPress() {
    animatePress();
    setStep("checkout_confirm");
  }

  /*
  签出确认：通知 ParkingContext 签出，清除本地快照，1.8 秒后跳转。
  Check-out confirm: notify ParkingContext, clear local snapshot, redirect after 1.8s.
  */
  function handleCheckOutConfirm() {
    animatePress();

    // 通知 Context 签出（Map 和 Home 会自动同步）
    // Notify Context to check out — Map and Home will sync automatically
    ctxCheckOut();
    setLocalCheckIn(null);
    setStep("checkout_success");

    timerRef.current = setTimeout(function redirectAfterCheckOut() {
      setStep("entry");
      router.push("/(tabs)/map" as any);
    }, 1800);
  }

  // ── 派生显示值 / Derived display values ─────────────────────────────────────

  // 当前步骤索引（0 / 1 / 2）
  // Current step index for the step indicator
  const stepIndex = getStepIndex(step);

  // 是否在签出流程
  // Whether the check-out flow is active
  const isCheckOut = isCheckOutStep(step);

  // 页面标题文字
  // Page header title text
  const headerTitle = getHeaderTitle(step);

  // 步骤标签数组
  // Step label array
  const stepLabels = getStepLabels(step);

  // 已注册车牌列表（供快捷选择使用）
  // Registered plate list — used for quick-pick buttons
  const registeredPlates = vehicles.map(function extractPlate(v) { return v.plate; });

  // 车牌输入框预览文字（有输入显示输入内容，无输入显示占位虚线）
  // Plate preview text — shows typed plate or placeholder dashes
  let platePreviewText: string;
  if (plate.trim()) {
    platePreviewText = normalisePlate(plate);
  } else {
    platePreviewText = "_ _ _ _ _ _ _";
  }

  // 签出确认页的签出时间文字
  // Check-out time text for the checkout_confirm page
  const checkOutTimeText = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // 输入框边框颜色（有错误时变红）
  // Input border colour — red when there's an error
  let inputBorderColor: string;
  if (error) {
    inputBorderColor = T.red;
  } else {
    inputBorderColor = T.border;
  }

  // 活动横幅颜色
  // Active session banner colours
  const bannerBgColor     = T.green + "15";
  const bannerBorderColor = T.green + "44";

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={(function getKeyboardBehavior() {
        if (Platform.OS === "ios") { return "padding" as const; }
        return "height" as const;
      })()}
    >
      <ScrollView
        style={[styles.screen, { backgroundColor: "transparent" }]}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >

        {/* 顶部导航栏 / Page header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={function goBack() { router.back(); }}
            style={styles.backArrow}
          >
            <Text style={[styles.backArrowText, { color: T.accent }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>{headerTitle}</Text>
          <Image
            source={require("../assets/images/itkia.png")}
            style={{ width: 80, height: 40, resizeMode: "contain" }}
          />
        </View>

        {/* 活动签入横幅（仅在 entry 步骤且已签入时显示）
            Active session banner — only on entry step when checked in */}
        {localCheckIn && step === "entry" && (
          <View style={[styles.activeBanner, { backgroundColor: bannerBgColor, borderColor: bannerBorderColor }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeBannerTitle, { color: T.green }]}>
                🟢  Currently Checked In
              </Text>
              <Text style={[styles.activeBannerSub, { color: T.muted }]}>
                {localCheckIn.plate}  ·  {localCheckIn.time}  ·  {localCheckIn.date}
              </Text>
            </View>
            {/* 横幅内的签出按钮 / Check-out button inside the banner */}
            <TouchableOpacity
              style={[styles.checkOutBtn, { backgroundColor: T.red }]}
              onPress={handleCheckOutPress}
              activeOpacity={0.85}
            >
              <Text style={styles.checkOutBtnText}>Check Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 步骤指示器 / Step indicator */}
        <View style={styles.stepRow}>
          {stepLabels.map(function renderStepItem(label, index) {
            const isActiveDot = index === stepIndex;
            const isDone      = index < stepIndex;

            // 圆点背景颜色
            // Dot background colour
            let dotBgColor: string;
            if (isDone) {
              dotBgColor = T.green;
            } else if (isActiveDot) {
              if (isCheckOut) {
                dotBgColor = T.red;
              } else {
                dotBgColor = T.accent;
              }
            } else {
              dotBgColor = T.border;
            }

            // 圆点内文字（已完成显示勾，其余显示序号）
            // Dot text — checkmark for done steps, number for others
            let dotText: string;
            if (isDone) {
              dotText = "✓";
            } else {
              dotText = String(index + 1);
            }

            // 标签文字颜色（活跃或完成的步骤用主色）
            // Label text colour — primary for active/done steps
            let labelColor: string;
            if (isActiveDot || isDone) {
              labelColor = T.text;
            } else {
              labelColor = T.muted;
            }

            // 连接线颜色（前一步完成则用绿色）
            // Connector line colour — green after completed step
            let lineColor: string;
            if (isDone) {
              lineColor = T.green;
            } else {
              lineColor = T.border;
            }

            return (
              <View key={label} style={styles.stepItem}>
                {/* 步骤圆点 / Step dot */}
                <View style={[styles.stepDot, { backgroundColor: dotBgColor }]}>
                  <Text style={styles.stepDotText}>{dotText}</Text>
                </View>
                {/* 步骤标签 / Step label */}
                <Text style={[styles.stepLabel, { color: labelColor }]}>{label}</Text>
                {/* 圆点之间的连接线（最后一个步骤后不渲染）
                    Connector line — not rendered after the last step */}
                {index < 2 && (
                  <View style={[styles.stepLine, { backgroundColor: lineColor }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* ── Step 1：输入车牌 / Step 1 — Enter Plate ─────────────────────── */}
        {step === "entry" && (
          <View style={styles.body}>

            {/* 马来西亚车牌预览卡 / Malaysian plate preview card */}
            <View
              style={[styles.plateIconCard, { backgroundColor: T.card, borderColor: T.border }]}
            >
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{platePreviewText}</Text>
              </View>
              <Text style={[styles.plateIconSub, { color: T.muted }]}>
                Malaysian vehicle plate preview
              </Text>
            </View>

            {/* 输入框 / Plate input */}
            <Text style={[styles.inputLabel, { color: T.muted }]}>
              Enter Your Plate Number
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: T.card, borderColor: inputBorderColor, color: T.text },
              ]}
              value={plate}
              onChangeText={function handlePlateChange(text) {
                setPlate(text);
                setError("");
              }}
              placeholder="e.g. JHR 1234"
              placeholderTextColor={T.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />

            {/* 错误提示（有错误时显示）/ Error message when present */}
            {error ? (
              <Text style={[styles.errorText, { color: T.red }]}>{error}</Text>
            ) : null}

            {/* 快捷选择标签 / Quick-pick label */}
            <Text style={[styles.quickPickLabel, { color: T.muted }]}>
              Your Registered Vehicles
            </Text>

            {/* 快捷选择按钮（无车辆时显示提示）
                Quick-pick buttons — show hint when no vehicles registered */}
            <View style={styles.quickPickRow}>
              {registeredPlates.length === 0 ? (
                <Text style={{ color: T.muted, fontSize: 12 }}>
                  No vehicles registered. Go to Profile to add one.
                </Text>
              ) : (
                registeredPlates.map(function renderQuickPickBtn(p) {
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.quickPickBtn,
                        { backgroundColor: T.card, borderColor: T.accent + "44" },
                      ]}
                      onPress={function selectPlate() {
                        setPlate(p);
                        setError("");
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickPickIcon}>🚗</Text>
                      <Text style={[styles.quickPickText, { color: T.accent }]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* 验证按钮（带按压动画）/ Verify button with press animation */}
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

        {/* ── Step 2：确认签入 / Step 2 — Confirm Check-In ─────────────────── */}
        {step === "confirm" && (
          <View style={styles.body}>
            <View style={[styles.confirmCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <Text style={styles.confirmIcon}>🅿️</Text>
              <Text style={[styles.confirmTitle, { color: T.text }]}>Plate Verified</Text>

              {/* 车牌展示 / Plate display */}
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{matchedPlate}</Text>
              </View>

              {/* 确认详情表格 / Confirmation detail table */}
              <View style={[styles.confirmDetails, { backgroundColor: T.bg }]}>
                {(function buildConfirmDetails(): [string, string][] {
                  // 年费状态：从已匹配车辆的 isPaid 字段读取，不再硬编码
                  // Pass status: read from matched vehicle's isPaid field — no more hardcoding
                  let passStatus: string;
                  if (matchedVehicle && matchedVehicle.isPaid) {
                    passStatus = "✅ Annual Fee Paid";
                  } else {
                    passStatus = "⚠️ Fee Unpaid — Pay at Admin Counter";
                  }

                  // 当前时间字符串（用于签入时间和日期行）
                  // Current time strings for the check-in time and date rows
                  const checkInTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  const checkInDate = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

                  // 返回完整详情行数组
                  // Return the complete detail rows array
                  return [
                    ["Status",   "✅ Registered Vehicle"],
                    ["Pass",     passStatus             ],
                    ["Check In", checkInTime            ],
                    ["Date",     checkInDate            ],
                  ];
                })().map(function renderConfirmRow([key, value]) {
                  return (
                    <View key={key} style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: T.muted }]}>{key}</Text>
                      <Text style={[styles.detailVal, { color: T.text }]}>{value}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 确认签入按钮 / Confirm check-in button */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: T.accent }]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>✅  Confirm Check-In</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 返回按钮 / Back button */}
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: T.card, borderColor: T.border }]}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: T.text }]}>
                ← Enter Different Plate
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 3：签入成功 / Step 3 — Check-In Success ─────────────────── */}
        {step === "success" && (
          <View style={[styles.body, styles.successBody]}>
            <View
              style={[
                styles.successCircle,
                { backgroundColor: T.green + "20", borderColor: T.green + "55" },
              ]}
            >
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

        {/* ── 签出确认 / Check-Out — Confirm ──────────────────────────────── */}
        {step === "checkout_confirm" && localCheckIn && (
          <View style={styles.body}>
            <View style={[styles.confirmCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <Text style={styles.confirmIcon}>🚗</Text>
              <Text style={[styles.confirmTitle, { color: T.text }]}>Confirm Check-Out</Text>

              {/* 车牌展示 / Plate display */}
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{localCheckIn.plate}</Text>
              </View>

              {/* 签出详情表格 / Check-out detail table */}
              <View style={[styles.confirmDetails, { backgroundColor: T.bg }]}>
                {[
                  ["Plate",      localCheckIn.plate],
                  ["Checked In", localCheckIn.time],
                  ["Date",       localCheckIn.date],
                  ["Check Out",  checkOutTimeText],
                ].map(function renderCheckOutRow([key, value]) {
                  return (
                    <View key={key} style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: T.muted }]}>{key}</Text>
                      <Text style={[styles.detailVal, { color: T.text }]}>{value}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 确认签出按钮（红色）/ Confirm check-out button — red */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: T.red }]}
                onPress={handleCheckOutConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>🚗  Confirm Check-Out</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 取消按钮 / Cancel button */}
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: T.card, borderColor: T.border }]}
              onPress={function cancelCheckOut() { setStep("entry"); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: T.text }]}>← Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 签出成功 / Check-Out — Success ──────────────────────────────── */}
        {step === "checkout_success" && (
          <View style={[styles.body, styles.successBody]}>
            <View
              style={[
                styles.successCircle,
                { backgroundColor: T.red + "20", borderColor: T.red + "55" },
              ]}
            >
              <Text style={styles.successEmoji}>👋</Text>
            </View>
            <Text style={[styles.successTitle, { color: T.text }]}>Checked Out!</Text>
            <Text style={[styles.successSub, { color: T.muted }]}>
              {localCheckIn ? localCheckIn.plate : ""} has been released.{"\n"}Drive safely!
            </Text>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}