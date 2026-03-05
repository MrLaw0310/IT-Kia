import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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

const MAX_VEHICLES = 4;
const ANNUAL_FEE   = 10;

interface Vehicle {
  id:      string;
  plate:   string;
  model:   string;
  isPaid:  boolean;
  isOKU:   boolean;
}

const STUDENT = {
  name:   "Ahmad Faiz",
  id:     "22CS10042",
  course: "Diploma in Computer Science",
  year:   "Year 2",
  email:  "ahmdfaiz@student.mdis.edu.my",
  phone:  "+60 12-345 6789",
  isOKU:  false,
};

// ─── Avatar Picker Modal ──────────────────────────────────────────────
function AvatarModal({
  visible,
  onClose,
  onCamera,
  onGallery,
  onRemove,
  hasPhoto,
}: {
  visible:   boolean;
  onClose:   () => void;
  onCamera:  () => void;
  onGallery: () => void;
  onRemove:  () => void;
  hasPhoto:  boolean;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Change Profile Photo</Text>
          <Text style={styles.sheetSub}>Choose how you'd like to update your photo</Text>

          {/* Camera option */}
          <TouchableOpacity style={styles.avatarOption} onPress={onCamera} activeOpacity={0.8}>
            <View style={[styles.avatarOptionIcon, { backgroundColor: C.accent + "20" }]}>
              <Text style={{ fontSize: 24 }}>📷</Text>
            </View>
            <View>
              <Text style={styles.avatarOptionTitle}>Take Photo</Text>
              <Text style={styles.avatarOptionSub}>Use your camera</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Gallery option */}
          <TouchableOpacity style={styles.avatarOption} onPress={onGallery} activeOpacity={0.8}>
            <View style={[styles.avatarOptionIcon, { backgroundColor: C.green + "20" }]}>
              <Text style={{ fontSize: 24 }}>🖼️</Text>
            </View>
            <View>
              <Text style={styles.avatarOptionTitle}>Choose from Gallery</Text>
              <Text style={styles.avatarOptionSub}>Pick an existing photo</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* Remove option — only show if photo exists */}
          {hasPhoto && (
            <>
              <View style={styles.rowDivider} />
              <TouchableOpacity style={styles.avatarOption} onPress={onRemove} activeOpacity={0.8}>
                <View style={[styles.avatarOptionIcon, { backgroundColor: C.red + "20" }]}>
                  <Text style={{ fontSize: 24 }}>🗑️</Text>
                </View>
                <View>
                  <Text style={[styles.avatarOptionTitle, { color: C.red }]}>Remove Photo</Text>
                  <Text style={styles.avatarOptionSub}>Go back to default avatar</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Vehicle Modal ────────────────────────────────────────────────────
function VehicleModal({
  visible, vehicle, onSave, onClose,
}: {
  visible:  boolean;
  vehicle?: Vehicle;
  onSave:   (plate: string, model: string, isOKU: boolean) => void;
  onClose:  () => void;
}) {
  const [plate, setPlate] = useState(vehicle?.plate ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [isOKU, setIsOKU] = useState(vehicle?.isOKU ?? false);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</Text>
          <Text style={styles.sheetSub}>Annual fee: RM{ANNUAL_FEE} per vehicle</Text>

          <Text style={styles.inputLabel}>Plate Number</Text>
          <TextInput
            style={styles.input}
            value={plate}
            onChangeText={setPlate}
            placeholder="e.g. WXY 1234"
            placeholderTextColor={C.muted}
            autoCapitalize="characters"
          />

          <Text style={styles.inputLabel}>Vehicle Model</Text>
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder="e.g. Honda Civic (White)"
            placeholderTextColor={C.muted}
          />

          <View style={styles.okuRow}>
            <View>
              <Text style={styles.okuLabel}>OKU Registered Vehicle</Text>
              <Text style={styles.okuSub}>Enables access to OKU parking spots</Text>
            </View>
            <Switch
              value={isOKU}
              onValueChange={setIsOKU}
              trackColor={{ false: C.border, true: C.orange + "80" }}
              thumbColor={isOKU ? C.orange : C.muted}
            />
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => { onSave(plate, model, isOKU); onClose(); }}
          >
            <Text style={styles.saveBtnText}>
              {vehicle ? "Save Changes" : `Register & Pay RM${ANNUAL_FEE}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Vehicle Card ─────────────────────────────────────────────────────
function VehicleCard({ vehicle, onEdit, onRemove }: {
  vehicle: Vehicle; onEdit: () => void; onRemove: () => void;
}) {
  return (
    <View style={styles.vehicleCard}>
      <View style={styles.vehicleLeft}>
        <Text style={styles.vehicleEmoji}>{vehicle.isOKU ? "♿" : "🚗"}</Text>
        <View>
          <View style={styles.vehiclePlateRow}>
            <Text style={styles.plateText}>{vehicle.plate}</Text>
            {vehicle.isOKU && (
              <View style={styles.okuBadge}>
                <Text style={styles.okuBadgeText}>OKU</Text>
              </View>
            )}
          </View>
          <Text style={styles.vehicleModel}>{vehicle.model}</Text>
          <View style={[styles.paidBadge, {
            backgroundColor: vehicle.isPaid ? C.green + "18" : C.red + "18",
            borderColor: vehicle.isPaid ? C.green + "44" : C.red + "44",
          }]}>
            <Text style={[styles.paidBadgeText, { color: vehicle.isPaid ? C.green : C.red }]}>
              {vehicle.isPaid ? "✅ Annual Fee Paid" : "⚠️ Fee Unpaid"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.vehicleActions}>
        <TouchableOpacity onPress={onEdit}><Text style={styles.vActionEdit}>Edit</Text></TouchableOpacity>
        <TouchableOpacity onPress={onRemove}><Text style={styles.vActionRemove}>Remove</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Setting Row ──────────────────────────────────────────────────────
function SettingRow({ icon, label, sub, onPress, right }: {
  icon: string; label: string; sub?: string;
  onPress?: () => void; right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={styles.settingRow}>
      <View style={styles.settingIcon}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub && <Text style={styles.settingSub}>{sub}</Text>}
      </View>
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────
export default function ProfileScreen() {
  const [avatarUri,    setAvatarUri]    = useState<string | null>(null);
  const [avatarModal,  setAvatarModal]  = useState(false);
  const [vehicles,     setVehicles]     = useState<Vehicle[]>([
    { id: "1", plate: "WXY 1234", model: "Honda Civic (White)",  isPaid: true,  isOKU: false },
    { id: "2", plate: "JHB 5678", model: "Toyota Vios (Silver)", isPaid: true,  isOKU: false },
  ]);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [editTarget,   setEditTarget]   = useState<Vehicle | undefined>(undefined);
  const [notifP,       setNotifP]       = useState(true);
  const [notifO,       setNotifO]       = useState(true);

  // ── Avatar: open camera ────────────────────────────────────────────
  async function handleCamera() {
    setAvatarModal(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission Needed", "Please allow camera access in Settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect:        [1, 1],   // square crop for avatar
      quality:       0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  // ── Avatar: open gallery ───────────────────────────────────────────
  async function handleGallery() {
    setAvatarModal(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Gallery Permission Needed", "Please allow photo library access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  // ── Avatar: remove ─────────────────────────────────────────────────
  function handleRemoveAvatar() {
    setAvatarModal(false);
    Alert.alert("Remove Photo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setAvatarUri(null) },
    ]);
  }

  // ── Vehicle management ─────────────────────────────────────────────
  function addVehicle(plate: string, model: string, isOKU: boolean) {
    if (vehicles.length >= MAX_VEHICLES) {
      Alert.alert("Limit Reached", `Max ${MAX_VEHICLES} vehicles allowed.`);
      return;
    }
    setVehicles(prev => [...prev, { id: Date.now().toString(), plate, model, isPaid: false, isOKU }]);
    Alert.alert("✅ Registered", `${plate} added. Please pay RM${ANNUAL_FEE} at admin office.`);
  }

  function editVehicle(plate: string, model: string, isOKU: boolean) {
    if (!editTarget) return;
    setVehicles(prev => prev.map(v =>
      v.id === editTarget.id ? { ...v, plate, model, isOKU } : v
    ));
  }

  function removeVehicle(id: string) {
    Alert.alert("Remove Vehicle", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () =>
          setVehicles(prev => prev.filter(v => v.id !== id)) },
    ]);
  }

  function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => {} },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Profile</Text>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>MDIS</Text>
          </View>
        </View>

        {/* ── Avatar Card ── */}
        <View style={styles.avatarCard}>

          {/* Avatar with camera button */}
          <TouchableOpacity onPress={() => setAvatarModal(true)} activeOpacity={0.85} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>👨‍🎓</Text>
              </View>
            )}
            {/* Camera badge overlay */}
            <View style={styles.cameraBadge}>
              <Text style={styles.cameraBadgeIcon}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.changePhotoHint}>Tap to change photo</Text>

          <Text style={styles.studentName}>{STUDENT.name}</Text>
          <Text style={styles.studentCourse}>{STUDENT.course} · {STUDENT.year}</Text>

          <View style={styles.idBadge}>
            <Text style={styles.idText}>ID: {STUDENT.id}</Text>
          </View>

          {STUDENT.isOKU && (
            <View style={styles.okuStudentBadge}>
              <Text style={styles.okuStudentText}>♿ OKU Registered Student</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📧</Text>
              <Text style={styles.infoVal}>{STUDENT.email}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📱</Text>
              <Text style={styles.infoVal}>{STUDENT.phone}</Text>
            </View>
          </View>
        </View>

        {/* ── My Vehicles ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MY VEHICLES</Text>
          <Text style={styles.sectionSub}>{vehicles.length}/{MAX_VEHICLES} · RM{ANNUAL_FEE}/vehicle/year</Text>
        </View>

        {vehicles.map(v => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            onEdit={() => { setEditTarget(v); setVehicleModal(true); }}
            onRemove={() => removeVehicle(v.id)}
          />
        ))}

        {vehicles.length < MAX_VEHICLES && (
          <TouchableOpacity
            style={styles.addVehicleBtn}
            onPress={() => { setEditTarget(undefined); setVehicleModal(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.addVehicleText}>＋  Add Vehicle  (RM{ANNUAL_FEE}/year)</Text>
          </TouchableOpacity>
        )}

        {/* ── Notifications ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>NOTIFICATIONS</Text>
        <View style={styles.settingCard}>
          <SettingRow
            icon="🔔" label="Parking Reminders"
            sub="Notify when session is unusually long"
            right={
              <Switch value={notifP} onValueChange={setNotifP}
                trackColor={{ false: C.border, true: C.accent + "80" }}
                thumbColor={notifP ? C.accent : C.muted} />
            }
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="⚠️" label="Overstay Alerts"
            sub="Warn me before overstay is flagged"
            right={
              <Switch value={notifO} onValueChange={setNotifO}
                trackColor={{ false: C.border, true: C.accent + "80" }}
                thumbColor={notifO ? C.accent : C.muted} />
            }
          />
        </View>

        {/* ── Account ── */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>ACCOUNT</Text>
        <View style={styles.settingCard}>
          <SettingRow icon="🔒" label="Change Password"
            onPress={() => Alert.alert("Change Password", "Feature coming soon.")} />
          <View style={styles.rowDivider} />
          <SettingRow icon="📷" label="Camera Permission"
            sub="Used for profile photo & plate scanning"
            onPress={() => Alert.alert("Camera", "Go to Settings → Apps → MDIS Parking → Permissions.")} />
          <View style={styles.rowDivider} />
          <SettingRow icon="📍" label="Location Permission"
            sub="Used for GPS parking detection"
            onPress={() => Alert.alert("Location", "Go to Settings → Apps → MDIS Parking → Permissions.")} />
          <View style={styles.rowDivider} />
          <SettingRow icon="📞" label="Support"
            sub="parking@mdis.edu.my"
            onPress={() => Alert.alert("Support", "Email: parking@mdis.edu.my")} />
        </View>

        {/* ── App Info ── */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>APP</Text>
        <View style={styles.settingCard}>
          <SettingRow icon="ℹ️" label="Version" sub="1.0.0 (Beta)" />
          <View style={styles.rowDivider} />
          <SettingRow icon="⭐" label="Rate This App"
            onPress={() => Alert.alert("Rate Us", "Thank you!")} />
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>🚪  Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>MDIS Campus Parking · Student Edition</Text>
      </ScrollView>

      {/* ── Avatar Modal ── */}
      <AvatarModal
        visible={avatarModal}
        hasPhoto={!!avatarUri}
        onClose={() => setAvatarModal(false)}
        onCamera={handleCamera}
        onGallery={handleGallery}
        onRemove={handleRemoveAvatar}
      />

      {/* ── Vehicle Modal ── */}
      <VehicleModal
        visible={vehicleModal}
        vehicle={editTarget}
        onSave={editTarget ? editVehicle : addVehicle}
        onClose={() => setVehicleModal(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  pageTitle: { color: C.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  logoBadge: {
    backgroundColor: "rgba(30,144,255,0.12)", borderWidth: 1,
    borderColor: "rgba(30,144,255,0.35)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  logoText: { color: C.accent, fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },

  // Avatar
  avatarCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 20,
  },
  avatarWrap: { position: "relative", marginBottom: 6 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(30,144,255,0.15)",
    borderWidth: 2, borderColor: C.accent + "55",
    justifyContent: "center", alignItems: "center",
  },
  avatarImage: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2, borderColor: C.accent + "55",
  },
  avatarEmoji: { fontSize: 40 },
  cameraBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.accent,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: C.bg,
  },
  cameraBadgeIcon: { fontSize: 13 },
  changePhotoHint: { color: C.accent, fontSize: 12, fontWeight: "600", marginBottom: 12 },

  studentName:   { color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  studentCourse: { color: C.muted, fontSize: 13, marginBottom: 12 },
  idBadge: {
    backgroundColor: C.accent + "18", borderWidth: 1, borderColor: C.accent + "44",
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10,
  },
  idText: { color: C.accent, fontWeight: "700", fontSize: 12, letterSpacing: 0.5 },
  okuStudentBadge: {
    backgroundColor: C.orange + "18", borderWidth: 1, borderColor: C.orange + "44",
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10,
  },
  okuStudentText: { color: C.orange, fontWeight: "700", fontSize: 12 },
  infoRow: { flexDirection: "row", width: "100%", backgroundColor: C.bg, borderRadius: 12, padding: 12 },
  infoItem: { flex: 1, alignItems: "center", gap: 4 },
  infoIcon: { fontSize: 16 },
  infoVal:  { color: C.muted, fontSize: 11, textAlign: "center" },
  infoDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 8 },

  // Vehicles
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
  sectionTitle:  { color: C.muted, fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  sectionSub:    { color: C.muted, fontSize: 11 },

  vehicleCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 14, marginBottom: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  vehicleLeft:     { flexDirection: "row", gap: 12, flex: 1 },
  vehicleEmoji:    { fontSize: 28, marginTop: 2 },
  vehiclePlateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  plateText:       { color: C.text, fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  okuBadge: {
    backgroundColor: C.orange + "22", borderWidth: 1, borderColor: C.orange + "55",
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  okuBadgeText:  { color: C.orange, fontSize: 10, fontWeight: "800" },
  vehicleModel:  { color: C.muted, fontSize: 12, marginBottom: 6 },
  paidBadge:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  paidBadgeText: { fontSize: 11, fontWeight: "700" },
  vehicleActions:  { gap: 8 },
  vActionEdit:     { color: C.accent, fontWeight: "700", fontSize: 12 },
  vActionRemove:   { color: C.red,    fontWeight: "700", fontSize: 12 },

  addVehicleBtn: {
    borderWidth: 1.5, borderColor: C.accent + "55", borderStyle: "dashed",
    borderRadius: 16, paddingVertical: 14, alignItems: "center", marginBottom: 4,
  },
  addVehicleText: { color: C.accent, fontWeight: "700", fontSize: 14 },

  // Settings
  settingCard: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, overflow: "hidden", marginBottom: 16,
  },
  settingRow:  { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  settingIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "rgba(30,144,255,0.1)",
    justifyContent: "center", alignItems: "center",
  },
  settingLabel: { color: C.text, fontSize: 14, fontWeight: "600" },
  settingSub:   { color: C.muted, fontSize: 11, marginTop: 2 },
  chevron:      { color: C.muted, fontSize: 22, lineHeight: 24 },
  rowDivider:   { height: 1, backgroundColor: C.border, marginLeft: 64 },

  logoutBtn: {
    backgroundColor: C.red + "18", borderWidth: 1, borderColor: C.red + "44",
    borderRadius: 16, paddingVertical: 15, alignItems: "center", marginBottom: 20,
  },
  logoutText: { color: C.red, fontWeight: "800", fontSize: 15 },
  footer: { color: C.muted, fontSize: 11, textAlign: "center" },

  // Modals
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0D1B38", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderTopWidth: 1, borderColor: C.border,
  },
  handle:    { width: 40, height: 4, backgroundColor: C.border, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  sheetSub:   { color: C.muted, fontSize: 13, marginBottom: 20 },

  // Avatar modal options
  avatarOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  avatarOptionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  avatarOptionTitle: { color: C.text, fontWeight: "700", fontSize: 15 },
  avatarOptionSub:   { color: C.muted, fontSize: 12, marginTop: 2 },

  // Vehicle modal inputs
  inputLabel: { color: C.muted, fontSize: 12, letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 13, color: C.text, fontSize: 15, marginBottom: 14,
  },
  okuRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: C.bg, borderRadius: 12, padding: 14, marginBottom: 20,
  },
  okuLabel: { color: C.text, fontWeight: "600", fontSize: 14 },
  okuSub:   { color: C.muted, fontSize: 12, marginTop: 2 },
  saveBtn:  { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  saveBtnText:   { color: "white", fontWeight: "800", fontSize: 15 },
  cancelBtn:     { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { color: C.muted, fontSize: 14 },
});