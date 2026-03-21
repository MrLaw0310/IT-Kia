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

超时判定 / Overstay threshold:
 签入超过 OVERSTAY_HOURS 小时且仍未签出，状态标记为 Overstay。
 A session still active beyond OVERSTAY_HOURS is flagged as Overstay.
*/

import { useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useParkingContext } from "../../utils/ParkingContext";
import type { Theme } from "../../utils/ThemeContext";
import { useTheme } from "../../utils/ThemeContext";

// ─── 常量 / Constants ─────────────────────────────────────────────────────────

// 超过此小时数且仍签入中，标记为 Overstay（超时）
// Sessions still active beyond this many hours are marked Overstay
const OVERSTAY_HOURS = 4;

// 筛选器选项列表（顺序决定显示顺序）
// Filter pill options — order determines display order
const FILTER_OPTIONS: (RecordStatus | "All")[] = ["All", "Active", "Completed", "Overstay"];

// ─── 类型定义 / Type definitions ──────────────────────────────────────────────

// 停车记录可能的状态值
// Possible status values for a parking record
type RecordStatus = "Active" | "Completed" | "Overstay";

// 此页面显示的单条停车记录结构
// Shape of a single parking record shown on this screen
interface ParkingRecord {
  id:        string;        // 唯一标识符 / unique ID
  spot:      string;        // 车位编号，如 "R1-3" / spot ID e.g. "R1-3"
  plate:     string;        // 车牌号 / license plate
  date:      string;        // 日期字符串 / date string
  checkIn:   string;        // 签入时间 / check-in time string
  checkOut?: string;        // 签出时间（可选，未签出时为 undefined）/ check-out time, if completed
  duration?: string;        // 停留时长（可选）/ duration string, if known
  status:    RecordStatus;  // 状态 / record status
}

// ─── 辅助函数 / Helper functions ──────────────────────────────────────────────

/*
根据记录状态返回对应的主题颜色。
Returns the theme colour corresponding to the given record status.

Active   → 绿色 / green
Completed → 主题强调色 / accent
Overstay → 红色 / red
*/
function getStatusColor(status: RecordStatus, T: Theme): string {
  if (status === "Active") {
    return T.green;
  }
  if (status === "Completed") {
    return T.accent;
  }
  // Overstay
  return T.red;
}

/*
根据记录状态返回对应的 emoji 图标。
Returns the emoji icon corresponding to the given record status.
*/
function getStatusIcon(status: RecordStatus): string {
  if (status === "Active") {
    return "🟢";
  }
  if (status === "Completed") {
    return "✅";
  }
  // Overstay
  return "⚠️";
}

/*
根据签入时间戳判断会话是否超时。
Returns true if the session has exceeded the overstay threshold.

@param checkedInAt ISO 时间戳字符串 / ISO timestamp string of check-in time
*/
function isOverstay(checkedInAt: string): boolean {
  const checkedInTime = new Date(checkedInAt).getTime();
  const nowTime       = Date.now();
  const hoursParked   = (nowTime - checkedInTime) / (1000 * 60 * 60);
  return hoursParked > OVERSTAY_HOURS;
}

/*
根据活动状态和签入信息，计算出该记录的显示状态。
Derives the display status for a record based on whether it is active and whether it is overstay.

@param isActive     是否是当前活动会话 / whether this is the current active session
@param isInEvent    activity item 的 isIn 标志 / the isIn flag from the activity item
@param checkedInAt  签入时间戳，可能不存在 / check-in timestamp, may be undefined
*/
function deriveRecordStatus(
  isActive:    boolean,
  isInEvent:   boolean,
  checkedInAt: string | undefined
): RecordStatus {
  // 既不是当前活动会话也不是签入事件，直接标记已完成
  // Neither the active session nor a check-in event — mark as Completed
  if (!isActive && !isInEvent) {
    return "Completed";
  }

  // 是活动会话：检查是否超时
  // Active session: check if overstay threshold is exceeded
  if (checkedInAt) {
    if (isOverstay(checkedInAt)) {
      return "Overstay";
    }
  }

  return "Active";
}

// ─── Styles for DetailModal ───────────────────────────────────────────────────
const detailModalStyles = StyleSheet.create({

  // 半透明遮罩层
  // Semi-transparent overlay behind the bottom sheet
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },

  // 底部弹出面板
  // Bottom sheet panel
  sheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              24,
    borderTopWidth:       1,
  },

  // 顶部拖动把手（视觉指示器）
  // Drag handle at the top of the sheet — visual indicator
  handle: {
    width:        40,
    height:       4,
    borderRadius: 999,
    alignSelf:    "center",
    marginBottom: 20,
  },

  // 弹窗标题
  // Sheet title
  sheetTitle: {
    fontSize:     20,
    fontWeight:   "800",
    marginBottom: 2,
  },

  // 弹窗副标题（日期）
  // Sheet subtitle — shows the date
  sheetSub: {
    fontSize:     13,
    marginBottom: 20,
  },

  // 车位编号 + 状态标签的横排容器
  // Row containing the spot badge and status pill
  spotBadge: {
    flexDirection:   "row",
    justifyContent:  "space-between",
    alignItems:      "center",
    borderWidth:     1,
    borderRadius:    14,
    padding:         14,
    marginBottom:    16,
  },

  // 车位编号文字
  // Spot ID text inside the badge
  spotBadgeText: {
    fontSize:   18,
    fontWeight: "900",
  },

  // 状态胶囊标签
  // Status pill
  statusPill: {
    borderWidth:      1,
    borderRadius:     999,
    paddingHorizontal: 10,
    paddingVertical:  4,
  },

  // 状态文字
  // Status text inside the pill
  statusPillText: {
    fontSize:      11,
    fontWeight:    "800",
    letterSpacing: 0.5,
  },

  // 详情行列表容器
  // Container for the detail rows table
  detailBox: {
    borderRadius: 14,
    padding:      14,
    marginBottom: 14,
    gap:          12,
  },

  // 单行详情（key + value 横排）
  // Single detail row — key and value side by side
  detailRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
  },

  // 详情行 key 文字
  // Key text in a detail row
  detailKey: {
    fontSize: 13,
  },

  // 详情行 value 文字
  // Value text in a detail row
  detailVal: {
    fontWeight: "700",
    fontSize:   13,
  },

  // 费用说明横幅
  // Fee note banner at the bottom of the sheet
  feeNote: {
    borderWidth:  1,
    borderRadius: 12,
    padding:      12,
    marginBottom: 16,
  },

  // 费用说明文字
  // Fee note text
  feeNoteText: {
    fontSize:   12,
    lineHeight: 18,
  },

  // 关闭按钮
  // Close button
  closeSheetBtn: {
    borderRadius:   14,
    paddingVertical: 14,
    alignItems:     "center",
  },

  // 关闭按钮文字
  // Close button text
  closeSheetText: {
    fontWeight: "700",
    fontSize:   14,
  },
});

// ─── DetailModal ──────────────────────────────────────────────────────────────
/*
点击历史记录卡片时从底部滑出，显示完整记录详情和费用说明。
Slides up from the bottom when a history card is tapped.
Shows full record details and a fee note.
*/
function DetailModal({ record, onClose }: {
  record:  ParkingRecord | null;
  onClose: () => void;
}) {
  const { theme: T } = useTheme();

  // 无选中记录时不渲染任何内容
  // Don't render anything if no record is selected
  if (!record) {
    return null;
  }

  // 根据状态取对应颜色
  // Derive colour from status
  const color = getStatusColor(record.status, T);

  // 费用说明字符串（提取为具名常量）
  // Fee note string — extracted as a named constant
  const feeNoteText = "💳  MDIS uses an annual parking pass (RM10/vehicle). No per-session charges.";

  // 详情列表数据（提取为具名数组，避免内联）
  // Detail rows — extracted as a named array to avoid inlining in JSX
  const detailRows: [string, string][] = [
    ["Plate No.", record.plate],
    ["Check In",  record.checkIn],
    // 签出时间：未签出时显示破折号 / Check-out time — dash when not yet checked out
    ["Check Out", (function checkOutDisplay() {
      if (record.checkOut) { return record.checkOut; }
      return "—";
    })()],
    // 停留时长：未完成时显示进行中 / Duration — shows ongoing when session is still active
    ["Duration",  (function durationDisplay() {
      if (record.duration) { return record.duration; }
      return "Ongoing";
    })()],
  ];

  // 弹窗遮罩颜色（半透明遮罩层）
  // Overlay tint colours
  const badgeBgColor     = color + "15";
  const badgeBorderColor = color + "66";
  const pillBgColor      = color + "22";
  const pillBorderColor  = color + "55";
  const feeNoteBg        = T.accent + "10";
  const feeNoteBorder    = T.accent + "30";

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      animationType="slide"
      visible={!!record}
      onRequestClose={onClose}
    >
      {/* 半透明遮罩，点击外部关闭弹窗 / Semi-transparent overlay — tap outside to close */}
      <TouchableOpacity
        style={detailModalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* 弹窗面板本体，点击内部不关闭 / Sheet itself — tapping inside does not dismiss */}
        <TouchableOpacity
          activeOpacity={1}
          style={[
            detailModalStyles.sheet,
            { backgroundColor: T.card, borderColor: T.border },
          ]}
        >
          {/* 顶部拖动把手 / Drag handle */}
          <View style={[detailModalStyles.handle, { backgroundColor: T.border }]} />

          {/* 弹窗标题和日期副标题 / Sheet title and date subtitle */}
          <Text style={[detailModalStyles.sheetTitle, { color: T.text }]}>
            Parking Record
          </Text>
          <Text style={[detailModalStyles.sheetSub, { color: T.muted }]}>
            {record.date}
          </Text>

          {/* 车位徽章 + 状态标签横排 / Spot badge + status pill row */}
          <View
            style={[
              detailModalStyles.spotBadge,
              { borderColor: badgeBorderColor, backgroundColor: badgeBgColor },
            ]}
          >
            <Text style={[detailModalStyles.spotBadgeText, { color }]}>
              🅿️  Spot {record.spot}
            </Text>
            <View
              style={[
                detailModalStyles.statusPill,
                { backgroundColor: pillBgColor, borderColor: pillBorderColor },
              ]}
            >
              <Text style={[detailModalStyles.statusPillText, { color }]}>
                {record.status}
              </Text>
            </View>
          </View>

          {/* 详情列表 / Detail rows table */}
          <View style={[detailModalStyles.detailBox, { backgroundColor: T.bg }]}>
            {detailRows.map(function renderDetailRow([key, value]) {
              return (
                <View key={key} style={detailModalStyles.detailRow}>
                  <Text style={[detailModalStyles.detailKey, { color: T.muted }]}>
                    {key}
                  </Text>
                  <Text style={[detailModalStyles.detailVal, { color: T.text }]}>
                    {value}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* 费用说明横幅 / Fee note banner */}
          <View
            style={[
              detailModalStyles.feeNote,
              { backgroundColor: feeNoteBg, borderColor: feeNoteBorder },
            ]}
          >
            <Text style={[detailModalStyles.feeNoteText, { color: T.muted }]}>
              {feeNoteText}
            </Text>
          </View>

          {/* 关闭按钮 / Close button */}
          <TouchableOpacity
            style={[detailModalStyles.closeSheetBtn, { backgroundColor: T.border }]}
            onPress={onClose}
          >
            <Text style={[detailModalStyles.closeSheetText, { color: T.text }]}>
              Close
            </Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles for HistoryCard ───────────────────────────────────────────────────
const historyCardStyles = StyleSheet.create({

  // 卡片外层容器（带左侧颜色条）
  // Card outer container — includes the left colour accent strip
  card: {
    borderWidth:   1,
    borderRadius:  16,
    marginBottom:  10,
    flexDirection: "row",
    overflow:      "hidden",
  },

  // 左侧细颜色条纹（状态颜色编码）
  // Left thin colour strip — colour encodes the status
  cardAccent: {
    width: 4,
  },

  // 卡片主内容区域
  // Main content area of the card
  cardBody: {
    flex:    1,
    padding: 14,
  },

  // 卡片上半部分（车位、日期时间、状态徽章）
  // Top section of the card body — spot, date/time, status badge
  cardTop: {
    flexDirection: "row",
    alignItems:    "center",
    marginBottom:  10,
  },

  // 车位编号的竖向容器
  // Vertical container for the spot number display
  cardSpotWrap: {
    alignItems: "center",
    minWidth:   36,
  },

  // "SPOT" 小标签文字
  // "SPOT" small label above the spot number
  cardSpotLabel: {
    fontSize:      9,
    letterSpacing: 1,
  },

  // 车位编号大字
  // Large spot number text
  cardSpot: {
    fontSize:   20,
    fontWeight: "900",
  },

  // 日期文字（加粗）
  // Date text — bold
  cardDate: {
    fontWeight: "700",
    fontSize:   14,
  },

  // 时间范围文字（较小）
  // Time range text — smaller
  cardTime: {
    fontSize:  12,
    marginTop: 2,
  },

  // 状态徽章（右侧 emoji + 文字组合）
  // Status badge — emoji and text on the right
  cardBadge: {
    borderWidth:       1,
    borderRadius:      10,
    paddingHorizontal: 8,
    paddingVertical:   4,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
  },

  // 状态徽章文字
  // Status badge text
  cardBadgeText: {
    fontSize:   11,
    fontWeight: "700",
  },

  // 卡片底部（时长信息）
  // Bottom section — duration info
  cardBottom: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },

  // 时长文字
  // Duration text
  cardDuration: {
    fontSize: 12,
  },
});

// ─── HistoryCard ──────────────────────────────────────────────────────────────
/*
单行停车记录卡片，按状态颜色编码：绿=活动，accent=已完成，红=超时。
Single row card for one parking record.
Colour-coded by status: green = Active, accent = Completed, red = Overstay.
*/
function HistoryCard({ record, onPress }: {
  record:  ParkingRecord;
  onPress: () => void;
}) {
  const { theme: T } = useTheme();

  // 根据状态取颜色和图标
  // Derive colour and icon from status
  const color = getStatusColor(record.status, T);
  const icon  = getStatusIcon(record.status);

  // 状态徽章的背景色和边框色
  // Status badge background and border colours
  const badgeBgColor     = color + "20";
  const badgeBorderColor = color + "50";

  // 时间范围文字（签入时间 + 可选签出时间）
  // Time range text — check-in time plus optional check-out time
  let timeRangeText: string;
  if (record.checkOut) {
    timeRangeText = record.checkIn + " → " + record.checkOut;
  } else {
    timeRangeText = record.checkIn + " (Active)";
  }

  // 时长显示文字
  // Duration display text
  let durationText: string;
  if (record.duration) {
    durationText = record.duration;
  } else {
    durationText = "Ongoing";
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[historyCardStyles.card, { backgroundColor: T.card, borderColor: T.border }]}
    >
      {/* 左侧状态颜色条 / Left status colour strip */}
      <View style={[historyCardStyles.cardAccent, { backgroundColor: color }]} />

      {/* 卡片内容 / Card content */}
      <View style={historyCardStyles.cardBody}>

        {/* 上部：车位 + 日期时间 + 状态徽章 / Top: spot + date/time + status badge */}
        <View style={historyCardStyles.cardTop}>

          {/* 车位编号 / Spot number */}
          <View style={historyCardStyles.cardSpotWrap}>
            <Text style={[historyCardStyles.cardSpotLabel, { color: T.muted }]}>
              SPOT
            </Text>
            <Text style={[historyCardStyles.cardSpot, { color }]}>
              {record.spot}
            </Text>
          </View>

          {/* 日期和时间范围 / Date and time range */}
          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text style={[historyCardStyles.cardDate, { color: T.text }]}>
              {record.date}
            </Text>
            <Text style={[historyCardStyles.cardTime, { color: T.muted }]}>
              {timeRangeText}
            </Text>
          </View>

          {/* 状态徽章 / Status badge */}
          <View
            style={[
              historyCardStyles.cardBadge,
              { backgroundColor: badgeBgColor, borderColor: badgeBorderColor },
            ]}
          >
            <Text style={{ fontSize: 12 }}>{icon}</Text>
            <Text style={[historyCardStyles.cardBadgeText, { color }]}>
              {record.status}
            </Text>
          </View>

        </View>

        {/* 下部：停留时长 / Bottom: duration */}
        <View style={historyCardStyles.cardBottom}>
          <Text style={[historyCardStyles.cardDuration, { color: T.muted }]}>
            🕐 {durationText}
          </Text>
        </View>

      </View>
    </TouchableOpacity>
  );
}

// ─── Styles for HistoryScreen ─────────────────────────────────────────────────
const styles = StyleSheet.create({

  // 全屏容器
  // Full-screen container
  screen: {
    flex: 1,
  },

  // 滚动内容区域（底部留空给标签栏）
  // Scroll content area — bottom padding for the tab bar
  scroll: {
    padding:           20,
    paddingTop:        56,
    paddingBottom:     100,
    backgroundColor:   "transparent",
  },

  // 顶部标题栏（标题 + logo 横排）
  // Page header row — title and logo side by side
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

  // 副标题（较小灰色）
  // Subtitle — smaller muted text
  subtitle: {
    fontSize: 13,
  },

  // 年度通行证横幅容器
  // Annual pass banner container
  passBanner: {
    borderWidth:   1,
    borderRadius:  14,
    padding:       14,
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
    marginBottom:  14,
  },

  // 通行证图标
  // Pass icon
  passIcon: {
    fontSize: 22,
  },

  // 通行证标题文字
  // Pass title text
  passTitle: {
    fontWeight: "700",
    fontSize:   14,
  },

  // 通行证副标题（有效期等）
  // Pass subtitle — validity info
  passSub: {
    fontSize:  12,
    marginTop: 2,
  },

  // 通行证活跃状态小圆点
  // Active indicator dot on the pass banner
  passValidDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },

  // 摘要卡片（3 个数字并排）
  // Summary card — 3 stats side by side
  summaryCard: {
    borderWidth:    1,
    borderRadius:   18,
    padding:        18,
    flexDirection:  "row",
    justifyContent: "space-around",
    alignItems:     "center",
    marginBottom:   16,
  },

  // 摘要行（数字 + 分隔线组合）
  // Summary row — combines the number item and the divider
  summaryRow: {
    flexDirection: "row",
    alignItems:    "center",
  },

  // 单个摘要项（数字 + 标签）
  // Single summary item — number + label
  summaryItem: {
    alignItems: "center",
  },

  // 摘要数字大字
  // Large summary number
  summaryNum: {
    fontSize:   22,
    fontWeight: "900",
  },

  // 摘要标签小字
  // Summary label — small text below the number
  summaryLabel: {
    fontSize:  11,
    marginTop: 2,
  },

  // 摘要项之间的竖向分隔线
  // Vertical divider between summary items
  summaryDivider: {
    width:            1,
    height:           36,
    marginHorizontal: 16,
  },

  // 水平滚动筛选标签行
  // Horizontal scrollable filter pill row
  filterRow: {
    marginBottom: 12,
  },

  // 单个筛选胶囊按钮
  // Single filter pill button
  pill: {
    borderWidth:       1,
    borderRadius:      999,
    paddingHorizontal: 16,
    paddingVertical:   7,
    marginRight:       8,
  },

  // 筛选胶囊文字
  // Filter pill text
  pillText: {
    fontSize:   13,
    fontWeight: "600",
  },

  // 筛选结果数量文字
  // Record count text shown above the list
  recordCount: {
    fontSize:     12,
    marginBottom: 12,
  },

  // 空状态容器（无记录时显示）
  // Empty state container — shown when no records match the filter
  emptyWrap: {
    alignItems:     "center",
    paddingVertical: 60,
  },

  // 空状态图标
  // Empty state icon
  emptyIcon: {
    fontSize:     40,
    marginBottom: 12,
  },

  // 空状态提示文字
  // Empty state hint text
  emptyText: {
    fontSize: 15,
  },
});

// ─── HistoryScreen ────────────────────────────────────────────────────────────
/*
停车历史主页面。
Main parking history screen.
*/
export default function HistoryScreen() {

  const { theme: T }                    = useTheme();
  const { activity, activeSession }     = useParkingContext();

  // 选中的记录（触发 DetailModal）/ Selected record — triggers DetailModal
  const [selected, setSelected] = useState<ParkingRecord | null>(null);

  // 当前激活的筛选标签 / Currently active filter pill
  const [filter, setFilter] = useState<RecordStatus | "All">("All");

  // ── 数据转换 / Data transformation ──────────────────────────────────────────
  // 将 context 的 ActivityItem[] 转换为此页面使用的 ParkingRecord[] 格式
  // Convert context ActivityItem[] into the ParkingRecord[] format used by this screen
  const records: ParkingRecord[] = activity.map(function convertActivityItem(item) {

    // 判断是否是当前活动会话（车牌匹配且是签入事件）
    // Check if this item matches the current active session — same plate and is a check-in event
    let isActive = false;
    if (activeSession && activeSession.plate === item.plate && item.isIn) {
      isActive = true;
    }

    // 取签入时间戳（如果 Context 提供了 checkedInAt 字段）
    // Get check-in timestamp if the context provides a checkedInAt field
    // 取签入时间戳：activeSession 可能没有 checkedInAt 字段（视 Context 实现而定）
    // Get check-in timestamp: activeSession may not have checkedInAt depending on Context implementation
    let checkedInAt: string | undefined;
    if (activeSession && (activeSession as any).checkedInAt) {
      checkedInAt = (activeSession as any).checkedInAt as string;
    } else {
      checkedInAt = undefined;
    }

    // 计算记录状态
    // Derive the record status
    const recordStatus = deriveRecordStatus(isActive, item.isIn, checkedInAt);

    // 日期文字：有时间记录时显示"Today"，否则显示破折号
    // Date text: show "Today" if time is recorded, dash otherwise
    let recordDate: string;
    if (item.time) {
      recordDate = "Today";
    } else {
      recordDate = "—";
    }

    return {
      id:       item.id,
      spot:     item.spot,
      plate:    item.plate,
      date:     recordDate,
      checkIn:  item.isIn  ? item.time : "—",
      checkOut: item.isIn  ? undefined  : item.time,
      duration: undefined, // 时长计算依赖 checkedInAt，暂用 undefined / depends on checkedInAt timestamp
      status:   recordStatus,
    };
  });

  // ── 筛选 / Filtering ─────────────────────────────────────────────────────────
  // "All" 不过滤，其他筛选器只保留对应状态的记录
  // "All" shows everything; other filters keep only records with a matching status
  let filtered: ParkingRecord[];
  if (filter === "All") {
    filtered = records;
  } else {
    filtered = records.filter(function matchesFilter(r) {
      return r.status === filter;
    });
  }

  // ── 摘要统计 / Summary stats ─────────────────────────────────────────────────
  // 已完成会话数量（不含活动中的）
  // Number of completed sessions — excludes active ones
  const totalSessions = records.filter(function isCompleted(r) {
    return r.status !== "Active";
  }).length;

  // 超时次数
  // Number of overstay records
  const overstayCount = records.filter(function isOverstayRecord(r) {
    return r.status === "Overstay";
  }).length;

  // 摘要卡片数据（提取为具名数组）
  // Summary card data — extracted as a named array
  const summaryItems = [
    { val: totalSessions,   label: "Sessions",  color: T.accent },
    { val: records.length,  label: "Total",     color: T.green  },
    {
      val:   overstayCount,
      label: "Overstays",
      color: overstayCount > 0 ? T.red : T.green,
    },
  ];

  // 记录数量显示文字（单复数）
  // Record count label — singular vs plural
  let recordCountText: string;
  if (filtered.length === 1) {
    recordCountText = "1 record";
  } else {
    recordCountText = filtered.length + " records";
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
            <Text style={[styles.pageTitle, { color: T.text }]}>My History</Text>
            <Text style={[styles.subtitle,  { color: T.muted }]}>Parking Activity</Text>
          </View>
          <Image
            source={require("../../assets/images/itkia.png")}
            style={{ width: 80, height: 40, resizeMode: "contain" }}
          />
        </View>

        {/* 年度通行证横幅 / Annual pass banner */}
        <View
          style={[
            styles.passBanner,
            { backgroundColor: T.green + "15", borderColor: T.green + "44" },
          ]}
        >
          <Text style={styles.passIcon}>🎫</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passTitle, { color: T.text }]}>
              Annual Parking Pass · Active
            </Text>
            <Text style={[styles.passSub, { color: T.muted }]}>
              Valid until Dec 2026 · RM10 paid
            </Text>
          </View>
          {/* 活跃绿色圆点 / Active green dot */}
          <View style={[styles.passValidDot, { backgroundColor: T.green }]} />
        </View>

        {/* 摘要卡片 / Summary card */}
        <View
          style={[styles.summaryCard, { backgroundColor: T.card, borderColor: T.border }]}
        >
          {summaryItems.map(function renderSummaryItem(item, index) {
            return (
              <View key={item.label} style={styles.summaryRow}>
                {/* 第一个之后的每项前面加分隔线 / Divider before every item except the first */}
                {index > 0 && (
                  <View style={[styles.summaryDivider, { backgroundColor: T.border }]} />
                )}
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: item.color }]}>
                    {item.val}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: T.muted }]}>
                    {item.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 水平滚动筛选标签 / Horizontal scrollable filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
        >
          {FILTER_OPTIONS.map(function renderFilterPill(option) {
            const isActive = filter === option;

            // 根据筛选器类型决定强调色
            // Decide accent colour based on filter type
            let pillAccentColor = T.muted;
            if (option === "Active") {
              pillAccentColor = T.green;
            } else if (option === "Overstay") {
              pillAccentColor = T.red;
            } else if (option === "Completed") {
              pillAccentColor = T.accent;
            }

            // 激活时填充颜色，未激活时透明背景
            // Active: filled background; inactive: transparent
            let pillBgColor: string;
            let pillBorderColor: string;
            let pillTextColor: string;
            if (isActive) {
              pillBgColor     = pillAccentColor;
              pillBorderColor = pillAccentColor;
              pillTextColor   = "#fff";
            } else {
              pillBgColor     = "transparent";
              pillBorderColor = T.border;
              pillTextColor   = T.muted;
            }

            return (
              <TouchableOpacity
                key={option}
                onPress={function selectFilter() { setFilter(option); }}
                style={[
                  styles.pill,
                  { backgroundColor: pillBgColor, borderColor: pillBorderColor },
                ]}
              >
                <Text style={[styles.pillText, { color: pillTextColor }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 筛选结果数量 / Filtered record count */}
        <Text style={[styles.recordCount, { color: T.muted }]}>
          {recordCountText}
        </Text>

        {/* 记录列表或空状态 / Record list or empty state */}
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🅿️</Text>
            <Text style={[styles.emptyText, { color: T.muted }]}>No records yet</Text>
          </View>
        ) : (
          filtered.map(function renderRecord(r) {
            return (
              <HistoryCard
                key={r.id}
                record={r}
                onPress={function openDetail() { setSelected(r); }}
              />
            );
          })
        )}

      </ScrollView>

      {/* 详情弹窗放在 ScrollView 外，确保正确层叠覆盖
          Detail modal is outside ScrollView so it renders above all content */}
      <DetailModal
        record={selected}
        onClose={function closeDetail() { setSelected(null); }}
      />

    </View>
  );
}