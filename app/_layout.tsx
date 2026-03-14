/*
app/_layout.tsx — 根布局 / Root Layout (App Entry Point)

整个 App 的最外层布局，设置全局 Provider 并渲染全屏渐变背景。
Outermost layout — sets up global providers and the full-screen gradient background.

渲染层级（从下到上）/ Rendering order (bottom to top):
 1. LinearGradient  — 最底层全屏渐变背景 / full-screen gradient at the very bottom
 2. Stack navigator — 页面内容层（透明背景）/ page content (transparent bg)
 3. StatusBar       — 自动根据主题明暗切换 / auto dark/light based on theme

为什么各页面设 transparent 背景？/ Why transparent backgrounds?
 所有子页面设 transparent，让此处渐变透过每个页面显示。
 All tab screens use transparent so this gradient shows through seamlessly.

Provider 嵌套顺序 / Provider nesting order:
 ThemeProvider → ParkingProvider → InnerLayout
*/

import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { ParkingProvider } from "../utils/ParkingContext";
import { ThemeProvider, useTheme } from "../utils/ThemeContext";

/*
InnerLayout — 在 ThemeProvider 内渲染，因此能读取当前主题。
Renders inside ThemeProvider so it can call useTheme() correctly.

与 RootLayout 分离是因为 useTheme() 必须在 ThemeProvider 内部使用。
Separated from RootLayout because useTheme() must be called inside ThemeProvider.
*/
function InnerLayout() {
  const { theme } = useTheme(); // 读取当前主题 / read active theme

  // 深色主题 → StatusBar 浅色文字；浅色主题 → 深色文字
  // Dark theme → light text; light theme → dark text
  const statusBarStyle = theme.isDarkTheme ? "light" : "dark";

  return (
    <>
      {/* 状态栏自动适配主题明暗 / StatusBar adapts to current theme brightness */}
      <StatusBar style={statusBarStyle} />

      {/* 全屏渐变背景，绝对定位铺满全屏，层级最低
          Full-screen gradient: absoluteFill, lowest z-index, behind all content
          start/end 定义斜向渐变方向 / start/end define slightly angled direction */}
      <LinearGradient
        colors={theme.gradientColors as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />

      {/* Stack 导航器，contentStyle transparent 让渐变透出来
          Stack navigator — transparent contentStyle so gradient shows through */}
      <Stack
        screenOptions={{
          headerShown: false, // 隐藏默认标题栏 / hide default header
          contentStyle: { backgroundColor: "transparent" },  // 让渐变透出 / reveal gradient
          animation: "fade", // 页面切换淡入淡出 / fade transition
        }}
      >
        {/* app/index.tsx — 启动画面 / splash screen */}
        <Stack.Screen name="index" />

        {/* app/(tabs)/ — 标签导航组 / tab navigation group */}
        <Stack.Screen name="(tabs)" />

        {/* app/camera.tsx — 签入摄像头页面 / check-in camera screen */}
        <Stack.Screen name="camera" />
      </Stack>
    </>
  );
}

/*
RootLayout — 导出为 App 根布局的最外层组件。
Exported as the app's root layout by expo-router.
*/
export default function RootLayout() {
  return (
    <ThemeProvider>
      <ParkingProvider>
        <InnerLayout />
      </ParkingProvider>
    </ThemeProvider>
  );
}