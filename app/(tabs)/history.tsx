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
*/

import { useState } from "react";
import {
  Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

/* 停车记录可能的状态值 / possible status values for a parking record */
type RecordStatus = "Active" | "Completed" | "Overstay";

/* 此页面显示的单条停车记录结构 / shape of a single parking record shown on this screen */
interface ParkingRecord {
  id:string; // 唯一标识符 / unique ID
  spot: string; // 车位编号，如 "R1-3" / spot ID e.g. "R1-3"
  plate: string; // 车牌号 / license plate
  date: string; // 日期字符串 / date string
  checkIn: string; // 签入时间 / check-in time
  checkOut?: string; // 签出时间（可选）/ check-out time if completed
  duration?: string; // 停留时长（可选）/ duration if known
  status: RecordStatus; // Active / Completed / Overstay
}

// ─── Helper: status colour (状态颜色辅助函数) ──────────────────────────────
/*
根据记录状态返回对应颜色。
Returns the display colour for a given record status.
*/
function getStatusColor(status: RecordStatus, T: any): string {
  if (status === "Active") {
    return T.green;
  }
  if (status === "Completed") {
    return T.accent;
  }
  return T.red; // Overstay
}

/*
根据记录状态返回对应 emoji 图标。
Returns the emoji icon for a given record status.
*/
function getStatusIcon(status: RecordStatus): string {
  if (status === "Active") {
    return "🟢";
  }
  if (status === "Completed") {
    return "✅";
  }
  return "⚠️"; // Overstay
}

// ─── DetailModal (底部详情弹窗) ───────────────────────────────────────────────
/*
点击历史记录卡片时从底部滑出，显示完整记录详情和费用说明。
Slides up from the bottom when a history card is tapped.
Shows full record details and a fee note.
*/
function DetailModal({ record, onClose }: { record: ParkingRecord | null; onClose: () => void }) {
  const { theme: T } = useTheme();
  // 无选中记录时不渲染 / don't render if no record selected
  if (!record) {
    return null;
  }

  const color = getStatusColor(record.status, T); // 状态颜色 / status colour

  return (
    <Modal transparent animationType="slide" visible={!!record} onRequestClose={onClose}>
      {/* 半透明遮罩，点外部关闭 / semi-transparent overlay, tap outside to close */}
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        {/* 弹窗本体，点击不关闭 / the sheet itself, not dismissable by tap */}
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
          <Text style={[styles.sheetTitle, { color: T.text }]}>Parking Record</Text>
          <Text style={[styles.sheetSub, { color: T.muted }]}>{record.date}</Text>

          {/* 车位徽章 + 状态标签 / spot badge + status pill */}
          <View style={[styles.spotBadge, { borderColor: color + "66", backgroundColor: color + "15" }]}>
            <Text style={[styles.spotBadgeText, { color }]}>🅿️  Spot {record.spot}</Text>
            <View style={[styles.statusPill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[styles.statusPillText, { color }]}>{record.status}</Text>
            </View>
          </View>

          {/* 详情表格 / details table */}
          <View style={[styles.detailBox, { backgroundColor: T.bg }]}>
            {[
              ["Plate No.", record.plate],
              ["Check In", record.checkIn],
              ["Check Out", record.checkOut ?? "—"],
              ["Duration", record.duration ?? "Ongoing"],
            ].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: T.text  }]}>{v}</Text>
              </View>
            ))}
          </View>

          {/* 费用说明：MDIS 使用年度通行证，无单次收费
              Fee note: MDIS uses annual pass, no per-session charges */}
          <View style={[styles.feeNote, { backgroundColor: T.accent + "10", borderColor: T.accent + "30" }]}>
            <Text style={[styles.feeNoteText, { color: T.muted }]}>
              💳  MDIS uses an annual parking pass (RM10/vehicle). No per-session charges.
            </Text>
          </View>

          {/* 关闭按钮 / close button */}
          <TouchableOpacity style={[styles.closeSheetBtn, { backgroundColor: T.border }]} onPress={onClose}>
            <Text style={[styles.closeSheetText, { color: T.text }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── HistoryCard (历史记录卡片) ───────────────────────────────────────────────
/*
单行停车记录卡片。按状态颜色编码：绿=活动, accent=完成, 红=超时。
Single row card for one parking record.
Colour-coded by status: green=Active, accent=Completed, red=Overstay.
*/
function HistoryCard({ record, onPress }: { record: ParkingRecord; onPress: () => void }) {
  const { theme: T } = useTheme();
  const color = getStatusColor(record.status, T);
  const icon  = getStatusIcon(record.status);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}
    >
      {/* 左侧颜色条纹 / left colour accent strip */}
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          {/* 车位编号 / spot number */}
          <View style={styles.cardSpotWrap}>
            <Text style={[styles.cardSpotLabel, { color: T.muted }]}>SPOT</Text>
            <Text style={[styles.cardSpot, { color }]}>{record.spot}</Text>
          </View>
          {/* 日期和时间范围 / date and time range */}
          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text style={[styles.cardDate, { color: T.text }]}>{record.date}</Text>
            <Text style={[styles.cardTime, { color: T.muted }]}>
              {record.checkIn}{record.checkOut ? ` ${record.checkOut}` : " "}
            </Text>
          </View>
          {/* 状态徽章 / status badge */}
          <View style={[styles.cardBadge, { backgroundColor: color + "20", borderColor: color + "50" }]}>
            <Text style={{ fontSize: 12 }}>{icon}</Text>
            <Text style={[styles.cardBadgeText, { color }]}>{record.status}</Text>
          </View>
        </View>
        {/* 停留时长 / duration */}
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

  // 选中的记录，触发详情弹窗 / selected record, triggers DetailModal
  const [selected, setSelected] = useState<ParkingRecord | null>(null);
  // 当前激活的筛选标签 / current active filter pill
  const [filter, setFilter] = useState<RecordStatus | "All">("All");

  const filters: (RecordStatus | "All")[] = ["All", "Active", "Completed", "Overstay"];

  // 将 context 的 ActivityItem[] 转换为此页面使用的 ParkingRecord[] 格式
  // Convert context ActivityItem[] into the ParkingRecord[] format used by this screen
  const records: ParkingRecord[] = activity.map(item => {
    const isActive = activeSession?.plate === item.plate && item.isIn; // 匹配当前活动会话 / matches current active session

    // 判断状态：活动会话或签入中 → Active，否则 → Completed
    // Determine status: active session or checked-in → Active, otherwise → Completed
    let recordStatus: RecordStatus = "Completed";
    if (isActive || item.isIn) {
      recordStatus = "Active";
    }

    return {
      id: item.id,
      spot: item.spot,
      plate: item.plate,
      date: item.time ? "Today" : "—",
      checkIn: item.isIn  ? item.time : "—",
      checkOut: item.isIn  ? undefined : item.time,
      duration: undefined, // 时长计算暂未实现 / duration calculation not yet implemented
      status: recordStatus,
    };
  });

  // 对记录应用筛选器 / apply filter to records
  const filtered = filter === "All" ? records : records.filter(r => r.status === filter);

  // 摘要卡片的统计数字 / summary stats for the summary card
  const totalSessions = records.filter(r => r.status !== "Active").length;
  const overstays = records.filter(r => r.status === "Overstay").length;

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
            <Text style={[styles.passSub, { color: T.muted }]}>Valid until Dec 2026 · RM10 paid</Text>
          </View>
          {/* 绿点：活跃指示 / green dot: active indicator */}
          <View style={[styles.passValidDot, { backgroundColor: T.green }]} />
        </View>

        {/* 摘要卡片：3个统计数字 / summary card: 3 stats */}
        <View style={[styles.summaryCard, { backgroundColor: T.card, borderColor: T.border }]}>
          {[
            { val: totalSessions, label: "Sessions", color: T.accent },
            { val: records.length,label: "Total", color: T.green  },
            { val: overstays, label: "Overstays", color: overstays > 0 ? T.red : T.green },
          ].map((s, i) => (
            <View key={s.label} style={styles.summaryRow}>
              {i > 0 && <View style={[styles.summaryDivider, { backgroundColor: T.border }]} />}
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: s.color }]}>{s.val}</Text>
                <Text style={[styles.summaryLabel, { color: T.muted }]}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 水平滚动筛选标签 / horizontal scrollable filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {filters.map(f => {
            const active = filter === f;
            // 每个筛选器有独立的强调色 / each filter has its own accent colour
            let col = T.muted;
            if (f === "Active") col = T.green;
            else if (f === "Overstay") col = T.red;
            else if (f === "Completed") col = T.accent;

            return (
              // 激活：填充主题色 / 非激活：透明 — Active: filled / Inactive: transparent
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

        {/* 记录数量标签 / record count label */}
        <Text style={[styles.recordCount, { color: T.muted }]}>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </Text>

        {/* 记录列表或空状态 / record list or empty state */}
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

      {/* 详情弹窗在 ScrollView 外，确保正确层叠覆盖
          Detail modal outside ScrollView so it renders above everything */}
      <DetailModal record={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

// ─── Styles (样式) ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13 },

  // 年度通行证横幅 / annual pass banner
  passBanner: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  passIcon: { fontSize: 22 },
  passTitle: { fontWeight: "700", fontSize: 14 },
  passSub: { fontSize: 12, marginTop: 2 },
  passValidDot: { width: 10, height: 10, borderRadius: 5 },

  // 摘要卡片 / summary card
  summaryCard: { borderWidth: 1, borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 16 },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryItem: { alignItems: "center" },
  summaryNum: { fontSize: 22, fontWeight: "900" },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, marginHorizontal: 16 },

  // 筛选标签 / filter pills
  filterRow: { marginBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  pillText: { fontSize: 13, fontWeight: "600" },
  recordCount: { fontSize: 12, marginBottom: 12 },

  // 记录卡片 / record cards
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

  // 空状态 / empty state
  emptyWrap: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15 },

  // 详情弹窗 / detail modal
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