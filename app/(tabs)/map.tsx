import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
  blue:   "#818CF8",
  yellow: "#FBBF24",
  text:   "#E8F0FF",
  muted:  "#6B7FA8",
};

// ─── Mock current user ────────────────────────────────────────────────
const CURRENT_USER = { name: "Ahmad Faiz", plate: "WXY 1234", isOKU: false };

// ─── GPS helpers ──────────────────────────────────────────────────────
const LOT_ORIGIN      = { lat: 1.42945, lng: 103.63628 };
const SPOT_WIDTH_DEG  = 0.000023;
const SPOT_HEIGHT_DEG = 0.000045;
const ROW_GAP_DEG     = 0.000010;

function spotCoords(row: number, col: number) {
  return {
    lat: LOT_ORIGIN.lat - row * (SPOT_HEIGHT_DEG + ROW_GAP_DEG) - SPOT_HEIGHT_DEG / 2,
    lng: LOT_ORIGIN.lng + col * SPOT_WIDTH_DEG + SPOT_WIDTH_DEG / 2,
  };
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R  = 6371000;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Types ────────────────────────────────────────────────────────────
type SpotStatus = "free" | "occupied";
type SpotType   = "normal" | "oku";

interface ParkingSpot {
  id:     string;
  row:    number;
  col:    number;
  status: SpotStatus;
  type:   SpotType;
  plate?: string;
}

// ─── Generate spots ───────────────────────────────────────────────────
const PLATES = ["WXY 1234", "JHB 5678", "ABC 9012", "DEF 3456", "GHI 7890", "JKL 2345"];

function generateSpots(): ParkingSpot[] {
  const spots: ParkingSpot[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 10; col++) {
      const seed  = row * 10 + col;
      const isOKU = row === 0 && col < 2;
      const occ   = (seed * 7 + seed % 3) % 10 < 6;
      spots.push({
        id:     isOKU ? `OKU-${col + 1}` : `R${row + 1}-${col + 1}`,
        row,    col,
        type:   isOKU ? "oku" : "normal",
        status: occ ? "occupied" : "free",
        plate:  occ ? PLATES[seed % PLATES.length] : undefined,
      });
    }
  }
  return spots;
}

const ALL_SPOTS = generateSpots();

function spotColor(spot: ParkingSpot, isMySpot = false) {
  if (isMySpot)            return C.yellow;
  if (spot.type === "oku") return spot.status === "free" ? C.blue : C.muted;
  return spot.status === "free" ? C.green : C.red;
}

// ─── OKU Warning Modal ────────────────────────────────────────────────
function OKUWarningModal({ visible, onClose, onProceed }: {
  visible: boolean; onClose: () => void; onProceed: () => void;
}) {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.warningOverlay}>
        <Animated.View style={[styles.warningBox, { transform: [{ translateX: shakeAnim }] }]}>
          <View style={styles.warningIconCircle}>
            <Text style={{ fontSize: 38 }}>⚠️</Text>
          </View>
          <Text style={styles.warningTitle}>OKU Spot Warning</Text>
          <Text style={styles.warningBody}>
            This spot is reserved for{" "}
            <Text style={{ color: C.blue, fontWeight: "800" }}>registered OKU students</Text> only.{"\n\n"}
            Your account{" "}
            <Text style={{ color: C.red, fontWeight: "800" }}>({CURRENT_USER.plate})</Text>{" "}
            does not have OKU parking rights.{"\n\n"}
            Parking here without authorisation may result in a{" "}
            <Text style={{ color: C.red, fontWeight: "800" }}>penalty or towing.</Text>
          </Text>
          <TouchableOpacity style={styles.warningCloseBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.warningCloseBtnText}>✅  Find Another Spot</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onProceed} style={styles.warningOverrideBtn}>
            <Text style={styles.warningOverrideText}>I have OKU status (not yet updated)</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Spot Detail Modal ────────────────────────────────────────────────
function SpotModal({ spot, mySpotId, onClose, onCheckIn }: {
  spot: ParkingSpot | null; mySpotId: string | null;
  onClose: () => void; onCheckIn: (s: ParkingSpot) => void;
}) {
  if (!spot) return null;
  const isMySpot   = spot.id === mySpotId;
  const color      = spotColor(spot, isMySpot);
  const isOKU      = spot.type === "oku";
  const canCheckIn = spot.status === "free";

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.modalHeader}>
            <View style={[styles.spotBadge, { borderColor: color + "66", backgroundColor: color + "18" }]}>
              <Text style={[styles.spotBadgeText, { color }]}>
                {isMySpot ? "📍" : isOKU ? "♿" : "🅿️"}  {spot.id}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
              <Text style={[styles.statusPillText, { color }]}>
                {isMySpot ? "YOU ARE HERE" : isOKU ? "OKU" : spot.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.detailBox}>
            {([
              ["Row",    `Row ${spot.row + 1}`],
              ["Spot",   `#${spot.col + 1}`],
              ["Type",   isOKU ? "♿ OKU Reserved" : "Student Parking"],
              ["Status", spot.status === "free" ? "✅ Available" : "🔴 Occupied"],
              ...(spot.plate  ? [["Plate", spot.plate]]             as [string,string][] : []),
              ...(isMySpot    ? [["GPS",   "📍 Your location"]]     as [string,string][] : []),
            ] as [string,string][]).map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={styles.detailKey}>{k}</Text>
                <Text style={[styles.detailVal, isMySpot && k === "GPS" ? { color: C.yellow } : {}]}>{v}</Text>
              </View>
            ))}
          </View>

          {isOKU && (
            <View style={styles.okuNote}>
              <Text style={styles.okuNoteText}>♿  Reserved for registered OKU students only.</Text>
            </View>
          )}

          {canCheckIn ? (
            <TouchableOpacity
              style={[styles.checkInBtn, { backgroundColor: isOKU ? C.blue : C.accent }]}
              onPress={() => onCheckIn(spot)} activeOpacity={0.85}
            >
              <Text style={styles.checkInText}>{isOKU ? "♿  Check In (OKU)" : "✅  Check In Here"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.checkInBtn, { backgroundColor: "#1A2F5A" }]}>
              <Text style={[styles.checkInText, { color: C.muted }]}>
                {isMySpot ? "📍  This is your current spot" : "🔴  Spot Already Taken"}
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────
export default function MapScreen() {
  const [spots,       setSpots]       = useState<ParkingSpot[]>(ALL_SPOTS);
  const [selected,    setSelected]    = useState<ParkingSpot | null>(null);
  const [filter,      setFilter]      = useState<"all" | "free" | "occupied">("all");
  const [mySpotId,    setMySpotId]    = useState<string | null>(null);
  const [gpsStatus,   setGpsStatus]   = useState<"idle" | "scanning" | "found" | "outside">("idle");
  const [okuWarning,  setOkuWarning]  = useState(false);
  const [pendingSpot, setPendingSpot] = useState<ParkingSpot | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mySpotId) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [mySpotId]);

  async function handleFindMySpot() {
    setGpsStatus("scanning");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location Required", "Please allow location access to detect your parking spot.");
      setGpsStatus("idle");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude } = loc.coords;

    let closest: ParkingSpot | null = null;
    let minDist = Infinity;
    for (const spot of spots) {
      const c    = spotCoords(spot.row, spot.col);
      const dist = distanceM(latitude, longitude, c.lat, c.lng);
      if (dist < minDist) { minDist = dist; closest = spot; }
    }

    if (closest && minDist < 4) {
      setMySpotId(closest.id);
      setGpsStatus("found");
      setSelected(closest);
    } else {
      setGpsStatus("outside");
      Alert.alert("📍 Not in Parking Lot",
        `You don't appear to be in the MDIS parking lot.\n(Nearest spot: ${Math.round(minDist)}m away)`);
      setTimeout(() => setGpsStatus("idle"), 3000);
    }
  }

  function handleCheckIn(spot: ParkingSpot) {
    setSelected(null);
    if (spot.type === "oku" && !CURRENT_USER.isOKU) {
      setPendingSpot(spot);
      setOkuWarning(true);
      return;
    }
    confirmCheckIn(spot);
  }

  function confirmCheckIn(spot: ParkingSpot) {
    setSpots(prev => prev.map(s =>
      s.id === spot.id ? { ...s, status: "occupied", plate: CURRENT_USER.plate } : s
    ));
    setMySpotId(spot.id);
    setGpsStatus("found");
    Alert.alert("✅ Checked In!", `You are now parked at Spot ${spot.id}.`);
  }

  function getSpot(row: number, col: number) {
    return spots.find(s => s.row === row && s.col === col) ?? null;
  }

  function isDimmed(spot: ParkingSpot) {
    if (spot.id === mySpotId) return false;
    if (filter === "free")     return spot.status !== "free";
    if (filter === "occupied") return spot.status !== "occupied";
    return false;
  }

  const freeCount = spots.filter(s => s.status === "free"     && s.type === "normal").length;
  const occCount  = spots.filter(s => s.status === "occupied" && s.type === "normal").length;
  const okuFree   = spots.filter(s => s.type === "oku" && s.status === "free").length;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Parking Map</Text>
            <Text style={styles.subtitle}>MDIS Educity · Student Lot</Text>
          </View>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>MDIS</Text>
          </View>
        </View>

        {/* ── GPS Button ── */}
        <TouchableOpacity
          style={[
            styles.gpsBtn,
            gpsStatus === "scanning" && { borderColor: C.orange + "55", backgroundColor: C.orange + "12" },
            gpsStatus === "found"    && { borderColor: C.green  + "55", backgroundColor: C.green  + "12" },
            gpsStatus === "outside"  && { borderColor: C.red    + "55", backgroundColor: C.red    + "12" },
          ]}
          onPress={handleFindMySpot}
          activeOpacity={0.8}
          disabled={gpsStatus === "scanning"}
        >
          <Text style={styles.gpsBtnIcon}>
            {gpsStatus === "scanning" ? "🔄" : gpsStatus === "found" ? "📍" : gpsStatus === "outside" ? "❌" : "📍"}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.gpsBtnTitle, {
              color: gpsStatus === "found"    ? C.green  :
                     gpsStatus === "outside"  ? C.red    :
                     gpsStatus === "scanning" ? C.orange : C.accent,
            }]}>
              {gpsStatus === "scanning" ? "Scanning GPS..." :
               gpsStatus === "found"    ? `Found! You're at ${mySpotId}` :
               gpsStatus === "outside"  ? "Not in parking lot" :
               "Find My Parking Spot"}
            </Text>
            <Text style={styles.gpsBtnSub}>
              {gpsStatus === "found"
                ? "Your spot is highlighted in yellow ✨"
                : "Tap to detect which spot you're parked at"}
            </Text>
          </View>
          {mySpotId && (
            <TouchableOpacity onPress={() => { setMySpotId(null); setGpsStatus("idle"); }} style={styles.gpsClearBtn}>
              <Text style={styles.gpsClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          {[
            { label: "Free",     val: freeCount,      color: C.green  },
            { label: "Occupied", val: occCount,        color: C.red    },
            { label: "OKU Free", val: `${okuFree}/2`, color: C.blue   },
            { label: "Total",    val: 70,              color: C.accent },
          ].map(s => (
            <View key={s.label} style={[styles.statChip, { borderColor: s.color + "44" }]}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Filter Pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[
            { key: "all",      label: "All Spots", color: C.accent },
            { key: "free",     label: "Free",      color: C.green  },
            { key: "occupied", label: "Occupied",  color: C.red    },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key as any)}
              style={[
                styles.filterPill,
                filter === f.key
                  ? { backgroundColor: f.color, borderColor: f.color }
                  : { backgroundColor: "transparent", borderColor: C.border },
              ]}
            >
              <Text style={[styles.filterText, { color: filter === f.key ? "#fff" : C.muted }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ══ PARKING GRID ══════════════════════════════════════════════ */}
        <View style={styles.gridCard}>

          {/* Top row: label left + EXIT arrow right */}
          <View style={styles.topRow}>
            <Text style={styles.gridTitle}>🅿️ MDIS Student Parking</Text>
            <View style={styles.exitBadge}>
              <Text style={styles.exitText}>EXIT ↗</Text>
            </View>
          </View>

          {/* Spot rows */}
          {Array.from({ length: 7 }, (_, row) => (
            <View key={row} style={styles.rowWrap}>
              {/* Row label */}
              <Text style={styles.rowLabel}>R{row + 1}</Text>

              {/* Spots */}
              <View style={styles.rowSpots}>
                {Array.from({ length: 10 }, (_, col) => {
                  const spot    = getSpot(row, col);
                  if (!spot) return null;
                  const isMySpot = spot.id === mySpotId;
                  const color    = spotColor(spot, isMySpot);
                  const dim      = isDimmed(spot);
                  const isOKU    = spot.type === "oku";

                  if (isMySpot) {
                    return (
                      <TouchableOpacity key={spot.id} onPress={() => setSelected(spot)} activeOpacity={0.7}>
                        <Animated.View style={[
                          styles.spot,
                          {
                            backgroundColor: C.yellow + "35",
                            borderColor:     C.yellow,
                            borderWidth:     2,
                            transform:       [{ scale: pulseAnim }],
                          },
                        ]}>
                          <Text style={{ fontSize: 11 }}>📍</Text>
                        </Animated.View>
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={spot.id}
                      onPress={() => setSelected(spot)}
                      activeOpacity={0.7}
                      style={[
                        styles.spot,
                        isOKU && styles.okuSpot,
                        {
                          backgroundColor: dim ? color + "0D" : color + "28",
                          borderColor:     dim ? color + "25" : color + "99",
                          opacity:         dim ? 0.3 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.spotText, { color: dim ? color + "60" : color }]}>
                        {isOKU ? "♿" : col + 1}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Bottom row: ENTRANCE arrow right */}
          <View style={styles.bottomRow}>
            <View style={styles.entranceBadge}>
              <Text style={styles.entranceText}>ENTRANCE ↘</Text>
            </View>
          </View>
        </View>

        {/* ── Legend ── */}
        <View style={styles.legend}>
          {[
            [C.green,  "Free"],
            [C.red,    "Occupied"],
            [C.blue,   "OKU"],
            [C.yellow, "My Spot"],
          ].map(([color, label]) => (
            <View key={label as string} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color as string }]} />
              <Text style={styles.legendLabel}>{label as string}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>Tap any spot to view details or check in 👆</Text>
      </ScrollView>

      {/* ── Modals ── */}
      <SpotModal
        spot={selected}
        mySpotId={mySpotId}
        onClose={() => setSelected(null)}
        onCheckIn={handleCheckIn}
      />

      <OKUWarningModal
        visible={okuWarning}
        onClose={() => { setOkuWarning(false); setPendingSpot(null); }}
        onProceed={() => {
          setOkuWarning(false);
          if (pendingSpot) confirmCheckIn(pendingSpot);
          setPendingSpot(null);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { color: C.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle:  { color: C.muted, fontSize: 13 },
  logoBadge: {
    backgroundColor: "rgba(30,144,255,0.12)", borderWidth: 1,
    borderColor: "rgba(30,144,255,0.35)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  logoText: { color: C.accent, fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },

  // GPS button
  gpsBtn: {
    backgroundColor: C.accent + "12", borderWidth: 1, borderColor: C.accent + "55",
    borderRadius: 16, padding: 14, marginBottom: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  gpsBtnIcon:  { fontSize: 26 },
  gpsBtnTitle: { fontSize: 14, fontWeight: "800" },
  gpsBtnSub:   { color: C.muted, fontSize: 11, marginTop: 2 },
  gpsClearBtn: { padding: 6 },
  gpsClearText:{ color: C.muted, fontSize: 16 },

  // Stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statChip: {
    flex: 1, backgroundColor: C.card, borderWidth: 1,
    borderRadius: 12, paddingVertical: 10, alignItems: "center",
  },
  statNum:   { fontSize: 18, fontWeight: "900" },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 2 },

  // Filter
  filterRow: { marginBottom: 14 },
  filterPill: {
    borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 7, marginRight: 8,
  },
  filterText: { fontSize: 13, fontWeight: "600" },

  // Grid card
  gridCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 16, marginBottom: 16,
  },

  // Top row: title + exit
  topRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  gridTitle: { color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  exitBadge: {
    backgroundColor: C.green + "20", borderWidth: 1, borderColor: C.green + "55",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  exitText: { color: C.green, fontWeight: "800", fontSize: 12 },

  // Spot rows
  rowWrap:  { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  rowLabel: { color: C.muted, fontSize: 10, width: 22, fontWeight: "600" },
  rowSpots: { flexDirection: "row", gap: 5, flex: 1 },

  spot: {
    flex: 1,
    aspectRatio: 0.7,       // taller than wide — like a real parking spot
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  okuSpot:  { borderWidth: 2 },
  spotText: { fontSize: 9, fontWeight: "800" },

  // Bottom row: entrance
  bottomRow: {
    flexDirection: "row", justifyContent: "flex-end",
    marginTop: 10,
  },
  entranceBadge: {
    backgroundColor: C.red + "20", borderWidth: 1, borderColor: C.red + "55",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  entranceText: { color: C.red, fontWeight: "800", fontSize: 12 },

  // Legend
  legend: { flexDirection: "row", justifyContent: "center", gap: 18, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { color: C.muted, fontSize: 12 },
  hint: { color: C.muted, fontSize: 12, textAlign: "center" },

  // Spot Modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0D1B38", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderTopWidth: 1, borderColor: C.border,
  },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  spotBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  spotBadgeText: { fontSize: 18, fontWeight: "900" },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  detailBox: { backgroundColor: C.bg, borderRadius: 14, padding: 14, marginBottom: 14, gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailKey: { color: C.muted, fontSize: 13 },
  detailVal: { color: C.text, fontWeight: "700", fontSize: 13 },
  okuNote: {
    backgroundColor: C.blue + "15", borderWidth: 1, borderColor: C.blue + "44",
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  okuNoteText: { color: C.blue, fontSize: 12, fontWeight: "600" },
  checkInBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginBottom: 10,
  },
  checkInText: { color: "white", fontWeight: "800", fontSize: 15 },
  closeBtn: { alignItems: "center", paddingVertical: 8 },
  closeBtnText: { color: C.muted, fontSize: 14 },

  // OKU Warning Modal
  warningOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  warningBox: {
    backgroundColor: "#0D1B38", borderRadius: 24,
    padding: 28, width: "100%",
    borderWidth: 1, borderColor: C.red + "55",
    alignItems: "center",
  },
  warningIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.red + "20", borderWidth: 2, borderColor: C.red + "55",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  warningTitle: { color: C.red, fontSize: 20, fontWeight: "900", marginBottom: 14 },
  warningBody: { color: C.muted, fontSize: 13, lineHeight: 22, textAlign: "center", marginBottom: 24 },
  warningCloseBtn: {
    backgroundColor: C.green, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
    alignItems: "center", width: "100%", marginBottom: 10,
  },
  warningCloseBtnText: { color: "white", fontWeight: "800", fontSize: 15 },
  warningOverrideBtn:  { paddingVertical: 8 },
  warningOverrideText: { color: C.muted, fontSize: 12 },
});