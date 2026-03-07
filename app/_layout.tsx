// ─────────────────────────────────────────────────────────────────────────────
// app/_layout.tsx  （Root Layout）
//
// 整个 App 的最外层布局：
//  1. 用 LinearGradient 铺满全屏渐变背景（绝对定位在最底层）
//  2. Stack 导航层叠在渐变上方，contentStyle 设为 transparent 让渐变透出
//  3. StatusBar 根据主题深浅自动切换深色/浅色
// ─────────────────────────────────────────────────────────────────────────────

import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { ParkingProvider } from "../utils/ParkingContext";
import { ThemeProvider, useTheme } from "../utils/ThemeContext";

function InnerLayout() {
  const { theme } = useTheme();

  // isDarkTheme=true → 背景深，StatusBar 用浅色文字（light）
  // isDarkTheme=false → 背景浅，StatusBar 用深色文字（dark）
  const statusBarStyle = theme.isDarkTheme ? "light" : "dark";

  return (
    <>
      <StatusBar style={statusBarStyle} />

      {/* 渐变背景：绝对定位铺满全屏，在所有内容下面 */}
      <LinearGradient
        colors={theme.gradientColors as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />

      <Stack
        screenOptions={{
          headerShown: false,
          // transparent 让渐变从底层透出来
          contentStyle: { backgroundColor: "transparent" },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="camera" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ParkingProvider>
        <InnerLayout />
      </ParkingProvider>
    </ThemeProvider>
  );
}