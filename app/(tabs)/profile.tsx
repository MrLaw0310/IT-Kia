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

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { useParkingContext, Vehicle } from "../../utils/ParkingContext";
import { Theme, ThemeKey, THEMES, useTheme } from "../../utils/ThemeContext";

// ─── 常量 / Constants ─────────────────────────────────────────────────────────

// 每个学生账号最多注册车辆数
// Maximum number of vehicles per student account
const MAX_VEHICLES = 4;

// 年度停车费（马币）
// Annual parking fee in Malaysian Ringgit
const ANNUAL_FEE = 10;

// 硬编码学生资料，生产环境应改为真实认证 / API
// Hardcoded student profile — replace with real auth / API in production
const STUDENT = {
  name:   "Ahmad Faiz",
  id:     "22CS10042",
  course: "Diploma in Computer Science",
  year:   "Year 2",
  email:  "ahmdfaiz@student.mdis.edu.my",
  phone:  "+60 12-345 6789",
  isOKU:  false,
};

// 每个星级对应的反馈弹窗文字（提取为模块级常量，避免每次 render 重建）
// Per-star alert messages for the Rate App feature
// Extracted at module level to avoid recreating on every render
const STAR_MESSAGES: Record<number, { title: string; message: string }> = {
  1: { title: "1 Star",  message: "Looks like you don't know how to use it. Goodbye." },
  2: { title: "2 Stars", message: "Maybe it's not the app's problem." },
  3: { title: "3 Stars", message: "Indecision is also a choice." },
  4: { title: "4 Stars", message: "You're very close to the right answer." },
  5: { title: "5 Stars", message: "Congratulations, you made the right decision." },
};

// ─── Styles for ThemePickerModal ──────────────────────────────────────────────
const themePickerStyles = StyleSheet.create({

  // 半透明遮罩层
  // Semi-transparent overlay
  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent:  "flex-end",
  },

  // 底部弹出面板
  // Bottom sheet panel
  sheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              24,
    borderTopWidth:       1,
  },

  // 拖动把手
  // Drag handle
  handle: {
    width:        40,
    height:       4,
    borderRadius: 999,
    alignSelf:    "center",
    marginBottom: 20,
  },

  // 弹窗标题
  // Sheet title
  sheetTitle: {
    fontSize:     20,
    fontWeight:   "800",
    marginBottom: 4,
  },

  // 弹窗副标题
  // Sheet subtitle
  sheetSub: {
    fontSize:     13,
    marginBottom: 20,
  },

  // 主题卡片两列网格
  // Two-column theme card grid
  themeGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           10,
    marginBottom:  20,
  },

  // 单个主题卡片
  // Single theme card
  themeCard: {
    width:          "47%",
    borderRadius:   16,
    padding:        14,
    alignItems:     "center",
    overflow:       "hidden",
    minHeight:      130,
    justifyContent: "center",
  },

  // 主题颜色预览点横排
  // Row of colour preview dots
  themePreviewRow: {
    flexDirection: "row",
    gap:           4,
    marginBottom:  8,
  },

  // 单个预览色点
  // Single preview colour dot
  previewDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },

  // 主题 emoji 大图标
  // Theme emoji — large icon
  themeEmoji: {
    fontSize:     28,
    marginBottom: 6,
  },

  // 主题名称文字
  // Theme name text
  themeName: {
    fontWeight:   "800",
    fontSize:     15,
    marginBottom: 2,
  },

  // 主题描述小字
  // Theme description — small text
  themeDesc: {
    fontSize:   10,
    textAlign:  "center",
  },

  // 选中状态的勾选徽章（左上角）
  // Checkmark badge shown on the active theme card (top-left corner)
  activeCheck: {
    position:       "absolute",
    top:            8,
    left:           8,
    width:          20,
    height:         20,
    borderRadius:   10,
    justifyContent: "center",
    alignItems:     "center",
  },

  // 取消按钮
  // Cancel button
  cancelBtn: {
    alignItems:     "center",
    paddingVertical: 10,
  },

  // 取消按钮文字
  // Cancel button text
  cancelBtnText: {
    fontSize: 14,
  },
});

// ─── ThemePickerModal ─────────────────────────────────────────────────────────
/*
底部弹窗：列出全部可选主题，点击切换。
Bottom sheet listing all available themes as tappable cards.
*/
function ThemePickerModal({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}) {
  const { themeKey, setTheme, theme: T } = useTheme();

  // 主题列表（从 THEMES 对象提取，确保顺序固定）
  // Theme list — extracted from THEMES object with consistent ordering
  const themeList = Object.values(THEMES) as Theme[];

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={themePickerStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            themePickerStyles.sheet,
            { backgroundColor: T.card, borderColor: T.border },
          ]}
        >
          {/* 拖动把手 / Drag handle */}
          <View style={[themePickerStyles.handle, { backgroundColor: T.border }]} />

          {/* 标题和副标题 / Title and subtitle */}
          <Text style={[themePickerStyles.sheetTitle, { color: T.text }]}>
            Choose Theme
          </Text>
          <Text style={[themePickerStyles.sheetSub, { color: T.muted }]}>
            Select your preferred app style
          </Text>

          {/* 主题卡片网格 / Theme card grid */}
          <View style={themePickerStyles.themeGrid}>
            {themeList.map(function renderThemeCard(t) {
              const isActive = themeKey === t.key;

              // 选中时边框更粗更亮
              // Active card has thicker, brighter border
              let borderWidth: number;
              let borderColor: string;
              if (isActive) {
                borderWidth = 2.5;
                borderColor = t.accent;
              } else {
                borderWidth = 1.5;
                borderColor = t.border;
              }

              // 颜色预览点列表（绿、红、强调色）
              // Colour preview dots — green, red, accent
              const previewColors = [t.green, t.red, t.accent];

              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.8}
                  onPress={function selectTheme() {
                    setTheme(t.key as ThemeKey);
                    onClose();
                  }}
                  style={[
                    themePickerStyles.themeCard,
                    { backgroundColor: t.bg, borderColor, borderWidth },
                  ]}
                >
                  {/* 颜色预览点 / Colour preview dots */}
                  <View style={themePickerStyles.themePreviewRow}>
                    {previewColors.map(function renderDot(dotColor, dotIndex) {
                      return (
                        <View
                          key={dotIndex}
                          style={[themePickerStyles.previewDot, { backgroundColor: dotColor }]}
                        />
                      );
                    })}
                  </View>

                  {/* 主题 emoji 和文字 / Theme emoji and text */}
                  <Text style={themePickerStyles.themeEmoji}>{t.emoji}</Text>
                  <Text style={[themePickerStyles.themeName, { color: t.text }]}>
                    {t.name}
                  </Text>
                  <Text style={[themePickerStyles.themeDesc, { color: t.muted }]}>
                    {t.desc}
                  </Text>

                  {/* 选中勾选徽章（仅活跃主题显示）
                      Checkmark badge — only shown on the active theme */}
                  {isActive && (
                    <View style={[themePickerStyles.activeCheck, { backgroundColor: t.accent }]}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>
                        ✓
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 关闭按钮 / Close button */}
          <TouchableOpacity style={themePickerStyles.cancelBtn} onPress={onClose}>
            <Text style={[themePickerStyles.cancelBtnText, { color: T.muted }]}>
              Close
            </Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles for AvatarModal ───────────────────────────────────────────────────
const avatarModalStyles = StyleSheet.create({

  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent:  "flex-end",
  },

  sheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              24,
    borderTopWidth:       1,
  },

  handle: {
    width:        40,
    height:       4,
    borderRadius: 999,
    alignSelf:    "center",
    marginBottom: 20,
  },

  sheetTitle: {
    fontSize:     20,
    fontWeight:   "800",
    marginBottom: 4,
  },

  // 单个选项行（图标 + 文字 + 箭头）
  // Single option row — icon, text, chevron
  option: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           14,
    paddingVertical: 14,
  },

  // 选项图标圆角背景容器
  // Rounded background container for the option icon
  optionIcon: {
    width:          48,
    height:         48,
    borderRadius:   14,
    justifyContent: "center",
    alignItems:     "center",
  },

  // 选项标题文字
  // Option title text
  optionTitle: {
    fontWeight: "700",
    fontSize:   15,
  },

  // 选项副标题文字
  // Option subtitle text
  optionSub: {
    fontSize:  12,
    marginTop: 2,
  },

  // 右侧箭头字符
  // Right chevron character
  chevron: {
    fontSize:   22,
    lineHeight: 24,
  },

  cancelBtn: {
    alignItems:      "center",
    paddingVertical: 12,
  },

  cancelBtnText: {
    fontSize: 14,
  },
});

// ─── AvatarModal ──────────────────────────────────────────────────────────────
/*
底部弹窗：拍照 / 选相册 / 删除头像。
Bottom sheet with options: Take Photo / Choose from Gallery / Remove Photo.
*/
function AvatarModal({ visible, onClose, onCamera, onGallery, onRemove, hasPhoto }: {
  visible:  boolean;
  onClose:  () => void;
  onCamera: () => void;
  onGallery:() => void;
  onRemove: () => void;
  hasPhoto: boolean;
}) {
  const { theme: T } = useTheme();

  // 固定选项列表（相机和相册）
  // Fixed option list — camera and gallery
  const standardOptions = [
    {
      icon:    "📷",
      bg:      T.accent + "20",
      title:   "Take Photo",
      sub:     "Use your camera",
      onPress: onCamera,
    },
    {
      icon:    "🖼️",
      bg:      T.green + "20",
      title:   "Choose from Gallery",
      sub:     "Pick an existing photo",
      onPress: onGallery,
    },
  ];

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={avatarModalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            avatarModalStyles.sheet,
            { backgroundColor: T.card, borderColor: T.border },
          ]}
        >
          {/* 拖动把手 / Drag handle */}
          <View style={[avatarModalStyles.handle, { backgroundColor: T.border }]} />

          {/* 标题 / Title */}
          <Text style={[avatarModalStyles.sheetTitle, { color: T.text }]}>
            Change Profile Photo
          </Text>

          {/* 相机和相册选项 / Camera and gallery options */}
          {standardOptions.map(function renderOption(option) {
            return (
              <TouchableOpacity
                key={option.title}
                style={avatarModalStyles.option}
                onPress={option.onPress}
                activeOpacity={0.8}
              >
                <View style={[avatarModalStyles.optionIcon, { backgroundColor: option.bg }]}>
                  <Text style={{ fontSize: 22 }}>{option.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[avatarModalStyles.optionTitle, { color: T.text }]}>
                    {option.title}
                  </Text>
                  <Text style={[avatarModalStyles.optionSub, { color: T.muted }]}>
                    {option.sub}
                  </Text>
                </View>
                <Text style={[avatarModalStyles.chevron, { color: T.muted }]}>›</Text>
              </TouchableOpacity>
            );
          })}

          {/* 删除选项（仅在有自定义头像时显示）
              Remove option — only shown when a custom photo exists */}
          {hasPhoto && (
            <TouchableOpacity
              style={avatarModalStyles.option}
              onPress={onRemove}
              activeOpacity={0.8}
            >
              <View style={[avatarModalStyles.optionIcon, { backgroundColor: T.red + "20" }]}>
                <Text style={{ fontSize: 22 }}>🗑️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[avatarModalStyles.optionTitle, { color: T.red }]}>
                  Remove Photo
                </Text>
                <Text style={[avatarModalStyles.optionSub, { color: T.muted }]}>
                  Go back to default avatar
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 取消按钮 / Cancel button */}
          <TouchableOpacity style={avatarModalStyles.cancelBtn} onPress={onClose}>
            <Text style={[avatarModalStyles.cancelBtnText, { color: T.muted }]}>
              Cancel
            </Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles for VehicleModal ──────────────────────────────────────────────────
const vehicleModalStyles = StyleSheet.create({

  overlay: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent:  "flex-end",
  },

  sheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              24,
    borderTopWidth:       1,
  },

  handle: {
    width:        40,
    height:       4,
    borderRadius: 999,
    alignSelf:    "center",
    marginBottom: 20,
  },

  sheetTitle: {
    fontSize:     20,
    fontWeight:   "800",
    marginBottom: 4,
  },

  sheetSub: {
    fontSize:     13,
    marginBottom: 20,
  },

  // 输入框标签
  // Input field label
  inputLabel: {
    fontSize:      12,
    letterSpacing: 0.5,
    marginBottom:  6,
  },

  // 文字输入框
  // Text input field
  input: {
    borderWidth:   1,
    borderRadius:  12,
    padding:       13,
    fontSize:      15,
    marginBottom:  14,
  },

  // OKU 开关行（标签 + Switch 横排）
  // OKU toggle row — label and switch side by side
  okuRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    borderRadius:   12,
    padding:        14,
    marginBottom:   8,
  },

  // OKU 标签文字
  // OKU toggle label text
  okuLabel: {
    fontWeight: "600",
    fontSize:   14,
  },

  // OKU 副标题文字
  // OKU toggle subtitle text
  okuSub: {
    fontSize:  12,
    marginTop: 2,
  },

  // OKU 启用时的警告横幅
  // Warning banner shown when OKU is toggled on
  okuWarning: {
    borderWidth:   1,
    borderRadius:  10,
    padding:       10,
    marginBottom:  14,
  },

  // OKU 警告文字
  // OKU warning text
  okuWarningText: {
    fontSize:   12,
    lineHeight: 18,
  },

  // 保存按钮
  // Save button
  saveBtn: {
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      "center",
    marginBottom:    10,
  },

  // 保存按钮文字
  // Save button text
  saveBtnText: {
    color:      "white",
    fontWeight: "800",
    fontSize:   15,
  },

  cancelBtn: {
    alignItems:      "center",
    paddingVertical: 10,
  },

  cancelBtnText: {
    fontSize: 14,
  },
});

// ─── VehicleModal ─────────────────────────────────────────────────────────────
/*
底部弹窗表单：新增或编辑车辆（车牌 + 车型 + OKU 开关）。
Bottom sheet form for adding or editing a vehicle (plate, model, OKU toggle).
*/
function VehicleModal({ visible, vehicle, onSave, onClose }: {
  visible:  boolean;
  vehicle?: Vehicle;
  onSave:   (plate: string, model: string, isOKU: boolean) => void;
  onClose:  () => void;
}) {
  const { theme: T } = useTheme();

  // useState 初始值不使用 ?. 和 ??，改为 if/else 先计算再传入
  // Initial state values use if/else instead of ?. and ?? operators
  let initialPlate: string;
  let initialModel: string;
  let initialIsOKU: boolean;
  if (vehicle) {
    initialPlate = vehicle.plate;
    initialModel = vehicle.model;
    initialIsOKU = vehicle.isOKU;
  } else {
    initialPlate = "";
    initialModel = "";
    initialIsOKU = false;
  }
  const [plate, setPlate] = useState(initialPlate);
  const [model, setModel] = useState(initialModel);
  const [isOKU, setIsOKU] = useState(initialIsOKU);

  // vehicle prop 变化时（切换编辑目标），同步重置表单内容
  // When vehicle prop changes (switching edit target), reset form fields to match
  useEffect(function syncFormToVehicle() {
    if (vehicle) {
      setPlate(vehicle.plate);
      setModel(vehicle.model);
      setIsOKU(vehicle.isOKU);
    } else {
      setPlate("");
      setModel("");
      setIsOKU(false);
    }
  }, [vehicle]);

  // 保存按钮文字（新增 vs 编辑）
  // Save button label — differs for add vs edit
  let saveBtnLabel: string;
  if (vehicle) {
    saveBtnLabel = "Save Changes";
  } else {
    saveBtnLabel = "Register & Pay RM" + ANNUAL_FEE;
  }

  // 弹窗标题（新增 vs 编辑）
  // Sheet title — differs for add vs edit
  let sheetTitleText: string;
  if (vehicle) {
    sheetTitleText = "Edit Vehicle";
  } else {
    sheetTitleText = "Add Vehicle";
  }

  // OKU 警告横幅颜色
  // OKU warning banner colours
  const okuWarningBg     = T.orange + "18";
  const okuWarningBorder = T.orange + "55";

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={vehicleModalStyles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            vehicleModalStyles.sheet,
            { backgroundColor: T.card, borderColor: T.border },
          ]}
        >
          {/* 拖动把手 / Drag handle */}
          <View style={[vehicleModalStyles.handle, { backgroundColor: T.border }]} />

          {/* 标题和副标题 / Title and subtitle */}
          <Text style={[vehicleModalStyles.sheetTitle, { color: T.text }]}>
            {sheetTitleText}
          </Text>
          <Text style={[vehicleModalStyles.sheetSub, { color: T.muted }]}>
            Annual fee: RM{ANNUAL_FEE} per vehicle
          </Text>

          {/* 车牌号输入框 / Plate number input */}
          <Text style={[vehicleModalStyles.inputLabel, { color: T.muted }]}>
            Plate Number
          </Text>
          <TextInput
            style={[
              vehicleModalStyles.input,
              { backgroundColor: T.bg, borderColor: T.border, color: T.text },
            ]}
            value={plate}
            onChangeText={setPlate}
            placeholder="e.g. WXY 1234"
            placeholderTextColor={T.muted}
            autoCapitalize="characters"
          />

          {/* 车型输入框 / Vehicle model input */}
          <Text style={[vehicleModalStyles.inputLabel, { color: T.muted }]}>
            Vehicle Model
          </Text>
          <TextInput
            style={[
              vehicleModalStyles.input,
              { backgroundColor: T.bg, borderColor: T.border, color: T.text },
            ]}
            value={model}
            onChangeText={setModel}
            placeholder="e.g. Honda Civic (White)"
            placeholderTextColor={T.muted}
          />

          {/* OKU 开关行 / OKU toggle row */}
          <View style={[vehicleModalStyles.okuRow, { backgroundColor: T.bg }]}>
            <View>
              <Text style={[vehicleModalStyles.okuLabel, { color: T.text }]}>
                OKU Registered Vehicle
              </Text>
              <Text style={[vehicleModalStyles.okuSub, { color: T.muted }]}>
                Enables OKU parking spots
              </Text>
            </View>
            <Switch
              value={isOKU}
              onValueChange={setIsOKU}
              trackColor={{ false: T.border, true: T.orange + "80" }}
              thumbColor={isOKU ? T.orange : T.muted}
            />
          </View>

          {/* OKU 启用时显示免责警告（不允许虚假申报）
              OKU disclaimer warning — shown when toggle is on */}
          {isOKU && (
            <View
              style={[
                vehicleModalStyles.okuWarning,
                { backgroundColor: okuWarningBg, borderColor: okuWarningBorder },
              ]}
            >
              <Text style={[vehicleModalStyles.okuWarningText, { color: T.orange }]}>
                ⚠️ OKU status requires official documentation. False declaration may result
                in account suspension and penalty.
              </Text>
            </View>
          )}

          {/* 保存按钮 / Save button */}
          <TouchableOpacity
            style={[vehicleModalStyles.saveBtn, { backgroundColor: T.accent }]}
            onPress={function handleSave() {
              onSave(plate, model, isOKU);
              onClose();
            }}
          >
            <Text style={vehicleModalStyles.saveBtnText}>{saveBtnLabel}</Text>
          </TouchableOpacity>

          {/* 取消按钮 / Cancel button */}
          <TouchableOpacity style={vehicleModalStyles.cancelBtn} onPress={onClose}>
            <Text style={[vehicleModalStyles.cancelBtnText, { color: T.muted }]}>
              Cancel
            </Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles for VehicleCard ───────────────────────────────────────────────────
const vehicleCardStyles = StyleSheet.create({

  // 卡片容器
  // Card container
  card: {
    borderWidth:    1,
    borderRadius:   16,
    padding:        14,
    marginBottom:   10,
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-start",
  },

  // 左侧内容区（emoji + 文字）
  // Left content area — emoji and text
  left: {
    flexDirection: "row",
    gap:           12,
    flex:          1,
  },

  // 车辆 emoji 图标
  // Vehicle emoji icon
  emoji: {
    fontSize:  28,
    marginTop: 2,
  },

  // 车牌号和 OKU 徽章横排
  // Plate number and OKU badge side by side
  plateRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    marginBottom:  2,
  },

  // 车牌号大字
  // Plate number — large bold text
  plateText: {
    fontSize:      17,
    fontWeight:    "900",
    letterSpacing: 1,
  },

  // OKU 小徽章
  // OKU badge — small pill
  okuBadge: {
    borderWidth:       1,
    borderRadius:      6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },

  // OKU 徽章文字
  // OKU badge text
  okuBadgeText: {
    fontSize:   10,
    fontWeight: "800",
  },

  // 车型描述文字
  // Vehicle model description text
  model: {
    fontSize:     12,
    marginBottom: 6,
  },

  // 缴费状态徽章
  // Annual fee payment status badge
  paidBadge: {
    borderWidth:       1,
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   3,
    alignSelf:         "flex-start",
  },

  // 缴费状态徽章文字
  // Payment status badge text
  paidBadgeText: {
    fontSize:   11,
    fontWeight: "700",
  },

  // 右侧操作按钮列（Edit / Remove）
  // Right action button column
  actions: {
    gap: 8,
  },

  // 编辑按钮文字
  // Edit action text
  editText: {
    fontWeight: "700",
    fontSize:   12,
  },

  // 删除按钮文字
  // Remove action text
  removeText: {
    fontWeight: "700",
    fontSize:   12,
  },
});

// ─── VehicleCard ──────────────────────────────────────────────────────────────
/*
显示单辆已注册车辆，包含编辑和删除操作。
Displays a single registered vehicle with Edit and Remove actions.
*/
function VehicleCard({ vehicle, onEdit, onRemove }: {
  vehicle:  Vehicle;
  onEdit:   () => void;
  onRemove: () => void;
}) {
  const { theme: T } = useTheme();

  // OKU 徽章颜色
  // OKU badge colours
  const okuBadgeBg     = T.orange + "22";
  const okuBadgeBorder = T.orange + "55";

  // 缴费状态徽章颜色（已缴 → 绿色，未缴 → 红色）
  // Payment status badge colours — green if paid, red if unpaid
  let paidBadgeBg:     string;
  let paidBadgeBorder: string;
  let paidBadgeText:   string;
  let paidBadgeColor:  string;
  if (vehicle.isPaid) {
    paidBadgeBg     = T.green + "18";
    paidBadgeBorder = T.green + "44";
    paidBadgeColor  = T.green;
    paidBadgeText   = "✅ Annual Fee Paid";
  } else {
    paidBadgeBg     = T.red + "18";
    paidBadgeBorder = T.red + "44";
    paidBadgeColor  = T.red;
    paidBadgeText   = "⚠️ Fee Unpaid";
  }

  // 车辆 emoji（OKU 车辆用轮椅图标）
  // Vehicle emoji — wheelchair for OKU vehicles
  let vehicleEmoji: string;
  if (vehicle.isOKU) {
    vehicleEmoji = "♿";
  } else {
    vehicleEmoji = "🚗";
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <View style={[vehicleCardStyles.card, { backgroundColor: T.card, borderColor: T.border }]}>

      {/* 左侧：图标 + 车辆信息 / Left: icon + vehicle info */}
      <View style={vehicleCardStyles.left}>
        <Text style={vehicleCardStyles.emoji}>{vehicleEmoji}</Text>
        <View>
          {/* 车牌 + OKU 徽章横排 / Plate and OKU badge side by side */}
          <View style={vehicleCardStyles.plateRow}>
            <Text style={[vehicleCardStyles.plateText, { color: T.text }]}>
              {vehicle.plate}
            </Text>
            {vehicle.isOKU && (
              <View
                style={[
                  vehicleCardStyles.okuBadge,
                  { backgroundColor: okuBadgeBg, borderColor: okuBadgeBorder },
                ]}
              >
                <Text style={[vehicleCardStyles.okuBadgeText, { color: T.orange }]}>
                  OKU
                </Text>
              </View>
            )}
          </View>

          {/* 车型描述 / Vehicle model */}
          <Text style={[vehicleCardStyles.model, { color: T.muted }]}>
            {vehicle.model}
          </Text>

          {/* 缴费状态徽章 / Payment status badge */}
          <View
            style={[
              vehicleCardStyles.paidBadge,
              { backgroundColor: paidBadgeBg, borderColor: paidBadgeBorder },
            ]}
          >
            <Text style={[vehicleCardStyles.paidBadgeText, { color: paidBadgeColor }]}>
              {paidBadgeText}
            </Text>
          </View>
        </View>
      </View>

      {/* 右侧：编辑和删除按钮 / Right: edit and remove actions */}
      <View style={vehicleCardStyles.actions}>
        <TouchableOpacity onPress={onEdit}>
          <Text style={[vehicleCardStyles.editText, { color: T.accent }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove}>
          <Text style={[vehicleCardStyles.removeText, { color: T.red }]}>Remove</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles for SettingRow ────────────────────────────────────────────────────
const settingRowStyles = StyleSheet.create({

  // 设置行容器（图标 + 文字 + 右侧插槽）
  // Setting row container — icon, text, right slot
  row: {
    flexDirection: "row",
    alignItems:    "center",
    padding:       14,
    gap:           12,
  },

  // 图标背景容器（圆角正方形）
  // Icon background — rounded square
  iconWrap: {
    width:          38,
    height:         38,
    borderRadius:   10,
    justifyContent: "center",
    alignItems:     "center",
  },

  // 设置项标题文字
  // Setting row label text
  label: {
    fontSize:   14,
    fontWeight: "600",
  },

  // 设置项副标题文字
  // Setting row subtitle text
  sub: {
    fontSize:  11,
    marginTop: 2,
  },

  // 右箭头字符
  // Right chevron
  chevron: {
    fontSize:   22,
    lineHeight: 24,
  },
});

// ─── SettingRow ───────────────────────────────────────────────────────────────
/*
可复用的设置列表行：图标 + 标题 + 可选副标题 + 右侧自定义插槽。
Reusable settings row: icon, label, optional subtitle, optional right slot.
*/
function SettingRow({ icon, label, sub, onPress, right }: {
  icon:    string;
  label:   string;
  sub?:    string;
  onPress?: () => void;
  right?:  React.ReactNode;
}) {
  const { theme: T } = useTheme();

  // 图标背景色（主题强调色 15% 透明度）
  // Icon background — accent at 15% opacity
  const iconBgColor = T.accent + "15";

  // 有 onPress 时显示箭头，无 onPress 时什么都不渲染
  // Show chevron when tappable, render nothing when not tappable
  let rightContent: React.ReactNode;
  if (right) {
    rightContent = right;
  } else if (onPress) {
    rightContent = (
      <Text style={[settingRowStyles.chevron, { color: T.muted }]}>›</Text>
    );
  } else {
    rightContent = null;
  }

  // 可点击时 activeOpacity 为 0.7，不可点击时为 1（无视觉反馈）
  // tappable rows have press feedback; non-tappable rows don't
  let pressOpacity: number;
  if (onPress) {
    pressOpacity = 0.7;
  } else {
    pressOpacity = 1;
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={pressOpacity}
      style={settingRowStyles.row}
    >
      {/* 图标 / Icon */}
      <View style={[settingRowStyles.iconWrap, { backgroundColor: iconBgColor }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>

      {/* 标题和副标题 / Label and subtitle */}
      <View style={{ flex: 1 }}>
        <Text style={[settingRowStyles.label, { color: T.text }]}>{label}</Text>
        {sub && (
          <Text style={[settingRowStyles.sub, { color: T.muted }]}>{sub}</Text>
        )}
      </View>

      {/* 右侧插槽（箭头或自定义内容）/ Right slot — chevron or custom content */}
      {rightContent}
    </TouchableOpacity>
  );
}

// ─── Styles for ProfileScreen ─────────────────────────────────────────────────
const styles = StyleSheet.create({

  // 全屏容器
  // Full-screen container
  screen: {
    flex: 1,
  },

  // 滚动内容区域
  // Scroll content area
  scroll: {
    padding:         20,
    paddingTop:      56,
    paddingBottom:   100,
    backgroundColor: "transparent",
  },

  // 顶部标题栏
  // Page header
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   16,
  },

  // 页面标题
  // Page title
  pageTitle: {
    fontSize:      24,
    fontWeight:    "800",
    letterSpacing: -0.5,
  },

  // 副标题
  // Subtitle
  subtitle: {
    fontSize: 13,
  },

  // 学生资料卡
  // Student info card
  avatarCard: {
    borderWidth:  1,
    borderRadius: 20,
    padding:      24,
    alignItems:   "center",
    marginBottom: 20,
  },

  // 头像和相机徽章的定位容器
  // Wrapper for avatar image and camera badge — enables absolute positioning
  avatarWrap: {
    position:     "relative",
    marginBottom: 6,
  },

  // 默认头像圆形容器（无自定义图片时显示）
  // Default avatar circle — shown when no custom photo is set
  avatarCircle: {
    width:          90,
    height:         90,
    borderRadius:   45,
    borderWidth:    2,
    justifyContent: "center",
    alignItems:     "center",
  },

  // 自定义头像图片
  // Custom avatar image
  avatarImage: {
    width:        90,
    height:       90,
    borderRadius: 45,
    borderWidth:  2,
  },

  // 默认头像 emoji
  // Default avatar emoji
  avatarEmoji: {
    fontSize: 40,
  },

  // 右下角相机图标徽章
  // Camera icon badge — bottom-right corner overlay
  cameraBadge: {
    position:       "absolute",
    bottom:         0,
    right:          0,
    width:          28,
    height:         28,
    borderRadius:   14,
    justifyContent: "center",
    alignItems:     "center",
    borderWidth:    2,
  },

  // "Tap to change photo" 提示文字
  // "Tap to change photo" hint text
  changePhotoHint: {
    fontSize:     12,
    fontWeight:   "600",
    marginBottom: 12,
  },

  // 学生姓名
  // Student name
  studentName: {
    fontSize:     20,
    fontWeight:   "800",
    marginBottom: 4,
  },

  // 课程和年级
  // Course and year
  studentCourse: {
    fontSize:     13,
    marginBottom: 12,
  },

  // 学号徽章（胶囊形）
  // Student ID badge — pill shaped
  idBadge: {
    borderWidth:       1,
    borderRadius:      999,
    paddingHorizontal: 14,
    paddingVertical:   5,
    marginBottom:      10,
  },

  // 学号文字
  // Student ID text
  idText: {
    fontWeight:    "700",
    fontSize:      12,
    letterSpacing: 0.5,
  },

  // 邮箱和电话横排容器
  // Email and phone info row
  infoRow: {
    flexDirection: "row",
    width:         "100%",
    borderRadius:  12,
    padding:       12,
  },

  // 单个信息项（图标 + 文字竖排）
  // Single info item — icon and text stacked vertically
  infoItem: {
    flex:       1,
    alignItems: "center",
    gap:        4,
  },

  // 信息图标
  // Info icon
  infoIcon: {
    fontSize: 16,
  },

  // 信息文字（邮箱/电话）
  // Info text — email or phone
  infoVal: {
    fontSize:  11,
    textAlign: "center",
  },

  // 邮箱和电话之间的竖向分隔线
  // Vertical divider between email and phone
  infoDivider: {
    width:            1,
    marginHorizontal: 8,
  },

  // 主题选择按钮（外观区域的入口按钮）
  // Theme picker button — entry button for the Appearance section
  themePickerBtn: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
    borderWidth:   1,
    borderRadius:  16,
    padding:       14,
    marginBottom:  16,
  },

  // 区域标题（全大写小字）
  // Section title — small uppercase label
  sectionTitle: {
    fontSize:      11,
    letterSpacing: 1.5,
    marginBottom:  8,
  },

  // 区域标题行（标题 + 右侧小字）
  // Section header row — title and right-aligned small text
  sectionHeaderRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-end",
    marginBottom:   10,
  },

  // 区域右侧小字（如 "2/4"）
  // Section right-side small text e.g. "2/4"
  sectionSub: {
    fontSize: 11,
  },

  // 新增车辆虚线按钮
  // Add vehicle dashed border button
  addVehicleBtn: {
    borderWidth:     1.5,
    borderStyle:     "dashed",
    borderRadius:    16,
    paddingVertical: 14,
    alignItems:      "center",
    marginBottom:    4,
  },

  // 新增车辆按钮文字
  // Add vehicle button text
  addVehicleText: {
    fontWeight: "700",
    fontSize:   14,
  },

  // 设置分组卡片容器
  // Settings group card container
  settingCard: {
    borderWidth:  1,
    borderRadius: 16,
    overflow:     "hidden",
    marginBottom: 16,
  },

  // 设置行之间的分隔线
  // Divider between setting rows
  rowDivider: {
    height:     1,
    marginLeft: 64,
  },

  // 图标背景（通用于 SettingRow）
  // Icon background — shared by SettingRow
  settingIcon: {
    width:          38,
    height:         38,
    borderRadius:   10,
    justifyContent: "center",
    alignItems:     "center",
  },

  // 登出按钮
  // Logout button
  logoutBtn: {
    borderWidth:     1,
    borderRadius:    16,
    paddingVertical: 15,
    alignItems:      "center",
    marginBottom:    20,
  },

  // 登出按钮文字
  // Logout button text
  logoutText: {
    fontWeight: "800",
    fontSize:   15,
  },

  // 页脚版本文字
  // Footer version text
  footer: {
    fontSize:  11,
    textAlign: "center",
  },
});

// ─── ProfileScreen ────────────────────────────────────────────────────────────
/*
个人资料和设置主页面。
Main user profile and settings screen.
*/
export default function ProfileScreen() {

  const { theme: T, themeKey } = useTheme();
  const router = useRouter();

  // 车辆列表来自 ParkingContext，修改后同步到 Home 和 Map
  // Vehicles from ParkingContext — changes sync to Home and Map
  const { vehicles, setVehicles } = useParkingContext();

  // 头像图片 URI（null = 使用默认 emoji）
  // Custom avatar image URI — null means use the default emoji
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // 各弹窗可见性 / Modal visibility states
  const [avatarModal,  setAvatarModal]  = useState(false);
  const [themeModal,   setThemeModal]   = useState(false);
  const [vehicleModal, setVehicleModal] = useState(false);

  // 正在编辑的车辆（undefined = 新增模式）
  // Vehicle being edited — undefined means "add new" mode
  const [editTarget, setEditTarget] = useState<Vehicle | undefined>(undefined);

  // 通知开关状态
  // Notification toggle states
  const [notifParking,  setNotifParking]  = useState(true);
  const [notifOverstay, setNotifOverstay] = useState(true);

  // 评分弹窗状态
  // Star rating modal states
  const [ratingVisible, setRatingVisible] = useState(false);
  const [hoveredStar,   setHoveredStar]   = useState(0);

  // ── 头像处理函数 / Avatar handlers ──────────────────────────────────────────

  /* 打开相机拍照并设为头像 / Open camera and use result as avatar */
  async function handleCamera() {
    setAvatarModal(false);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.status !== "granted") {
      Alert.alert("Camera Permission Needed", "Please allow camera access in Settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.8,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  /* 打开相册选照片并设为头像 / Open gallery and use selected photo as avatar */
  async function handleGallery() {
    setAvatarModal(false);
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== "granted") {
      Alert.alert("Gallery Permission Needed", "Please allow photo access in Settings.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.8,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  /* 二次确认后删除自定义头像，恢复默认 emoji
     Confirm then remove custom avatar and revert to default emoji */
  function handleRemoveAvatar() {
    setAvatarModal(false);
    Alert.alert("Remove Photo", "Are you sure?", [
      { text: "Cancel",  style: "cancel" },
      {
        text:    "Remove",
        style:   "destructive",
        onPress: function confirmRemove() { setAvatarUri(null); },
      },
    ]);
  }

  // ── 车辆处理函数 / Vehicle handlers ─────────────────────────────────────────

  /* 新增车辆到列表（含重复车牌检验）
     Add a new vehicle — includes duplicate plate check */
  function addVehicle(plate: string, model: string, isOKU: boolean) {
    const cleaned = plate.trim().toUpperCase();

    // 车牌不能为空
    // Plate cannot be empty
    if (!cleaned) {
      Alert.alert("Error", "Please enter a plate number.");
      return;
    }

    // 简单格式校验（至少 3 个字符）
    // Basic format check — at least 3 characters
    if (cleaned.replace(/\s/g, "").length < 3) {
      Alert.alert("Invalid Plate", "Please enter a valid plate number.");
      return;
    }

    // 重复车牌检验（忽略空格和大小写）
    // Duplicate plate check — ignores spaces and case
    const isDuplicate = vehicles.some(function checkDuplicate(v) {
      return v.plate.toUpperCase().replace(/\s/g, "") === cleaned.replace(/\s/g, "");
    });
    if (isDuplicate) {
      Alert.alert("Already Registered", cleaned + " is already in your vehicle list.");
      return;
    }

    // 数量上限检验
    // Maximum vehicle count check
    if (vehicles.length >= MAX_VEHICLES) {
      Alert.alert("Limit Reached", "Maximum " + MAX_VEHICLES + " vehicles allowed.");
      return;
    }

    // 新增车辆
    // Add the new vehicle
    const newVehicle: Vehicle = {
      id:     Date.now().toString(),
      plate:  cleaned,
      model:  model.trim(),
      isOKU,
      isPaid: false, // 新车辆默认未缴费 / new vehicles start as unpaid
    };
    setVehicles([...vehicles, newVehicle]);
    Alert.alert(
      "✅ Registered",
      cleaned + " added.\nPlease pay RM" + ANNUAL_FEE + " at the admin counter."
    );
  }

  /* 编辑已有车辆信息 / Edit an existing vehicle's details */
  function editVehicle(plate: string, model: string, isOKU: boolean) {
    if (!editTarget) {
      return;
    }
    const updatedVehicles = vehicles.map(function updateIfMatch(v) {
      if (v.id === editTarget.id) {
        return {
          ...v,
          plate:  plate.trim().toUpperCase(),
          model,
          isOKU,
        };
      }
      return v;
    });
    setVehicles(updatedVehicles);
  }

  /* 二次确认后删除车辆 / Remove a vehicle after user confirmation */
  function removeVehicle(id: string) {
    Alert.alert("Remove Vehicle", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text:    "Remove",
        style:   "destructive",
        onPress: function confirmRemove() {
          setVehicles(vehicles.filter(function excludeById(v) {
            return v.id !== id;
          }));
        },
      },
    ]);
  }

  // ── 账号处理函数 / Account handlers ─────────────────────────────────────────

  /* 登出确认并清除数据，跳回启动画面
     Confirm logout, clear local data, navigate back to splash */
  function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text:    "Log Out",
        style:   "destructive",
        onPress: async function confirmLogout() {
          try {
            await AsyncStorage.clear();
          } catch {
            // 清除失败不阻断登出流程 / storage clear failure does not block logout
          }
          router.replace("/");
        },
      },
    ]);
  }

  /* 选择星级后显示对应反馈弹窗
     Show per-star feedback alert after star is selected */
  function handleStarSelect(star: number) {
    setRatingVisible(false);
    setHoveredStar(0);
    const feedback = STAR_MESSAGES[star];
    // 等弹窗关闭动画完成后再弹 alert，避免动画冲突
    // Delay alert until modal close animation finishes to avoid visual conflict
    setTimeout(function showFeedback() {
      Alert.alert(feedback.title, feedback.message, [{ text: "OK" }]);
    }, 300);
  }

  // ── 辅助派生值 / Derived display values ─────────────────────────────────────

  // 当前主题的 emoji + 名称 + 描述（显示在主题选择按钮副标题）
  // Current theme emoji, name, and description — shown in the theme picker button subtitle
  const currentTheme         = THEMES[themeKey];
  const themePickerSubtitle  = currentTheme.emoji + " " + currentTheme.name + " — " + currentTheme.desc;

  // 车辆数量显示（如 "2/4 · RM10/year"）
  // Vehicle count display e.g. "2/4 · RM10/year"
  const vehicleCountLabel = vehicles.length + "/" + MAX_VEHICLES + " · RM" + ANNUAL_FEE + "/year";

  // 是否显示"新增车辆"按钮（未达上限时显示）
  // Whether to show the Add Vehicle button — shown when below the limit
  const canAddVehicle = vehicles.length < MAX_VEHICLES;

  // 头像边框颜色
  // Avatar border colour
  const avatarBorderColor = T.accent + "55";

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* 顶部标题栏 / Page header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: T.text }]}>Profile</Text>
            <Text style={[styles.subtitle,  { color: T.muted }]}>Account & Settings</Text>
          </View>
          <Image
            source={require("../../assets/images/itkia.png")}
            style={{ width: 80, height: 40, resizeMode: "contain" }}
          />
        </View>

        {/* 学生资料卡 / Student info card */}
        <View style={[styles.avatarCard, { backgroundColor: T.card, borderColor: T.border }]}>

          {/* 头像（点击打开 AvatarModal）/ Avatar — tap to open AvatarModal */}
          <TouchableOpacity
            onPress={function openAvatarModal() { setAvatarModal(true); }}
            activeOpacity={0.85}
            style={styles.avatarWrap}
          >
            {avatarUri ? (
              // 有自定义头像时显示图片
              // Show custom photo when available
              <Image
                source={{ uri: avatarUri }}
                style={[styles.avatarImage, { borderColor: avatarBorderColor }]}
              />
            ) : (
              // 无自定义头像时显示默认 emoji 圆形
              // Show default emoji circle when no custom photo is set
              <View
                style={[
                  styles.avatarCircle,
                  { backgroundColor: T.accent + "18", borderColor: avatarBorderColor },
                ]}
              >
                <Text style={styles.avatarEmoji}>👨‍🎓</Text>
              </View>
            )}

            {/* 右下角相机徽章 / Camera badge at bottom-right */}
            <View style={[styles.cameraBadge, { backgroundColor: T.accent, borderColor: T.bg }]}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>

          {/* 提示文字 / Tap hint */}
          <Text style={[styles.changePhotoHint, { color: T.accent }]}>
            Tap to change photo
          </Text>

          {/* 姓名和课程 / Name and course */}
          <Text style={[styles.studentName,   { color: T.text  }]}>{STUDENT.name}</Text>
          <Text style={[styles.studentCourse, { color: T.muted }]}>
            {STUDENT.course} · {STUDENT.year}
          </Text>

          {/* 学号徽章 / Student ID badge */}
          <View
            style={[
              styles.idBadge,
              { backgroundColor: T.accent + "18", borderColor: T.accent + "44" },
            ]}
          >
            <Text style={[styles.idText, { color: T.accent }]}>
              ID: {STUDENT.id}
            </Text>
          </View>

          {/* 邮箱和电话行 / Email and phone row */}
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

        {/* 外观区域标题 / Appearance section title */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>APPEARANCE</Text>

        {/* 主题选择入口按钮 / Theme picker entry button */}
        <TouchableOpacity
          style={[styles.themePickerBtn, { backgroundColor: T.card, borderColor: T.border }]}
          onPress={function openThemeModal() { setThemeModal(true); }}
          activeOpacity={0.8}
        >
          <View style={[styles.settingIcon, { backgroundColor: T.accent + "15" }]}>
            <Text style={{ fontSize: 18 }}>🎨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[settingRowStyles.label, { color: T.text }]}>App Theme</Text>
            <Text style={[settingRowStyles.sub, { color: T.muted }]}>
              {themePickerSubtitle}
            </Text>
          </View>
          <Text style={[settingRowStyles.chevron, { color: T.muted }]}>›</Text>
        </TouchableOpacity>

        {/* 车辆区域标题行 / Vehicles section header row */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: T.muted }]}>MY VEHICLES</Text>
          <Text style={[styles.sectionSub,   { color: T.muted }]}>{vehicleCountLabel}</Text>
        </View>

        {/* 已注册车辆列表 / Registered vehicle list */}
        {vehicles.map(function renderVehicleCard(v) {
          return (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onEdit={function openEditModal() {
                setEditTarget(v);
                setVehicleModal(true);
              }}
              onRemove={function removeThisVehicle() { removeVehicle(v.id); }}
            />
          );
        })}

        {/* 新增车辆按钮（未达上限时显示）
            Add vehicle button — hidden when at max capacity */}
        {canAddVehicle && (
          <TouchableOpacity
            style={[styles.addVehicleBtn, { borderColor: T.accent + "55" }]}
            onPress={function openAddModal() {
              setEditTarget(undefined);
              setVehicleModal(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.addVehicleText, { color: T.accent }]}>
              ＋  Add Vehicle  (RM{ANNUAL_FEE}/year)
            </Text>
          </TouchableOpacity>
        )}

        {/* 通知设置 / Notifications section */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 24 }]}>
          NOTIFICATIONS
        </Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow
            icon="🔔"
            label="Parking Reminders"
            sub="Notify when session is unusually long"
            right={
              <Switch
                value={notifParking}
                onValueChange={setNotifParking}
                trackColor={{ false: T.border, true: T.accent + "80" }}
                thumbColor={notifParking ? T.accent : T.muted}
              />
            }
          />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow
            icon="⚠️"
            label="Overstay Alerts"
            sub="Warn before overstay is flagged"
            right={
              <Switch
                value={notifOverstay}
                onValueChange={setNotifOverstay}
                trackColor={{ false: T.border, true: T.accent + "80" }}
                thumbColor={notifOverstay ? T.accent : T.muted}
              />
            }
          />
        </View>

        {/* 账号设置 / Account section */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 8 }]}>ACCOUNT</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow
            icon="🔒"
            label="Change Password"
            onPress={function showPasswordAlert() {
              Alert.alert("Change Password", "Coming soon.");
            }}
          />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow
            icon="📷"
            label="Camera Permission"
            sub="Profile photo & plate scanning"
            onPress={function showCameraPermAlert() {
              Alert.alert("Camera", "Go to Settings → Apps → MDIS Parking → Permissions.");
            }}
          />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow
            icon="📍"
            label="Location Permission"
            sub="GPS parking detection"
            onPress={function showLocationPermAlert() {
              Alert.alert("Location", "Go to Settings → Apps → MDIS Parking → Permissions.");
            }}
          />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow
            icon="📞"
            label="Support"
            sub="parking@mdis.edu.my"
            onPress={function showSupportAlert() {
              Alert.alert("Support", "Email: parking@mdis.edu.my");
            }}
          />
        </View>

        {/* App 信息 / App info section */}
        <Text style={[styles.sectionTitle, { color: T.muted, marginTop: 8 }]}>APP</Text>
        <View style={[styles.settingCard, { backgroundColor: T.card, borderColor: T.border }]}>
          <SettingRow icon="ℹ️" label="Version" sub="1.0.0 (Beta)" />
          <View style={[styles.rowDivider, { backgroundColor: T.border }]} />
          <SettingRow
            icon="⭐"
            label="Rate This App"
            onPress={function openRatingModal() { setRatingVisible(true); }}
          />
        </View>

        {/* 登出按钮 / Logout button */}
        <TouchableOpacity
          style={[
            styles.logoutBtn,
            { backgroundColor: T.red + "18", borderColor: T.red + "44" },
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={[styles.logoutText, { color: T.red }]}>🚪  Log Out</Text>
        </TouchableOpacity>

        {/* 页脚 / Footer */}
        <Text style={[styles.footer, { color: T.muted }]}>
          MDIS Campus Parking · Student Edition
        </Text>

      </ScrollView>

      {/* 弹窗放在 ScrollView 外，确保层叠在最顶层
          Modals outside ScrollView so they render above all content */}
      <ThemePickerModal
        visible={themeModal}
        onClose={function closeThemeModal() { setThemeModal(false); }}
      />

      <AvatarModal
        visible={avatarModal}
        hasPhoto={avatarUri !== null}
        onClose={function closeAvatarModal() { setAvatarModal(false); }}
        onCamera={handleCamera}
        onGallery={handleGallery}
        onRemove={handleRemoveAvatar}
      />

      <VehicleModal
        visible={vehicleModal}
        vehicle={editTarget}
        onSave={editTarget ? editVehicle : addVehicle}
        onClose={function closeVehicleModal() { setVehicleModal(false); }}
      />

      {/* 星级评分弹窗 / Star rating modal */}
      <Modal
        transparent
        visible={ratingVisible}
        animationType="fade"
        onRequestClose={function closeRating() {
          setRatingVisible(false);
          setHoveredStar(0);
        }}
      >
        <View
          style={{
            flex:            1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent:  "center",
            alignItems:      "center",
          }}
        >
          <View
            style={{
              backgroundColor: T.card,
              borderRadius:    20,
              padding:         28,
              width:           300,
              alignItems:      "center",
              borderWidth:     1,
              borderColor:     T.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: T.text, marginBottom: 6 }}>
              Rate This App
            </Text>
            <Text style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>
              Tap a star to submit your rating
            </Text>

            {/* 星星列表 / Star row */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(function renderStar(star) {
                // 鼠标悬停或已选中时显示实心星
                // Show filled star when hovered or selected
                let starChar:  string;
                let starColor: string;
                if (star <= hoveredStar) {
                  starChar  = "★";
                  starColor = "#F5A623";
                } else {
                  starChar  = "☆";
                  starColor = T.muted;
                }

                return (
                  <TouchableOpacity
                    key={star}
                    onPress={function selectStar() { handleStarSelect(star); }}
                    onPressIn={function hoverStar() { setHoveredStar(star); }}
                    onPressOut={function clearHover() { setHoveredStar(0); }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 38, color: starColor }}>{starChar}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 取消按钮 / Cancel button */}
            <TouchableOpacity
              onPress={function cancelRating() {
                setRatingVisible(false);
                setHoveredStar(0);
              }}
              style={{ marginTop: 22 }}
            >
              <Text style={{ color: T.muted, fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}