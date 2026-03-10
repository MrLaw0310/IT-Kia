// ─────────────────────────────────────────────────────────────────────────────
// app/(tabs)/profile.tsx  —  用户资料与设置页
// User Profile & Settings Screen
//
// 功能 / Features:
//   1. 学生资料卡（头像、姓名、课程、学号、邮箱、电话）
//      Student info card (avatar, name, course, ID, email, phone)
//   2. 头像管理（拍照 / 相册 / 删除）— expo-image-picker
//      Avatar management (camera / gallery / remove) via expo-image-picker
//   3. 主题选择器（5 套主题，写入 ThemeContext）
//      Theme picker (5 themes, saved to ThemeContext)
//   4. 车辆管理（最多 4 辆，含 OKU 标记，写入 ParkingContext）
//      Vehicle management (max 4, OKU flag, saved to ParkingContext)
//   5. 通知开关（Parking Reminders / Overstay Alerts）
//      Notification toggles (Parking Reminders / Overstay Alerts)
//   6. 账号设置（修改密码、权限、支持、版本、登出）
//      Account settings (password, permissions, support, version, logout)
//
// IMPORTS (引入):
//   expo-image-picker        → camera + gallery for avatar (头像拍照和相册选择)
//   React hooks              → useState
//   React Native components  → Alert, Image, Modal, ScrollView, StyleSheet,Switch, Text, TextInput, TouchableOpacity, View
//   useParkingContext        → vehicles, setVehicles (共享车辆数据，跨页同步)
//   Vehicle                  → vehicle type definition (车辆类型定义)
//   Theme                    → full theme object type (主题对象类型)
//   ThemeKey, THEMES         → theme identifiers and theme list (主题键和主题列表)
//   useTheme                 → current theme + setter (当前主题颜色和切换方法)
//
// EXPORTS (导出):
//   default ProfileScreen    → the profile screen component (资料页，默认导出)
// ─────────────────────────────────────────────────────────────────────────────

import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert, Image, Modal, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View
} from "react-native";
import { useParkingContext, Vehicle } from "../../utils/ParkingContext";
import { Theme, ThemeKey, THEMES, useTheme } from "../../utils/ThemeContext";

// ─── Constants (常量) ─────────────────────────────────────────────────────────
const MAX_VEHICLES = 4;   // Maximum vehicles per student account (每个学生账号最多注册车辆数)
const ANNUAL_FEE   = 10;  // Annual parking fee in RM (年度停车费，RM)

// Hardcoded student profile — replace with real auth/API in production
// 硬编码学生资料 — 生产环境应改为真实认证/API
const STUDENT = {
  name:   "Ahmad Faiz",
  id:     "22CS10042",
  course: "Diploma in Computer Science",
  year:   "Year 2",
  email:  "ahmdfaiz@student.mdis.edu.my",
  phone:  "+60 12-345 6789",
  isOKU:  false,
};

// ═════════════════════════════════════════════════════════════════════════════
// 🎨 ThemePickerModal
// Bottom sheet listing all available themes as tappable cards.
// 底部弹窗：列出全部可选主题，点击切换。
// ═════════════════════════════════════════════════════════════════════════════
function ThemePickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { themeKey, setTheme, theme: T } = useTheme();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}
          style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
          <Text style={[styles.sheetTitle, { color: T.text }]}>Choose Theme</Text>
          <Text style={[styles.sheetSub,   { color: T.muted }]}>Select your preferred app style</Text>

          {/* 2-column theme card grid (两列主题卡片格子) */}
          <View style={styles.themeGrid}>
            {(Object.values(THEMES) as Theme[]).map((t) => {
              const isActive = themeKey === t.key;
              return (
                <TouchableOpacity key={t.key} activeOpacity={0.8}
                  onPress={() => { setTheme(t.key as ThemeKey); onClose(); }}
                  style={[styles.themeCard, {
                    backgroundColor: t.bg,
                    borderColor: isActive ? t.accent : t.border,
                    borderWidth: isActive ? 2.5 : 1.5,
                  }]}>
                  {/* Colour preview dots (主题颜色预览点) */}
                  <View style={styles.themePreviewRow}>
                    {[t.green, t.red, t.accent].map((c, i) => (
                      <View key={i} style={[styles.previewDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                  <Text style={styles.themeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.themeName, { color: t.text }]}>{t.name}</Text>
                  <Text style={[styles.themeDesc, { color: t.muted }]}>{t.desc}</Text>
                  {/* Active checkmark badge (选中时显示的勾选徽章) */}
                  {isActive && (
                    <View style={[styles.activeCheck, { backgroundColor: t.accent }]}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: T.muted }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 📷 AvatarModal
// Bottom sheet with options: Take Photo / Choose from Gallery / Remove Photo.
// 底部弹窗：拍照 / 选相册 / 删除头像。
// ═════════════════════════════════════════════════════════════════════════════
function AvatarModal({ visible, onClose, onCamera, onGallery, onRemove, hasPhoto }: {
  visible: boolean; onClose: () => void; onCamera: () => void;
  onGallery: () => void; onRemove: () => void; hasPhoto: boolean;
}) {
  const { theme: T } = useTheme();
  const options = [
    { icon: "📷", bg: T.accent+"20", title: "Take Photo",          sub: "Use your camera",        onPress: onCamera  },
    { icon: "🖼️", bg: T.green +"20", title: "Choose from Gallery", sub: "Pick an existing photo", onPress: onGallery },
  ];
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}
          style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
          <Text style={[styles.sheetTitle, { color: T.text }]}>Change Profile Photo</Text>

          {/* Camera and gallery options (拍照和相册选项) */}
          {options.map(o => (
            <TouchableOpacity key={o.title} style={styles.avatarOption} onPress={o.onPress} activeOpacity={0.8}>
              <View style={[styles.avatarOptionIcon, { backgroundColor: o.bg }]}>
                <Text style={{ fontSize: 22 }}>{o.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.avatarOptionTitle, { color: T.text }]}>{o.title}</Text>
                <Text style={[styles.avatarOptionSub,   { color: T.muted }]}>{o.sub}</Text>
              </View>
              <Text style={[styles.chevron, { color: T.muted }]}>›</Text>
            </TouchableOpacity>
          ))}

          {/* Remove photo — only shown when a custom photo exists (仅在有自定义头像时显示) */}
          {hasPhoto && (
            <TouchableOpacity style={styles.avatarOption} onPress={onRemove} activeOpacity={0.8}>
              <View style={[styles.avatarOptionIcon, { backgroundColor: T.red+"20" }]}>
                <Text style={{ fontSize: 22 }}>🗑️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.avatarOptionTitle, { color: T.red }]}>Remove Photo</Text>
                <Text style={[styles.avatarOptionSub,   { color: T.muted }]}>Go back to default avatar</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: T.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 🚗 VehicleModal
// Bottom sheet form for adding or editing a vehicle.
// 底部弹窗表单：新增或编辑车辆（车牌 + 车型 + OKU 开关）。
// ═════════════════════════════════════════════════════════════════════════════
function VehicleModal({ visible, vehicle, onSave, onClose }: {
  visible: boolean; vehicle?: Vehicle;
  onSave: (plate: string, model: string, isOKU: boolean) => void;
  onClose: () => void;
}) {
  const { theme: T } = useTheme();
  const [plate, setPlate] = useState(vehicle?.plate ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [isOKU, setIsOKU] = useState(vehicle?.isOKU ?? false);
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}
          style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
          <Text style={[styles.sheetTitle, { color: T.text }]}>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</Text>
          <Text style={[styles.sheetSub, { color: T.muted }]}>Annual fee: RM{ANNUAL_FEE} per vehicle</Text>

          {/* Plate number input (车牌号输入) */}
          <Text style={[styles.inputLabel, { color: T.muted }]}>Plate Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
            value={plate} onChangeText={setPlate}
            placeholder="e.g. WXY 1234" placeholderTextColor={T.muted}
            autoCapitalize="characters"
          />

          {/* Vehicle model input (车型输入) */}
          <Text style={[styles.inputLabel, { color: T.muted }]}>Vehicle Model</Text>
          <TextInput
            style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
            value={model} onChangeText={setModel}
            placeholder="e.g. Honda Civic (White)" placeholderTextColor={T.muted}
          />

          {/* OKU toggle — enables access to OKU reserved spots (OKU 开关 — 开启后可使用 OKU 专用车位) */}
          <View style={[styles.okuRow, { backgroundColor: T.bg }]}>
            <View>
              <Text style={[styles.okuLabel, { color: T.text }]}>OKU Registered Vehicle</Text>
              <Text style={[styles.okuSub,   { color: T.muted }]}>Enables OKU parking spots</Text>
            </View>
            <Switch value={isOKU} onValueChange={setIsOKU}
              trackColor={{ false: T.border, true: T.orange+"80" }}
              thumbColor={isOKU ? T.orange : T.muted} />
          </View>

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: T.accent }]}
            onPress={() => { onSave(plate, model, isOKU); onClose(); }}>
            <Text style={styles.saveBtnText}>{vehicle ? "Save Changes" : `Register & Pay RM${ANNUAL_FEE}`}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: T.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 🚗 VehicleCard
// Displays a single registered vehicle with Edit and Remove actions.
// 显示单辆已注册车辆，包含编辑和删除操作。
// ═════════════════════════════════════════════════════════════════════════════
function VehicleCard({ vehicle, onEdit, onRemove }: {
  vehicle: Vehicle; onEdit: () => void; onRemove: () => void;
}) {
  const { theme: T } = useTheme();
  return (
    <View style={[styles.vehicleCard, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={styles.vehicleLeft}>
        {/* OKU badge or regular car icon (OKU 或普通车图标) */}
        <Text style={styles.vehicleEmoji}>{vehicle.isOKU ? "♿" : "🚗"}</Text>
        <View>
          <View style={styles.vehiclePlateRow}>
            <Text style={[styles.plateText, { color: T.text }]}>{vehicle.plate}</Text>
            {vehicle.isOKU && (
              <View style={[styles.okuBadge, { backgroundColor: T.orange+"22", borderColor: T.orange+"55" }]}>
                <Text style={[styles.okuBadgeText, { color: T.orange }]}>OKU</Text>
              </View>
            )}
          </View>
          <Text style={[styles.vehicleModel, { color: T.muted }]}>{vehicle.model}</Text>
          {/* Annual fee payment status badge (年费缴纳状态徽章) */}
          <View style={[styles.paidBadge, {
            backgroundColor: vehicle.isPaid ? T.green+"18" : T.red+"18",
            borderColor:     vehicle.isPaid ? T.green+"44" : T.red+"44",
          }]}>
            <Text style={[styles.paidBadgeText, { color: vehicle.isPaid ? T.green : T.red }]}>
              {vehicle.isPaid ? "✅ Annual Fee Paid" : "⚠️ Fee Unpaid"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.vehicleActions}>
        <TouchableOpacity onPress={onEdit}>
          <Text style={[styles.vActionEdit, { color: T.accent }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove}>
          <Text style={[styles.vActionRemove, { color: T.red }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ⚙️ SettingRow
// Reusable settings list row with icon, label, optional subtitle, and right slot.
// 可复用的设置行组件：图标、标题、可选副标题、右侧插槽。
// ═════════════════════════════════════════════════════════════════════════════
function SettingRow({ icon, label, sub, onPress, right }: {
  icon: string; label: string; sub?: string; onPress?: () => void; right?: React.ReactNode;
}) {
  const { theme: T } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: T.accent+"15" }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: T.text }]}>{label}</Text>
        {sub && <Text style={[styles.settingSub, { color: T.muted }]}>{sub}</Text>}
      </View>
      {/* Show custom right content, or a chevron if tappable, or nothing (显示自定义右侧内容，或可点击时显示箭头，否则不显示) */}
      {right ?? (onPress ? <Text style={[styles.chevron, { color: T.muted }]}>›</Text> : null)}
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 👤 ProfileScreen — Main screen component (主页面组件)
// ═════════════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const { theme: T, themeKey } = useTheme();

  // Vehicles come from ParkingContext so changes here sync to Home & Map screens
  // 车辆数据来自 ParkingContext，在此修改会同步到 Home 和 Map 页面
  const { vehicles, setVehicles } = useParkingContext();

  // ── Local UI state (本地 UI 状态) ─────────────────────────────────────────
  const [avatarUri,    setAvatarUri]    = useState<string | null>(null);       // Custom avatar URI (自定义头像路径)
  const [avatarModal,  setAvatarModal]  = useState(false);                     // AvatarModal visibility (头像弹窗是否可见)
  const [themeModal,   setThemeModal]   = useState(false);                     // ThemePickerModal visibility (主题弹窗)
  const [vehicleModal, setVehicleModal] = useState(false);                     // VehicleModal visibility (车辆弹窗)
  const [editTarget,   setEditTarget]   = useState<Vehicle | undefined>(undefined); // Vehicle being edited (正在编辑的车辆)
  const [notifP, setNotifP] = useState(true);  // Parking reminder toggle (停车提醒开关)
  const [notifO, setNotifO] = useState(true);  // Overstay alert toggle (超时警告开关)

  // ── Avatar: take photo with camera (头像：用相机拍照) ────────────────────
  async function handleCamera() {
    setAvatarModal(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Camera Permission Needed", "Please allow camera access in Settings."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  // ── Avatar: pick from gallery (头像：从相册选择) ─────────────────────────
  async function handleGallery() {
    setAvatarModal(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Gallery Permission Needed", "Please allow photo access in Settings."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  // ── Avatar: remove custom photo (头像：删除自定义头像，恢复默认) ──────────
  function handleRemoveAvatar() {
    setAvatarModal(false);
    Alert.alert("Remove Photo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setAvatarUri(null) },
    ]);
  }

  // ── Vehicle: add new (车辆：新增) ─────────────────────────────────────────
  function addVehicle(plate: string, model: string, isOKU: boolean) {
    if (!plate.trim()) { Alert.alert("Error", "Please enter a plate number."); return; }
    if (vehicles.length >= MAX_VEHICLES) { Alert.alert("Limit Reached", `Maximum ${MAX_VEHICLES} vehicles allowed.`); return; }
    const updated = [...vehicles, {
      id: Date.now().toString(),
      plate: plate.trim().toUpperCase(),
      model, isOKU,
      isPaid: false, // New vehicles start unpaid (新车辆默认未付费)
    }];
    setVehicles(updated); // Persisted via ParkingContext → AsyncStorage (通过 ParkingContext 持久化到 AsyncStorage)
    Alert.alert("✅ Registered", `${plate.trim().toUpperCase()} added.\nPlease pay RM${ANNUAL_FEE} at the admin counter.`);
  }

  // ── Vehicle: edit existing (车辆：编辑已有) ───────────────────────────────
  function editVehicle(plate: string, model: string, isOKU: boolean) {
    if (!editTarget) return;
    const updated = vehicles.map(v =>
      v.id === editTarget.id ? { ...v, plate: plate.trim().toUpperCase(), model, isOKU } : v
    );
    setVehicles(updated);
  }

  // ── Vehicle: remove with confirmation (车辆：二次确认删除) ─────────────────
  function removeVehicle(id: string) {
    Alert.alert("Remove Vehicle", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive",
        onPress: () => setVehicles(vehicles.filter(v => v.id !== id)) },
    ]);
  }

  // ── Logout with confirmation (登出，含确认弹窗) ────────────────────────────
  function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel",  style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => {} }, // TODO: clear session & navigate to login (清除会话并跳转登录页)
    ]);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Background transparent so _layout.tsx LinearGradient shows through.
  // 背景透明，让 _layout.tsx 的渐变透出来。
  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header (顶部标题栏) ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>Profile</Text>
            <Text style={[styles.subtitle,   { color: T.muted }]}>Account & Settings</Text>
          </View>
          <Image source={require("../../assets/images/itkia.png")} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </View>

        {/* ── Student info card (学生资料卡) ── */}
        <View style={[styles.avatarCard, { backgroundColor: T.card, borderColor: T.border }]}>
          {/* Tappable avatar — opens AvatarModal (点击头像打开头像弹窗) */}
          <TouchableOpacity onPress={() => setAvatarModal(true)} activeOpacity={0.85} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[styles.avatarImage, { borderColor: T.accent+"55" }]} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: T.accent+"18", borderColor: T.accent+"55" }]}>
                <Text style={styles.avatarEmoji}>👨‍🎓</Text>
              </View>
            )}
            {/* Camera icon badge overlaying avatar (叠加在头像上的相机图标) */}
            <View style={[styles.cameraBadge, { backgroundColor: T.accent, borderColor: T.bg }]}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.changePhotoHint, { color: T.accent }]}>Tap to change photo</Text>
          <Text style={[styles.studentName,   { color: T.text  }]}>{STUDENT.name}</Text>
          <Text style={[styles.studentCourse, { color: T.muted }]}>{STUDENT.course} · {STUDENT.year}</Text>
          <View style={[styles.idBadge, { backgroundColor: T.accent+"18", borderColor: T.accent+"44" }]}>
            <Text style={[styles.idText, { color: T.accent }]}>ID: {STUDENT.id}</Text>
          </View>

          {/* Email + phone row (邮箱和电话行) */}
          <View style={[styles.infoRow, { backgroundColor: T.bg }]}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📧</Text>
              <Text style={[styles.infoVal, { color: T.muted }]}>{STUDENT.email}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: T.border }]} />
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📱</Text>
              <Text style={[styles.infoVal, { color: T.muted }]}>{STUDENT.phone}</Text>
            </View>
          </View>
        </View>

        {/* ── Appearance: theme picker button (外观：主题选择按钮) ── */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>APPEARANCE</Text>
        <TouchableOpacity
          style={[styles.themePickerBtn, { backgroundColor: T.card, borderColor: T.border }]}
          onPress={() => setThemeModal(true)} activeOpacity={0.8}>
          <View style={[styles.settingIcon, { backgroundColor: T.accent+"15" }]}>
            <Text style={{ fontSize: 18 }}>🎨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: T.text }]}>App Theme</Text>
            <Text style={[styles.settingSub, { color: T.muted }]}>
              {THEMES[themeKey].emoji}  {THEMES[themeKey].name} — {THEMES[themeKey].desc}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: T.muted }]}>›</Text>
        </TouchableOpacity>

        {/* ── Vehicles section (车辆管理区域) ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: T.muted }]}>MY VEHICLES</Text>
          <Text style={[styles.sectionSub, { color: T.muted }]}>{vehicles.length}/{MAX_VEHICLES} · RM{ANNUAL_FEE}/year</Text>
        </View>

        {vehicles.map(v => (
          <VehicleCard key={v.id} vehicle={v}
            onEdit={()   => { setEditTarget(v); setVehicleModal(true); }}
            onRemove={() => removeVehicle(v.id)}
          />
        ))}

        {/* Add vehicle button — hidden when at max capacity (新增车辆按钮，达上限时隐藏) */}
        {vehicles.length < MAX_VEHICLES && (
          <TouchableOpacity
            style={[styles.addVehicleBtn, { borderColor: T.accent+"55" }]}
            onPress={() => { setEditTarget(undefined); setVehicleModal(true); }}
            activeOpacity={0.8}>
            <Text style={[styles.addVehicleText, { color: T.accent }]}>＋  Add Vehicle  (RM{ANNUAL_FEE}/year)</Text>
          </TouchableOpacity>
        )}

        {/* ── Notifications (通知设置) ── */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 24 }]}>NOTIFICATIONS</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow icon="🔔" label="Parking Reminders" sub="Notify when session is unusually long"
            right={<Switch value={notifP} onValueChange={setNotifP}
              trackColor={{ false: T.border, true: T.accent+"80" }}
              thumbColor={notifP ? T.accent : T.muted} />} />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="⚠️" label="Overstay Alerts" sub="Warn before overstay is flagged"
            right={<Switch value={notifO} onValueChange={setNotifO}
              trackColor={{ false: T.border, true: T.accent+"80" }}
              thumbColor={notifO ? T.accent : T.muted} />} />
        </View>

        {/* ── Account settings (账号设置) ── */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 8 }]}>ACCOUNT</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow icon="🔒" label="Change Password"
            onPress={() => Alert.alert("Change Password", "Coming soon.")} />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="📷" label="Camera Permission" sub="Profile photo & plate scanning"
            onPress={() => Alert.alert("Camera", "Go to Settings → Apps → MDIS Parking → Permissions.")} />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="📍" label="Location Permission" sub="GPS parking detection"
            onPress={() => Alert.alert("Location", "Go to Settings → Apps → MDIS Parking → Permissions.")} />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="📞" label="Support" sub="parking@mdis.edu.my"
            onPress={() => Alert.alert("Support", "Email: parking@mdis.edu.my")} />
        </View>

        {/* ── App info (应用信息) ── */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 8 }]}>APP</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow icon="ℹ️" label="Version" sub="1.0.0 (Beta)" />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="⭐" label="Rate This App"
            onPress={() => Alert.alert("Rate Us", "Thank you for your feedback!")} />
        </View>

        {/* ── Logout button (登出按钮) ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: T.red+"18", borderColor: T.red+"44" }]}
          onPress={handleLogout} activeOpacity={0.8}>
          <Text style={[styles.logoutText, { color: T.red }]}>🚪  Log Out</Text>
        </TouchableOpacity>

        <Text style={[styles.footer, { color: T.muted }]}>MDIS Campus Parking · Student Edition</Text>
      </ScrollView>

      {/* Modals — outside ScrollView so they render above everything (弹窗在 ScrollView 外，层级最高) */}
      <ThemePickerModal visible={themeModal} onClose={() => setThemeModal(false)} />
      <AvatarModal
        visible={avatarModal} hasPhoto={!!avatarUri}
        onClose={()      => setAvatarModal(false)}
        onCamera={handleCamera} onGallery={handleGallery} onRemove={handleRemoveAvatar}
      />
      <VehicleModal
        visible={vehicleModal} vehicle={editTarget}
        onSave={editTarget ? editVehicle : addVehicle}
        onClose={() => setVehicleModal(false)}
      />
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

  avatarCard:      { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 20 },
  avatarWrap:      { position: "relative", marginBottom: 6 },
  avatarCircle:    { width: 90, height: 90, borderRadius: 45, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  avatarImage:     { width: 90, height: 90, borderRadius: 45, borderWidth: 2 },
  avatarEmoji:     { fontSize: 40 },
  cameraBadge:     { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 2 },
  changePhotoHint: { fontSize: 12, fontWeight: "600", marginBottom: 12 },
  studentName:     { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  studentCourse:   { fontSize: 13, marginBottom: 12 },
  idBadge:         { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10 },
  idText:          { fontWeight: "700", fontSize: 12, letterSpacing: 0.5 },
  infoRow:         { flexDirection: "row", width: "100%", borderRadius: 12, padding: 12 },
  infoItem:        { flex: 1, alignItems: "center", gap: 4 },
  infoIcon:        { fontSize: 16 },
  infoVal:         { fontSize: 11, textAlign: "center" },
  infoDivider:     { width: 1, marginHorizontal: 8 },

  themePickerBtn:  { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  themeGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  themeCard:       { width: "47%", borderRadius: 16, padding: 14, alignItems: "center", overflow: "hidden", minHeight: 130, justifyContent: "center" },
  themePreviewRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  previewDot:      { width: 8, height: 8, borderRadius: 4 },
  themeEmoji:      { fontSize: 28, marginBottom: 6 },
  themeName:       { fontWeight: "800", fontSize: 15, marginBottom: 2 },
  themeDesc:       { fontSize: 10, textAlign: "center" },
  activeCheck:     { position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  sectionTitle:     { fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
  sectionSub:       { fontSize: 11 },

  vehicleCard:     { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  vehicleLeft:     { flexDirection: "row", gap: 12, flex: 1 },
  vehicleEmoji:    { fontSize: 28, marginTop: 2 },
  vehiclePlateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  plateText:       { fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  okuBadge:        { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  okuBadgeText:    { fontSize: 10, fontWeight: "800" },
  vehicleModel:    { fontSize: 12, marginBottom: 6 },
  paidBadge:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  paidBadgeText:   { fontSize: 11, fontWeight: "700" },
  vehicleActions:  { gap: 8 },
  vActionEdit:     { fontWeight: "700", fontSize: 12 },
  vActionRemove:   { fontWeight: "700", fontSize: 12 },
  addVehicleBtn:   { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginBottom: 4 },
  addVehicleText:  { fontWeight: "700", fontSize: 14 },

  settingCard:  { borderWidth: 1, borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  settingRow:   { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  settingIcon:  { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  settingLabel: { fontSize: 14, fontWeight: "600" },
  settingSub:   { fontSize: 11, marginTop: 2 },
  chevron:      { fontSize: 22, lineHeight: 24 },
  rowDivider:   { height: 1, marginLeft: 64 },

  logoutBtn:  { borderWidth: 1, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginBottom: 20 },
  logoutText: { fontWeight: "800", fontSize: 15 },
  footer:     { fontSize: 11, textAlign: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle:  { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  sheetSub:   { fontSize: 13, marginBottom: 20 },

  avatarOption:      { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  avatarOptionIcon:  { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  avatarOptionTitle: { fontWeight: "700", fontSize: 15 },
  avatarOptionSub:   { fontSize: 12, marginTop: 2 },

  inputLabel:  { fontSize: 12, letterSpacing: 0.5, marginBottom: 6 },
  input:       { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 14 },
  okuRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, padding: 14, marginBottom: 20 },
  okuLabel:    { fontWeight: "600", fontSize: 14 },
  okuSub:      { fontSize: 12, marginTop: 2 },
  saveBtn:     { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  saveBtnText: { color: "white", fontWeight: "800", fontSize: 15 },
  cancelBtn:     { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { fontSize: 14 },
});