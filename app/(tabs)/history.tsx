// ─────────────────────────────────────────────────────────────────────────────
// app/(tabs)/history.tsx  —  停车记录历史页
//
// 功能：
//   1. 显示停车记录列表（Active / Completed / Overstay）
//   2. 筛选器：全部 / 进行中 / 已完成 / 超时
//   3. 点击记录 → 底部弹窗显示详细信息
//   4. 顶部统计：总次数 / 总时长 / 超时次数
//   5. 年费通行证状态横幅
//
// 常见修改：
//   修改历史数据       → 改 HISTORY 数组（正式版改从 ParkingContext activity 读取）
//   修改通行证信息     → 改 passBanner 里的文字
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  Image, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useTheme } from "../../utils/ThemeContext";

// ─── 类型定义 ──────────────────────────────────────────────────────────────
type RecordStatus = "Active" | "Completed" | "Overstay";

interface ParkingRecord {
  id:          string;
  spot:        string;          // 车位编号，如 "A3"
  plate:       string;          // 车牌
  date:        string;          // 日期显示文字
  checkIn:     string;          // 签入时间
  checkOut?:   string;          // 签出时间（Active 时无此字段）
  duration?:   string;          // 停留时长，如 "2h 15m"
  status:      RecordStatus;
  photoTaken?: boolean;         // 是否有拍照记录
}

// ─── 测试数据（正式版改从 ParkingContext.activity 读取）──────────────────────
const HISTORY: ParkingRecord[] = [
  { id: "1", spot: "A3", plate: "WXY 1234", date: "Today",       checkIn: "08:14 AM", status: "Active",    photoTaken: true  },
  { id: "2", spot: "B7", plate: "WXY 1234", date: "Yesterday",   checkIn: "02:30 PM", checkOut: "04:45 PM", duration: "2h 15m", status: "Completed", photoTaken: true  },
  { id: "3", spot: "C2", plate: "WXY 1234", date: "Mon, 3 Mar",  checkIn: "09:00 AM", checkOut: "02:10 PM", duration: "5h 10m", status: "Overstay",  photoTaken: false },
  { id: "4", spot: "A8", plate: "WXY 1234", date: "Fri, 28 Feb", checkIn: "10:00 AM", checkOut: "12:00 PM", duration: "2h 00m", status: "Completed", photoTaken: true  },
  { id: "5", spot: "D5", plate: "WXY 1234", date: "Thu, 27 Feb", checkIn: "08:45 AM", checkOut: "01:30 PM", duration: "4h 45m", status: "Completed", photoTaken: true  },
  { id: "6", spot: "B3", plate: "WXY 1234", date: "Wed, 26 Feb", checkIn: "11:20 AM", checkOut: "01:00 PM", duration: "1h 40m", status: "Completed", photoTaken: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// 📋 DetailModal — 点击记录后弹出的详情底部弹窗
// ═════════════════════════════════════════════════════════════════════════════
function DetailModal({ record, onClose }: {
  record:  ParkingRecord | null;
  onClose: () => void;
}) {
  const { theme: T } = useTheme();
  if (!record) return null;

  // 状态颜色：进行中=绿，已完成=强调色，超时=红
  const color = record.status === "Active"    ? T.green
              : record.status === "Completed" ? T.accent
              : T.red;

  return (
    <Modal transparent animationType="slide" visible={!!record} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}
          style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>

          <View style={[styles.handle, { backgroundColor: T.border }]} />
          <Text style={[styles.sheetTitle, { color: T.text }]}>Parking Record</Text>
          <Text style={[styles.sheetSub,   { color: T.muted }]}>{record.date}</Text>

          {/* 车位 + 状态标签 */}
          <View style={[styles.spotBadge, { borderColor: color + "66", backgroundColor: color + "15" }]}>
            <Text style={[styles.spotBadgeText, { color }]}>🅿️  Spot {record.spot}</Text>
            <View style={[styles.statusPill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[styles.statusPillText, { color }]}>{record.status}</Text>
            </View>
          </View>

          {/* 详情列表 */}
          <View style={[styles.detailBox, { backgroundColor: T.bg }]}>
            {[
              ["Plate No.",   record.plate],
              ["Check In",    record.checkIn],
              ["Check Out",   record.checkOut ?? "—"],
              ["Duration",    record.duration ?? "Ongoing"],
              ["Photo Taken", record.photoTaken ? "✅ Yes" : "❌ No"],
            ].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: T.text }]}>{v}</Text>
              </View>
            ))}
          </View>

          {/* 年费说明 */}
          <View style={[styles.feeNote, { backgroundColor: T.accent + "10", borderColor: T.accent + "30" }]}>
            <Text style={[styles.feeNoteText, { color: T.muted }]}>
              💳  MDIS uses an annual parking pass (RM10/vehicle). No per-session charges.
            </Text>
          </View>

          <TouchableOpacity style={[styles.closeSheetBtn, { backgroundColor: T.border }]} onPress={onClose}>
            <Text style={[styles.closeSheetText, { color: T.text }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 🃏 HistoryCard — 单条停车记录卡片
// ═════════════════════════════════════════════════════════════════════════════
function HistoryCard({ record, onPress }: {
  record:  ParkingRecord;
  onPress: () => void;
}) {
  const { theme: T } = useTheme();

  // 状态颜色 & 图标
  const color = record.status === "Active"    ? T.green
              : record.status === "Completed" ? T.accent
              : T.red;
  const icon  = record.status === "Active"    ? "🟢"
              : record.status === "Completed" ? "✅"
              : "⚠️";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}
    >
      {/* 左侧彩色竖条，颜色代表状态 */}
      <View style={[styles.cardAccent, { backgroundColor: color }]} />

      <View style={styles.cardBody}>
        {/* 上半：车位号 + 日期时间 + 状态徽章 */}
        <View style={styles.cardTop}>
          <View style={styles.cardSpotWrap}>
            <Text style={[styles.cardSpotLabel, { color: T.muted }]}>SPOT</Text>
            <Text style={[styles.cardSpot, { color }]}>{record.spot}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text style={[styles.cardDate, { color: T.text }]}>{record.date}</Text>
            <Text style={[styles.cardTime, { color: T.muted }]}>
              {record.checkIn}{record.checkOut ? `  →  ${record.checkOut}` : "  →  Now"}
            </Text>
          </View>
          <View style={[styles.cardBadge, { backgroundColor: color + "20", borderColor: color + "50" }]}>
            <Text style={{ fontSize: 12 }}>{icon}</Text>
            <Text style={[styles.cardBadgeText, { color }]}>{record.status}</Text>
          </View>
        </View>

        {/* 下半：时长 + 是否有照片 */}
        <View style={styles.cardBottom}>
          <Text style={[styles.cardDuration, { color: T.muted }]}>🕐 {record.duration ?? "Ongoing"}</Text>
          {record.photoTaken && <Text style={[styles.photoTag, { color: T.muted }]}>📷 Photo</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 📜 HistoryScreen — 主页面
// ═════════════════════════════════════════════════════════════════════════════
export default function HistoryScreen() {
  const { theme: T } = useTheme();

  // ── 状态管理 ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<ParkingRecord | null>(null);         // 当前点击的记录（弹窗用）
  const [filter,   setFilter]   = useState<RecordStatus | "All">("All");        // 当前筛选器
  const filters: (RecordStatus | "All")[] = ["All", "Active", "Completed", "Overstay"];

  // 根据筛选器过滤记录
  const filtered = filter === "All" ? HISTORY : HISTORY.filter(r => r.status === filter);

  // ── 统计计算 ──────────────────────────────────────────────────────────────

  // 总完成次数（不含进行中）
  const totalSessions = HISTORY.filter(r => r.status !== "Active").length;

  // 总停车时长（小时）
  const totalHours = HISTORY.filter(r => r.duration).reduce((sum, r) => {
    const m = r.duration!.match(/(\d+)h\s*(\d+)?m?/);
    return sum + (m ? parseInt(m[1]) + (parseInt(m[2] ?? "0") / 60) : 0);
  }, 0);

  // 超时次数
  const overstays = HISTORY.filter(r => r.status === "Overstay").length;

  // ─────────────────────────────────────────────────────────────────────────
  // 渲染
  // 背景 transparent → 让 app/_layout.tsx 的 LinearGradient 渐变透出来
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── 标题栏 ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>My History</Text>
            <Text style={[styles.subtitle,  { color: T.muted }]}>Plate: WXY 1234</Text>
          </View>
          {/* IT Kia logo（与其他页面一致）*/}
          <Image source={require('../../assets/images/itkia.png')} style={{ width: 80, height: 40, resizeMode: 'contain' }} />
        </View>

        {/* ── 年费通行证状态横幅 ── */}
        <View style={[styles.passBanner, { backgroundColor: T.green + "15", borderColor: T.green + "44" }]}>
          <Text style={styles.passIcon}>🎫</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passTitle, { color: T.text }]}>Annual Parking Pass · Active</Text>
            {/* 修改通行证有效期 → 改这里 */}
            <Text style={[styles.passSub,   { color: T.muted }]}>Valid until Dec 2025 · RM10 paid</Text>
          </View>
          {/* 绿点：有效状态指示 */}
          <View style={[styles.passValidDot, { backgroundColor: T.green }]} />
        </View>

        {/* ── 统计卡片：总次数 / 总时长 / 超时次数 ── */}
        <View style={[styles.summaryCard, { backgroundColor: T.card, borderColor: T.border }]}>
          {[
            { val: totalSessions,             label: "Sessions",    color: T.accent },
            { val: totalHours.toFixed(1) + "h", label: "Total Hours", color: T.green  },
            { val: overstays,                 label: "Overstays",   color: overstays > 0 ? T.red : T.green },
          ].map((s, i) => (
            <View key={s.label} style={styles.summaryRow}>
              {/* 分隔线（第一个不显示）*/}
              {i > 0 && <View style={[styles.summaryDivider, { backgroundColor: T.border }]} />}
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum,   { color: s.color }]}>{s.val}</Text>
                <Text style={[styles.summaryLabel, { color: T.muted }]}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── 筛选器 ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {filters.map(f => {
            const active = filter === f;
            // 每个筛选器有对应颜色
            const col = f === "Active"    ? T.green
                      : f === "Overstay"  ? T.red
                      : f === "Completed" ? T.accent
                      : T.muted;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.pill,
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

        {/* 记录数量提示 */}
        <Text style={[styles.recordCount, { color: T.muted }]}>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </Text>

        {/* ── 记录列表 / 空状态 ── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🅿️</Text>
            <Text style={[styles.emptyText, { color: T.muted }]}>No records found</Text>
          </View>
        ) : (
          filtered.map(r => (
            <HistoryCard key={r.id} record={r} onPress={() => setSelected(r)} />
          ))
        )}
      </ScrollView>

      {/* 详情弹窗（放在 ScrollView 外，确保层级最高）*/}
      <DetailModal record={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // 背景透明，让 _layout.tsx 的 LinearGradient 渐变透出来
  screen: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" },

  // 标题栏
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle:  { fontSize: 13 },

  // 年费通行证横幅
  passBanner:   { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  passIcon:     { fontSize: 22 },
  passTitle:    { fontWeight: "700", fontSize: 14 },
  passSub:      { fontSize: 12, marginTop: 2 },
  passValidDot: { width: 10, height: 10, borderRadius: 5 },

  // 统计卡片
  summaryCard:    { borderWidth: 1, borderRadius: 18, padding: 18, flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 16 },
  summaryRow:     { flexDirection: "row", alignItems: "center" },
  summaryItem:    { alignItems: "center" },
  summaryNum:     { fontSize: 22, fontWeight: "900" },
  summaryLabel:   { fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, marginHorizontal: 16 },

  // 筛选器
  filterRow: { marginBottom: 12 },
  pill:      { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  pillText:  { fontSize: 13, fontWeight: "600" },

  // 记录数量
  recordCount: { fontSize: 12, marginBottom: 12 },

  // 记录卡片
  card:          { borderWidth: 1, borderRadius: 16, marginBottom: 10, flexDirection: "row", overflow: "hidden" },
  cardAccent:    { width: 4 },  // 左侧状态颜色竖条
  cardBody:      { flex: 1, padding: 14 },
  cardTop:       { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardSpotWrap:  { alignItems: "center", minWidth: 36 },
  cardSpotLabel: { fontSize: 9, letterSpacing: 1 },
  cardSpot:      { fontSize: 20, fontWeight: "900" },
  cardDate:      { fontWeight: "700", fontSize: 14 },
  cardTime:      { fontSize: 12, marginTop: 2 },
  cardBadge:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  cardBadgeText: { fontSize: 11, fontWeight: "700" },
  cardBottom:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardDuration:  { fontSize: 12 },
  photoTag:      { fontSize: 12 },

  // 空状态
  emptyWrap: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15 },

  // ── Modal 通用样式 ──
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle:  { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },

  // 详情弹窗
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