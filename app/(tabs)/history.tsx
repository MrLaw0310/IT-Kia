import { useState } from "react";
import {
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useTheme } from "../../utils/ThemeContext";

type RecordStatus = "Active" | "Completed" | "Overstay";
interface ParkingRecord {
  id: string; spot: string; plate: string; date: string;
  checkIn: string; checkOut?: string; duration?: string;
  status: RecordStatus; photoTaken?: boolean;
}

const HISTORY: ParkingRecord[] = [
  { id:"1", spot:"A3", plate:"WXY 1234", date:"Today",       checkIn:"08:14 AM", status:"Active",    photoTaken:true  },
  { id:"2", spot:"B7", plate:"WXY 1234", date:"Yesterday",   checkIn:"02:30 PM", checkOut:"04:45 PM", duration:"2h 15m", status:"Completed", photoTaken:true  },
  { id:"3", spot:"C2", plate:"WXY 1234", date:"Mon, 3 Mar",  checkIn:"09:00 AM", checkOut:"02:10 PM", duration:"5h 10m", status:"Overstay",  photoTaken:false },
  { id:"4", spot:"A8", plate:"WXY 1234", date:"Fri, 28 Feb", checkIn:"10:00 AM", checkOut:"12:00 PM", duration:"2h 00m", status:"Completed", photoTaken:true  },
  { id:"5", spot:"D5", plate:"WXY 1234", date:"Thu, 27 Feb", checkIn:"08:45 AM", checkOut:"01:30 PM", duration:"4h 45m", status:"Completed", photoTaken:true  },
  { id:"6", spot:"B3", plate:"WXY 1234", date:"Wed, 26 Feb", checkIn:"11:20 AM", checkOut:"01:00 PM", duration:"1h 40m", status:"Completed", photoTaken:false },
];

function DetailModal({ record, onClose }: { record: ParkingRecord | null; onClose: () => void }) {
  const { theme: T } = useTheme();
  if (!record) return null;
  const color = record.status === "Active" ? T.green : record.status === "Completed" ? T.accent : T.red;
  return (
    <Modal transparent animationType="slide" visible={!!record} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
          <Text style={[styles.sheetTitle, { color: T.text }]}>Parking Record</Text>
          <Text style={[styles.sheetSub,   { color: T.muted }]}>{record.date}</Text>
          <View style={[styles.spotBadge, { borderColor: color+"66", backgroundColor: color+"15" }]}>
            <Text style={[styles.spotBadgeText, { color }]}>🅿️  Spot {record.spot}</Text>
            <View style={[styles.statusPill, { backgroundColor: color+"22", borderColor: color+"55" }]}>
              <Text style={[styles.statusPillText, { color }]}>{record.status}</Text>
            </View>
          </View>
          <View style={[styles.detailBox, { backgroundColor: T.bg }]}>
            {[["Plate No.", record.plate],["Check In", record.checkIn],["Check Out", record.checkOut??"—"],
              ["Duration", record.duration??"Ongoing"],["Photo Taken", record.photoTaken?"✅ Yes":"❌ No"],
            ].map(([k,v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: T.muted }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: T.text }]}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.feeNote, { backgroundColor: T.accent+"10", borderColor: T.accent+"30" }]}>
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

function HistoryCard({ record, onPress }: { record: ParkingRecord; onPress: () => void }) {
  const { theme: T } = useTheme();
  const color = record.status === "Active" ? T.green : record.status === "Completed" ? T.accent : T.red;
  const icon  = record.status === "Active" ? "🟢"   : record.status === "Completed" ? "✅"     : "⚠️";
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.cardSpotWrap}>
            <Text style={[styles.cardSpotLabel, { color: T.muted }]}>SPOT</Text>
            <Text style={[styles.cardSpot, { color }]}>{record.spot}</Text>
          </View>
          <View style={{ flex:1, paddingLeft:14 }}>
            <Text style={[styles.cardDate, { color: T.text }]}>{record.date}</Text>
            <Text style={[styles.cardTime, { color: T.muted }]}>
              {record.checkIn}{record.checkOut ? `  →  ${record.checkOut}` : "  →  Now"}
            </Text>
          </View>
          <View style={[styles.cardBadge, { backgroundColor: color+"20", borderColor: color+"50" }]}>
            <Text style={{ fontSize:12 }}>{icon}</Text>
            <Text style={[styles.cardBadgeText, { color }]}>{record.status}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={[styles.cardDuration, { color: T.muted }]}>🕐 {record.duration ?? "Ongoing"}</Text>
          {record.photoTaken && <Text style={[styles.photoTag, { color: T.muted }]}>📷 Photo</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const { theme: T } = useTheme();
  const [selected, setSelected] = useState<ParkingRecord | null>(null);
  const [filter,   setFilter]   = useState<RecordStatus | "All">("All");
  const filters: (RecordStatus | "All")[] = ["All","Active","Completed","Overstay"];
  const filtered = filter === "All" ? HISTORY : HISTORY.filter(r => r.status === filter);
  const totalSessions = HISTORY.filter(r => r.status !== "Active").length;
  const totalHours = HISTORY.filter(r => r.duration).reduce((s, r) => {
    const m = r.duration!.match(/(\d+)h\s*(\d+)?m?/);
    return s + (m ? parseInt(m[1]) + (parseInt(m[2]??"0")/60) : 0);
  }, 0);
  const overstays = HISTORY.filter(r => r.status === "Overstay").length;

  return (
    <View style={[styles.screen, { backgroundColor: T.bg }]}>
      {T.pattern && (
        <View style={styles.patternWrap} pointerEvents="none">
          {Array.from({length:40},(_,i) => (
            <Text key={i} style={[styles.patternChar, { color: T.patternColor }]}>{T.pattern}</Text>
          ))}
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>My History</Text>
            <Text style={[styles.subtitle,   { color: T.muted }]}>Plate: WXY 1234</Text>
          </View>
          <View style={[styles.logoBadge, { backgroundColor: T.accent+"18", borderColor: T.accent+"44" }]}>
            <Text style={[styles.logoText, { color: T.accent }]}>MDIS</Text>
          </View>
        </View>

        <View style={[styles.passBanner, { backgroundColor: T.green+"15", borderColor: T.green+"44" }]}>
          <Text style={styles.passIcon}>🎫</Text>
          <View style={{ flex:1 }}>
            <Text style={[styles.passTitle, { color: T.text }]}>Annual Parking Pass · Active</Text>
            <Text style={[styles.passSub,   { color: T.muted }]}>Valid until Dec 2025 · RM10 paid</Text>
          </View>
          <View style={[styles.passValidDot, { backgroundColor: T.green }]} />
        </View>

        <View style={[styles.summaryCard, { backgroundColor: T.card, borderColor: T.border }]}>
          {[
            { val: totalSessions,            label: "Sessions",    color: T.accent },
            { val: totalHours.toFixed(1)+"h", label: "Total Hours", color: T.green  },
            { val: overstays,                label: "Overstays",   color: overstays>0 ? T.red : T.green },
          ].map((s,i) => (
            <View key={s.label} style={styles.summaryRow}>
              {i > 0 && <View style={[styles.summaryDivider, { backgroundColor: T.border }]} />}
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: s.color }]}>{s.val}</Text>
                <Text style={[styles.summaryLabel, { color: T.muted }]}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {filters.map(f => {
            const active = filter === f;
            const col = f==="Active"?T.green:f==="Overstay"?T.red:f==="Completed"?T.accent:T.muted;
            return (
              <TouchableOpacity key={f} onPress={() => setFilter(f)}
                style={[styles.pill, active
                  ? { backgroundColor:col, borderColor:col }
                  : { backgroundColor:"transparent", borderColor:T.border }]}>
                <Text style={[styles.pillText, { color: active?"#fff":T.muted }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.recordCount, { color: T.muted }]}>{filtered.length} record{filtered.length!==1?"s":""}</Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🅿️</Text>
            <Text style={[styles.emptyText, { color: T.muted }]}>No records found</Text>
          </View>
        ) : (
          filtered.map(r => <HistoryCard key={r.id} record={r} onPress={() => setSelected(r)} />)
        )}
      </ScrollView>
      <DetailModal record={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex:1 },
  scroll: { padding:20, paddingTop:56, paddingBottom:100, backgroundColor:"transparent" },
  patternWrap: { position:"absolute", top:0, left:0, right:0, bottom:0, flexDirection:"row", flexWrap:"wrap", padding:20, gap:20, zIndex:0 },
  patternChar: { fontSize:28 },
  header: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  pageTitle: { fontSize:24, fontWeight:"800", letterSpacing:-0.5 },
  subtitle:  { fontSize:13 },
  logoBadge: { borderWidth:1, borderRadius:10, paddingHorizontal:12, paddingVertical:5 },
  logoText:  { fontWeight:"800", fontSize:13, letterSpacing:1.5 },
  passBanner:   { borderWidth:1, borderRadius:14, padding:14, flexDirection:"row", alignItems:"center", gap:12, marginBottom:14 },
  passIcon:     { fontSize:22 },
  passTitle:    { fontWeight:"700", fontSize:14 },
  passSub:      { fontSize:12, marginTop:2 },
  passValidDot: { width:10, height:10, borderRadius:5 },
  summaryCard:  { borderWidth:1, borderRadius:18, padding:18, flexDirection:"row", justifyContent:"space-around", alignItems:"center", marginBottom:16 },
  summaryRow:   { flexDirection:"row", alignItems:"center" },
  summaryItem:  { alignItems:"center" },
  summaryNum:   { fontSize:22, fontWeight:"900" },
  summaryLabel: { fontSize:11, marginTop:2 },
  summaryDivider: { width:1, height:36, marginHorizontal:16 },
  filterRow:    { marginBottom:12 },
  pill:         { borderWidth:1, borderRadius:999, paddingHorizontal:16, paddingVertical:7, marginRight:8 },
  pillText:     { fontSize:13, fontWeight:"600" },
  recordCount:  { fontSize:12, marginBottom:12 },
  card:      { borderWidth:1, borderRadius:16, marginBottom:10, flexDirection:"row", overflow:"hidden" },
  cardAccent:{ width:4 },
  cardBody:  { flex:1, padding:14 },
  cardTop:   { flexDirection:"row", alignItems:"center", marginBottom:10 },
  cardSpotWrap:  { alignItems:"center", minWidth:36 },
  cardSpotLabel: { fontSize:9, letterSpacing:1 },
  cardSpot:      { fontSize:20, fontWeight:"900" },
  cardDate:      { fontWeight:"700", fontSize:14 },
  cardTime:      { fontSize:12, marginTop:2 },
  cardBadge:     { borderWidth:1, borderRadius:10, paddingHorizontal:8, paddingVertical:4, flexDirection:"row", alignItems:"center", gap:4 },
  cardBadgeText: { fontSize:11, fontWeight:"700" },
  cardBottom:    { flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  cardDuration:  { fontSize:12 },
  photoTag:      { fontSize:12 },
  emptyWrap: { alignItems:"center", paddingVertical:60 },
  emptyIcon: { fontSize:40, marginBottom:12 },
  emptyText: { fontSize:15 },
  overlay: { flex:1, backgroundColor:"rgba(0,0,0,0.6)", justifyContent:"flex-end" },
  sheet:   { borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, borderTopWidth:1 },
  handle:  { width:40, height:4, borderRadius:999, alignSelf:"center", marginBottom:20 },
  sheetTitle:{ fontSize:20, fontWeight:"800", marginBottom:2 },
  sheetSub:  { fontSize:13, marginBottom:20 },
  spotBadge: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", borderWidth:1, borderRadius:14, padding:14, marginBottom:16 },
  spotBadgeText: { fontSize:18, fontWeight:"900" },
  statusPill:    { borderWidth:1, borderRadius:999, paddingHorizontal:10, paddingVertical:4 },
  statusPillText:{ fontSize:11, fontWeight:"800", letterSpacing:0.5 },
  detailBox: { borderRadius:14, padding:14, marginBottom:14, gap:12 },
  detailRow: { flexDirection:"row", justifyContent:"space-between" },
  detailKey: { fontSize:13 },
  detailVal: { fontWeight:"700", fontSize:13 },
  feeNote:    { borderWidth:1, borderRadius:12, padding:12, marginBottom:16 },
  feeNoteText:{ fontSize:12, lineHeight:18 },
  closeSheetBtn: { borderRadius:14, paddingVertical:14, alignItems:"center" },
  closeSheetText:{ fontWeight:"700", fontSize:14 },
});