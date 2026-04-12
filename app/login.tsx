/*
app/login.tsx — 登录/注册页面 / Login & Registration Screen

用户未登录时显示此页面，支持切换登录和注册模式。
Shown when user is not logged in. Supports toggling between login and register modes.

流程 / Flow:
 登录成功 → onAuthStateChanged 更新 user → app/_layout.tsx 跳转主页
 Sign in success → onAuthStateChanged updates user → app/_layout.tsx navigates to home

 注册成功 → Firebase 自动登录 → 同上
 Register success → Firebase auto-signs-in → same as above
*/

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
import { useAuth } from "../utils/AuthContext";
import { useTheme } from "../utils/ThemeContext";

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // 页面容器 / page container
  screen: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 60, paddingBottom: 60, backgroundColor: "transparent" },

  // 顶部 logo 区域 / top logo area
  logoWrap: { alignItems: "center", marginBottom: 36 },
  logoText: { fontSize: 36, fontWeight: "900", letterSpacing: 4, marginBottom: 4 },
  logoSub: { fontSize: 13, letterSpacing: 1 },

  // 模式切换标签（登录/注册）/ mode toggle tabs (login / register)
  tabRow: { flexDirection: "row", borderRadius: 12, overflow: "hidden", marginBottom: 28, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontWeight: "700", fontSize: 14 },

  // 输入区域 / input area
  inputLabel: { fontSize: 12, letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16 },

  // 错误提示 / error message
  errorBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { fontSize: 13, fontWeight: "600" },

  // 主操作按钮 / primary action button
  primaryBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginBottom: 16 },
  primaryBtnText: { color: "white", fontWeight: "800", fontSize: 15 },

  // 底部提示文字 / bottom hint text
  hint: { textAlign: "center", fontSize: 12, lineHeight: 18 },
});

// ─── LoginScreen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {

  const { theme: T } = useTheme();
  const { signIn, signUp } = useAuth();

  // 当前模式：登录 or 注册 / current mode: login or register
  const [mode,     setMode]     = useState<"login" | "register">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  /*
  处理登录或注册提交。
  Handles login or register submission.
  */
  async function handleSubmit() {
    // 基本验证 / basic validation
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
        // 登录成功 → onAuthStateChanged 更新 user → _layout.tsx 自动跳转
        // Sign in success → onAuthStateChanged updates user → _layout.tsx auto-navigates
      } else {
        await signUp(email.trim(), password);
        // 注册成功提示，之后 Firebase 自动登录，_layout.tsx 跳转主页
        // Show success alert; Firebase auto-signs-in and _layout.tsx navigates to home
        Alert.alert(
          "✅ Account Created!",
          "Welcome to MDIS Campus Parking. You are now logged in.",
          [{ text: "Let's Go!" }]
        );
      }
    } catch (e: any) {
      // 将 Firebase 错误代码转换为易读文字 / convert Firebase error codes to readable messages
      setError(getErrorMessage(e.code));
    } finally {
      setLoading(false);
    }
  }

  /*
  切换登录/注册模式，清空输入和错误。
  Toggle between login and register mode, clearing inputs and errors.
  */
  function handleModeSwitch(newMode: "login" | "register") {
    setMode(newMode);
    setEmail("");
    setPassword("");
    setError("");
  }

  // 登录按钮文字 / button label
  let btnLabel = "Sign In";
  if (mode === "register") { btnLabel = "Create Account"; }

  // 底部提示文字 / hint text
  let hintMain = "Don't have an account?";
  let hintAction = "Register";
  let hintTarget: "login" | "register" = "register";
  if (mode === "register") {
    hintMain   = "Already have an account?";
    hintAction = "Sign In";
    hintTarget = "login";
  }

  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

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
              onPress={() => handleModeSwitch("login")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: mode === "login" ? "#fff" : T.muted }]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "register" && { backgroundColor: T.accent }]}
              onPress={() => handleModeSwitch("register")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: mode === "register" ? "#fff" : T.muted }]}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* 电邮输入框 / Email input */}
          <Text style={[styles.inputLabel, { color: T.muted }]}>Email Address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
            value={email}
            onChangeText={t => { setEmail(t); setError(""); }}
            placeholder="e.g. student@mdis.edu.my"
            placeholderTextColor={T.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
          />

          {/* 密码输入框 / Password input */}
          <Text style={[styles.inputLabel, { color: T.muted }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: T.card, borderColor: T.border, color: T.text }]}
            value={password}
            onChangeText={t => { setPassword(t); setError(""); }}
            placeholder="Minimum 6 characters"
            placeholderTextColor={T.muted}
            secureTextEntry
          />

          {/* 错误提示 / Error message */}
          {error !== "" && (
            <View style={[styles.errorBox, { backgroundColor: T.red + "15", borderColor: T.red + "44" }]}>
              <Text style={[styles.errorText, { color: T.red }]}>⚠️  {error}</Text>
            </View>
          )}

          {/* 提交按钮 / Submit button */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: T.accent }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>{btnLabel}</Text>
            )}
          </TouchableOpacity>

          {/* 底部切换提示 / Bottom mode switch hint */}
          <Text style={[styles.hint, { color: T.muted }]}>
            {hintMain}{" "}
            <Text
              style={{ color: T.accent, fontWeight: "700" }}
              onPress={() => handleModeSwitch(hintTarget)}
            >
              {hintAction}
            </Text>
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Firebase 错误码转换 / Firebase error code to readable message ─────────────
/*
将 Firebase Auth 错误代码转换为用户友好的提示文字。
Converts Firebase Auth error codes to user-friendly messages.
*/
function getErrorMessage(code: string): string {
  if (code === "auth/user-not-found")       { return "No account found with this email."; }
  if (code === "auth/wrong-password")        { return "Incorrect password. Please try again."; }
  if (code === "auth/email-already-in-use") { return "This email is already registered."; }
  if (code === "auth/invalid-email")         { return "Please enter a valid email address."; }
  if (code === "auth/weak-password")         { return "Password must be at least 6 characters."; }
  if (code === "auth/too-many-requests")     { return "Too many attempts. Please try again later."; }
  if (code === "auth/network-request-failed") { return "Network error. Please check your connection."; }
  return "Something went wrong. Please try again.";
}