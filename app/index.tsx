// ═══════════════════════════════════════════════════════════════════════════════
// FILE: app/index.tsx  (Splash / Launch Screen)
//
// PURPOSE (用途):
//   The first screen users see when opening the app.
//   用户打开 App 时看到的第一个画面（启动画面）。
//
// ANIMATION SEQUENCE (动画顺序):
//   1. Logo "MDIS" fades in + scales up with spring physics
//      (Logo "MDIS" 淡入 + 弹性缩放出现)
//   2. Slogan and app name fade in
//      (标语和 App 名称淡入)
//   3. Loading bar fills left → right
//      (加载进度条从左向右填充)
//   4. After bar completes → navigate to (tabs)/home
//      (进度条完成后 → 跳转到 (tabs)/home 主页)
//
// TO CHANGE (如需修改):
//   - Change loading duration    → adjust duration values in Animated.timing()
//     (修改加载时长 → 调整 Animated.timing() 的 duration 值)
//   - Change destination screen  → edit router.replace("/(tabs)/home")
//     (修改跳转目标页面 → 修改 router.replace() 的路径)
//   - Change colors              → edit styles (background #060D1F, accent #1E90FF)
//     (修改颜色 → 修改 styles 中的 backgroundColor 和 #1E90FF)
//   - Change text                → edit the Text elements below
//     (修改文字 → 修改下方的 Text 组件内容)
//
// NOTE: This screen uses a hardcoded dark background (#060D1F) instead of the
//       theme gradient because it renders before ThemeProvider is available.
//       此页面使用固定的深色背景 (#060D1F) 而非主题渐变，因为此时 ThemeProvider 尚未就绪。
//
// IMPORTS (引入):
//   - useRouter     → from expo-router (路由导航)
//   - useEffect,
//     useRef        → React hooks (React 钩子)
//   - Animated,
//     StyleSheet,
//     Text,
//     View          → from react-native (React Native 核心组件)
//
// EXPORTS (导出):
//   - default SplashScreen → the splash screen component (启动画面组件，默认导出)
// ═══════════════════════════════════════════════════════════════════════════════

import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

/*
   SplashScreen — animated launch screen shown on app start.
   启动画面 — App 启动时显示的带动画的欢迎画面。
*/
export default function SplashScreen() {
  const router = useRouter(); // Expo Router navigation hook (路由导航钩子)

  // ── Animation Values (动画值，每个控制一个动画属性) ──────────────────────────

  /* Logo opacity: 0 → 1 (Logo 不透明度：从0到1) */
  const logoOpacity   = useRef(new Animated.Value(0)).current;

  /* Logo scale: 0.8 → 1.0 with spring (Logo 缩放：从0.8弹性放大到1.0) */
  const logoScale     = useRef(new Animated.Value(0.8)).current;

  /* Slogan + app name opacity: 0 → 1 (标语和App名称透明度：从0到1) */
  const sloganOpacity = useRef(new Animated.Value(0)).current;

  /* Loading bar fill: 0 → 1 (progress %) (加载进度条：从0到1，代表百分比) */
  const barWidth      = useRef(new Animated.Value(0)).current;

  // ── Animation Sequence (动画序列) ───────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      // Logo fades in (Logo 淡入)
      Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      // Logo scales up with spring bounce (Logo 弹性缩放)
      Animated.spring(logoScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start(() => {
      // After logo appears, fade in slogan (Logo出现后，标语淡入)
      Animated.timing(sloganOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
        // After slogan, fill the loading bar (标语淡入后，填充进度条)
        Animated.timing(barWidth, { toValue: 1, duration: 900, useNativeDriver: false }).start(() => {
          // After bar completes, navigate to main app (进度条完成后跳转到主页)
          // Short 200ms delay to let user see the completed bar (200ms延迟让用户看到满格进度条)
          setTimeout(() => router.replace("/(tabs)/home"), 200);
        });
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Subtle glow effects for atmosphere (为氛围感添加的微弱光晕效果) */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* ── MDIS Logo (Logo 文字) ── */}
      <Animated.View style={[styles.logoWrap, {
        opacity:   logoOpacity,
        transform: [{ scale: logoScale }],
      }]}>
        <Text style={styles.logoMDIS}>MDIS</Text>
      </Animated.View>

      {/* ── Slogan: university name (标语：大学名称) ── */}
      <Animated.Text style={[styles.slogan, { opacity: sloganOpacity }]}>
        Management &amp; Science University
      </Animated.Text>

      {/* ── App Name (App 名称) ── */}
      <Animated.Text style={[styles.appName, { opacity: sloganOpacity }]}>
        Campus Parking
      </Animated.Text>

      {/* ── Loading bar (加载进度条) ──
            barWidth animates 0→1, interpolated to "0%"→"100%" width
            barWidth 从0动画到1，插值转换为宽度百分比 */}
      <Animated.View style={styles.barBg}>
        <Animated.View
          style={[styles.barFill, {
            width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          }]}
        />
      </Animated.View>

      {/* ── Footer text (底部文字) ── */}
      <Text style={styles.footer}>Smart Parking · MDIS Campus</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Note: hardcoded dark colors (#060D1F, #1E90FF) — no theme system here
// 注意：此处使用固定深色颜色，不依赖主题系统（主题尚未加载）
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060D1F",           // Very dark navy (极深蓝黑色)
    justifyContent: "center",
    alignItems: "center",
  },

  // Atmospheric glow orbs (atmospheric 光晕装饰球)
  glowTop: {
    position: "absolute", top: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(30,144,255,0.07)", // Translucent blue (半透明蓝)
  },
  glowBottom: {
    position: "absolute", bottom: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: "rgba(30,144,255,0.05)",
  },

  // Logo container and text (Logo容器和文字)
  logoWrap: { marginBottom: 14 },
  logoMDIS: {
    fontSize: 60, fontWeight: "900",
    color: "#1E90FF",                     // Dodger blue (道奇蓝)
    letterSpacing: 6,
  },

  // University slogan (大学名称标语)
  slogan: {
    fontSize: 12, color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5, marginBottom: 6,
    textAlign: "center", paddingHorizontal: 30,
  },

  // App name (App 名称)
  appName: {
    fontSize: 18, color: "rgba(255,255,255,0.75)",
    fontWeight: "700", letterSpacing: 1, marginBottom: 48,
  },

  // Loading progress bar container (加载进度条容器)
  barBg: {
    width: 160, height: 3,
    backgroundColor: "rgba(30,144,255,0.2)", // Faint blue track (淡蓝底轨)
    borderRadius: 999, overflow: "hidden", marginBottom: 48,
  },
  // Animated fill bar (动画填充条)
  barFill: { height: "100%", backgroundColor: "#1E90FF", borderRadius: 999 },

  // Bottom copyright/branding text (底部品牌文字)
  footer: {
    position: "absolute", bottom: 40,
    color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: 1,
  },
});