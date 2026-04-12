/*
app/(tabs)/history.tsx — 停车历史记录页面 / Parking History Screen

显示所有停车会话（签入/签出事件）的时间顺序列表。
Shows a chronological list of all parking sessions (check-in/out events).

页面区块 / Sections:
 1. 年度通行证横幅 / Annual pass banner — shows pass validity
 2. 摘要卡片 / Summary card — total sessions / overstays count
 3. 筛选标签 / Filter pills — All / Active / Completed / Overstay
 4. 记录卡片 / Record cards — tappable, opens DetailModal
 5. 无记录时的空状态提示 / Empty state if no records

数据 / Data:
 useParkingContext() 的 activity 被转换为 ParkingRecord[] 格式显示。
 `activity` from useParkingContext() is converted to ParkingRecord[] for display.

[BUG 3 & 4 FIX] 记录配对说明 / Record pairing note:
 activity 数组中每个事件是独立的（isIn=true 为签入，isIn=false 为签出）。
 修复后先将 isIn/isOut 事件按车牌+车位配对，合并为一条完整停车记录，
 确保每条记录同时包含签入和签出时间，已完成的历史签入事件不再错误显示为 Active。
 Each activity item is a standalone event (isIn=true = check-in, isIn=false = check-out).
 The fix pairs isIn/isOut events by plate+spot into complete session records,
 so each record has both check-in and check-out times, and completed historical
 check-in events no longer incorrectly appear as Active.
*/

import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useAuth } from "../../utils/AuthContext";
import { useParkingContext } from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── 常量 / Constants ─────────────────────────────────────────────────────────

// 超过此小时数且仍签入中，标记为 Overstay（超时）
// Sessions still active beyond this many hours are marked Overstay
const OVERSTAY_HOURS = 4;

// 筛选器选项列表，放在组件外避免每次渲染重新创建
// Filter options outside the component to avoid re-creating on every render
const FILTERS: (RecordStatus | "All")[] = ["All", "Active", "Completed", "Overstay"];

// ─── 类型定义 / Type definitions ──────────────────────────────────────────────

/* 停车记录可能的状态值 / possible status values for a parking record */
type RecordStatus = "Active" | "Completed" | "Overstay";

/* 此页面显示的单条停车记录结构 / shape of a single parking record shown on this screen */
interface ParkingRecord {
  id: string;        // 唯一标识符 / unique ID
  spot: string;      // 车位编号，如 "R1-3" / spot ID e.g. "R1-3"
  plate: string;     // 车牌号 / license plate
  date: string;      // 日期字符串 / date string
  checkIn: string;   // 签入时间 / check-in time
  checkOut?: string; // 签出时间（可选）/ check-out time if completed
  duration?: string; // 停留时长（可选）/ duration if known
  status: RecordStatus; // Active / Completed / Overstay
}

// ─── 辅助函数 / Helper functions ──────────────────────────────────────────────

/*
根据记录状态返回对应颜色。
Returns the display colour for a given record status.
*/
function getStatusColor(status: RecordStatus, T: any): string {
  if (status === "Active")    { return T.green;  }
  if (status === "Completed") { return T.accent; }
  return T.red; // Overstay
}

/*
根据记录状态返回对应 emoji 图标。
Returns the emoji icon for a given record status.
*/
function getStatusIcon(status: RecordStatus): string {
  if (status === "Active")    { return "🟢"; }
  if (status === "Completed") { return "✅"; }
  return "⚠️"; // Overstay
}

/*
根据签入时间戳判断会话是否超时。
Returns true if the session has exceeded the overstay threshold.

@param checkedInAt ISO 时间戳字符串 / ISO timestamp string of check-in time
*/
function isOverstay(checkedInAt: string): boolean {
  const hoursParked = (Date.now() - new Date(checkedInAt).getTime()) / (1000 * 60 * 60);
  return hoursParked > OVERSTAY_HOURS;
}

/*
[BUG 3 FIX] 根据活动状态和签入信息，计算出该记录的显示状态。
[BUG 3 FIX] Derives the display status for a record.

原来的问题：只要 isInEvent 为 true，就跳过第一个 if，最终返回 "Active"，
导致所有历史签入事件都被标为 Active，而不是 Completed。

修复后：
 - 非签入事件（签出事件）→ Completed
 - [NEW] 签入事件但不是当前活动会话 → 已完成（已配对签出）→ Completed
 - 当前活动会话 → 检查是否超时 → Overstay or Active

Original issue: any isIn=true event returned "Active", so all historical
check-ins appeared Active even after completion.

Fixed:
 - Not a check-in event → Completed
 - [NEW] Is check-in but not active session → session ended → Completed
 - Is active session → check overstay → Overstay or Active

@param isActive    是否是当前活动会话 / whether this is the current active session
@param isInEvent   activity item 的 isIn 标志 / the isIn flag from the activity item
@param checkedInAt 签入时间戳，可能不存在 / check-in timestamp, may be undefined
*/
function deriveRecordStatus(
  isActive: boolean,
  isInEvent: boolean,
  checkedInAt: string | undefined
): RecordStatus {
  // 既不是当前活动会话也不是签入事件，直接标记已完成
  // Neither the active session nor a check-in event — mark as Completed
  if (!isActive && !isInEvent) {
    return "Completed";
  }

  // [BUG 3 FIX] 是签入事件但不是当前活动会话，该次签入已完成
  // [BUG 3 FIX] Is a check-in event but not the active session — session has ended
  if (isInEvent && !isActive) {
    return "Completed";
  }

  // 是当前活动会话：检查是否超时 / active session: check overstay threshold
  if (checkedInAt && isOverstay(checkedInAt)) {
    return "Overstay";
  }

  return "Active";
}

// ─── DetailModal styles (底部详情弹窗样式) ────────────────────────────────────
const detailModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle: { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  sheetSub: { fontSize: 13, marginBottom: 20 },
  spotBadge: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  spotBadgeText: { fontSize: 18, fontWeight: "900" },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  detailBox: { borderRadius: 14, padding: 14, marginBottom: 14, gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailKey: { fontSize: 13 },
  detailVal: { fontWeight: "700", fontSize: 13 },
  feeNote: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  feeNoteText: { fontSize: 12, lineHeight: 18 },
  closeSheetBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  closeSheetText: { fontWeight: "700", fontSize: 14 },
});

// ─── DetailModal (底部详情弹窗) ───────────────────────────────────────────────
/*
点击历史记录卡片时从底部滑出，显示完整记录详情和费用说明。
Slides up from the bottom when a history card is tapped.
*/
function DetailModal({ record, onClose }: { record: ParkingRecord | null; onClose: () => void }) {
  const { theme: T } = useTheme();
  if (!record) { return null; }

  const color = getStatusColor(record.status, T);

  let checkOutDisplay = "—";
  if (record.checkOut) { checkOutDisplay = record.checkOut; }

  let durationDisplay = "Ongoing";
  if (record.duration) { durationDisplay = record.duration; }

  const details = [
    ["Plate No.", record.plate],
    ["Check In",  record.checkIn],
    ["Check Out", checkOutDisplay],
    ["Duration",  durationDisplay],
  ];

  return (
    <Modal transparent animationType="slide" visible={!!record} onRequestClose={onClose}>
      <TouchableOpacity style={detailModalStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[detailModalStyles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[detailModalStyles.handle, { backgroundColor: T.border }]} />
          <Text style={[detailModalStyles.sheetTitle, { color: T.text }]}>Parking Record</Text>
          <Text style={[detailModalStyles.sheetSub, { color: T.muted }]}>{record.date}</Text>

          <View style={[detailModalStyles.spotBadge, { borderColor: color + "66", backgroundColor: color + "15" }]}>
            <Text style={[detailModalStyles.spotBadgeText, { color }]}>🅿️  Spot {record.spot}</Text>
            <View style={[detailModalStyles.statusPill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[detailModalStyles.statusPillText, { color }]}>{record.status}</Text>
            </View>
          </View>

          <View style={[detailModalStyles.detailBox, { backgroundColor: T.bg }]}>
            {details.map(([k, v]) => (
              <View key={k} style={detailModalStyles.detailRow}>
                <Text style={[detailModalStyles.detailKey, { color: T.muted }]}>{k}</Text>
                <Text style={[detailModalStyles.detailVal, { color: T.text }]}>{v}</Text>
              </View>
            ))}
          </View>

          <View style={[detailModalStyles.feeNote, { backgroundColor: T.accent + "10", borderColor: T.accent + "30" }]}>
            <Text style={[detailModalStyles.feeNoteText, { color: T.muted }]}>
              💳  MDIS uses an annual parking pass (RM10/vehicle). No per-session charges.
            </Text>
          </View>

          <TouchableOpacity style={[detailModalStyles.closeSheetBtn, { backgroundColor: T.border }]} onPress={onClose}>
            <Text style={[detailModalStyles.closeSheetText, { color: T.text }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── HistoryCard styles (历史记录卡片样式) ────────────────────────────────────
const historyCardStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, marginBottom: 10, flexDirection: "row", overflow: "hidden" },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardSpotWrap: { alignItems: "center", minWidth: 36 },
  cardSpotLabel: { fontSize: 9, letterSpacing: 1 },
  cardSpot: { fontSize: 20, fontWeight: "900" },
  cardDate: { fontWeight: "700", fontSize: 14 },
  cardTime: { fontSize: 12, marginTop: 2 },
  cardBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  cardBadgeText: { fontSize: 11, fontWeight: "700" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardDuration: { fontSize: 12 },
});

// ─── HistoryCard (历史记录卡片) ───────────────────────────────────────────────
/*
单行停车记录卡片。按状态颜色编码：绿=活动, accent=完成, 红=超时。
Single row card. Colour-coded by status: green=Active, accent=Completed, red=Overstay.
*/
function HistoryCard({ record, onPress }: { record: ParkingRecord; onPress: () => void }) {
  const { theme: T } = useTheme();
  const color = getStatusColor(record.status, T);
  const icon  = getStatusIcon(record.status);

  // 时间显示：有签出时间则追加 / time: append check-out if available
  let timeDisplay = record.checkIn;
  if (record.checkOut) {
    timeDisplay = `${record.checkIn} → ${record.checkOut}`;
  }

  let durationDisplay = "Ongoing";
  if (record.duration) { durationDisplay = record.duration; }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={[historyCardStyles.card, { backgroundColor: T.card, borderColor: T.border }]}
    >
      <View style={[historyCardStyles.cardAccent, { backgroundColor: color }]} />
      <View style={historyCardStyles.cardBody}>
        <View style={historyCardStyles.cardTop}>
          <View style={historyCardStyles.cardSpotWrap}>
            <Text style={[historyCardStyles.cardSpotLabel, { color: T.muted }]}>SPOT</Text>
            <Text style={[historyCardStyles.cardSpot, { color }]}>{record.spot}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text style={[historyCardStyles.cardDate, { color: T.text }]}>{record.date}</Text>
            <Text style={[historyCardStyles.cardTime, { color: T.muted }]}>{timeDisplay}</Text>
          </View>
          <View style={[historyCardStyles.cardBadge, { backgroundColor: color + "20", borderColor: color + "50" }]}>
            <Text style={{ fontSize: 12 }}>{icon}</Text>
            <Text style={[historyCardStyles.cardBadgeText, { color }]}>{record.status}</Text>
          </View>
        </View>
        <View style={historyCardStyles.cardBottom}>
          <Text style={[historyCardStyles.cardDuration, { color: T.muted }]}>🕐 {durationDisplay}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── HistoryScreen styles (历史记录主页面样式) ────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13 },
  passBanner: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  passIcon: { fontSize: 22 },
  passTitle: { fontWeight: "700", fontSize: 14 },
  passSub: { fontSize: 12, marginTop: 2 },
  passValidDot: { width: 10, height: 10, borderRadius: 5 },
  summaryCard: { borderWidth: 1, borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 16 },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryItem: { alignItems: "center" },
  summaryNum: { fontSize: 22, fontWeight: "900" },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, marginHorizontal: 16 },
  filterRow: { marginBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  pillText: { fontSize: 13, fontWeight: "600" },
  recordCount: { fontSize: 12, marginBottom: 12 },
  emptyWrap: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15 },
  // 访客锁定提示样式 / Guest lock screen styles
  guestWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  guestIcon: { fontSize: 48, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  guestSub: { fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  guestBtn: { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  guestBtnText: { color: "white", fontWeight: "800", fontSize: 15 },
});

// ─── HistoryScreen (主历史记录页面) ───────────────────────────────────────────
export default function HistoryScreen() {
  const { isGuest } = useAuth();
  const { theme: T } = useTheme();
  const { activity, activeSession } = useParkingContext();
  const router = useRouter();

  // ── Hook 必须在所有条件判断之前调用 / Hooks must be called before any early returns ──
  const [selected, setSelected] = useState<ParkingRecord | null>(null);
  const [filter, setFilter]     = useState<RecordStatus | "All">("All");

  // 访客模式：整页锁住，提示需登录
  // Guest mode: full page lock with sign-in prompt
  if (isGuest) {
    return (
      <View style={[styles.screen, styles.guestWrap, { backgroundColor: "transparent" }]}>
        <Text style={styles.guestIcon}>🔒</Text>
        <Text style={[styles.guestTitle, { color: T.text }]}>Sign In Required</Text>
        <Text style={[styles.guestSub, { color: T.muted }]}>
          Your parking history is only available to registered students.{"\n\n"}
          Please sign in to view your records.
        </Text>
        <TouchableOpacity
          style={[styles.guestBtn, { backgroundColor: T.accent }]}
          onPress={function goToSignIn() { router.push("/login" as any); }}
          activeOpacity={0.85}
        >
          <Text style={styles.guestBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── 数据转换 / Data transformation ──────────────────────────────────────────
  /*
  [BUG 4 FIX] 将 context 的 ActivityItem[] 配对合并为 ParkingRecord[]。
  [BUG 4 FIX] Pair and merge context ActivityItem[] into ParkingRecord[].

  原来每条 activity 直接映射为一条记录，导致：
   - isIn 事件的 checkOut 永远是 undefined
   - isOut 事件的 checkIn 永远是 "—"
  修复：以 plate+spot 为 key 将签入/签出事件配对，合并为完整记录。

  Previously each item mapped 1-to-1, causing split check-in and check-out records.
  Fix: index isIn events by plate+spot, merge with matching isOut events.
  */

  // 已配对签出的签入事件 ID 集合 / set of isIn IDs already paired with a checkout
  const pairedInIds = new Set<string>();

  // 以 plate+spot 为 key 的签入事件查找表 / isIn events indexed by plate+spot
  const inEventMap: Record<string, typeof activity[0]> = {};
  for (let i = 0; i < activity.length; i++) {
    const item = activity[i];
    if (item.isIn) {
      const key = item.plate + "|" + item.spot;
      if (!inEventMap[key]) { inEventMap[key] = item; } // 保留最新 / keep latest
    }
  }

  const records: ParkingRecord[] = [];

  // 第一遍：处理签出事件，尝试配对签入 / first pass: process checkouts, pair with check-ins
  for (let i = 0; i < activity.length; i++) {
    const item = activity[i];
    if (item.isIn) { continue; }

    const key      = item.plate + "|" + item.spot;
    const inEvent  = inEventMap[key];
    const recDate  = item.time ? "Today" : "—";

    if (inEvent) {
      pairedInIds.add(inEvent.id);
      records.push({
        id: item.id, spot: item.spot, plate: item.plate, date: recDate,
        checkIn:  inEvent.time, // 真实签入时间 / real check-in time
        checkOut: item.time,    // 真实签出时间 / real check-out time
        duration: undefined,
        status:   "Completed",  // 有签出 → 一定完成 / has checkout → always Completed
      });
    } else {
      // 防御性：找不到对应签入 / defensive: no matching check-in found
      records.push({
        id: item.id, spot: item.spot, plate: item.plate, date: recDate,
        checkIn: "—", checkOut: item.time, duration: undefined, status: "Completed",
      });
    }
  }

  // 第二遍：处理未配对的签入事件（仍在停车中）
  // Second pass: handle unpaired check-in events (sessions still active)
  for (let i = 0; i < activity.length; i++) {
    const item = activity[i];
    if (!item.isIn || pairedInIds.has(item.id)) { continue; }

    let isActive = false;
    if (activeSession && activeSession.plate === item.plate && item.isIn) {
      isActive = true;
    }

    // 取签入时间戳（如果 Context 提供了 checkedInAt 字段）
    // Get check-in timestamp if the context provides a checkedInAt field
    let checkedInAt: string | undefined;
    if (activeSession && (activeSession as any).checkedInAt) {
      checkedInAt = (activeSession as any).checkedInAt as string;
    }

    records.push({
      id: item.id, spot: item.spot, plate: item.plate,
      date:     item.time ? "Today" : "—",
      checkIn:  item.time,
      checkOut: undefined,
      duration: undefined,
      // [BUG 3 FIX] 使用修复后的状态推导函数 / use fixed status derivation
      status:   deriveRecordStatus(isActive, item.isIn, checkedInAt),
    });
  }

  // ── 筛选 / Filtering ─────────────────────────────────────────────────────────
  let filtered: ParkingRecord[] = [];
  if (filter === "All") {
    filtered = records;
  } else {
    filtered = records.filter(r => r.status === filter);
  }

  // ── 摘要统计 / Summary stats ─────────────────────────────────────────────────
  const totalSessions = records.filter(r => r.status !== "Active").length;
  const overstays     = records.filter(r => r.status === "Overstay").length;
  let overstayColor   = T.green;
  if (overstays > 0) { overstayColor = T.red; }

  const summaryStats = [
    { val: totalSessions,  label: "Sessions",  color: T.accent      },
    { val: records.length, label: "Total",     color: T.green       },
    { val: overstays,      label: "Overstays", color: overstayColor },
  ];

  // 记录数量标签后缀（单数/复数）/ record count suffix
  let recordSuffix = "s";
  if (filtered.length === 1) { recordSuffix = ""; }

  // ── 筛选胶囊辅助函数 / Filter pill helpers ────────────────────────────────────

  function getFilterColor(f: RecordStatus | "All"): string {
    if (f === "Active")    { return T.green;  }
    if (f === "Overstay")  { return T.red;    }
    if (f === "Completed") { return T.accent; }
    return T.muted;
  }

  function getPillStyle(isActive: boolean, col: string) {
    if (isActive) { return { backgroundColor: col, borderColor: col }; }
    return { backgroundColor: "transparent", borderColor: T.border };
  }

  function getPillTextColor(isActive: boolean): string {
    if (isActive) { return "#fff"; }
    return T.muted;
  }

  // ── 记录列表渲染 / Record list renderer ──────────────────────────────────────
  function renderRecordList() {
    if (filtered.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🅿️</Text>
          <Text style={[styles.emptyText, { color: T.muted }]}>No records yet</Text>
        </View>
      );
    }
    return filtered.map(r => (
      <HistoryCard key={r.id} record={r} onPress={() => setSelected(r)} />
    ));
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* 顶部标题 / header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>My History</Text>
            <Text style={[styles.subtitle,  { color: T.muted }]}>Parking Activity</Text>
          </View>
          <Image source={require("../../assets/images/itkia.png")} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </View>

        {/* 年度通行证横幅 / annual pass banner */}
        <View style={[styles.passBanner, { backgroundColor: T.green + "15", borderColor: T.green + "44" }]}>
          <Text style={styles.passIcon}>🎫</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passTitle, { color: T.text }]}>Annual Parking Pass · Active</Text>
            <Text style={[styles.passSub,   { color: T.muted }]}>Valid until Dec 2026 · RM10 paid</Text>
          </View>
          <View style={[styles.passValidDot, { backgroundColor: T.green }]} />
        </View>

        {/* 摘要卡片 / summary card */}
        <View style={[styles.summaryCard, { backgroundColor: T.card, borderColor: T.border }]}>
          {summaryStats.map((s, i) => (
            <View key={s.label} style={styles.summaryRow}>
              {i > 0 && <View style={[styles.summaryDivider, { backgroundColor: T.border }]} />}
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum,   { color: s.color  }]}>{s.val}</Text>
                <Text style={[styles.summaryLabel, { color: T.muted  }]}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 水平滚动筛选标签 / horizontal scrollable filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {FILTERS.map(f => {
            const isActive = filter === f;
            const col = getFilterColor(f);
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.pill, getPillStyle(isActive, col)]}
              >
                <Text style={[styles.pillText, { color: getPillTextColor(isActive) }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 记录数量标签 / record count label */}
        <Text style={[styles.recordCount, { color: T.muted }]}>
          {filtered.length} record{recordSuffix}
        </Text>

        {/* 记录列表或空状态 / record list or empty state */}
        {renderRecordList()}

      </ScrollView>

      {/* 详情弹窗在 ScrollView 外，确保正确层叠覆盖
          Detail modal outside ScrollView so it renders above everything */}
      <DetailModal record={selected} onClose={() => setSelected(null)} />
    </View>
  );
}