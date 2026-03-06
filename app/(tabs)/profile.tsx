// ─────────────────────────────────────────────────────────────────────────────
// app/(tabs)/profile.tsx
//
// 个人资料页，功能包括：
// 1. 头像拍照/选图
// 2. 🎨 主题切换（在这里选！）
// 3. 车辆管理（最多 4 辆，每辆 RM10/年）
// 4. 通知设置
// 5. 账号设置
// ─────────────────────────────────────────────────────────────────────────────

import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert, Image, Modal, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from "../../utils/ParkingContext";
import { THEMES, ThemeKey, useTheme } from "../../utils/ThemeContext";

// ─── 常量 ─────────────────────────────────────────────────────────────
const MAX_VEHICLES = 4;     // 每个学生最多注册 4 辆车
const ANNUAL_FEE   = 10;    // 年费 RM10/辆

// ─── 学生资料（实际项目应从 API 获取）────────────────────────────────
const STUDENT = {
  name:   "Ahmad Faiz",
  id:     "22CS10042",
  course: "Diploma in Computer Science",
  year:   "Year 2",
  email:  "ahmdfaiz@student.mdis.edu.my",
  phone:  "+60 12-345 6789",
  isOKU:  false,
};


// ═════════════════════════════════════════════════════════════════════
// 🎨 主题选择弹窗
// 点击 Profile 页里的 "App Theme" 按钮会弹出这个
// ═════════════════════════════════════════════════════════════════════
function ThemePickerModal({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}) {
  // 从 Context 获取当前主题 key 和切换函数
  const { themeKey, setTheme, theme: T } = useTheme();

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      {/* 半透明遮罩，点击遮罩关闭弹窗 */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* 弹窗主体 — activeOpacity={1} 防止点击穿透到遮罩 */}
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}
        >
          {/* 顶部拖拽条 */}
          <View style={[styles.handle, { backgroundColor: T.border }]} />

          <Text style={[styles.sheetTitle, { color: T.text }]}>Choose Theme</Text>
          <Text style={[styles.sheetSub,   { color: T.muted }]}>Select your preferred app style</Text>

          {/* 4 个主题卡片 2×2 排列 */}
          <View style={styles.themeGrid}>
            {(Object.values(THEMES) as Theme[]).map((t) => {
              const isActive = themeKey === t.key;

              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.8}
                  // ⭐ 点击：调用 setTheme 切换主题，然后关闭弹窗
                  onPress={() => {
                    setTheme(t.key as ThemeKey);  // 切换主题
                    onClose();                     // 关闭弹窗
                  }}
                  style={[
                    styles.themeCard,
                    {
                      backgroundColor: t.bg,
                      borderColor: isActive ? t.accent : t.border,
                      borderWidth: isActive ? 2.5 : 1.5,
                    },
                  ]}
                >
                  {/* 三色预览点 */}
                  <View style={styles.themePreviewRow}>
                    {[t.green, t.red, t.accent].map((c, i) => (
                      <View key={i} style={[styles.previewDot, { backgroundColor: c }]} />
                    ))}
                  </View>

                  {/* 背景装饰字符（古风☯、温柔✿、日系桜） */}
                  {t.pattern && (
                    <Text style={[styles.themePatternChar, { color: t.accent + "50" }]}>
                      {t.pattern}
                    </Text>
                  )}

                  <Text style={styles.themeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.themeName, { color: t.text }]}>{t.name}</Text>
                  <Text style={[styles.themeDesc, { color: t.muted }]}>{t.desc}</Text>

                  {/* 选中时显示 ✓ 标记 */}
                  {isActive && (
                    <View style={[styles.activeCheck, { backgroundColor: t.accent }]}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 关闭按钮 */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: T.muted }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 📷 头像选择弹窗
// ═════════════════════════════════════════════════════════════════════
function AvatarModal({ visible, onClose, onCamera, onGallery, onRemove, hasPhoto }: {
  visible:   boolean;
  onClose:   () => void;
  onCamera:  () => void;
  onGallery: () => void;
  onRemove:  () => void;
  hasPhoto:  boolean;
}) {
  const { theme: T } = useTheme();

  const options = [
    { icon: "📷", bg: T.accent + "20", title: "Take Photo",          sub: "Use your camera",        onPress: onCamera  },
    { icon: "🖼️", bg: T.green  + "20", title: "Choose from Gallery", sub: "Pick an existing photo", onPress: onGallery },
  ];

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}
          style={[styles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[styles.handle, { backgroundColor: T.border }]} />
          <Text style={[styles.sheetTitle, { color: T.text }]}>Change Profile Photo</Text>

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

          {/* 只有已有头像才显示删除选项 */}
          {hasPhoto && (
            <TouchableOpacity style={styles.avatarOption} onPress={onRemove} activeOpacity={0.8}>
              <View style={[styles.avatarOptionIcon, { backgroundColor: T.red + "20" }]}>
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

// ═════════════════════════════════════════════════════════════════════
// 🚗 车辆添加/编辑弹窗
// ═════════════════════════════════════════════════════════════════════
function VehicleModal({ visible, vehicle, onSave, onClose }: {
  visible:  boolean;
  vehicle?: Vehicle;
  onSave:   (plate: string, model: string, isOKU: boolean) => void;
  onClose:  () => void;
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
          <Text style={[styles.sheetTitle, { color: T.text }]}>
            {vehicle ? "Edit Vehicle" : "Add Vehicle"}
          </Text>
          <Text style={[styles.sheetSub, { color: T.muted }]}>
            Annual fee: RM{ANNUAL_FEE} per vehicle
          </Text>

          {/* 车牌号输入 */}
          <Text style={[styles.inputLabel, { color: T.muted }]}>Plate Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
            value={plate} onChangeText={setPlate}
            placeholder="e.g. WXY 1234" placeholderTextColor={T.muted}
            autoCapitalize="characters"
          />

          {/* 车型输入 */}
          <Text style={[styles.inputLabel, { color: T.muted }]}>Vehicle Model</Text>
          <TextInput
            style={[styles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
            value={model} onChangeText={setModel}
            placeholder="e.g. Honda Civic (White)" placeholderTextColor={T.muted}
          />

          {/* OKU 开关 */}
          <View style={[styles.okuRow, { backgroundColor: T.bg }]}>
            <View>
              <Text style={[styles.okuLabel, { color: T.text }]}>OKU Registered Vehicle</Text>
              <Text style={[styles.okuSub,   { color: T.muted }]}>Enables OKU parking spots</Text>
            </View>
            <Switch
              value={isOKU} onValueChange={setIsOKU}
              trackColor={{ false: T.border, true: T.orange + "80" }}
              thumbColor={isOKU ? T.orange : T.muted}
            />
          </View>

          {/* 保存按钮 */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: T.accent }]}
            onPress={() => { onSave(plate, model, isOKU); onClose(); }}
          >
            <Text style={styles.saveBtnText}>
              {vehicle ? "Save Changes" : `Register & Pay RM${ANNUAL_FEE}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: T.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── 车辆卡片 ─────────────────────────────────────────────────────────
function VehicleCard({ vehicle, onEdit, onRemove }: {
  vehicle:  Vehicle;
  onEdit:   () => void;
  onRemove: () => void;
}) {
  const { theme: T } = useTheme();
  return (
    <View style={[styles.vehicleCard, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={styles.vehicleLeft}>
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

// ─── 通用设置行 ───────────────────────────────────────────────────────
function SettingRow({ icon, label, sub, onPress, right }: {
  icon:     string;
  label:    string;
  sub?:     string;
  onPress?: () => void;
  right?:   React.ReactNode;
}) {
  const { theme: T } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={styles.settingRow}
    >
      <View style={[styles.settingIcon, { backgroundColor: T.accent + "15" }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, { color: T.text }]}>{label}</Text>
        {sub && <Text style={[styles.settingSub, { color: T.muted }]}>{sub}</Text>}
      </View>
      {right ?? (onPress ? <Text style={[styles.chevron, { color: T.muted }]}>›</Text> : null)}
    </TouchableOpacity>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 📄 Profile 主页面
// ═════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const { theme: T, themeKey } = useTheme();
  const { vehicles, setVehicles } = useParkingContext();  // ← 加这行

  // ── 状态管理 ───────────────────────────────────────────────────────
  const [avatarUri,    setAvatarUri]    = useState<string | null>(null);
  const [avatarModal,  setAvatarModal]  = useState(false);
  const [themeModal,   setThemeModal]   = useState(false);
  // ← 删掉原来的 vehicles useState
  const [vehicleModal, setVehicleModal] = useState(false);
  const [editTarget,   setEditTarget]   = useState<Vehicle | undefined>(undefined);
  const [notifP,       setNotifP]       = useState(true);
  const [notifO,       setNotifO]       = useState(true);

  // ── 头像：拍照 ────────────────────────────────────────────────────
  async function handleCamera() {
    setAvatarModal(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission Needed", "Please allow camera access in Settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  // ── 头像：从相册选 ────────────────────────────────────────────────
  async function handleGallery() {
    setAvatarModal(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Gallery Permission Needed", "Please allow photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  // ── 头像：删除 ────────────────────────────────────────────────────
  function handleRemoveAvatar() {
    setAvatarModal(false);
    Alert.alert("Remove Photo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setAvatarUri(null) },
    ]);
  }

  // ── 车辆：添加 ────────────────────────────────────────────────────
  function addVehicle(plate: string, model: string, isOKU: boolean) {
    if (vehicles.length >= MAX_VEHICLES) {
      Alert.alert("Limit Reached", `Maximum ${MAX_VEHICLES} vehicles allowed.`);
      return;
    }
    setVehicles(prev => [...prev, {
      id: Date.now().toString(), plate, model, isPaid: false, isOKU,
    }]);
    Alert.alert("✅ Registered", `${plate} added.\nPlease pay RM${ANNUAL_FEE} at the admin counter.`);
  }

  // ── 车辆：编辑 ────────────────────────────────────────────────────
  function editVehicle(plate: string, model: string, isOKU: boolean) {
    if (!editTarget) return;
    setVehicles(prev => prev.map(v =>
      v.id === editTarget.id ? { ...v, plate, model, isOKU } : v
    ));
  }

  // ── 车辆：删除 ────────────────────────────────────────────────────
  function removeVehicle(id: string) {
    Alert.alert("Remove Vehicle", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive",
        onPress: () => setVehicles(prev => prev.filter(v => v.id !== id)) },
    ]);
  }

  // ── 登出 ──────────────────────────────────────────────────────────
  function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => {} },
    ]);
  }

  // ── 是否有背景装饰（温柔风/古风/日系才有）────────────────────────
  const hasPattern = !!T.pattern;

  return (
    <View style={[styles.screen, { backgroundColor: T.bg }]}>

      {/* ── 背景装饰图案（非科技风才显示）── */}
      {hasPattern && (
        <View style={styles.patternWrap} pointerEvents="none">
          {Array.from({ length: 40 }, (_, i) => (
            <Text key={i} style={[styles.patternChar, { color: T.patternColor }]}>
              {T.pattern}
            </Text>
          ))}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── 页面标题 ── */}
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: T.text }]}>Profile</Text>
          <View style={[styles.logoBadge, { backgroundColor: T.accent+"18", borderColor: T.accent+"44" }]}>
            <Text style={[styles.logoText, { color: T.accent }]}>MDIS</Text>
          </View>
        </View>

        {/* ── 头像卡片 ── */}
        <View style={[styles.avatarCard, { backgroundColor: T.card, borderColor: T.border }]}>
          {/* 点击头像打开相机/相册选项 */}
          <TouchableOpacity onPress={() => setAvatarModal(true)} activeOpacity={0.85} style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }}
                style={[styles.avatarImage, { borderColor: T.accent+"55" }]} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: T.accent+"18", borderColor: T.accent+"55" }]}>
                <Text style={styles.avatarEmoji}>👨‍🎓</Text>
              </View>
            )}
            {/* 相机图标小徽章 */}
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

        {/* ══════════════════════════════════════════════════════════
            🎨 主题设置区域
            点击这个按钮会打开 ThemePickerModal
        ══════════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>APPEARANCE</Text>
        <TouchableOpacity
          style={[styles.themePickerBtn, { backgroundColor: T.card, borderColor: T.border }]}
          onPress={() => setThemeModal(true)}   // ⭐ 打开主题选择弹窗
          activeOpacity={0.8}
        >
          <View style={[styles.settingIcon, { backgroundColor: T.accent + "15" }]}>
            <Text style={{ fontSize: 18 }}>🎨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: T.text }]}>App Theme</Text>
            {/* 显示当前主题名字 */}
            <Text style={[styles.settingSub, { color: T.muted }]}>
              {THEMES[themeKey].emoji}  {THEMES[themeKey].name} — {THEMES[themeKey].desc}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: T.muted }]}>›</Text>
        </TouchableOpacity>

        {/* ── 我的车辆 ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: T.muted }]}>MY VEHICLES</Text>
          <Text style={[styles.sectionSub, { color: T.muted }]}>{vehicles.length}/{MAX_VEHICLES} · RM{ANNUAL_FEE}/year</Text>
        </View>

        {vehicles.map(v => (
          <VehicleCard key={v.id} vehicle={v}
            onEdit={() => { setEditTarget(v); setVehicleModal(true); }}
            onRemove={() => removeVehicle(v.id)} />
        ))}

        {/* 未满 4 辆才显示"Add Vehicle"按钮 */}
        {vehicles.length < MAX_VEHICLES && (
          <TouchableOpacity
            style={[styles.addVehicleBtn, { borderColor: T.accent + "55" }]}
            onPress={() => { setEditTarget(undefined); setVehicleModal(true); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.addVehicleText, { color: T.accent }]}>
              ＋  Add Vehicle  (RM{ANNUAL_FEE}/year)
            </Text>
          </TouchableOpacity>
        )}

        {/* ── 通知设置 ── */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 24 }]}>NOTIFICATIONS</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow icon="🔔" label="Parking Reminders"
            sub="Notify when session is unusually long"
            right={<Switch value={notifP} onValueChange={setNotifP}
              trackColor={{ false: T.border, true: T.accent + "80" }}
              thumbColor={notifP ? T.accent : T.muted} />} />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="⚠️" label="Overstay Alerts"
            sub="Warn before overstay is flagged"
            right={<Switch value={notifO} onValueChange={setNotifO}
              trackColor={{ false: T.border, true: T.accent + "80" }}
              thumbColor={notifO ? T.accent : T.muted} />} />
        </View>

        {/* ── 账号设置 ── */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 8 }]}>ACCOUNT</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow icon="🔒" label="Change Password"
            onPress={() => Alert.alert("Change Password", "Coming soon.")} />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="📷" label="Camera Permission"
            sub="Profile photo & plate scanning"
            onPress={() => Alert.alert("Camera", "Go to Settings → Apps → MDIS Parking → Permissions.")} />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="📍" label="Location Permission"
            sub="GPS parking detection"
            onPress={() => Alert.alert("Location", "Go to Settings → Apps → MDIS Parking → Permissions.")} />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="📞" label="Support"
            sub="parking@mdis.edu.my"
            onPress={() => Alert.alert("Support", "Email: parking@mdis.edu.my")} />
        </View>

        {/* ── App 信息 ── */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 8 }]}>APP</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow icon="ℹ️" label="Version" sub="1.0.0 (Beta)" />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow icon="⭐" label="Rate This App"
            onPress={() => Alert.alert("Rate Us", "Thank you for your feedback!")} />
        </View>

        {/* ── 登出按钮 ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: T.red+"18", borderColor: T.red+"44" }]}
          onPress={handleLogout} activeOpacity={0.8}
        >
          <Text style={[styles.logoutText, { color: T.red }]}>🚪  Log Out</Text>
        </TouchableOpacity>

        <Text style={[styles.footer, { color: T.muted }]}>MDIS Campus Parking · Student Edition</Text>
      </ScrollView>

      {/* ── 弹窗组件 ── */}
      {/* 主题选择弹窗 */}
      <ThemePickerModal visible={themeModal} onClose={() => setThemeModal(false)} />

      {/* 头像选择弹窗 */}
      <AvatarModal
        visible={avatarModal} hasPhoto={!!avatarUri}
        onClose={() => setAvatarModal(false)}
        onCamera={handleCamera} onGallery={handleGallery} onRemove={handleRemoveAvatar}
      />

      {/* 车辆添加/编辑弹窗 */}
      <VehicleModal
        visible={vehicleModal} vehicle={editTarget}
        onSave={editTarget ? editVehicle : addVehicle}
        onClose={() => setVehicleModal(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" },

  // 背景装饰图案
  patternWrap: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "row", flexWrap: "wrap", padding: 20, gap: 20, zIndex: 0,
  },
  patternChar: { fontSize: 28, opacity: 1 },

  // 页面标题行
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  logoBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  logoText:  { fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },

  // 头像卡片
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

  // 主题选择按钮
  themePickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16,
  },

  // 主题卡片网格
  themeGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  themeCard: {
    width: "47%", borderRadius: 16, padding: 14,
    alignItems: "center", overflow: "hidden",
    minHeight: 130, justifyContent: "center",
  },
  themePreviewRow:  { flexDirection: "row", gap: 4, marginBottom: 8 },
  previewDot:       { width: 8, height: 8, borderRadius: 4 },
  themePatternChar: { position: "absolute", top: 6, right: 8, fontSize: 28 },
  themeEmoji:       { fontSize: 28, marginBottom: 6 },
  themeName:        { fontWeight: "800", fontSize: 15, marginBottom: 2 },
  themeDesc:        { fontSize: 10, textAlign: "center" },
  activeCheck: {
    position: "absolute", top: 8, left: 8,
    width: 20, height: 20, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },

  // 分区标题
  sectionTitle:     { fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
  sectionSub:       { fontSize: 11 },

  // 车辆卡片
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

  // 设置卡片
  settingCard:  { borderWidth: 1, borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  settingRow:   { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  settingIcon:  { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  settingLabel: { fontSize: 14, fontWeight: "600" },
  settingSub:   { fontSize: 11, marginTop: 2 },
  chevron:      { fontSize: 22, lineHeight: 24 },
  rowDivider:   { height: 1, marginLeft: 64 },

  // 登出
  logoutBtn:  { borderWidth: 1, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginBottom: 20 },
  logoutText: { fontWeight: "800", fontSize: 15 },
  footer:     { fontSize: 11, textAlign: "center" },

  // Modal 通用
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle:  { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  sheetSub:   { fontSize: 13, marginBottom: 20 },

  // 头像 modal
  avatarOption:      { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  avatarOptionIcon:  { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  avatarOptionTitle: { fontWeight: "700", fontSize: 15 },
  avatarOptionSub:   { fontSize: 12, marginTop: 2 },

  // 车辆 modal 输入
  inputLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 6 },
  input:      { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 14 },
  okuRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, padding: 14, marginBottom: 20 },
  okuLabel:   { fontWeight: "600", fontSize: 14 },
  okuSub:     { fontSize: 12, marginTop: 2 },
  saveBtn:    { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  saveBtnText:{ color: "white", fontWeight: "800", fontSize: 15 },
  cancelBtn:  { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { fontSize: 14 },
});

// ─── 缺少的 Theme 类型（在这个文件里用到）────────────────────────────
type Theme = import("../../utils/ThemeContext").Theme;
type Vehicle = import("../../utils/ParkingContext").Vehicle;