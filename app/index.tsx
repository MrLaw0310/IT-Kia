/*
app/index.tsx — 启动画面 / Splash Screen

用户打开 App 时看到的第一个画面。
The first screen users see when opening the app.

动画顺序 / Animation sequence:
 1. Logo "MDIS" 淡入 + 弹性缩放出现 / fades in + spring scales up
 2. 标语和 App 名称淡入 / slogan and app name fade in
 3. 加载进度条从左向右填充 / loading bar fills left → right
 4. 进度条完成后跳转到 (tabs)/home / navigates to (tabs)/home after bar completes

注意：此页面使用固定深色背景 (#060D1F)，因为 ThemeProvider 此时尚未就绪。
Note: hardcoded dark background (#060D1F) — ThemeProvider is not yet available here.

 如需修改 / To customise:
 - 加载时长 → 调整 Animated.timing() 的 duration 值
   Loading duration → edit duration in Animated.timing()
 - 跳转目标 → 修改 router.replace() 的路径
   Destination → edit router.replace() path
 - 颜色 → 修改 styles 里的 #060D1F 和 #1E90FF
   Colors → change #060D1F and #1E90FF in styles
*/

import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

/*
SplashScreen — App 启动时显示的带动画欢迎画面。
Animated launch screen shown on app start.
*/
export default function SplashScreen() {
  const router = useRouter(); // 路由导航钩子 / expo-router navigation

  // 动画值，每个控制一个属性 / animation values, one per animated property
  const logoOpacity = useRef(new Animated.Value(0)).current; // Logo 透明度 0→1 / opacity
  const logoScale = useRef(new Animated.Value(0.8)).current; // Logo 缩放 0.8→1 弹性 / spring scale
  const sloganOpacity = useRef(new Animated.Value(0)).current; // 标语和 App 名透明度 / slogan opacity
  const barWidth = useRef(new Animated.Value(0)).current; // 进度条 0→1 / loading bar progress

  // 动画序列 / animation sequence
  useEffect(() => {
    Animated.parallel([
      // Logo 淡入 / logo fade in
      Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      // Logo 弹性缩放 / logo spring scale
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start(() => {
      // Logo 出现后标语淡入 / after logo appears, fade in slogan
      Animated.timing(sloganOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
        // 标语淡入后填充进度条 / after slogan, fill loading bar
        Animated.timing(barWidth, { toValue: 1, duration: 900, useNativeDriver: false }).start(() => {
          // 200ms 延迟让用户看到满格进度条再跳转
          // Short delay so user sees the completed bar before navigating
          setTimeout(() => router.replace("/(tabs)/home"), 200);
        });
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* 氛围感光晕装饰 / atmospheric glow orbs */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* MDIS Logo 文字 / logo text */}
      <Animated.View style={[styles.logoWrap, {
        opacity: logoOpacity,
        transform: [{ scale: logoScale }],
      }]}>
        <Text style={styles.logoMDIS}>MDIS</Text>
      </Animated.View>

      {/* 大学名称标语 / university name slogan */}
      <Animated.Text style={[styles.slogan, { opacity: sloganOpacity }]}>
        Management &amp; Science University
      </Animated.Text>

      {/* App 名称 / app name */}
      <Animated.Text style={[styles.appName, { opacity: sloganOpacity }]}>
        Campus Parking
      </Animated.Text>

      {/* 加载进度条 — barWidth 从0动画到1，插值转换为宽度百分比
          Loading bar — barWidth animates 0→1, interpolated to "0%"→"100%" */}
      <Animated.View style={styles.barBg}>
        <Animated.View
          style={[styles.barFill, {
            width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          }]}
        />
      </Animated.View>

      {/* 底部品牌文字 / bottom branding text */}
      <Text style={styles.footer}>Smart Parking · MDIS Campus</Text>
    </View>
  );
}

// ─── Styles (样式) ────────────────────────────────────────────────────────────
// 注意：固定深色颜色，不依赖主题系统（主题尚未加载）
// Note: hardcoded dark colors — theme system not yet loaded at this point
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060D1F", // 极深蓝黑色 / very dark navy
    justifyContent: "center",
    alignItems: "center",
  },

  // 氛围感半透明蓝色光晕球 / atmospheric translucent blue glow orbs
  glowTop: {
    position: "absolute", top: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(30,144,255,0.07)",
  },
  glowBottom: {
    position: "absolute", bottom: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: "rgba(30,144,255,0.05)",
  },

  // Logo 容器和文字 / logo container and text
  logoWrap: { marginBottom: 14 },
  logoMDIS: {
    fontSize: 60, fontWeight: "900",
    color: "#1E90FF", // 道奇蓝 / dodger blue
    letterSpacing: 6,
  },

  // 大学名称标语 / university name slogan
  slogan: {
    fontSize: 12, color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5, marginBottom: 6,
    textAlign: "center", paddingHorizontal: 30,
  },

  // App 名称 / app name text
  appName: {
    fontSize: 18, color: "rgba(255,255,255,0.75)",
    fontWeight: "700", letterSpacing: 1, marginBottom: 48,
  },

  // 加载进度条容器 / loading bar container
  barBg: {
    width: 160, height: 3,
    backgroundColor: "rgba(30,144,255,0.2)", // 淡蓝底轨 / faint blue track
    borderRadius: 999, overflow: "hidden", marginBottom: 48,
  },
  // 动画填充条 / animated fill bar
  barFill: { height: "100%", backgroundColor: "#1E90FF", borderRadius: 999 },

  // 底部品牌文字 / footer branding text
  footer: {
    position: "absolute", bottom: 40,
    color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: 1,
  },
});