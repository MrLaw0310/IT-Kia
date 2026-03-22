/*
app/(tabs)/profile.tsx — 用户资料与设置页 / User Profile & Settings Screen

功能 / Features:
 1. 学生资料卡（头像、姓名、课程、学号、邮箱、电话）
    Student info card (avatar, name, course, ID, email, phone)
 2. 头像管理（拍照 / 相册 / 删除）— expo-image-picker
    Avatar management (camera / gallery / remove) via expo-image-picker
 3. 主题选择器（5 套主题，写入 ThemeContext）
    Theme picker (5 themes, saved to ThemeContext)
 4. 车辆管理（最多 4 辆，含 OKU 标记，写入 ParkingContext）
    Vehicle management (max 4, OKU flag, saved to ParkingContext)
 5. 通知开关（Parking Reminders / Overstay Alerts）
    Notification toggles (Parking Reminders / Overstay Alerts)
 6. 账号设置（修改密码、权限、支持、版本、登出）
    Account settings (password, permissions, support, version, logout)
*/

import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert, Image, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useParkingContext, Vehicle } from "../../utils/ParkingContext";
import { Theme, ThemeKey, THEMES, useTheme } from "../../utils/ThemeContext";

// ─── Constants (常量) ─────────────────────────────────────────────────────────
const MAX_VEHICLES = 4;  // 每个学生账号最多注册车辆数 / maximum vehicles per student account
const ANNUAL_FEE   = 10; // 年度停车费，RM / annual parking fee in RM

// 硬编码学生资料，生产环境应改为真实认证/API
// Hardcoded student profile — replace with real auth/API in production
const STUDENT = {
  name:   "Ahmad Faiz",
  id:     "22CS10042",
  course: "Diploma in Computer Science",
  year:   "Year 2",
  email:  "ahmdfaiz@student.mdis.edu.my",
  phone:  "+60 12-345 6789",
  isOKU:  false,
};

// ─── Shared modal sheet styles (弹窗底部通用样式) ─────────────────────────────
// ThemePickerModal、AvatarModal、VehicleModal 共用 / shared by all three modals
const sharedModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1 },
  handle: { width: 40, height: 4, borderRadius: 999, alignSelf: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  sheetSub: { fontSize: 13, marginBottom: 20 },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { fontSize: 14 },
});

// ─── ThemePickerModal styles (主题选择弹窗样式) ───────────────────────────────
const themePickerStyles = StyleSheet.create({
  // 两列主题卡片格子 / two-column theme card grid
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  themeCard: { width: "47%", borderRadius: 16, padding: 14, alignItems: "center", overflow: "hidden", minHeight: 130, justifyContent: "center" },

  // 主题颜色预览点 / colour preview dots
  themePreviewRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  previewDot: { width: 8, height: 8, borderRadius: 4 },

  // 主题名称和描述 / theme name and description
  themeEmoji: { fontSize: 28, marginBottom: 6 },
  themeName: { fontWeight: "800", fontSize: 15, marginBottom: 2 },
  themeDesc: { fontSize: 10, textAlign: "center" },

  // 选中时显示的勾选徽章 / checkmark badge when active
  activeCheck: { position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
});

// ─── ThemePickerModal (主题选择弹窗) ─────────────────────────────────────────
/*
底部弹窗：列出全部可选主题，点击切换。
Bottom sheet listing all available themes as tappable cards.
*/
function ThemePickerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { themeKey, setTheme, theme: T } = useTheme();

  // 选中主题并关闭弹窗 / select theme and close modal
  function handleThemeSelect(key: ThemeKey) {
    setTheme(key);
    onClose();
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={sharedModalStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}
          style={[sharedModalStyles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[sharedModalStyles.handle, { backgroundColor: T.border }]} />
          <Text style={[sharedModalStyles.sheetTitle, { color: T.text }]}>Choose Theme</Text>
          <Text style={[sharedModalStyles.sheetSub, { color: T.muted }]}>Select your preferred app style</Text>

          {/* 两列主题卡片格子 / two-column theme card grid */}
          <View style={themePickerStyles.themeGrid}>
            {(Object.values(THEMES) as Theme[]).map((t) => {
              const isActive = themeKey === t.key;

              // 激活时加粗边框 / thicker border when active
              let cardBorderColor = t.border;
              let cardBorderWidth = 1.5;
              if (isActive) {
                cardBorderColor = t.accent;
                cardBorderWidth = 2.5;
              }

              // 颜色预览点（固定三色）/ colour preview dots (fixed 3 colours)
              const previewColors = [t.green, t.red, t.accent];

              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.8}
                  onPress={() => handleThemeSelect(t.key as ThemeKey)}
                  style={[themePickerStyles.themeCard, {
                    backgroundColor: t.bg,
                    borderColor: cardBorderColor,
                    borderWidth: cardBorderWidth,
                  }]}
                >
                  {/* 主题颜色预览点 / colour preview dots */}
                  <View style={themePickerStyles.themePreviewRow}>
                    {previewColors.map((c, i) => (
                      <View key={i} style={[themePickerStyles.previewDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                  <Text style={themePickerStyles.themeEmoji}>{t.emoji}</Text>
                  <Text style={[themePickerStyles.themeName, { color: t.text }]}>{t.name}</Text>
                  <Text style={[themePickerStyles.themeDesc, { color: t.muted }]}>{t.desc}</Text>
                  {/* 选中时显示的勾选徽章 / checkmark badge when active */}
                  {isActive && (
                    <View style={[themePickerStyles.activeCheck, { backgroundColor: t.accent }]}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={sharedModalStyles.cancelBtn} onPress={onClose}>
            <Text style={[sharedModalStyles.cancelBtnText, { color: T.muted }]}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── AvatarModal styles (头像管理弹窗样式) ────────────────────────────────────
const avatarModalStyles = StyleSheet.create({
  // 选项行 / option rows
  avatarOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  avatarOptionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  avatarOptionTitle: { fontWeight: "700", fontSize: 15 },
  avatarOptionSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22, lineHeight: 24 },
});

// ─── AvatarModal (头像管理弹窗) ───────────────────────────────────────────────
/*
底部弹窗：拍照 / 选相册 / 删除头像。
Bottom sheet with options: Take Photo / Choose from Gallery / Remove Photo.
*/
function AvatarModal({ visible, onClose, onCamera, onGallery, onRemove, hasPhoto }: {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onRemove: () => void;
  hasPhoto: boolean;
}) {
  const { theme: T } = useTheme();

  // 拍照和相册选项 / camera and gallery options
  const options = [
    { icon: "📷", bg: T.accent + "20", title: "Take Photo",            sub: "Use your camera",       onPress: onCamera  },
    { icon: "🖼️", bg: T.green  + "20", title: "Choose from Gallery",   sub: "Pick an existing photo", onPress: onGallery },
  ];

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={sharedModalStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}
          style={[sharedModalStyles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[sharedModalStyles.handle, { backgroundColor: T.border }]} />
          <Text style={[sharedModalStyles.sheetTitle, { color: T.text }]}>Change Profile Photo</Text>

          {/* 拍照和相册选项 / camera and gallery options */}
          {options.map(o => (
            <TouchableOpacity key={o.title} style={avatarModalStyles.avatarOption} onPress={o.onPress} activeOpacity={0.8}>
              <View style={[avatarModalStyles.avatarOptionIcon, { backgroundColor: o.bg }]}>
                <Text style={{ fontSize: 22 }}>{o.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[avatarModalStyles.avatarOptionTitle, { color: T.text }]}>{o.title}</Text>
                <Text style={[avatarModalStyles.avatarOptionSub,   { color: T.muted }]}>{o.sub}</Text>
              </View>
              <Text style={[avatarModalStyles.chevron, { color: T.muted }]}>›</Text>
            </TouchableOpacity>
          ))}

          {/* 仅在有自定义头像时显示删除选项 / remove option only shown when a custom photo exists */}
          {hasPhoto && (
            <TouchableOpacity style={avatarModalStyles.avatarOption} onPress={onRemove} activeOpacity={0.8}>
              <View style={[avatarModalStyles.avatarOptionIcon, { backgroundColor: T.red + "20" }]}>
                <Text style={{ fontSize: 22 }}>🗑️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[avatarModalStyles.avatarOptionTitle, { color: T.red }]}>Remove Photo</Text>
                <Text style={[avatarModalStyles.avatarOptionSub, { color: T.muted }]}>Go back to default avatar</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={sharedModalStyles.cancelBtn} onPress={onClose}>
            <Text style={[sharedModalStyles.cancelBtnText, { color: T.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── VehicleModal styles (车辆新增/编辑弹窗样式) ──────────────────────────────
const vehicleModalStyles = StyleSheet.create({
  // 输入字段 / input fields
  inputLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 14 },

  // OKU 开关行 / OKU toggle row
  okuRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, padding: 14, marginBottom: 20 },
  okuLabel: { fontWeight: "600", fontSize: 14 },
  okuSub: { fontSize: 12, marginTop: 2 },

  // 保存按钮 / save button
  saveBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  saveBtnText: { color: "white", fontWeight: "800", fontSize: 15 },
});

// ─── VehicleModal (车辆新增/编辑弹窗) ────────────────────────────────────────
/*
底部弹窗表单：新增或编辑车辆（车牌 + 车型 + OKU 开关）。
Bottom sheet form for adding or editing a vehicle.
*/
function VehicleModal({ visible, vehicle, onSave, onClose }: {
  visible: boolean;
  vehicle?: Vehicle;
  onSave: (plate: string, model: string, isOKU: boolean) => void;
  onClose: () => void;
}) {
  const { theme: T } = useTheme();

  // vehicle 可能是 undefined，用 if 判断来设置初始值
  // vehicle may be undefined — use if to safely set initial state values
  let initialPlate = "";
  if (vehicle) { initialPlate = vehicle.plate; }
  const [plate, setPlate] = useState(initialPlate);

  let initialModel = "";
  if (vehicle) { initialModel = vehicle.model; }
  const [model, setModel] = useState(initialModel);

  let initialIsOKU = false;
  if (vehicle) { initialIsOKU = vehicle.isOKU; }
  const [isOKU, setIsOKU] = useState(initialIsOKU);

  // 弹窗标题：编辑已有车辆 or 新增车辆 / modal title: editing vs adding
  let modalTitle = "Add Vehicle";
  if (vehicle) { modalTitle = "Edit Vehicle"; }

  // 保存按钮文字：编辑显示 Save Changes，新增显示注册 + 年费
  // Save button label: editing shows Save Changes, adding shows Register + fee
  let saveBtnLabel = `Register & Pay RM${ANNUAL_FEE}`;
  if (vehicle) { saveBtnLabel = "Save Changes"; }

  // 保存并关闭 / save then close
  function handleSave() {
    onSave(plate, model, isOKU);
    onClose();
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={sharedModalStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}
          style={[sharedModalStyles.sheet, { backgroundColor: T.card, borderColor: T.border }]}>
          <View style={[sharedModalStyles.handle, { backgroundColor: T.border }]} />
          <Text style={[sharedModalStyles.sheetTitle, { color: T.text }]}>{modalTitle}</Text>
          <Text style={[sharedModalStyles.sheetSub, { color: T.muted }]}>Annual fee: RM{ANNUAL_FEE} per vehicle</Text>

          {/* 车牌号输入 / plate number input */}
          <Text style={[vehicleModalStyles.inputLabel, { color: T.muted }]}>Plate Number</Text>
          <TextInput
            style={[vehicleModalStyles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
            value={plate}
            onChangeText={setPlate}
            placeholder="e.g. WXY 1234"
            placeholderTextColor={T.muted}
            autoCapitalize="characters"
          />

          {/* 车型输入 / vehicle model input */}
          <Text style={[vehicleModalStyles.inputLabel, { color: T.muted }]}>Vehicle Model</Text>
          <TextInput
            style={[vehicleModalStyles.input, { backgroundColor: T.bg, borderColor: T.border, color: T.text }]}
            value={model}
            onChangeText={setModel}
            placeholder="e.g. Honda Civic (White)"
            placeholderTextColor={T.muted}
          />

          {/* OKU 开关，开启后可使用 OKU 专用车位 / OKU toggle, enables access to OKU reserved spots */}
          <View style={[vehicleModalStyles.okuRow, { backgroundColor: T.bg }]}>
            <View>
              <Text style={[vehicleModalStyles.okuLabel, { color: T.text }]}>OKU Registered Vehicle</Text>
              <Text style={[vehicleModalStyles.okuSub,   { color: T.muted }]}>Enables OKU parking spots</Text>
            </View>
            <Switch
              value={isOKU}
              onValueChange={setIsOKU}
              trackColor={{ false: T.border, true: T.orange + "80" }}
              thumbColor={isOKU ? T.orange : T.muted}
            />
          </View>

          <TouchableOpacity
            style={[vehicleModalStyles.saveBtn, { backgroundColor: T.accent }]}
            onPress={handleSave}
          >
            <Text style={vehicleModalStyles.saveBtnText}>{saveBtnLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sharedModalStyles.cancelBtn} onPress={onClose}>
            <Text style={[sharedModalStyles.cancelBtnText, { color: T.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── VehicleCard styles (车辆卡片样式) ───────────────────────────────────────
const vehicleCardStyles = StyleSheet.create({
  // 卡片容器 / card container
  vehicleCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  vehicleLeft: { flexDirection: "row", gap: 12, flex: 1 },
  vehicleEmoji: { fontSize: 28, marginTop: 2 },

  // 车牌行 / plate row
  vehiclePlateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  plateText: { fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  okuBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  okuBadgeText: { fontSize: 10, fontWeight: "800" },

  // 车型和缴费状态 / model and payment status
  vehicleModel: { fontSize: 12, marginBottom: 6 },
  paidBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  paidBadgeText: { fontSize: 11, fontWeight: "700" },

  // 编辑/删除操作 / edit/remove actions
  vehicleActions: { gap: 8 },
  vActionEdit:   { fontWeight: "700", fontSize: 12 },
  vActionRemove: { fontWeight: "700", fontSize: 12 },
});

// ─── VehicleCard (车辆卡片) ───────────────────────────────────────────────────
/*
显示单辆已注册车辆，包含编辑和删除操作。
Displays a single registered vehicle with Edit and Remove actions.
*/
function VehicleCard({ vehicle, onEdit, onRemove }: {
  vehicle: Vehicle;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { theme: T } = useTheme();

  // OKU 或普通车图标 / OKU or regular car icon
  let vehicleEmoji = "🚗";
  if (vehicle.isOKU) {
    vehicleEmoji = "♿";
  }

  // 年费缴纳状态徽章颜色和文字 / annual fee badge colour and label
  let paidBg       = T.red   + "18";
  let paidBorder   = T.red   + "44";
  let paidText     = "⚠️ Fee Unpaid";
  let paidTextColor = T.red;
  if (vehicle.isPaid) {
    paidBg        = T.green + "18";
    paidBorder    = T.green + "44";
    paidText      = "✅ Annual Fee Paid";
    paidTextColor = T.green;
  }

  return (
    <View style={[vehicleCardStyles.vehicleCard, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={vehicleCardStyles.vehicleLeft}>
        <Text style={vehicleCardStyles.vehicleEmoji}>{vehicleEmoji}</Text>
        <View>
          <View style={vehicleCardStyles.vehiclePlateRow}>
            <Text style={[vehicleCardStyles.plateText, { color: T.text }]}>{vehicle.plate}</Text>
            {vehicle.isOKU && (
              <View style={[vehicleCardStyles.okuBadge, { backgroundColor: T.orange + "22", borderColor: T.orange + "55" }]}>
                <Text style={[vehicleCardStyles.okuBadgeText, { color: T.orange }]}>OKU</Text>
              </View>
            )}
          </View>
          <Text style={[vehicleCardStyles.vehicleModel, { color: T.muted }]}>{vehicle.model}</Text>
          {/* 年费缴纳状态徽章 / annual fee payment status badge */}
          <View style={[vehicleCardStyles.paidBadge, { backgroundColor: paidBg, borderColor: paidBorder }]}>
            <Text style={[vehicleCardStyles.paidBadgeText, { color: paidTextColor }]}>{paidText}</Text>
          </View>
        </View>
      </View>
      <View style={vehicleCardStyles.vehicleActions}>
        <TouchableOpacity onPress={onEdit}>
          <Text style={[vehicleCardStyles.vActionEdit, { color: T.accent }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove}>
          <Text style={[vehicleCardStyles.vActionRemove, { color: T.red }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SettingRow styles (设置列表行样式) ──────────────────────────────────────
const settingRowStyles = StyleSheet.create({
  // 行容器 / row container
  settingRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },

  // 左侧图标容器 / left icon container
  settingIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },

  // 标题和副标题 / label and sub-label
  settingLabel: { fontSize: 14, fontWeight: "600" },
  settingSub:   { fontSize: 11, marginTop: 2 },

  // 右侧箭头 / right chevron
  chevron: { fontSize: 22, lineHeight: 24 },
});

// ─── SettingRow (设置列表行) ──────────────────────────────────────────────────
/*
可复用的设置行组件：图标、标题、可选副标题、右侧插槽。
Reusable settings row with icon, label, optional subtitle, and right slot.
*/
function SettingRow({ icon, label, sub, onPress, right }: {
  icon: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const { theme: T } = useTheme();

  // 可点击时降低透明度反馈，否则完全不透明 / lower opacity on press if tappable, opaque otherwise
  let rowActiveOpacity = 1;
  if (onPress) {
    rowActiveOpacity = 0.7;
  }

  // 右侧内容：自定义插槽 > 箭头（可点击时）> 空 / right slot: custom > chevron (if tappable) > nothing
  function renderRight() {
    if (right) {
      return right;
    }
    if (onPress) {
      return <Text style={[settingRowStyles.chevron, { color: T.muted }]}>›</Text>;
    }
    return null;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={rowActiveOpacity} style={settingRowStyles.settingRow}>
      <View style={[settingRowStyles.settingIcon, { backgroundColor: T.accent + "15" }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[settingRowStyles.settingLabel, { color: T.text }]}>{label}</Text>
        {sub && <Text style={[settingRowStyles.settingSub, { color: T.muted }]}>{sub}</Text>}
      </View>
      {/* 自定义右侧内容，或可点击时显示箭头 / custom right content, or chevron when tappable */}
      {renderRight()}
    </TouchableOpacity>
  );
}

// ─── ProfileScreen styles (个人资料主页面样式) ────────────────────────────────
const styles = StyleSheet.create({
  // 页面容器 / page containers
  screen: { flex: 1 }, // 全屏容器，背景由 _layout.tsx 渐变填充 / full-screen, gradient bg from _layout.tsx
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100, backgroundColor: "transparent" }, // 底部留空给 tab bar / bottom pad for tab bar

  // 顶部标题栏 / page header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13 },

  // 学生资料卡 / student info card
  avatarCard: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 20 },
  avatarWrap: { position: "relative", marginBottom: 6 }, // 头像和相机徽章的定位容器 / wrapper for avatar + camera badge
  avatarCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  avatarImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 2 },
  avatarEmoji: { fontSize: 40 },
  cameraBadge: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 2 },
  changePhotoHint: { fontSize: 12, fontWeight: "600", marginBottom: 12 },
  studentName: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  studentCourse: { fontSize: 13, marginBottom: 12 },
  idBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10 },
  idText: { fontWeight: "700", fontSize: 12, letterSpacing: 0.5 },
  infoRow: { flexDirection: "row", width: "100%", borderRadius: 12, padding: 12 },
  infoItem: { flex: 1, alignItems: "center", gap: 4 },
  infoIcon: { fontSize: 16 },
  infoVal: { fontSize: 11, textAlign: "center" },
  infoDivider: { width: 1, marginHorizontal: 8 },

  // 主题选择按钮 / theme picker button
  themePickerBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },

  // 区域标题 / section headers
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
  sectionSub: { fontSize: 11 },

  // 新增车辆按钮 / add vehicle button
  addVehicleBtn: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 16, paddingVertical: 14, alignItems: "center", marginBottom: 4 },
  addVehicleText: { fontWeight: "700", fontSize: 14 },

  // 设置卡片容器和分隔线 / settings card container and dividers
  settingCard: { borderWidth: 1, borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  rowDivider: { height: 1, marginLeft: 64 },

  // 登出 + 页脚 / logout and footer
  logoutBtn: { borderWidth: 1, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginBottom: 20 },
  logoutText: { fontWeight: "800", fontSize: 15 },
  footer: { fontSize: 11, textAlign: "center" },
});

// ─── ProfileScreen (个人资料主页面) ───────────────────────────────────────────
export default function ProfileScreen() {

  const { theme: T, themeKey } = useTheme();

  // 车辆来自 ParkingContext，修改后同步到 Home 和 Map
  // Vehicles from ParkingContext — changes sync to Home and Map
  const { vehicles, setVehicles } = useParkingContext();

  // 头像路径 / custom avatar image URI
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  // 各弹窗可见性 / modal visibility states
  const [avatarModal,  setAvatarModal]  = useState(false);
  const [themeModal,   setThemeModal]   = useState(false);
  const [vehicleModal, setVehicleModal] = useState(false);
  // 正在编辑的车辆 / vehicle currently being edited
  const [editTarget, setEditTarget] = useState<Vehicle | undefined>(undefined);
  // 通知开关 / notification toggles
  const [notifP, setNotifP] = useState(true); // 停车提醒 / parking reminders
  const [notifO, setNotifO] = useState(true); // 超时警告 / overstay alerts
  // 评分弹窗 / star rating modal
  const [ratingVisible, setRatingVisible] = useState(false);
  const [hoveredStar,   setHoveredStar]   = useState(0); // 悬停预览星星 / hovered star preview

  // 每个星级对应的反馈弹窗文字 / per-star alert messages for the Rate App feature
  const starMessages: Record<number, { title: string; message: string }> = {
    1: { title: "1 Star",  message: "Looks like you don't know how to use it. Goodbye." },
    2: { title: "2 Stars", message: "Maybe it's not the app's problem." },
    3: { title: "3 Stars", message: "Indecision is also a choice." },
    4: { title: "4 Stars", message: "You're very close to the right answer." },
    5: { title: "5 Stars", message: "Congratulations, you made the right decision." },
  };

  // ─── 头像处理函数 / Avatar handlers ────────────────────────────────────────

  /* 打开相机，将拍摄结果设为头像 / open camera and set result as avatar */
  async function handleCamera() {
    setAvatarModal(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission Needed", "Please allow camera access in Settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  /* 打开相册，将选择结果设为头像 / open gallery and set result as avatar */
  async function handleGallery() {
    setAvatarModal(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Gallery Permission Needed", "Please allow photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  /* 删除自定义头像，恢复默认 emoji / remove custom avatar and revert to default emoji */
  function handleRemoveAvatar() {
    setAvatarModal(false);
    Alert.alert("Remove Photo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setAvatarUri(null) },
    ]);
  }

  // ─── 车辆处理函数 / Vehicle handlers ────────────────────────────────────────

  /* 新增车辆到列表 / add a new vehicle to the list */
  function addVehicle(plate: string, model: string, isOKU: boolean) {
    if (!plate.trim()) {
      Alert.alert("Error", "Please enter a plate number.");
      return;
    }
    if (vehicles.length >= MAX_VEHICLES) {
      Alert.alert("Limit Reached", `Maximum ${MAX_VEHICLES} vehicles allowed.`);
      return;
    }
    const updated = [...vehicles, {
      id: Date.now().toString(),
      plate: plate.trim().toUpperCase(),
      model,
      isOKU,
      isPaid: false, // 新车辆默认未付费 / new vehicles start unpaid
    }];
    setVehicles(updated);
    Alert.alert("✅ Registered", `${plate.trim().toUpperCase()} added.\nPlease pay RM${ANNUAL_FEE} at the admin counter.`);
  }

  /* 编辑已有车辆信息 / edit an existing vehicle's details */
  function editVehicle(plate: string, model: string, isOKU: boolean) {
    if (!editTarget) {
      return;
    }
    // 遍历所有车辆，找到目标车辆后更新其信息 / loop through all vehicles and update the target
    const updated: Vehicle[] = [];
    for (const v of vehicles) {
      if (v.id === editTarget.id) {
        updated.push({ ...v, plate: plate.trim().toUpperCase(), model, isOKU });
      } else {
        updated.push(v);
      }
    }
    setVehicles(updated);
  }

  /* 二次确认后删除车辆 / remove a vehicle after user confirmation */
  function removeVehicle(id: string) {
    Alert.alert("Remove Vehicle", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => setVehicles(vehicles.filter(v => v.id !== id)),
      },
    ]);
  }

  /* 打开编辑车辆弹窗 / open vehicle modal in edit mode */
  function handleEditVehicle(v: Vehicle) {
    setEditTarget(v);
    setVehicleModal(true);
  }

  /* 打开新增车辆弹窗 / open vehicle modal in add mode */
  function handleAddVehicle() {
    setEditTarget(undefined);
    setVehicleModal(true);
  }

  // ─── 账号处理函数 / Account handlers ────────────────────────────────────────

  /* 显示登出确认弹窗 / show logout confirmation alert */
  function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel",  style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => {} }, // TODO: 清除会话并跳转登录页 / clear session & navigate to login
    ]);
  }

  /* 选择星级后关闭弹窗并显示对应反馈 / handle star selection and show feedback */
  function handleStarSelect(star: number) {
    setRatingVisible(false);
    setHoveredStar(0);
    const { title, message } = starMessages[star];
    // 等弹窗关闭动画结束再弹 alert / delay so modal close animation finishes before alert
    setTimeout(() => Alert.alert(title, message, [{ text: "OK" }]), 300);
  }

  /* 关闭评分弹窗并重置悬停状态 / close rating modal and reset hover state */
  function handleCloseRating() {
    setRatingVisible(false);
    setHoveredStar(0);
  }

  // VehicleModal 的 onSave：编辑模式用 editVehicle，新增模式用 addVehicle
  // VehicleModal onSave: editVehicle in edit mode, addVehicle in add mode
  function getOnSaveHandler() {
    if (editTarget) {
      return editVehicle;
    } else {
      return addVehicle;
    }
  }

  // 头像：有自定义图片则显示 Image，否则显示默认 emoji
  // Avatar: show Image if custom URI exists, otherwise show default emoji
  function renderAvatar() {
    if (avatarUri) {
      return <Image source={{ uri: avatarUri }} style={[styles.avatarImage, { borderColor: T.accent + "55" }]} />;
    } else {
      return (
        <View style={[styles.avatarCircle, { backgroundColor: T.accent + "18", borderColor: T.accent + "55" }]}>
          <Text style={styles.avatarEmoji}>👨‍🎓</Text>
        </View>
      );
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* 顶部标题栏 / page header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>Profile</Text>
            <Text style={[styles.subtitle, { color: T.muted }]}>Account & Settings</Text>
          </View>
          <Image source={require("../../assets/images/itkia.png")} style={{ width: 80, height: 40, resizeMode: "contain" }} />
        </View>

        {/* 学生资料卡 / student info card */}
        <View style={[styles.avatarCard, { backgroundColor: T.card, borderColor: T.border }]}>
          {/* 点击头像打开头像弹窗 / tappable avatar, opens AvatarModal */}
          <TouchableOpacity onPress={() => setAvatarModal(true)} activeOpacity={0.85} style={styles.avatarWrap}>
            {renderAvatar()}
            {/* 叠加在头像右下角的相机图标 / camera badge overlaying avatar */}
            <View style={[styles.cameraBadge, { backgroundColor: T.accent, borderColor: T.bg }]}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.changePhotoHint, { color: T.accent }]}>Tap to change photo</Text>
          <Text style={[styles.studentName,   { color: T.text  }]}>{STUDENT.name}</Text>
          <Text style={[styles.studentCourse, { color: T.muted }]}>{STUDENT.course} · {STUDENT.year}</Text>
          <View style={[styles.idBadge, { backgroundColor: T.accent + "18", borderColor: T.accent + "44" }]}>
            <Text style={[styles.idText, { color: T.accent }]}>ID: {STUDENT.id}</Text>
          </View>

          {/* 邮箱和电话行 / email + phone row */}
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

        {/* 外观：主题选择按钮 / Appearance: theme picker button */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>APPEARANCE</Text>
        <TouchableOpacity
          style={[styles.themePickerBtn, { backgroundColor: T.card, borderColor: T.border }]}
          onPress={() => setThemeModal(true)}
          activeOpacity={0.8}
        >
          <View style={[settingRowStyles.settingIcon, { backgroundColor: T.accent + "15" }]}>
            <Text style={{ fontSize: 18 }}>🎨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[settingRowStyles.settingLabel, { color: T.text }]}>App Theme</Text>
            <Text style={[settingRowStyles.settingSub, { color: T.muted }]}>
              {THEMES[themeKey].emoji} {THEMES[themeKey].name} — {THEMES[themeKey].desc}
            </Text>
          </View>
          <Text style={[settingRowStyles.chevron, { color: T.muted }]}>›</Text>
        </TouchableOpacity>

        {/* 车辆管理区域 / vehicles section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: T.muted }]}>MY VEHICLES</Text>
          <Text style={[styles.sectionSub, { color: T.muted }]}>{vehicles.length}/{MAX_VEHICLES} · RM{ANNUAL_FEE}/year</Text>
        </View>

        {vehicles.map(v => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            onEdit={() => handleEditVehicle(v)}
            onRemove={() => removeVehicle(v.id)}
          />
        ))}

        {/* 新增车辆按钮，达上限时隐藏 / add vehicle button, hidden when at max capacity */}
        {vehicles.length < MAX_VEHICLES && (
          <TouchableOpacity
            style={[styles.addVehicleBtn, { borderColor: T.accent + "55" }]}
            onPress={handleAddVehicle}
            activeOpacity={0.8}
          >
            <Text style={[styles.addVehicleText, { color: T.accent }]}>＋  Add Vehicle  (RM{ANNUAL_FEE}/year)</Text>
          </TouchableOpacity>
        )}

        {/* 通知设置 / notifications */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 24 }]}>NOTIFICATIONS</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow
            icon="🔔" label="Parking Reminders" sub="Notify when session is unusually long"
            right={<Switch value={notifP} onValueChange={setNotifP}
              trackColor={{ false: T.border, true: T.accent + "80" }}
              thumbColor={notifP ? T.accent : T.muted} />}
          />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow
            icon="⚠️" label="Overstay Alerts" sub="Warn before overstay is flagged"
            right={<Switch value={notifO} onValueChange={setNotifO}
              trackColor={{ false: T.border, true: T.accent + "80" }}
              thumbColor={notifO ? T.accent : T.muted} />}
          />
        </View>

        {/* 账号设置 / account settings */}
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

        {/* 应用信息 / app info */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 8 }]}>APP</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow icon="ℹ️" label="Version" sub="1.0.0 (Beta)" />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          {/* 评分按钮，打开星级评分弹窗 / rate app button, opens star rating modal */}
          <SettingRow icon="⭐" label="Rate This App" onPress={() => setRatingVisible(true)} />
        </View>

        {/* 登出按钮 / logout button */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: T.red + "18", borderColor: T.red + "44" }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={[styles.logoutText, { color: T.red }]}>🚪  Log Out</Text>
        </TouchableOpacity>

        <Text style={[styles.footer, { color: T.muted }]}>MDIS Campus Parking · Student Edition</Text>
      </ScrollView>

      {/* 弹窗在 ScrollView 外，层级最高 / modals outside ScrollView so they render above everything */}
      <ThemePickerModal visible={themeModal} onClose={() => setThemeModal(false)} />
      <AvatarModal
        visible={avatarModal} hasPhoto={!!avatarUri}
        onClose={() => setAvatarModal(false)}
        onCamera={handleCamera}
        onGallery={handleGallery}
        onRemove={handleRemoveAvatar}
      />
      <VehicleModal
        visible={vehicleModal}
        vehicle={editTarget}
        onSave={getOnSaveHandler()}
        onClose={() => setVehicleModal(false)}
      />

      {/* 星级评分弹窗 / star rating modal */}
      <Modal
        transparent
        visible={ratingVisible}
        animationType="fade"
        onRequestClose={handleCloseRating}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: T.card, borderRadius: 20, padding: 28, width: 300, alignItems: "center", borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: T.text, marginBottom: 6 }}>Rate This App</Text>
            <Text style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>Tap a star to submit your rating</Text>

            {/* 星星按钮：悬停或已选显示实心，否则空心
                Star buttons: filled when hovered, hollow otherwise */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(star => {
                // 悬停时填色星，否则空心 / filled when hovered, hollow otherwise
                let starColor = T.muted;
                let starChar  = "☆";
                if (star <= hoveredStar) {
                  starColor = "#F5A623";
                  starChar  = "★";
                }
                return (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleStarSelect(star)}
                    onPressIn={() => setHoveredStar(star)}
                    onPressOut={() => setHoveredStar(0)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 38, color: starColor }}>{starChar}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity onPress={handleCloseRating} style={{ marginTop: 22 }}>
              <Text style={{ color: T.muted, fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}