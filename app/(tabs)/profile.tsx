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
 7. 编辑个人资料（姓名、课程、年级、学号、邮箱、电话）[新增]
    Edit profile (name, course, year, ID, email, phone) [NEW]
*/

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

const MAX_VEHICLES        = 4;
const ANNUAL_FEE          = 10;
const STORAGE_KEY_PROFILE = "@itkia_student_profile"; // AsyncStorage key for persisting profile

// 默认学生资料（生产环境应改为真实认证 / API）
// Default student profile — replace with real auth / API in production
const DEFAULT_STUDENT = {
  name:   "Ahmad Faiz",
  id:     "22CS10042",
  course: "Diploma in Computer Science",
  year:   "Year 2",
  email:  "ahmdfaiz@student.mdis.edu.my",
  phone:  "+60 12-345 6789",
  isOKU:  false,
};

// 年级选项列表
// Year level options
const YEAR_OPTIONS = ["Year 1", "Year 2", "Year 3", "Foundation", "Postgraduate"];

// 课程前缀选项列表（可按需扩展）
// Course prefix options (expand as needed)
const COURSE_PREFIXES = [
  "Diploma in",
  "Bachelor of",
  "Master of",
  "Certificate in",
];

const STAR_MESSAGES: Record<number, { title: string; message: string }> = {
  1: { title: "1 Star",  message: "Looks like you don't know how to use it. Goodbye." },
  2: { title: "2 Stars", message: "Maybe it's not the app's problem." },
  3: { title: "3 Stars", message: "Indecision is also a choice." },
  4: { title: "4 Stars", message: "You're very close to the right answer." },
  5: { title: "5 Stars", message: "Congratulations, you made the right decision." },
};

// ─── StudentProfile type ──────────────────────────────────────────────────────
type StudentProfile = {
  name:   string;
  id:     string;
  course: string;
  year:   string;
  email:  string;
  phone:  string;
  isOKU:  boolean;
};

// ─── Styles for EditProfileModal ──────────────────────────────────────────────
const editProfileStyles = StyleSheet.create({

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
    maxHeight:            "90%",
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

  inputLabel: {
    fontSize:      12,
    letterSpacing: 0.5,
    marginBottom:  6,
    fontWeight:    "600",
  },

  input: {
    borderWidth:   1,
    borderRadius:  12,
    padding:       13,
    fontSize:      15,
    marginBottom:  14,
  },

  // 年级选项横排按钮组
  // Year option button row
  optionRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           8,
    marginBottom:  14,
  },

  // 单个年级选项按钮
  // Single year option pill button
  optionPill: {
    borderWidth:       1,
    borderRadius:      999,
    paddingHorizontal: 14,
    paddingVertical:   7,
  },

  optionPillText: {
    fontSize:   13,
    fontWeight: "600",
  },

  saveBtn: {
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      "center",
    marginBottom:    10,
    marginTop:       6,
  },

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

// ─── EditProfileModal ─────────────────────────────────────────────────────────
/*
底部弹窗表单：编辑学生个人资料。
Bottom sheet form for editing the student's profile information.
*/
function EditProfileModal({ visible, profile, onSave, onClose }: {
  visible:  boolean;
  profile:  StudentProfile;
  onSave:   (updated: StudentProfile) => void;
  onClose:  () => void;
}) {
  const { theme: T } = useTheme();

  const [name,   setName]   = useState(profile.name);
  const [course, setCourse] = useState(profile.course);
  const [year,   setYear]   = useState(profile.year);
  const [id,     setId]     = useState(profile.id);
  const [email,  setEmail]  = useState(profile.email);
  const [phone,  setPhone]  = useState(profile.phone);

  // profile prop 变化时重置表单（切换账号时使用）
  // Reset form when profile prop changes
  useEffect(function syncForm() {
    setName(profile.name);
    setCourse(profile.course);
    setYear(profile.year);
    setId(profile.id);
    setEmail(profile.email);
    setPhone(profile.phone);
  }, [profile]);

  // 验证并保存
  // Validate and save
  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Missing Name", "Please enter your name.");
      return;
    }
    if (!id.trim()) {
      Alert.alert("Missing ID", "Please enter your student ID.");
      return;
    }

    // 简单邮箱格式校验
    // Basic email format check
    const emailTrimmed = email.trim();
    if (emailTrimmed && !emailTrimmed.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    onSave({
      name:   trimmedName,
      course: course.trim(),
      year:   year.trim(),
      id:     id.trim(),
      email:  emailTrimmed,
      phone:  phone.trim(),
      isOKU:  profile.isOKU,
    });
    onClose();
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={editProfileStyles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            editProfileStyles.sheet,
            { backgroundColor: T.card, borderColor: T.border },
          ]}
        >
          {/* 拖动把手 / Drag handle */}
          <View style={[editProfileStyles.handle, { backgroundColor: T.border }]} />

          {/* 标题 / Title */}
          <Text style={[editProfileStyles.sheetTitle, { color: T.text }]}>
            Edit Profile
          </Text>
          <Text style={[editProfileStyles.sheetSub, { color: T.muted }]}>
            Update your personal information
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>

            {/* 姓名 / Full name */}
            <Text style={[editProfileStyles.inputLabel, { color: T.muted }]}>
              FULL NAME
            </Text>
            <TextInput
              style={[
                editProfileStyles.input,
                { backgroundColor: T.bg, borderColor: T.border, color: T.text },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ahmad Faiz"
              placeholderTextColor={T.muted}
              autoCapitalize="words"
            />

            {/* 课程 / Course */}
            <Text style={[editProfileStyles.inputLabel, { color: T.muted }]}>
              COURSE / PROGRAMME
            </Text>
            <TextInput
              style={[
                editProfileStyles.input,
                { backgroundColor: T.bg, borderColor: T.border, color: T.text },
              ]}
              value={course}
              onChangeText={setCourse}
              placeholder="e.g. Diploma in Computer Science"
              placeholderTextColor={T.muted}
              autoCapitalize="words"
            />

            {/* 年级（快选按钮 + 手动输入）/ Year (quick pick + free text) */}
            <Text style={[editProfileStyles.inputLabel, { color: T.muted }]}>
              YEAR / LEVEL
            </Text>
            <View style={editProfileStyles.optionRow}>
              {YEAR_OPTIONS.map(function renderYearOption(option) {
                const isSelected = year === option;
                let bgColor: string;
                let borderColor: string;
                let textColor: string;
                if (isSelected) {
                  bgColor     = T.accent;
                  borderColor = T.accent;
                  textColor   = "white";
                } else {
                  bgColor     = T.bg;
                  borderColor = T.border;
                  textColor   = T.text;
                }
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      editProfileStyles.optionPill,
                      { backgroundColor: bgColor, borderColor },
                    ]}
                    onPress={function selectYear() { setYear(option); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[editProfileStyles.optionPillText, { color: textColor }]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* 自定义年级输入框（当快选选项不符合时使用）
                Free-text year input — used when no quick-pick option matches */}
            <TextInput
              style={[
                editProfileStyles.input,
                { backgroundColor: T.bg, borderColor: T.border, color: T.text },
              ]}
              value={year}
              onChangeText={setYear}
              placeholder="Or type custom e.g. Year 3"
              placeholderTextColor={T.muted}
            />

            {/* 学号 / Student ID */}
            <Text style={[editProfileStyles.inputLabel, { color: T.muted }]}>
              STUDENT ID
            </Text>
            <TextInput
              style={[
                editProfileStyles.input,
                { backgroundColor: T.bg, borderColor: T.border, color: T.text },
              ]}
              value={id}
              onChangeText={setId}
              placeholder="e.g. 22CS10042"
              placeholderTextColor={T.muted}
              autoCapitalize="characters"
            />

            {/* 邮箱 / Email */}
            <Text style={[editProfileStyles.inputLabel, { color: T.muted }]}>
              EMAIL
            </Text>
            <TextInput
              style={[
                editProfileStyles.input,
                { backgroundColor: T.bg, borderColor: T.border, color: T.text },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. name@student.mdis.edu.my"
              placeholderTextColor={T.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* 电话 / Phone */}
            <Text style={[editProfileStyles.inputLabel, { color: T.muted }]}>
              PHONE NUMBER
            </Text>
            <TextInput
              style={[
                editProfileStyles.input,
                { backgroundColor: T.bg, borderColor: T.border, color: T.text },
              ]}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +60 12-345 6789"
              placeholderTextColor={T.muted}
              keyboardType="phone-pad"
            />

            {/* 保存按钮 / Save button */}
            <TouchableOpacity
              style={[editProfileStyles.saveBtn, { backgroundColor: T.accent }]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={editProfileStyles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>

            {/* 取消按钮 / Cancel button */}
            <TouchableOpacity style={editProfileStyles.cancelBtn} onPress={onClose}>
              <Text style={[editProfileStyles.cancelBtnText, { color: T.muted }]}>
                Cancel
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles for ThemePickerModal ──────────────────────────────────────────────
const themePickerStyles = StyleSheet.create({

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

  themeGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           10,
    marginBottom:  20,
  },

  themeCard: {
    width:          "47%",
    borderRadius:   16,
    padding:        14,
    alignItems:     "center",
    overflow:       "hidden",
    minHeight:      130,
    justifyContent: "center",
  },

  themePreviewRow: {
    flexDirection: "row",
    gap:           4,
    marginBottom:  8,
  },

  previewDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },

  themeEmoji: {
    fontSize:     28,
    marginBottom: 6,
  },

  themeName: {
    fontWeight:   "800",
    fontSize:     15,
    marginBottom: 2,
  },

  themeDesc: {
    fontSize:   10,
    textAlign:  "center",
  },

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

  cancelBtn: {
    alignItems:      "center",
    paddingVertical: 10,
  },

  cancelBtnText: {
    fontSize: 14,
  },
});

// ─── ThemePickerModal ─────────────────────────────────────────────────────────
function ThemePickerModal({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}) {
  const { themeKey, setTheme, theme: T } = useTheme();
  const themeList = Object.values(THEMES) as Theme[];

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
          <View style={[themePickerStyles.handle, { backgroundColor: T.border }]} />

          <Text style={[themePickerStyles.sheetTitle, { color: T.text }]}>
            Choose Theme
          </Text>
          <Text style={[themePickerStyles.sheetSub, { color: T.muted }]}>
            Select your preferred app style
          </Text>

          <View style={themePickerStyles.themeGrid}>
            {themeList.map(function renderThemeCard(t) {
              const isActive = themeKey === t.key;
              let borderWidth: number;
              let borderColor: string;
              if (isActive) {
                borderWidth = 2.5;
                borderColor = t.accent;
              } else {
                borderWidth = 1.5;
                borderColor = t.border;
              }
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
                  <Text style={themePickerStyles.themeEmoji}>{t.emoji}</Text>
                  <Text style={[themePickerStyles.themeName, { color: t.text }]}>
                    {t.name}
                  </Text>
                  <Text style={[themePickerStyles.themeDesc, { color: t.muted }]}>
                    {t.desc}
                  </Text>
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
  option: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             14,
    paddingVertical: 14,
  },
  optionIcon: {
    width:          48,
    height:         48,
    borderRadius:   14,
    justifyContent: "center",
    alignItems:     "center",
  },
  optionTitle: {
    fontWeight: "700",
    fontSize:   15,
  },
  optionSub: {
    fontSize:  12,
    marginTop: 2,
  },
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
function AvatarModal({ visible, onClose, onCamera, onGallery, onRemove, hasPhoto }: {
  visible:   boolean;
  onClose:   () => void;
  onCamera:  () => void;
  onGallery: () => void;
  onRemove:  () => void;
  hasPhoto:  boolean;
}) {
  const { theme: T } = useTheme();

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
          <View style={[avatarModalStyles.handle, { backgroundColor: T.border }]} />
          <Text style={[avatarModalStyles.sheetTitle, { color: T.text }]}>
            Change Profile Photo
          </Text>

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
  inputLabel: {
    fontSize:      12,
    letterSpacing: 0.5,
    marginBottom:  6,
  },
  input: {
    borderWidth:   1,
    borderRadius:  12,
    padding:       13,
    fontSize:      15,
    marginBottom:  14,
  },
  okuRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    borderRadius:   12,
    padding:        14,
    marginBottom:   8,
  },
  okuLabel: {
    fontWeight: "600",
    fontSize:   14,
  },
  okuSub: {
    fontSize:  12,
    marginTop: 2,
  },
  okuWarning: {
    borderWidth:   1,
    borderRadius:  10,
    padding:       10,
    marginBottom:  14,
  },
  okuWarningText: {
    fontSize:   12,
    lineHeight: 18,
  },
  saveBtn: {
    borderRadius:    14,
    paddingVertical: 14,
    alignItems:      "center",
    marginBottom:    10,
  },
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
function VehicleModal({ visible, vehicle, onSave, onClose }: {
  visible:  boolean;
  vehicle?: Vehicle;
  onSave:   (plate: string, model: string, isOKU: boolean) => void;
  onClose:  () => void;
}) {
  const { theme: T } = useTheme();

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

  let saveBtnLabel: string;
  if (vehicle) {
    saveBtnLabel = "Save Changes";
  } else {
    saveBtnLabel = "Register & Pay RM" + ANNUAL_FEE;
  }

  let sheetTitleText: string;
  if (vehicle) {
    sheetTitleText = "Edit Vehicle";
  } else {
    sheetTitleText = "Add Vehicle";
  }

  const okuWarningBg     = T.orange + "18";
  const okuWarningBorder = T.orange + "55";

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
          <View style={[vehicleModalStyles.handle, { backgroundColor: T.border }]} />

          <Text style={[vehicleModalStyles.sheetTitle, { color: T.text }]}>
            {sheetTitleText}
          </Text>
          <Text style={[vehicleModalStyles.sheetSub, { color: T.muted }]}>
            Annual fee: RM{ANNUAL_FEE} per vehicle
          </Text>

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

          <TouchableOpacity
            style={[vehicleModalStyles.saveBtn, { backgroundColor: T.accent }]}
            onPress={function handleSave() {
              onSave(plate, model, isOKU);
              onClose();
            }}
          >
            <Text style={vehicleModalStyles.saveBtnText}>{saveBtnLabel}</Text>
          </TouchableOpacity>

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
  card: {
    borderWidth:    1,
    borderRadius:   16,
    padding:        14,
    marginBottom:   10,
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-start",
  },
  left: {
    flexDirection: "row",
    gap:           12,
    flex:          1,
  },
  emoji: {
    fontSize:  28,
    marginTop: 2,
  },
  plateRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    marginBottom:  2,
  },
  plateText: {
    fontSize:      17,
    fontWeight:    "900",
    letterSpacing: 1,
  },
  okuBadge: {
    borderWidth:       1,
    borderRadius:      6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  okuBadgeText: {
    fontSize:   10,
    fontWeight: "800",
  },
  model: {
    fontSize:     12,
    marginBottom: 6,
  },
  paidBadge: {
    borderWidth:       1,
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   3,
    alignSelf:         "flex-start",
  },
  paidBadgeText: {
    fontSize:   11,
    fontWeight: "700",
  },
  actions: {
    gap: 8,
  },
  editText: {
    fontWeight: "700",
    fontSize:   12,
  },
  removeText: {
    fontWeight: "700",
    fontSize:   12,
  },
});

// ─── VehicleCard ──────────────────────────────────────────────────────────────
function VehicleCard({ vehicle, onEdit, onRemove }: {
  vehicle:  Vehicle;
  onEdit:   () => void;
  onRemove: () => void;
}) {
  const { theme: T } = useTheme();

  const okuBadgeBg     = T.orange + "22";
  const okuBadgeBorder = T.orange + "55";

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

  let vehicleEmoji: string;
  if (vehicle.isOKU) {
    vehicleEmoji = "♿";
  } else {
    vehicleEmoji = "🚗";
  }

  return (
    <View style={[vehicleCardStyles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={vehicleCardStyles.left}>
        <Text style={vehicleCardStyles.emoji}>{vehicleEmoji}</Text>
        <View>
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
          <Text style={[vehicleCardStyles.model, { color: T.muted }]}>
            {vehicle.model}
          </Text>
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
  row: {
    flexDirection: "row",
    alignItems:    "center",
    padding:       14,
    gap:           12,
  },
  iconWrap: {
    width:          38,
    height:         38,
    borderRadius:   10,
    justifyContent: "center",
    alignItems:     "center",
  },
  label: {
    fontSize:   14,
    fontWeight: "600",
  },
  sub: {
    fontSize:  11,
    marginTop: 2,
  },
  chevron: {
    fontSize:   22,
    lineHeight: 24,
  },
});

// ─── SettingRow ───────────────────────────────────────────────────────────────
function SettingRow({ icon, label, sub, onPress, right }: {
  icon:     string;
  label:    string;
  sub?:     string;
  onPress?: () => void;
  right?:   React.ReactNode;
}) {
  const { theme: T } = useTheme();
  const iconBgColor = T.accent + "15";

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

  let pressOpacity: number;
  if (onPress) {
    pressOpacity = 0.7;
  } else {
    pressOpacity = 1;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={pressOpacity}
      style={settingRowStyles.row}
    >
      <View style={[settingRowStyles.iconWrap, { backgroundColor: iconBgColor }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[settingRowStyles.label, { color: T.text }]}>{label}</Text>
        {sub && (
          <Text style={[settingRowStyles.sub, { color: T.muted }]}>{sub}</Text>
        )}
      </View>
      {rightContent}
    </TouchableOpacity>
  );
}

// ─── Styles for ProfileScreen ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    padding:         20,
    paddingTop:      56,
    paddingBottom:   100,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    marginBottom:   16,
  },
  pageTitle: {
    fontSize:      24,
    fontWeight:    "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
  },
  avatarCard: {
    borderWidth:  1,
    borderRadius: 20,
    padding:      24,
    alignItems:   "center",
    marginBottom: 20,
  },
  avatarWrap: {
    position:     "relative",
    marginBottom: 6,
  },
  avatarCircle: {
    width:          90,
    height:         90,
    borderRadius:   45,
    borderWidth:    2,
    justifyContent: "center",
    alignItems:     "center",
  },
  avatarImage: {
    width:        90,
    height:       90,
    borderRadius: 45,
    borderWidth:  2,
  },
  avatarEmoji: {
    fontSize: 40,
  },
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
  changePhotoHint: {
    fontSize:     12,
    fontWeight:   "600",
    marginBottom: 12,
  },
  studentName: {
    fontSize:     20,
    fontWeight:   "800",
    marginBottom: 4,
  },
  studentCourse: {
    fontSize:     13,
    marginBottom: 12,
  },
  idBadge: {
    borderWidth:       1,
    borderRadius:      999,
    paddingHorizontal: 14,
    paddingVertical:   5,
    marginBottom:      10,
  },
  idText: {
    fontWeight:    "700",
    fontSize:      12,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    width:         "100%",
    borderRadius:  12,
    padding:       12,
  },
  infoItem: {
    flex:       1,
    alignItems: "center",
    gap:        4,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoVal: {
    fontSize:  11,
    textAlign: "center",
  },
  infoDivider: {
    width:            1,
    marginHorizontal: 8,
  },

  // 编辑资料按钮（资料卡底部）
  // Edit profile button — at the bottom of the info card
  editProfileBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    borderWidth:       1,
    borderRadius:      12,
    paddingVertical:   9,
    paddingHorizontal: 20,
    marginTop:         12,
  },

  editProfileBtnText: {
    fontSize:   13,
    fontWeight: "700",
  },

  themePickerBtn: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
    borderWidth:   1,
    borderRadius:  16,
    padding:       14,
    marginBottom:  16,
  },
  sectionTitle: {
    fontSize:      11,
    letterSpacing: 1.5,
    marginBottom:  8,
  },
  sectionHeaderRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "flex-end",
    marginBottom:   10,
  },
  sectionSub: {
    fontSize: 11,
  },
  addVehicleBtn: {
    borderWidth:     1.5,
    borderStyle:     "dashed",
    borderRadius:    16,
    paddingVertical: 14,
    alignItems:      "center",
    marginBottom:    4,
  },
  addVehicleText: {
    fontWeight: "700",
    fontSize:   14,
  },
  settingCard: {
    borderWidth:  1,
    borderRadius: 16,
    overflow:     "hidden",
    marginBottom: 16,
  },
  rowDivider: {
    height:     1,
    marginLeft: 64,
  },
  settingIcon: {
    width:          38,
    height:         38,
    borderRadius:   10,
    justifyContent: "center",
    alignItems:     "center",
  },
  logoutBtn: {
    borderWidth:     1,
    borderRadius:    16,
    paddingVertical: 15,
    alignItems:      "center",
    marginBottom:    20,
  },
  logoutText: {
    fontWeight: "800",
    fontSize:   15,
  },
  footer: {
    fontSize:  11,
    textAlign: "center",
  },
});

// ─── ProfileScreen ────────────────────────────────────────────────────────────
export default function ProfileScreen() {

  const { theme: T, themeKey } = useTheme();
  const router = useRouter();
  const { vehicles, setVehicles } = useParkingContext();

  // 学生资料 state（可编辑）
  // Student profile state — editable
  const [student, setStudent] = useState<StudentProfile>(DEFAULT_STUDENT);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // 各弹窗可见性 / Modal visibility states
  const [avatarModal,       setAvatarModal]       = useState(false);
  const [themeModal,        setThemeModal]         = useState(false);
  const [vehicleModal,      setVehicleModal]       = useState(false);
  const [editProfileModal,  setEditProfileModal]   = useState(false); // 新增 / NEW

  const [editTarget,   setEditTarget]   = useState<Vehicle | undefined>(undefined);
  const [notifParking,  setNotifParking]  = useState(true);
  const [notifOverstay, setNotifOverstay] = useState(true);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [hoveredStar,   setHoveredStar]   = useState(0);

  // 启动时从 AsyncStorage 加载已保存的学生资料
  // On mount: load persisted student profile from AsyncStorage
  useEffect(function loadProfileOnMount() {
    async function loadProfile() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_PROFILE);
        if (saved !== null) {
          const parsed: StudentProfile = JSON.parse(saved);
          setStudent(parsed);
        }
      } catch {
        // 读取失败时使用默认值，静默处理 / fall back to DEFAULT_STUDENT silently
      }
    }
    loadProfile();
  }, []);

  // ── 头像处理函数 / Avatar handlers ──────────────────────────────────────────

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

  function handleRemoveAvatar() {
    setAvatarModal(false);
    Alert.alert("Remove Photo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text:    "Remove",
        style:   "destructive",
        onPress: function confirmRemove() { setAvatarUri(null); },
      },
    ]);
  }

  // ── 资料保存函数 / Profile save handler ─────────────────────────────────────

  /* 接收 EditProfileModal 回调，更新 state 并写入 AsyncStorage
     Receives callback from EditProfileModal, updates state and persists to AsyncStorage */
  async function handleSaveProfile(updated: StudentProfile) {
    setStudent(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(updated));
    } catch {
      // 写入失败不阻断 UI，静默处理 / storage write failure is non-blocking
    }
  }

  // ── 车辆处理函数 / Vehicle handlers ─────────────────────────────────────────

  function addVehicle(plate: string, model: string, isOKU: boolean) {
    const cleaned = plate.trim().toUpperCase();
    if (!cleaned) {
      Alert.alert("Error", "Please enter a plate number.");
      return;
    }
    if (cleaned.replace(/\s/g, "").length < 3) {
      Alert.alert("Invalid Plate", "Please enter a valid plate number.");
      return;
    }
    const isDuplicate = vehicles.some(function checkDuplicate(v) {
      return v.plate.toUpperCase().replace(/\s/g, "") === cleaned.replace(/\s/g, "");
    });
    if (isDuplicate) {
      Alert.alert("Already Registered", cleaned + " is already in your vehicle list.");
      return;
    }
    if (vehicles.length >= MAX_VEHICLES) {
      Alert.alert("Limit Reached", "Maximum " + MAX_VEHICLES + " vehicles allowed.");
      return;
    }
    const newVehicle: Vehicle = {
      id:     Date.now().toString(),
      plate:  cleaned,
      model:  model.trim(),
      isOKU,
      isPaid: false,
    };
    setVehicles([...vehicles, newVehicle]);
    Alert.alert(
      "✅ Registered",
      cleaned + " added.\nPlease pay RM" + ANNUAL_FEE + " at the admin counter."
    );
  }

  function editVehicle(plate: string, model: string, isOKU: boolean) {
    if (!editTarget) {
      return;
    }
    const updatedVehicles = vehicles.map(function updateIfMatch(v) {
      if (v.id === editTarget.id) {
        return { ...v, plate: plate.trim().toUpperCase(), model, isOKU };
      }
      return v;
    });
    setVehicles(updatedVehicles);
  }

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

  function handleStarSelect(star: number) {
    setRatingVisible(false);
    setHoveredStar(0);
    const feedback = STAR_MESSAGES[star];
    setTimeout(function showFeedback() {
      Alert.alert(feedback.title, feedback.message, [{ text: "OK" }]);
    }, 300);
  }

  // ── 派生值 / Derived values ─────────────────────────────────────────────────

  const currentTheme         = THEMES[themeKey];
  const themePickerSubtitle  = currentTheme.emoji + " " + currentTheme.name + " — " + currentTheme.desc;
  const vehicleCountLabel    = vehicles.length + "/" + MAX_VEHICLES + " · RM" + ANNUAL_FEE + "/year";
  const canAddVehicle        = vehicles.length < MAX_VEHICLES;
  const avatarBorderColor    = T.accent + "55";

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

          {/* 头像 / Avatar */}
          <TouchableOpacity
            onPress={function openAvatarModal() { setAvatarModal(true); }}
            activeOpacity={0.85}
            style={styles.avatarWrap}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={[styles.avatarImage, { borderColor: avatarBorderColor }]}
              />
            ) : (
              <View
                style={[
                  styles.avatarCircle,
                  { backgroundColor: T.accent + "18", borderColor: avatarBorderColor },
                ]}
              >
                <Text style={styles.avatarEmoji}>👨‍🎓</Text>
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: T.accent, borderColor: T.bg }]}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={[styles.changePhotoHint, { color: T.accent }]}>
            Tap to change photo
          </Text>

          {/* 姓名和课程（来自 student state）/ Name and course from student state */}
          <Text style={[styles.studentName,   { color: T.text  }]}>{student.name}</Text>
          <Text style={[styles.studentCourse, { color: T.muted }]}>
            {student.course} · {student.year}
          </Text>

          {/* 学号徽章 / Student ID badge */}
          <View
            style={[
              styles.idBadge,
              { backgroundColor: T.accent + "18", borderColor: T.accent + "44" },
            ]}
          >
            <Text style={[styles.idText, { color: T.accent }]}>
              ID: {student.id}
            </Text>
          </View>

          {/* 邮箱和电话行 / Email and phone row */}
          <View style={[styles.infoRow, { backgroundColor: T.bg }]}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📧</Text>
              <Text style={[styles.infoVal, { color: T.muted }]}>{student.email}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: T.border }]} />
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📱</Text>
              <Text style={[styles.infoVal, { color: T.muted }]}>{student.phone}</Text>
            </View>
          </View>

          {/* ── 编辑资料按钮（新增）/ Edit profile button [NEW] ── */}
          <TouchableOpacity
            style={[
              styles.editProfileBtn,
              { borderColor: T.accent + "55", backgroundColor: T.accent + "10" },
            ]}
            onPress={function openEditProfile() { setEditProfileModal(true); }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14 }}>✏️</Text>
            <Text style={[styles.editProfileBtnText, { color: T.accent }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>

        </View>

        {/* 外观区域 / Appearance section */}
        <Text style={[styles.sectionTitle, { color: T.muted }]}>APPEARANCE</Text>
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

        {/* 车辆区域 / Vehicles section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: T.muted }]}>MY VEHICLES</Text>
          <Text style={[styles.sectionSub,   { color: T.muted }]}>{vehicleCountLabel}</Text>
        </View>

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

        <Text style={[styles.footer, { color: T.muted }]}>
          MDIS Campus Parking · Student Edition
        </Text>

      </ScrollView>

      {/* ── 弹窗层 / Modal layer ── */}

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

      {/* 编辑资料弹窗（新增）/ Edit Profile modal [NEW] */}
      <EditProfileModal
        visible={editProfileModal}
        profile={student}
        onSave={handleSaveProfile}
        onClose={function closeEditProfile() { setEditProfileModal(false); }}
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
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(function renderStar(star) {
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