import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Colours ──────────────────────────────────────────────────────────
const C = {
  bg:     "#060D1F",
  card:   "#0D1B38",
  border: "#1A2F5A",
  accent: "#1E90FF",
  green:  "#22C55E",
  red:    "#EF4444",
  orange: "#F97316",
  text:   "#E8F0FF",
  muted:  "#6B7FA8",
};

type RecordStatus = "Active" | "Completed" | "Overstay";

interface ParkingRecord {
  id:        string;
  spot:      string;
  plate:     string;
  date:      string;
  checkIn:   string;
  checkOut?: string;
  duration?: string;
  status:    RecordStatus;
  photoTaken?: boolean; // was camera used at check-in
}

// ─── Mock Data (no per-session fees — annual fee only) ────────────────
const HISTORY: ParkingRecord[] = [
  {
    id: "1", spot: "A3", plate: "WXY 1234",
    date: "Today", checkIn: "08:14 AM",
    status: "Active", photoTaken: true,
  },
  {
    id: "2", spot: "B7", plate: "WXY 1234",
    date: "Yesterday", checkIn: "02:30 PM", checkOut: "04:45 PM",
    duration: "2h 15m", status: "Completed", photoTaken: true,
  },
  {
    id: "3", spot: "C2", plate: "WXY 1234",
    date: "Mon, 3 Mar", checkIn: "09:00 AM", checkOut: "02:10 PM",
    duration: "5h 10m", status: "Overstay", photoTaken: false,
  },
  {
    id: "4", spot: "A8", plate: "WXY 1234",
    date: "Fri, 28 Feb", checkIn: "10:00 AM", checkOut: "12:00 PM",
    duration: "2h 00m", status: "Completed", photoTaken: true,
  },
  {
    id: "5", spot: "D5", plate: "WXY 1234",
    date: "Thu, 27 Feb", checkIn: "08:45 AM", checkOut: "01:30 PM",
    duration: "4h 45m", status: "Completed", photoTaken: true,
  },
  {
    id: "6", spot: "B3", plate: "WXY 1234",
    date: "Wed, 26 Feb", checkIn: "11:20 AM", checkOut: "01:00 PM",
    duration: "1h 40m", status: "Completed", photoTaken: false,
  },
];

function statusColor(s: RecordStatus) {
  return s === "Active" ? C.green : s === "Completed" ? C.accent : C.red;
}
function statusIcon(s: RecordStatus) {
  return s === "Active" ? "🟢" : s === "Completed" ? "✅" : "⚠️";
}

// ─── Detail Modal ─────────────────────────────────────────────────────
function DetailModal({ record, onClose }: { record: ParkingRecord | null; onClose: () => void }) {
  if (!record) return null;
  const color = statusColor(record.status);

  return (
    <Modal transparent animationType="slide" visible={!!record} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Parking Record</Text>
          <Text style={styles.sheetSub}>{record.date}</Text>

          <View style={[styles.spotBadge, { borderColor: color + "66", backgroundColor: color + "15" }]}>
            <Text style={[styles.spotBadgeText, { color }]}>🅿️  Spot {record.spot}</Text>
            <View style={[styles.statusPill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[styles.statusPillText, { color }]}>{record.status}</Text>
            </View>
          </View>

          <View style={styles.detailBox}>
            {[
              ["Plate No.",   record.plate],
              ["Check In",    record.checkIn],
              ["Check Out",   record.checkOut ?? "—"],
              ["Duration",    record.duration ?? "Ongoing"],
              ["Photo Taken", record.photoTaken ? "✅ Yes" : "❌ No"],
            ].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={styles.detailKey}>{k}</Text>
                <Text style={styles.detailVal}>{v}</Text>
              </View>
            ))}
          </View>

          {/* Annual fee note */}
          <View style={styles.feeNote}>
            <Text style={styles.feeNoteText}>
              💳  MDIS uses an annual parking pass (RM10/vehicle). No per-session charges.
            </Text>
          </View>

          <TouchableOpacity style={styles.closeSheetBtn} onPress={onClose}>
            <Text style={styles.closeSheetText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── History Card ─────────────────────────────────────────────────────
function HistoryCard({ record, onPress }: { record: ParkingRecord; onPress: () => void }) {
  const color = statusColor(record.status);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.cardSpotWrap}>
            <Text style={styles.cardSpotLabel}>SPOT</Text>
            <Text style={[styles.cardSpot, { color }]}>{record.spot}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text style={styles.cardDate}>{record.date}</Text>
            <Text style={styles.cardTime}>
              {record.checkIn}{record.checkOut ? `  →  ${record.checkOut}` : "  →  Now"}
            </Text>
          </View>
          <View style={[styles.cardBadge, { backgroundColor: color + "20", borderColor: color + "50" }]}>
            <Text style={{ fontSize: 12 }}>{statusIcon(record.status)}</Text>
            <Text style={[styles.cardBadgeText, { color }]}>{record.status}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.cardDuration}>🕐 {record.duration ?? "Ongoing"}</Text>
          {record.photoTaken && <Text style={styles.photoTag}>📷 Photo</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────
export default function HistoryScreen() {
  const [selected, setSelected] = useState<ParkingRecord | null>(null);
  const [filter, setFilter]     = useState<RecordStatus | "All">("All");

  const filters: (RecordStatus | "All")[] = ["All", "Active", "Completed", "Overstay"];
  const filtered = filter === "All" ? HISTORY : HISTORY.filter(r => r.status === filter);

  const totalSessions = HISTORY.filter(r => r.status !== "Active").length;
  const totalHours    = HISTORY
    .filter(r => r.duration)
    .reduce((sum, r) => {
      const match = r.duration!.match(/(\d+)h\s*(\d+)?m?/);
      return sum + (match ? parseInt(match[1]) + (parseInt(match[2] ?? "0") / 60) : 0);
    }, 0);
  const overstays = HISTORY.filter(r => r.status === "Overstay").length;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>My History</Text>
            <Text style={styles.subtitle}>Plate: WXY 1234</Text>
          </View>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>MDIS</Text>
          </View>
        </View>

        {/* ── Annual Pass Banner ── */}
        <View style={styles.passBanner}>
          <Text style={styles.passIcon}>🎫</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.passTitle}>Annual Parking Pass · Active</Text>
            <Text style={styles.passSub}>Valid until Dec 2025 · RM10 paid</Text>
          </View>
          <View style={styles.passValidDot} />
        </View>

        {/* ── Summary Card ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: C.accent }]}>{totalSessions}</Text>
            <Text style={styles.summaryLabel}>Sessions</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: C.green }]}>{totalHours.toFixed(1)}h</Text>
            <Text style={styles.summaryLabel}>Total Hours</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: overstays > 0 ? C.red : C.green }]}>{overstays}</Text>
            <Text style={styles.summaryLabel}>Overstays</Text>
          </View>
        </View>

        {/* ── Filter Pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {filters.map(f => {
            const active = filter === f;
            const col = f === "Active" ? C.green : f === "Overstay" ? C.red : f === "Completed" ? C.accent : C.muted;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.pill, active
                  ? { backgroundColor: col, borderColor: col }
                  : { backgroundColor: "transparent", borderColor: C.border }]}
              >
                <Text style={[styles.pillText, { color: active ? "#fff" : C.muted }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.recordCount}>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</Text>

        {/* ── Cards ── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🅿️</Text>
            <Text style={styles.emptyText}>No records found</Text>
          </View>
        ) : (
          filtered.map(record => (
            <HistoryCard key={record.id} record={record} onPress={() => setSelected(record)} />
          ))
        )}
      </ScrollView>

      <DetailModal record={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { color: C.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 13 },
  logoBadge: {
    backgroundColor: "rgba(30,144,255,0.12)", borderWidth: 1,
    borderColor: "rgba(30,144,255,0.35)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  logoText: { color: C.accent, fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },

  // Annual pass
  passBanner: {
    backgroundColor: C.green + "15", borderWidth: 1, borderColor: C.green + "44",
    borderRadius: 14, padding: 14, flexDirection: "row",
    alignItems: "center", gap: 12, marginBottom: 14,
  },
  passIcon: { fontSize: 22 },
  passTitle: { color: C.text, fontWeight: "700", fontSize: 14 },
  passSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  passValidDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green },

  // Summary
  summaryCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, padding: 18, flexDirection: "row",
    justifyContent: "space-around", alignItems: "center", marginBottom: 16,
  },
  summaryItem: { alignItems: "center" },
  summaryNum: { fontSize: 22, fontWeight: "900" },
  summaryLabel: { color: C.muted, fontSize: 11, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: C.border },

  // Filter
  filterRow: { marginBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginRight: 8 },
  pillText: { fontSize: 13, fontWeight: "600" },
  recordCount: { color: C.muted, fontSize: 12, marginBottom: 12 },

  // Card
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, marginBottom: 10, flexDirection: "row", overflow: "hidden",
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardSpotWrap: { alignItems: "center", minWidth: 36 },
  cardSpotLabel: { color: C.muted, fontSize: 9, letterSpacing: 1 },
  cardSpot: { fontSize: 20, fontWeight: "900" },
  cardDate: { color: C.text, fontWeight: "700", fontSize: 14 },
  cardTime: { color: C.muted, fontSize: 12, marginTop: 2 },
  cardBadge: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  cardBadgeText: { fontSize: 11, fontWeight: "700" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardDuration: { color: C.muted, fontSize: 12 },
  photoTag: { color: C.muted, fontSize: 12 },

  // Empty
  emptyWrap: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: C.muted, fontSize: 15 },

  // Modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0D1B38", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderTopWidth: 1, borderColor: C.border,
  },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 2 },
  sheetSub: { color: C.muted, fontSize: 13, marginBottom: 20 },
  spotBadge: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16,
  },
  spotBadgeText: { fontSize: 18, fontWeight: "900" },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  detailBox: { backgroundColor: C.bg, borderRadius: 14, padding: 14, marginBottom: 14, gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailKey: { color: C.muted, fontSize: 13 },
  detailVal: { color: C.text, fontWeight: "700", fontSize: 13 },
  feeNote: {
    backgroundColor: C.accent + "10", borderWidth: 1, borderColor: C.accent + "30",
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  feeNoteText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  closeSheetBtn: { backgroundColor: C.border, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  closeSheetText: { color: C.text, fontWeight: "700", fontSize: 14 },
});