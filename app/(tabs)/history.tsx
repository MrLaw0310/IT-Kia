// ═══════════════════════════════════════════════════════════════════════════════
// FILE: app/(tabs)/history.tsx  (Parking History Screen)
//
// PURPOSE (用途):
//   Displays a chronological list of all parking sessions (check-in/out events).
//   显示所有停车会话（签入/签出事件）的时间顺序列表。
//
// SECTIONS (页面区块):
//   1. Annual pass banner — shows pass validity (年度通行证横幅)
//   2. Summary card — total sessions / overstays count (摘要卡片 — 总会话/超时次数)
//   3. Filter pills — All / Active / Completed / Overstay (筛选标签)
//   4. Record cards — tappable, opens DetailModal (记录卡片 — 可点击，打开详情弹窗)
//   5. Empty state if no records (无记录时的空状态提示)
//
// DATA (数据):
//   - `activity` from useParkingContext() is converted to ParkingRecord[] format
//     (useParkingContext() 的 activity 被转换为 ParkingRecord[] 格式)
//   - `activeSession` determines which records are currently "Active"
//     (activeSession 决定哪些记录当前状态为 "Active")
//
// IMPORTS (引入):
//   - useState                 → React hook
//   - Image, Modal, ScrollView,
//     StyleSheet, Text,
//     TouchableOpacity, View   → React Native components
//   - useParkingContext         → activity + activeSession (活动记录和活动会话)
//   - useTheme                  → current theme colors (当前主题颜色)
//
// EXPORTS (导出):
//   - default HistoryScreen    → (默认导出)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import {
  Image, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

/** Possible status values for a parking record (停车记录可能的状态值) */
type RecordStatus = "Active" | "Completed" | "Overstay";

/** Shape of a single parking record displayed in this screen
 *  此页面显示的单条停车记录结构 */
interface ParkingRecord {
  id:        string;          // Unique ID (唯一标识符)
  spot:      string;          // Spot ID e.g. "R1-3" (车位编号)
  plate:     string;          // License plate (车牌号)
  date:      string;          // Date string (日期字符串)
  checkIn:   string;          // Check-in time (签入时间)
  checkOut?: string;          // Check-out time if completed (签出时间，可选)
  duration?: string;          // Duration if known (停留时长，可选)
  status:    RecordStatus;    // Active / Completed / Overstay (状态)
}

// ─── DetailModal (底部详情弹窗) ───────────────────────────────────────────────
/**
 * DetailModal — slides up from the bottom when a history card is tapped.
 * 详情弹窗 — 点击历史记录卡片时从底部滑出。
 *
 * Shows full record details + fee note.
 * 显示完整记录详情和费用说明。
 */
function DetailModal({ record, onClose }: { record: ParkingRecord | null; onClose: () => void }) {
  const { theme: T } = useTheme();
  if (!record) return null; // Don't render if no record selected (无选中记录时不渲染)

  // Status-based color (根据状态的颜色)
  const color = record.status === "Active" ? T.green
    : record.status === "Completed" ? T.accent : T.red;

  return (
    <Modal transparent animationType="slide" visible={!!record} onRequestClose={onClose}>
      {/* Semi-transparent overlay — tap outside to close (半透明遮罩 — 点外部关闭) */}
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        {/* The sheet itself — not dismissable by tap (弹窗本体 — 点击不关闭) */}
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          {/* Drag handle indicator (拖动把手指示器) */}
          <View style={[styles.handle, { backgroundColor: T.border }]} />
          <Text style={[styles.sheetTitle, { color: T.text }]}>Parking Record</Text>
          <Text style={[styles.sheetSub,   { color: T.muted }]}>{record.date}</Text>

          {/* Spot badge + status pill (车位徽章 + 状态标签) */}
          <View style={[styles.spotBadge, { borderColor: color + "66", backgroundColor: color + "15" }]}>
            <Text style={[styles.spotBadgeText, { color }]}>🅿️  Spot {record.spot}</Text>
            <View style={[styles.statusPill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[styles.statusPillText, { color }]}>{record.status}</Text>
            </View>
          </View>

          {/* Details table (详情表格) */}
          <View style={[styles.detailBox, { backgroundColor: T.bg }]}>
            {[
              ["Plate No.", record.plate],
              ["Check In",  record.checkIn],
              ["Check Out", record.checkOut ?? "—"],
              ["Duration",  record.duration ?? "Ongoing"],
            ].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: T.text }]}>{v}</Text>
              </View>
            ))}
          </View>

          {/* Fee note: MDIS uses annual pass, no per-session charge
              费用说明：MDIS 使用年度通行证，无单次收费 */}
          <View style={[styles.feeNote, { backgroundColor: T.accent + "10", borderColor: T.accent + "30" }]}>
            <Text style={[styles.feeNoteText, { color: T.muted }]}>
              💳  MDIS uses an annual parking pass (RM10/vehicle). No per-session charges.
            </Text>
          </View>

          {/* Close button (关闭按钮) */}
          <TouchableOpacity style={[styles.closeSheetBtn, { backgroundColor: T.border }]} onPress={onClose}>
            <Text style={[styles.closeSheetText, { color: T.text }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── HistoryCard (历史记录卡片) ───────────────────────────────────────────────
/**
 * HistoryCard — single row card for one parking record.
 * 单行停车记录卡片。
 *
 * Color-coded by status: green=Active, accent=Completed, red=Overstay.
 * 按状态颜色编码：绿=活动, accent=完成, 红=超时。
 */
function HistoryCard({ record, onPress }: { record: ParkingRecord; onPress: () => void }) {
  const { theme: T } = useTheme();
  const color = record.status === "Active" ? T.green : record.status === "Completed" ? T.accent : T.red;
  const icon  = record.status === "Active" ? "🟢"   : record.status === "Completed" ? "✅"   : "⚠️";

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      {/* Left color accent strip (左侧颜色条纹) */}
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          {/* Spot number (车位编号) */}
          <View style={styles.cardSpotWrap}>
            <Text style={[styles.cardSpotLabel, { color: T.muted }]}>SPOT</Text>
            <Text style={[styles.cardSpot, { color }]}>{record.spot}</Text>
          </View>
          {/* Date and time range (日期和时间范围) */}
          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text style={[styles.cardDate, { color: T.text }]}>{record.date}</Text>
            <Text style={[styles.cardTime, { color: T.muted }]}>
              {record.checkIn}{record.checkOut ? `  →  ${record.checkOut}` : "  →  Now"}
            </Text>
          </View>
          {/* Status badge (状态徽章) */}
          <View style={[styles.cardBadge, { backgroundColor: color + "20", borderColor: color + "50" }]}>
            <Text style={{ fontSize: 12 }}>{icon}</Text>
            <Text style={[styles.cardBadgeText, { color }]}>{record.status}</Text>
          </View>
        </View>
        {/* Duration (停留时长) */}
        <View style={styles.cardBottom}>
          <Text style={[styles.cardDuration, { color: T.muted }]}>🕐 {record.duration ?? "Ongoing"}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── HistoryScreen (主历史记录页面) ──────────────────────────────────────────

export default function HistoryScreen() {
  const { theme: T } = useTheme();
  const { activity, activeSession } = useParkingContext();

  const [selected, setSelected] = useState<ParkingRecord | null>(null);          // Currently selected record for modal (当前选中的记录，用于弹窗)
  const [filter,   setFilter]   = useState<RecordStatus | "All">("All");          // Active filter (当前激活的筛选器)
  const filters: (RecordStatus | "All")[] = ["All", "Active", "Completed", "Overstay"];

  // ── Convert ActivityItem[] → ParkingRecord[] (转换活动记录为停车记录格式) ──
  const records: ParkingRecord[] = activity.map(item => {
    // A record is "Active" if it's a check-in AND it matches the current active session
    // (如果是签入记录且匹配当前活动会话，则状态为"Active")
    const isActive = activeSession?.plate === item.plate && item.isIn;
    return {
      id:       item.id,
      spot:     item.spot,
      plate:    item.plate,
      date:     item.time ? "Today" : "—",
      checkIn:  item.isIn  ? item.time : "—",
      checkOut: item.isIn  ? undefined : item.time,
      duration: undefined, // Duration calculation not implemented yet (时长计算暂未实现)
      status:   isActive ? "Active" : item.isIn ? "Active" : "Completed",
    };
  });

  // Apply filter (应用筛选器)
  const filtered = filter === "All" ? records : records.filter(r => r.status === filter);

  // Summary stats (摘要统计)
  const totalSessions = records.filter(r => r.status !== "Active").length;
  const overstays     = records.filter(r => r.status === "Overstay").length;

  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header (顶部标题) ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>My History</Text>
            <Text style={[styles.subtitle,  { color: T.muted }]}>Parking Activity</Text>
          </View>
          <Image source={require("../../assets/images/itkia.png")} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </View>

        {/* ── Annual pass banner (年度通行证横幅) ── */}
        <View style={[styles.passBanner, { backgroundColor: T.green + "15", borderColor: T.green + "44" }]}>
          <Text style={styles.passIcon}>🎫</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passTitle, { color: T.text }]}>Annual Parking Pass · Active</Text>
            <Text style={[styles.passSub,   { color: T.muted }]}>Valid until Dec 2025 · RM10 paid</Text>
          </View>
          {/* Green dot: active indicator (绿点：活跃指示) */}
          <View style={[styles.passValidDot, { backgroundColor: T.green }]} />
        </View>

        {/* ── Summary card: 3 stats (摘要卡片：3个统计数字) ── */}
        <View style={[styles.summaryCard, { backgroundColor: T.card, borderColor: T.border }]}>
          {[
            { val: totalSessions, label: "Sessions",  color: T.accent },
            { val: records.length,label: "Total",     color: T.green  },
            { val: overstays,     label: "Overstays", color: overstays > 0 ? T.red : T.green },
          ].map((s, i) => (
            <View key={s.label} style={styles.summaryRow}>
              {i > 0 && <View style={[styles.summaryDivider, { backgroundColor: T.border }]} />}
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum,   { color: s.color }]}>{s.val}</Text>
                <Text style={[styles.summaryLabel, { color: T.muted }]}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Filter pills (水平滚动筛选标签) ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {filters.map(f => {
            const active = filter === f;
            /* Each filter has its own accent color (每个筛选器有独立的强调色) */
            const col = f === "Active" ? T.green : f === "Overstay" ? T.red : f === "Completed" ? T.accent : T.muted;
            return (
              /* Active style: filled accent color / Inactive style: transparent (激活：填充主题色 / 非激活：透明) */
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  styles.pill,
                  active
                    ? { backgroundColor: col, borderColor: col }
                    : { backgroundColor: "transparent", borderColor: T.border },
                ]}
              >
                <Text style={[styles.pillText, { color: active ? "#fff" : T.muted }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Record count label (记录数量标签) */}
        <Text style={[styles.recordCount, { color: T.muted }]}>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </Text>

        {/* ── Record list or empty state (记录列表或空状态) ── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🅿️</Text>
            <Text style={[styles.emptyText, { color: T.muted }]}>No records yet</Text>
          </View>
        ) : (
          filtered.map(r => (
            <HistoryCard key={r.id} record={r} onPress={() => setSelected(r)} />
          ))
        )}
      </ScrollView>

      {/* Detail modal — outside ScrollView so it overlays correctly
          详情弹窗 — 在 ScrollView 外，确保正确层叠覆盖 */}
      <DetailModal record={selected} onClose={() => setSelected(null)} />
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

  // Annual pass banner (年度通行证横幅)
  passBanner:   { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  passIcon:     { fontSize: 22 },
  passTitle:    { fontWeight: "700", fontSize: 14 },
  passSub:      { fontSize: 12, marginTop: 2 },
  passValidDot: { width: 10, height: 10, borderRadius: 5 },

  // Summary card (摘要卡片)
  summaryCard:    { borderWidth: 1, borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 16 },
  summaryRow:     { flexDirection: "row", alignItems: "center" },
  summaryItem:    { alignItems: "center" },
  summaryNum:     { fontSize: 22, fontWeight: "900" },
  summaryLabel:   { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, marginHorizontal: 16 },

  // Filter pills (筛选标签)
  filterRow:   { marginBottom: 12 },
  pill:        { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  pillText:    { fontSize: 13, fontWeight: "600" },
  recordCount: { fontSize: 12, marginBottom: 12 },

  // Record cards (记录卡片)
  card:       { borderWidth: 1, borderRadius: 16, marginBottom: 10, flexDirection: "row", overflow: "hidden" },
  cardAccent: { width: 4 },
  cardBody:   { flex: 1, padding: 14 },
  cardTop:    { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardSpotWrap:  { alignItems: "center", minWidth: 36 },
  cardSpotLabel: { fontSize: 9, letterSpacing: 1 },
  cardSpot:      { fontSize: 20, fontWeight: "900" },
  cardDate:      { fontWeight: "700", fontSize: 14 },
  cardTime:      { fontSize: 12, marginTop: 2 },
  cardBadge:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  cardBadgeText: { fontSize: 11, fontWeight: "700" },
  cardBottom:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardDuration:  { fontSize: 12 },

  // Empty state (空状态)
  emptyWrap: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15 },

  // Modal (弹窗)
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle:  { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  sheetTitle:     { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  sheetSub:       { fontSize: 13, marginBottom: 20 },
  spotBadge:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  spotBadgeText:  { fontSize: 18, fontWeight: "900" },
  statusPill:     { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  detailBox:      { borderRadius: 14, padding: 14, marginBottom: 14, gap: 12 },
  detailRow:      { flexDirection: "row", justifyContent: "space-between" },
  detailKey:      { fontSize: 13 },
  detailVal:      { fontWeight: "700", fontSize: 13 },
  feeNote:        { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  feeNoteText:    { fontSize: 12, lineHeight: 18 },
  closeSheetBtn:  { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  closeSheetText: { fontWeight: "700", fontSize: 14 },
});