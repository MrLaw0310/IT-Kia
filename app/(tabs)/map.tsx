import { useState } from "react";
import {
    Alert,
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
  yellow: "#EAB308",
  text:   "#E8F0FF",
  muted:  "#6B7FA8",
};

// ─── Types ────────────────────────────────────────────────────────────
type SpotStatus = "free" | "occupied" | "reserved" | "disabled";

interface ParkingSpot {
  id: string;
  row: string;
  number: number;
  status: SpotStatus;
  plate?: string;       // if occupied
  reservedFor?: string; // if reserved
}

// ─── Mock Data (60 spots, 6 rows × 10 cols) ──────────────────────────
function generateSpots(): ParkingSpot[] {
  const rows = ["A", "B", "C", "D", "E", "F"];
  const statuses: SpotStatus[] = ["free", "occupied", "reserved", "disabled"];
  const plates = ["WXY 1234", "JKL 5678", "ABC 9999", "DEF 3321", "GHI 7700"];

  return rows.flatMap((row, ri) =>
    Array.from({ length: 10 }, (_, ci) => {
      const seed = (ri * 10 + ci) % 7;
      const status: SpotStatus =
        seed === 0 ? "disabled" :
        seed <= 2 ? "occupied" :
        seed === 3 ? "reserved" :
        "free";

      return {
        id: `${row}${ci + 1}`,
        row,
        number: ci + 1,
        status,
        plate: status === "occupied" ? plates[ci % plates.length] : undefined,
        reservedFor: status === "reserved" ? "Staff" : undefined,
      };
    })
  );
}

const ALL_SPOTS = generateSpots();

// ─── Spot colour helpers ──────────────────────────────────────────────
function spotColor(status: SpotStatus) {
  switch (status) {
    case "free":     return C.green;
    case "occupied": return C.red;
    case "reserved": return C.orange;
    case "disabled": return C.muted;
  }
}

// ─── Legend Item ──────────────────────────────────────────────────────
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ─── Spot Detail Modal ────────────────────────────────────────────────
function SpotModal({
  spot,
  onClose,
  onCheckIn,
}: {
  spot: ParkingSpot | null;
  onClose: () => void;
  onCheckIn: (spot: ParkingSpot) => void;
}) {
  if (!spot) return null;
  const color = spotColor(spot.status);

  return (
    <Modal transparent animationType="slide" visible={!!spot} onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          {/* Spot ID */}
          <View style={styles.modalHeader}>
            <View style={[styles.modalSpotBadge, { borderColor: color + "66", backgroundColor: color + "18" }]}>
              <Text style={[styles.modalSpotId, { color }]}>🅿️ {spot.id}</Text>
            </View>
            <View style={[styles.modalStatusBadge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
              <Text style={[styles.modalStatusText, { color }]}>
                {spot.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.modalDetails}>
            <View style={styles.modalRow}>
              <Text style={styles.modalKey}>Row</Text>
              <Text style={styles.modalVal}>Row {spot.row}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalKey}>Spot Number</Text>
              <Text style={styles.modalVal}>#{spot.number}</Text>
            </View>
            {spot.plate && (
              <View style={styles.modalRow}>
                <Text style={styles.modalKey}>Plate No.</Text>
                <Text style={[styles.modalVal, { color: C.red }]}>{spot.plate}</Text>
              </View>
            )}
            {spot.reservedFor && (
              <View style={styles.modalRow}>
                <Text style={styles.modalKey}>Reserved For</Text>
                <Text style={[styles.modalVal, { color: C.orange }]}>{spot.reservedFor}</Text>
              </View>
            )}
          </View>

          {/* Action button */}
          {spot.status === "free" ? (
            <TouchableOpacity
              style={styles.checkInBtn}
              onPress={() => onCheckIn(spot)}
              activeOpacity={0.85}
            >
              <Text style={styles.checkInText}>✅  Check In Here</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.checkInBtn, { backgroundColor: "#1A2F5A" }]}>
              <Text style={[styles.checkInText, { color: C.muted }]}>
                {spot.status === "occupied" ? "🚗  Spot Taken" :
                 spot.status === "reserved" ? "🔒  Reserved" : "⛔  Not Available"}
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
  const [spots, setSpots] = useState<ParkingSpot[]>(ALL_SPOTS);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [filter, setFilter] = useState<SpotStatus | "all">("all");

  const rows = ["A", "B", "C", "D", "E", "F"];

  const counts = {
    free:     spots.filter(s => s.status === "free").length,
    occupied: spots.filter(s => s.status === "occupied").length,
    reserved: spots.filter(s => s.status === "reserved").length,
  };

  function handleCheckIn(spot: ParkingSpot) {
    setSpots(prev =>
      prev.map(s =>
        s.id === spot.id ? { ...s, status: "occupied", plate: "WXY 1234" } : s
      )
    );
    setSelectedSpot(null);
    Alert.alert("✅ Checked In!", `You are now parked at Spot ${spot.id}.`);
  }

  const filterOptions: { key: SpotStatus | "all"; label: string; color: string }[] = [
    { key: "all",      label: "All",      color: C.accent  },
    { key: "free",     label: "Free",     color: C.green   },
    { key: "occupied", label: "Taken",    color: C.red     },
    { key: "reserved", label: "Reserved", color: C.orange  },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Parking Map</Text>
            <Text style={styles.subtitle}>Main Campus Lot · 60 Spots</Text>
          </View>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>IT KIA</Text>
          </View>
        </View>

        {/* ── Mini Stats ── */}
        <View style={styles.statsRow}>
          {[
            { label: "Free",     val: counts.free,     color: C.green  },
            { label: "Occupied", val: counts.occupied,  color: C.red    },
            { label: "Reserved", val: counts.reserved,  color: C.orange },
          ].map(s => (
            <View key={s.label} style={[styles.statChip, { borderColor: s.color + "44" }]}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Filter Pills ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {filterOptions.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterPill,
                filter === f.key
                  ? { backgroundColor: f.color, borderColor: f.color }
                  : { backgroundColor: "transparent", borderColor: C.border },
              ]}
            >
              <Text style={[styles.filterText, filter === f.key ? { color: "#fff" } : { color: C.muted }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Parking Grid ── */}
        <View style={styles.gridCard}>

          {/* Entrance label */}
          <View style={styles.entranceRow}>
            <View style={styles.entranceLine} />
            <Text style={styles.entranceText}>ENTRANCE / EXIT</Text>
            <View style={styles.entranceLine} />
          </View>

          {rows.map((row, rowIndex) => (
            <View key={row}>
              {/* Row label */}
              <Text style={styles.rowLabel}>Row {row}</Text>

              <View style={styles.rowSpots}>
                {spots
                  .filter(s => s.row === row)
                  .map(spot => {
                    const color = spotColor(spot.status);
                    const dimmed = filter !== "all" && spot.status !== filter;
                    return (
                      <TouchableOpacity
                        key={spot.id}
                        onPress={() => setSelectedSpot(spot)}
                        activeOpacity={0.7}
                        style={[
                          styles.spot,
                          {
                            backgroundColor: dimmed ? color + "18" : color + "28",
                            borderColor: dimmed ? color + "22" : color + "88",
                            opacity: dimmed ? 0.4 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.spotId, { color: dimmed ? color + "88" : color }]}>
                          {spot.number}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              {/* Divider road between rows */}
              {rowIndex < rows.length - 1 && rowIndex % 2 === 1 && (
                <View style={styles.roadDivider}>
                  <Text style={styles.roadText}>← LANE →</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* ── Legend ── */}
        <View style={styles.legend}>
          <LegendItem color={C.green}  label="Free" />
          <LegendItem color={C.red}    label="Occupied" />
          <LegendItem color={C.orange} label="Reserved" />
          <LegendItem color={C.muted}  label="Disabled" />
        </View>

        <Text style={styles.hint}>Tap any spot to see details or check in 👆</Text>
      </ScrollView>

      {/* ── Spot Detail Modal ── */}
      <SpotModal
        spot={selectedSpot}
        onClose={() => setSelectedSpot(null)}
        onCheckIn={handleCheckIn}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pageTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: C.muted,
    fontSize: 13,
  },
  logoBadge: {
    backgroundColor: "rgba(30,144,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(30,144,255,0.35)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  logoText: {
    color: C.accent,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 1.5,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statChip: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  statNum: {
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: C.muted,
    fontSize: 11,
    marginTop: 2,
  },

  // Filter
  filterRow: {
    marginBottom: 16,
  },
  filterPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginRight: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Grid
  gridCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  entranceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  entranceLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.accent + "44",
  },
  entranceText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  rowLabel: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: 2,
  },
  rowSpots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  spot: {
    width: 28,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  spotId: {
    fontSize: 9,
    fontWeight: "700",
  },
  roadDivider: {
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 6,
    backgroundColor: "#0A1020",
    borderRadius: 6,
  },
  roadText: {
    color: C.muted,
    fontSize: 9,
    letterSpacing: 2,
  },

  // Legend
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    color: C.muted,
    fontSize: 12,
  },
  hint: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#0D1B38",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalSpotBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalSpotId: {
    fontSize: 20,
    fontWeight: "900",
  },
  modalStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modalStatusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modalDetails: {
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalKey: {
    color: C.muted,
    fontSize: 13,
  },
  modalVal: {
    color: C.text,
    fontWeight: "700",
    fontSize: 13,
  },
  checkInBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  checkInText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  closeBtnText: {
    color: C.muted,
    fontSize: 14,
  },
});