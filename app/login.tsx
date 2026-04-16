/*
app/login.tsx — 登录/注册页面 / Login & Registration Screen

用户未登录时显示此页面，支持切换登录和注册模式。
Shown when user is not logged in. Supports toggling between login and register modes.

流程 / Flow:
 登录成功 → onAuthStateChanged 更新 user → app/_layout.tsx 跳转主页
 Sign in success → onAuthStateChanged updates user → app/_layout.tsx navigates to home

 注册成功 → Firebase 自动登录 → 同上
 Register success → Firebase auto-signs-in → same as above

 访客模式 → enterGuestMode() → app/_layout.tsx 跳转主页（权限受限）
 Guest mode → enterGuestMode() → app/_layout.tsx navigates to home (limited access)

注册表单分两步 / Two-step register form:
 Step 1: 个人资料（名字、科系、年级、学号、电话、电邮、密码）
 Step 2: 车辆资料（车牌、品牌、型号、颜色）
*/

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth, VehicleData } from "../utils/AuthContext";
import { useTheme } from "../utils/ThemeContext";

// ─── 课程选项 / Program options ─────────────────────────────────────────────────
const PROGRAMS = ["Certificate", "Diploma", "Degree", "Foundation"];

// ─── 根据课程类型动态显示部门 / Department options by program type ────────────
const DEPARTMENTS_BY_PROGRAM: Record<string, string[]> = {
  Certificate: ["Business Management", "English Language"],
  Diploma: [
    "Information Technology",
    "Tourism Management",
    "Marketing",
    "Accounting",
    "Business Management",
    "Hotel Management",
    "Mass Communication",
    "International Business",
    "Finance",
  ],
  Degree: [
    "Bachelor of Science (Honours) in International Tourism and Hospitality Management (3+0) In Collaboration with University of Sunderland, UK",
    "Bachelor of Arts (Honours) Media, Culture and Communication (3+0) In Collaboration with University of Sunderland, UK",
  ],
  Foundation: ["Business"],
};

// ─── 颜色选项 / Color options ─────────────────────────────────────────────────
const COLORS = [
  { label: "White",  hex: "#FFFFFF" },
  { label: "Black",  hex: "#1a1a1a" },
  { label: "Silver", hex: "#C0C0C0" },
  { label: "Grey",   hex: "#808080" },
  { label: "Red",    hex: "#E53935" },
  { label: "Blue",   hex: "#1E88E5" },
  { label: "Green",  hex: "#43A047" },
  { label: "Brown",  hex: "#6D4C41" },
  { label: "Gold",   hex: "#FFB300" },
  { label: "Orange", hex: "#FB8C00" },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:       { flex: 1 },
  scroll:       { flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 60, paddingBottom: 60, backgroundColor: "transparent" },

  // 顶部 logo 区域 / top logo area
  logoWrap:     { alignItems: "center", marginBottom: 36 },
  logoText:     { fontSize: 36, fontWeight: "900", letterSpacing: 4, marginBottom: 4 },
  logoSub:      { fontSize: 13, letterSpacing: 1 },

  // 模式切换标签 / mode toggle tabs
  tabRow:       { flexDirection: "row", borderRadius: 12, overflow: "hidden", marginBottom: 28, borderWidth: 1 },
  tab:          { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText:      { fontWeight: "700", fontSize: 14 },

  // 注册步骤指示器 / register step indicator
  stepRow:      { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  stepDot:      { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  stepNum:      { fontSize: 12, fontWeight: "800" },
  stepLine:     { flex: 1, height: 2, marginHorizontal: 8 },
  stepLabel:    { fontSize: 11, fontWeight: "600", marginTop: 4, textAlign: "center" },

  // 区块标题 / section title
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 1, marginBottom: 16, marginTop: 4 },

  // 输入框 / input
  inputLabel:   { fontSize: 12, letterSpacing: 0.5, marginBottom: 6 },
  input:        { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16 },

  // 选择器 chip / selector chip
  selectorRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  selectorChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  selectorText: { fontSize: 13, fontWeight: "600" },

  // 颜色点 / color dot
  colorRow:     { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  colorDot:     { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },

  // 错误提示 / error box
  errorBox:     { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText:    { fontSize: 13, fontWeight: "600" },

  // 主按钮 / primary button
  primaryBtn:   { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginBottom: 16 },
  primaryBtnText: { color: "white", fontWeight: "800", fontSize: 15 },

  // 次要按钮 / secondary button
  secondaryBtn:  { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 12, borderWidth: 1 },
  secondaryText: { fontWeight: "700", fontSize: 14 },

  // 分隔线 / divider
  dividerRow:   { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  dividerLine:  { flex: 1, height: 1 },
  dividerText:  { marginHorizontal: 10, fontSize: 12 },

  // 访客按钮 / guest button
  guestBtn:     { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginBottom: 16, borderWidth: 1 },
  guestBtnText: { fontWeight: "700", fontSize: 14 },

  // 底部提示 / bottom hint
  hint:         { textAlign: "center", fontSize: 12, lineHeight: 18 },
});

// ─── LoginScreen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {

  const { theme: T } = useTheme();
  const { signIn, signUp, enterGuestMode } = useAuth();
  const router = useRouter();

  // 当前模式：登录 or 注册 / current mode: login or register
  const [mode,     setMode]     = useState<"login" | "register">("login");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // ── 登录字段 / Login fields ──
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  // ── 注册 Step 1：个人资料 / Register Step 1: personal info ──
  const [regStep,      setRegStep]      = useState<1 | 2>(1);
  const [name,         setName]         = useState("");
  const [program,      setProgram]      = useState("");
  const [department,   setDepartment]   = useState("");
  const [studentId,    setStudentId]    = useState("");
  const [phone,        setPhone]        = useState("");
  const [regEmail,     setRegEmail]     = useState("");
  const [regPassword,  setRegPassword]  = useState("");
  const [confirmPw,    setConfirmPw]    = useState("");

  // ── 注册 Step 2：车辆资料 / Register Step 2: vehicle info ──
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");

  // ── 切换模式，清空所有状态 / Switch mode, reset all state ──────────────────
  function handleModeSwitch(newMode: "login" | "register") {
    setMode(newMode);
    setError("");
    setRegStep(1);
    // 清空登录字段 / clear login fields
    setEmail(""); setPassword("");
    // 清空注册字段 / clear register fields
    setName(""); setProgram(""); setDepartment(""); setStudentId("");
    setPhone(""); setRegEmail(""); setRegPassword(""); setConfirmPw("");
    setPlate(""); setBrand(""); setModel(""); setColor("");
  }

  // ── 登录提交 / Login submit ───────────────────────────────────────────────
  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password."); return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    setError(""); setLoading(true);
    try {
      await signIn(email.trim(), password);
      // 登录成功 → onAuthStateChanged 更新 user → _layout.tsx 自动跳转
    } catch (e: any) {
      console.log("Login error:", e.code, e.message);
      setError(getErrorMessage(e.code));
    } finally {
      setLoading(false);
    }
  }

  // ── Student ID 格式验证 / Validate student ID format ────────────────────
  // 必须符合格式：XX/XXSX-XXXX... (例如：23/24S1-1962DBM)
  // Must follow format: XX/XXSX-XXXX... (e.g. 23/24S1-1962DBM)
  function validateStudentId(id: string): boolean {
    const pattern = /^\d{2}\/\d{2}[A-Za-z]\d-\d{4}.*/;
    return pattern.test(id.trim());
  }

  // ── 电话号码格式验证 / Validate phone number format ──────────────────────
  // 接受多种格式，但必须至少有 10-11 个数字 / Accepts various formats, must have 10-11 digits
  function validatePhoneNumber(phone: string): boolean {
    const digitsOnly = phone.replace(/\D/g, "");
    return digitsOnly.length >= 10 && digitsOnly.length <= 11;
  }

  // ── 注册 Step 1 验证 / Register step 1 validation ─────────────────────────
  function validateStep1(): boolean {
    if (!name.trim())          { setError("Please enter your full name."); return false; }
    if (!program)              { setError("Please select your program."); return false; }
    if (!department)           { setError("Please select your department."); return false; }
    if (!studentId.trim())     { setError("Please enter your student ID."); return false; }
    if (!validateStudentId(studentId)) { setError("Student ID must follow format: XX/XXSX-XXXX (e.g. 23/24S1-1962DBM)"); return false; }
    if (!phone.trim())         { setError("Please enter your phone number."); return false; }
    if (!validatePhoneNumber(phone)) { setError("Phone number must have 10-11 digits."); return false; }
    if (!regEmail.trim())      { setError("Please enter your email address."); return false; }
    if (regPassword.length < 6){ setError("Password must be at least 6 characters."); return false; }
    if (regPassword !== confirmPw) { setError("Passwords do not match."); return false; }
    return true;
  }

  // ── 注册 Step 2 验证 / Register step 2 validation ─────────────────────────
  function validateStep2(): boolean {
    if (!plate.trim()) { setError("Please enter your license plate."); return false; }
    if (!brand.trim()) { setError("Please enter your car brand."); return false; }
    if (!model.trim()) { setError("Please enter your car model."); return false; }
    if (!color)        { setError("Please select your car color."); return false; }
    return true;
  }

  // ── 进入第二步 / Go to step 2 ─────────────────────────────────────────────
  function handleNextStep() {
    setError("");
    if (validateStep1()) setRegStep(2);
  }

  // ── 注册提交 / Register submit ────────────────────────────────────────────
  async function handleRegister() {
    setError("");
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const vehicle: VehicleData = {
        plate: plate.trim().toUpperCase(),
        brand: brand.trim(),
        model: model.trim(),
        color,
        isDefault: true,
      };
      // 调用 AuthContext.signUp，内部创建 Firebase Auth 账号 + 写入 Firestore
      // Calls AuthContext.signUp — creates Firebase Auth account + writes to Firestore
      await signUp(
        regEmail.trim(),
        regPassword,
        { name: name.trim(), department, year: program, studentId: studentId.trim(), phone: phone.trim() },
        vehicle
      );
      Alert.alert(
        "✅ Account Created!",
        "Welcome to MDIS Campus Parking. You are now logged in.",
        [{ text: "Let's Go!" }]
      );
      // Firebase 自动登录，_layout.tsx 的 onAuthStateChanged 自动跳转主页
    } catch (e: any) {
      console.log("Register error:", e.code, e.message);
      setError(getErrorMessage(e.code));
    } finally {
      setLoading(false);
    }
  }

  // ── 访客模式 / Guest mode ─────────────────────────────────────────────────
  function handleGuestMode() {
    if (typeof enterGuestMode === "function") enterGuestMode();
    router.replace("/(tabs)/home");
  }

  // ─── 渲染步骤指示器 / Render step indicator ──────────────────────────────
  function renderStepIndicator() {
    return (
      <View style={styles.stepRow}>
        <View style={{ alignItems: "center" }}>
          <View style={[styles.stepDot, { backgroundColor: T.accent }]}>
            <Text style={[styles.stepNum, { color: "#fff" }]}>1</Text>
          </View>
          <Text style={[styles.stepLabel, { color: T.accent }]}>Personal</Text>
        </View>
        <View style={[styles.stepLine, { backgroundColor: regStep === 2 ? T.accent : T.border }]} />
        <View style={{ alignItems: "center" }}>
          <View style={[styles.stepDot, {
            backgroundColor: regStep === 2 ? T.accent : T.card,
            borderWidth: regStep === 2 ? 0 : 2,
            borderColor: T.border,
          }]}>
            <Text style={[styles.stepNum, { color: regStep === 2 ? "#fff" : T.muted }]}>2</Text>
          </View>
          <Text style={[styles.stepLabel, { color: regStep === 2 ? T.accent : T.muted }]}>Vehicle</Text>
        </View>
      </View>
    );
  }

  // ─── 渲染注册 Step 1 / Render register step 1 ────────────────────────────
  function renderRegStep1() {
    // 获取当前选择的Program对应的Department列表 / get departments for selected program
    const availableDepartments = program ? (DEPARTMENTS_BY_PROGRAM[program] || []) : [];
    
    return (
      <>
        <Text style={[styles.sectionTitle, { color: T.accent }]}>👤 PERSONAL INFORMATION</Text>

        <Text style={[styles.inputLabel, { color: T.muted }]}>Full Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={name} onChangeText={t => { setName(t); setError(""); }}
          placeholder="e.g. Ahmad Bin Abdullah" placeholderTextColor={T.muted}
          autoCapitalize="words"
        />

        <Text style={[styles.inputLabel, { color: T.muted }]}>Program</Text>
        <View style={styles.selectorRow}>
          {PROGRAMS.map(p => (
            <TouchableOpacity key={p}
              style={[styles.selectorChip, {
                backgroundColor: program === p ? T.accent : T.card,
                borderColor: program === p ? T.accent : T.border,
              }]}
              onPress={() => { 
                setProgram(p); 
                setDepartment(""); // 清除之前选择的department / reset department when program changes
                setError(""); 
              }}
            >
              <Text style={[styles.selectorText, { color: program === p ? "#fff" : T.text }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {program && (
          <>
            <Text style={[styles.inputLabel, { color: T.muted }]}>Department</Text>
            <View style={styles.selectorRow}>
              {availableDepartments.map(d => (
                <TouchableOpacity key={d}
                  style={[styles.selectorChip, {
                    backgroundColor: department === d ? T.accent : T.card,
                    borderColor: department === d ? T.accent : T.border,
                  }]}
                  onPress={() => { setDepartment(d); setError(""); }}
                >
                  <Text style={[styles.selectorText, { color: department === d ? "#fff" : T.text }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.inputLabel, { color: T.muted }]}>Student ID</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={studentId} onChangeText={t => { setStudentId(t); setError(""); }}
          placeholder="e.g. 23/24S1-1962DBM" placeholderTextColor={T.muted}
          autoCapitalize="characters"
        />

        <Text style={[styles.inputLabel, { color: T.muted }]}>Phone Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={phone} onChangeText={t => { setPhone(t); setError(""); }}
          placeholder="e.g. 011-12345678 (any format accepted)" placeholderTextColor={T.muted}
          keyboardType="phone-pad"
        />

        <Text style={[styles.sectionTitle, { color: T.accent, marginTop: 4 }]}>🔐 ACCOUNT CREDENTIALS</Text>

        <Text style={[styles.inputLabel, { color: T.muted }]}>Email Address</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={regEmail} onChangeText={t => { setRegEmail(t); setError(""); }}
          placeholder="e.g. student@mdis.edu.my" placeholderTextColor={T.muted}
          autoCapitalize="none" keyboardType="email-address"
        />

        <Text style={[styles.inputLabel, { color: T.muted }]}>Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={regPassword} onChangeText={t => { setRegPassword(t); setError(""); }}
          placeholder="Minimum 6 characters" placeholderTextColor={T.muted}
          secureTextEntry
        />

        <Text style={[styles.inputLabel, { color: T.muted }]}>Confirm Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={confirmPw} onChangeText={t => { setConfirmPw(t); setError(""); }}
          placeholder="Re-enter your password" placeholderTextColor={T.muted}
          secureTextEntry
        />
      </>
    );
  }

  // ─── 渲染注册 Step 2 / Render register step 2 ────────────────────────────
  function renderRegStep2() {
    return (
      <>
        <Text style={[styles.sectionTitle, { color: T.accent }]}>🚗 VEHICLE INFORMATION</Text>

        <Text style={[styles.inputLabel, { color: T.muted }]}>License Plate</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={plate} onChangeText={t => { setPlate(t); setError(""); }}
          placeholder="e.g. WXX 1234" placeholderTextColor={T.muted}
          autoCapitalize="characters"
        />

        <Text style={[styles.inputLabel, { color: T.muted }]}>Car Brand</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={brand} onChangeText={t => { setBrand(t); setError(""); }}
          placeholder="e.g. Perodua, Toyota, Honda" placeholderTextColor={T.muted}
          autoCapitalize="words"
        />

        <Text style={[styles.inputLabel, { color: T.muted }]}>Car Model</Text>
        <TextInput
          style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
          value={model} onChangeText={t => { setModel(t); setError(""); }}
          placeholder="e.g. Myvi, Vios, City" placeholderTextColor={T.muted}
          autoCapitalize="words"
        />

        <Text style={[styles.inputLabel, { color: T.muted }]}>Car Color</Text>
        <View style={styles.colorRow}>
          {COLORS.map(c => (
            <TouchableOpacity key={c.label}
              onPress={() => { setColor(c.label); setError(""); }}
              style={{ alignItems: "center" }}
            >
              <View style={[styles.colorDot, {
                backgroundColor: c.hex,
                borderColor: color === c.label ? T.accent : T.border,
                ...(c.label === "White" && { borderColor: color === "White" ? T.accent : "#aaa" }),
              }]}>
                {color === c.label && (
                  <Ionicons
                    name="checkmark" size={16}
                    color={["White","Silver","Gold"].includes(c.label) ? "#333" : "#fff"}
                  />
                )}
              </View>
              <Text style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  }

  // ─── 主渲染 / Main render ─────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, mode === "register" && { justifyContent: "flex-start" }]}
          keyboardShouldPersistTaps="handled">

          {/* Logo 区域 / Logo area */}
          <View style={styles.logoWrap}>
            <Image
              source={require("../assets/images/itkia.png")}
              style={{ width: 120, height: 60, resizeMode: "contain", marginBottom: 12 }}
            />
            <Text style={[styles.logoText, { color: T.accent }]}>MDIS</Text>
            <Text style={[styles.logoSub, { color: T.muted }]}>Campus Parking · Student Edition</Text>
          </View>

          {/* 模式切换标签 / Mode toggle tabs */}
          <View style={[styles.tabRow, { borderColor: T.border, backgroundColor: T.card }]}>
            <TouchableOpacity
              style={[styles.tab, mode === "login" && { backgroundColor: T.accent }]}
              onPress={() => handleModeSwitch("login")} activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: mode === "login" ? "#fff" : T.muted }]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "register" && { backgroundColor: T.accent }]}
              onPress={() => handleModeSwitch("register")} activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: mode === "register" ? "#fff" : T.muted }]}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* ── 登录模式 / Login mode ── */}
          {mode === "login" && (
            <>
              <Text style={[styles.inputLabel, { color: T.muted }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
                value={email} onChangeText={t => { setEmail(t); setError(""); }}
                placeholder="e.g. student@mdis.edu.my" placeholderTextColor={T.muted}
                autoCapitalize="none" keyboardType="email-address" autoFocus
              />

              <Text style={[styles.inputLabel, { color: T.muted }]}>Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
                value={password} onChangeText={t => { setPassword(t); setError(""); }}
                placeholder="Minimum 6 characters" placeholderTextColor={T.muted}
                secureTextEntry
              />

              {error !== "" && (
                <View style={[styles.errorBox, { backgroundColor: T.red + "15", borderColor: T.red + "44" }]}>
                  <Text style={[styles.errorText, { color: T.red }]}>⚠️  {error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: T.accent }]}
                onPress={handleLogin} activeOpacity={0.85} disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
                <Text style={[styles.dividerText, { color: T.muted }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: T.border }]} />
              </View>

              <TouchableOpacity
                style={[styles.guestBtn, { borderColor: T.border, backgroundColor: T.card }]}
                onPress={handleGuestMode} activeOpacity={0.8}
              >
                <Text style={[styles.guestBtnText, { color: T.muted }]}>👁  Continue as Guest</Text>
              </TouchableOpacity>

              <Text style={[styles.hint, { color: T.muted }]}>
                Don't have an account?{" "}
                <Text style={{ color: T.accent, fontWeight: "700" }} onPress={() => handleModeSwitch("register")}>
                  Register
                </Text>
              </Text>
            </>
          )}

          {/* ── 注册模式 / Register mode ── */}
          {mode === "register" && (
            <>
              {/* 步骤指示器 / step indicator */}
              {renderStepIndicator()}

              {/* 当前步骤表单 / current step form */}
              {regStep === 1 ? renderRegStep1() : renderRegStep2()}

              {/* 错误提示 / error message */}
              {error !== "" && (
                <View style={[styles.errorBox, { backgroundColor: T.red + "15", borderColor: T.red + "44" }]}>
                  <Text style={[styles.errorText, { color: T.red }]}>⚠️  {error}</Text>
                </View>
              )}

              {/* 按钮 / buttons */}
              {regStep === 1 ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: T.accent }]}
                  onPress={handleNextStep} activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Next: Vehicle Info →</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: T.accent }]}
                    onPress={handleRegister} activeOpacity={0.85} disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Create Account ✓</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: T.border, backgroundColor: T.card }]}
                    onPress={() => { setRegStep(1); setError(""); }} activeOpacity={0.8}
                  >
                    <Text style={[styles.secondaryText, { color: T.muted }]}>← Back</Text>
                  </TouchableOpacity>
                </>
              )}

              <Text style={[styles.hint, { color: T.muted, marginTop: 8 }]}>
                Already have an account?{" "}
                <Text style={{ color: T.accent, fontWeight: "700" }} onPress={() => handleModeSwitch("login")}>
                  Sign In
                </Text>
              </Text>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Firebase 错误码转换 / Firebase error code to readable message ─────────────
// 将 Firebase Auth 错误代码转换为用户友好的提示文字
function getErrorMessage(code: string): string {
  if (code === "auth/user-not-found")        { return "No account found with this email."; }
  if (code === "auth/wrong-password")         { return "Incorrect password. Please try again."; }
  if (code === "auth/email-already-in-use")  { return "This email is already registered."; }
  if (code === "auth/invalid-email")          { return "Please enter a valid email address."; }
  if (code === "auth/weak-password")          { return "Password must be at least 6 characters."; }
  if (code === "auth/too-many-requests")      { return "Too many attempts. Please try again later."; }
  if (code === "auth/network-request-failed") { return "Network error. Please check your connection."; }
  return "Something went wrong. Please try again.";
}