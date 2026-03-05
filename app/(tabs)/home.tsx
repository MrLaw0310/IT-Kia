import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Mock Data ────────────────────────────────────────────────────────
const TOTAL_SPOTS     = 60;
const AVAILABLE_SPOTS = 23;
const OCCUPIED_SPOTS  = TOTAL_SPOTS - AVAILABLE_SPOTS;

const recentActivity = [
  { id: "1", plate: "WXY 1234", action: "Checked In",  time: "08:14 AM", color: "#22C55E" },
  { id: "2", plate: "JKL 5678", action: "Checked Out", time: "08:02 AM", color: "#EF4444" },
  { id: "3", plate: "ABC 9999", action: "Checked In",  time: "07:55 AM", color: "#22C55E" },
  { id: "4", plate: "DEF 3321", action: "Checked Out", time: "07:40 AM", color: "#EF4444" },
];

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

// MDIS Malaysia campus — EduCity, Iskandar Puteri, Johor
const MDIS_LAT = 1.43364;
const MDIS_LNG = 103.615175;

// ─── Animated Number ──────────────────────────────────────────────────
function AnimatedNumber({ value, style }: { value: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 1200, useNativeDriver: false }).start();
    anim.addListener(({ value: v }) => setDisplay(Math.floor(v)));
    return () => anim.removeAllListeners();
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

// ─── Availability Ring ────────────────────────────────────────────────
function AvailabilityRing({ available, total }: { available: number; total: number }) {
  const pct   = available / total;
  const color = pct > 0.4 ? C.green : pct > 0.2 ? C.orange : C.red;

  return (
    <View style={styles.ringWrap}>
      <View style={[styles.ringOuter, { borderColor: color + "33" }]}>
        <View style={[styles.ringInner, { borderColor: color }]}>
          <AnimatedNumber value={available} style={[styles.ringNumber, { color }]} />
          <Text style={styles.ringLabel}>available</Text>
        </View>
      </View>
      <Text style={styles.ringTotal}>out of {total} spots</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────
export default function HomeScreen() {
  const router    = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // Open Google Maps directions to MDIS — no expo-location needed
  function openMapsToMDIS() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${MDIS_LAT},${MDIS_LNG}&travelmode=driving`;
      Linking.openURL(url).catch(() =>
      Linking.openURL(`geo:${MDIS_LAT},${MDIS_LNG}?q=MDIS+Malaysia+EduCity+Iskandar+Puteri+Johor`)
    );
  }

  const pct         = Math.round((AVAILABLE_SPOTS / TOTAL_SPOTS) * 100);
  const statusColor = pct > 40 ? C.green : pct > 20 ? C.orange : C.red;
  const statusLabel = pct > 40 ? "Plenty of Space" : pct > 20 ? "Filling Up" : "Almost Full";

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.pageTitle}>Parking Dashboard</Text>
          </View>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>MDIS</Text>
          </View>
        </Animated.View>

        {/* ── GPS / Navigate Card ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.gpsCard}>
            <View style={styles.gpsLeft}>
              <Text style={styles.gpsIcon}>📍</Text>
              <View>
                <Text style={styles.gpsTitle}>Campus Location</Text>
                <Text style={styles.gpsVal}>EduCity, Iskandar Puteri, Johor</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.directionsBtn} onPress={openMapsToMDIS} activeOpacity={0.8}>
              <Text style={styles.directionsBtnText}>Navigate →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Status Banner ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={[styles.statusBanner, { borderColor: statusColor + "55" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            <Text style={styles.statusTime}>Updated just now</Text>
          </View>
        </Animated.View>

        {/* ── Availability Ring Card ── */}
        <Animated.View style={[styles.card, styles.mainCard, { opacity: fadeAnim }]}>
          <Text style={styles.cardLabel}>MDIS MAIN PARKING LOT</Text>
          <AvailabilityRing available={AVAILABLE_SPOTS} total={TOTAL_SPOTS} />
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: statusColor }]} />
          </View>
          <Text style={styles.progressLabel}>{pct}% available</Text>
        </Animated.View>

        {/* ── Stats Row ── */}
        <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
          {[
            { label: "Free",     val: AVAILABLE_SPOTS, color: C.green  },
            { label: "Occupied", val: OCCUPIED_SPOTS,  color: C.red    },
            { label: "OKU",      val: 2,               color: C.orange },
            { label: "Total",    val: TOTAL_SPOTS,     color: C.accent },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + "44" }]}>
              <Text style={[styles.statNumber, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: "🗺️",  label: "View Map",  bg: C.accent,  textColor: "white",  onPress: () => router.push("/(tabs)/map" as any) },
            { icon: "📷",  label: "Scan Plate", bg: C.card,    textColor: C.text,   onPress: () => router.push("/camera" as any) },
            { icon: "🕐",  label: "History",    bg: C.card,    textColor: C.text,   onPress: () => router.push("/(tabs)/history" as any) },
            { icon: "🧭",  label: "Navigate",   bg: C.card,    textColor: C.text,   onPress: openMapsToMDIS },
          ].map(a => (
            <TouchableOpacity
              key={a.label}
              style={[styles.actionBtn, { backgroundColor: a.bg, borderWidth: a.bg === C.card ? 1 : 0, borderColor: C.border }]}
              onPress={a.onPress}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={[styles.actionText, { color: a.textColor }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Activity ── */}
        <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        {recentActivity.map(item => (
          <View key={item.id} style={styles.activityCard}>
            <View style={[styles.activityDot, { backgroundColor: item.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activityPlate}>{item.plate}</Text>
              <Text style={styles.activityAction}>{item.action}</Text>
            </View>
            <Text style={styles.activityTime}>{item.time}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  greeting:  { color: C.muted, fontSize: 13 },
  pageTitle: { color: C.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  logoBadge: {
    backgroundColor: "rgba(30,144,255,0.12)", borderWidth: 1,
    borderColor: "rgba(30,144,255,0.35)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  logoText: { color: C.accent, fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },

  // GPS card
  gpsCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, marginBottom: 12,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  gpsLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  gpsIcon:  { fontSize: 20 },
  gpsTitle: { color: C.muted, fontSize: 11, marginBottom: 2 },
  gpsVal:   { color: C.text, fontWeight: "600", fontSize: 13 },
  directionsBtn: {
    backgroundColor: C.accent + "22", borderWidth: 1, borderColor: C.accent + "55",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  directionsBtnText: { color: C.accent, fontWeight: "700", fontSize: 12 },

  // Status banner
  statusBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.card, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9, marginBottom: 16,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontWeight: "700", fontSize: 13, flex: 1 },
  statusTime: { color: C.muted, fontSize: 11 },

  // Main card
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 20, marginBottom: 14,
  },
  mainCard: { alignItems: "center", shadowColor: C.accent, shadowOpacity: 0.12, shadowRadius: 24, elevation: 6 },
  cardLabel: { color: C.muted, fontSize: 11, letterSpacing: 1.5, marginBottom: 16 },

  // Ring
  ringWrap:  { alignItems: "center", marginBottom: 20 },
  ringOuter: { width: 150, height: 150, borderRadius: 75, borderWidth: 12, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  ringInner: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, justifyContent: "center", alignItems: "center", backgroundColor: C.bg },
  ringNumber: { fontSize: 36, fontWeight: "900", lineHeight: 40 },
  ringLabel:  { color: C.muted, fontSize: 11 },
  ringTotal:  { color: C.muted, fontSize: 12 },

  // Progress
  progressBg:   { width: "100%", height: 8, backgroundColor: "#1A2F5A", borderRadius: 999, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", borderRadius: 999 },
  progressLabel: { color: C.muted, fontSize: 12 },

  // Stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: "900" },
  statLabel:  { color: C.muted, fontSize: 10, marginTop: 2 },

  // Actions
  sectionTitle: { color: C.muted, fontSize: 11, letterSpacing: 1.5, marginBottom: 10 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  actionBtn:   { width: "47%", borderRadius: 14, paddingVertical: 16, alignItems: "center", gap: 6 },
  actionIcon:  { fontSize: 24 },
  actionText:  { fontWeight: "700", fontSize: 13 },

  // Activity
  activityCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 14, marginBottom: 8, gap: 12,
  },
  activityDot:    { width: 10, height: 10, borderRadius: 5 },
  activityPlate:  { color: C.text, fontWeight: "700", fontSize: 14 },
  activityAction: { color: C.muted, fontSize: 12 },
  activityTime:   { color: C.muted, fontSize: 12 },
});