/*
app/index.tsx — 启动画面 / Splash Screen

用户打开 App 时看到的第一个画面。
The first screen users see when opening the app.

动画顺序 / Animation sequence:
 1. Logo "MDIS" 淡入 + 弹性缩放出现 / fades in + spring scales up
 2. 标语和 App 名称淡入 / slogan and app name fade in
 3. 加载进度条从左向右填充 / loading bar fills left to right
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

// ─── 进度条插值范围常量 / Interpolation range constants for the loading bar ───
// barWidth 动画值从 0 到 1，插值输出为宽度百分比字符串
// barWidth animates from 0 to 1, interpolated output is a percentage string
const BAR_INPUT_RANGE  = [0, 1];
const BAR_OUTPUT_RANGE = ["0%", "100%"];

// ─── Styles for SplashScreen ─────────────────────────────────────────────────
// 注意：固定深色颜色，不依赖主题系统（主题此时尚未加载）
// Note: hardcoded dark colors — theme system not yet loaded at this point
const styles = StyleSheet.create({

  // 全屏容器，深蓝黑背景居中布局
  // Full-screen container with dark navy background, centred layout
  container: {
    flex: 1,
    backgroundColor: "#060D1F",
    justifyContent: "center",
    alignItems: "center",
  },

  // 顶部氛围光晕球（装饰性半透明圆形）
  // Top atmospheric glow orb — decorative translucent circle
  glowTop: {
    position: "absolute",
    top: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(30,144,255,0.07)",
  },

  // 底部氛围光晕球
  // Bottom atmospheric glow orb
  glowBottom: {
    position: "absolute",
    bottom: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(30,144,255,0.05)",
  },

  // Logo 文字外层容器，控制下方间距
  // Logo text wrapper — controls bottom margin
  logoWrap: {
    marginBottom: 14,
  },

  // "MDIS" 大字标志
  // "MDIS" large brand logotype
  logoMDIS: {
    fontSize: 60,
    fontWeight: "900",
    color: "#1E90FF",
    letterSpacing: 6,
  },

  // 大学名称副标题（半透明白色小字）
  // University name subtitle — semi-transparent small white text
  slogan: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: "center",
    paddingHorizontal: 30,
  },

  // App 名称文字
  // App name text
  appName: {
    fontSize: 18,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 48,
  },

  // 进度条背景轨道（淡蓝色圆角矩形）
  // Loading bar background track — faint blue rounded rect
  barBg: {
    width: 160,
    height: 3,
    backgroundColor: "rgba(30,144,255,0.2)",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 48,
  },

  // 进度条填充块（随动画宽度变化）
  // Loading bar fill — width changes with animation
  barFill: {
    height: "100%",
    backgroundColor: "#1E90FF",
    borderRadius: 999,
  },

  // 页面最底部的品牌版权文字
  // Bottom branding text at the very bottom of the screen
  footer: {
    position: "absolute",
    bottom: 40,
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
    letterSpacing: 1,
  },
});

// ─── SplashScreen ─────────────────────────────────────────────────────────────
/*
App 启动时显示的带动画欢迎画面。
Animated launch screen shown on app start.
*/
export default function SplashScreen() {

  // 路由钩子，用于动画结束后跳转
  // Router hook — used to navigate after animations finish
  const router = useRouter();

  // ── 动画值（每个控制一个视觉属性）/ Animation values (one per visual property) ──

  // Logo 透明度，从完全透明淡入到不透明
  // Logo opacity — fades in from 0 to 1
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Logo 缩放比例，从 0.8 弹性放大到 1.0
  // Logo scale — springs from 0.8 to 1.0
  const logoScale = useRef(new Animated.Value(0.8)).current;

  // 标语和 App 名称的透明度，logo 出现后再淡入
  // Slogan and app name opacity — fades in after logo appears
  const sloganOpacity = useRef(new Animated.Value(0)).current;

  // 进度条填充比例，从 0 线性增长到 1
  // Loading bar progress — linearly fills from 0 to 1
  const barWidth = useRef(new Animated.Value(0)).current;

  // ── 动画序列 / Animation sequence ───────────────────────────────────────────
  useEffect(() => {
    // 第一阶段：Logo 同时执行淡入和弹性缩放
    // Phase 1: Logo fades in and spring-scales simultaneously
    const logoFadeIn = Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    });

    const logoSpring = Animated.spring(logoScale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    });

    // 第二阶段：标语淡入
    // Phase 2: Slogan fades in
    const sloganFadeIn = Animated.timing(sloganOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    });

    // 第三阶段：进度条从左向右填充
    // Phase 3: Loading bar fills left to right
    const barFill = Animated.timing(barWidth, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false, // 宽度动画不支持 native driver / width animation requires JS driver
    });

    // 进度条填充完成后跳转到主页
    // Navigate to home after bar completes
    function onBarComplete() {
      setTimeout(function navigateToHome() {
        router.replace("/(tabs)/home");
      }, 200); // 200ms 让用户看到满格进度条 / short pause so user sees full bar
    }

    // 标语淡入完成后启动进度条
    // Start bar fill after slogan appears
    function onSloganComplete() {
      barFill.start(onBarComplete);
    }

    // Logo 出现完成后启动标语淡入
    // Start slogan fade after logo appears
    function onLogoComplete() {
      sloganFadeIn.start(onSloganComplete);
    }

    // 启动动画链
    // Kick off the animation chain
    Animated.parallel([logoFadeIn, logoSpring]).start(onLogoComplete);
  }, [router]);

  // ── 进度条宽度插值 / Bar width interpolation ─────────────────────────────────
  // barWidth 的值是 0 到 1 的数字，插值转换为宽度百分比字符串
  // barWidth value is 0-1; interpolated to a percentage string for the width style
  const animatedBarWidth = barWidth.interpolate({
    inputRange:  BAR_INPUT_RANGE,
    outputRange: BAR_OUTPUT_RANGE,
  });

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* 装饰性光晕球 / Decorative atmospheric glow orbs */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* MDIS Logo：透明度 + 缩放动画 / MDIS logo with opacity and scale animation */}
      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Text style={styles.logoMDIS}>MDIS</Text>
      </Animated.View>

      {/* 大学名称标语（与 App 名共用同一个透明度动画值）
          University name slogan — shares the same opacity animation as app name */}
      <Animated.Text style={[styles.slogan, { opacity: sloganOpacity }]}>
        Management &amp; Science University
      </Animated.Text>

      {/* App 名称 / App name */}
      <Animated.Text style={[styles.appName, { opacity: sloganOpacity }]}>
        Campus Parking
      </Animated.Text>

      {/* 加载进度条 / Loading progress bar */}
      <Animated.View style={styles.barBg}>
        <Animated.View style={[styles.barFill, { width: animatedBarWidth }]} />
      </Animated.View>

      {/* 底部品牌文字 / Bottom branding footer text */}
      <Text style={styles.footer}>Smart Parking · MDIS Campus</Text>

    </View>
  );
}