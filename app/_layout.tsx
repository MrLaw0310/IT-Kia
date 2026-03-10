// ═══════════════════════════════════════════════════════════════════════════════
// FILE: app/_layout.tsx  (Root Layout — App Entry Point)
//
// PURPOSE (用途):
//   The outermost layout of the entire app — sets up global providers and
//   renders the full-screen gradient background.
//   整个 App 的最外层布局 — 设置全局 Provider 并渲染全屏渐变背景。
//
// RENDERING ORDER (渲染层级，从下到上):
//   1. LinearGradient    → full-screen gradient layer at the very bottom
//                          (最底层：绝对定位的全屏渐变背景)
//   2. Stack navigator   → page content on top of gradient (transparent bg)
//                          (渐变之上：Stack 导航，contentStyle 设为 transparent)
//   3. StatusBar         → auto dark/light based on current theme
//                          (自动根据主题深浅切换 StatusBar 文字颜色)
//
// WHY TRANSPARENT BACKGROUNDS? (为什么各页面设置 transparent 背景？)
//   All tab screens set backgroundColor: "transparent" so the gradient from
//   this layout shows through every screen seamlessly.
//   所有子页面设 backgroundColor: "transparent"，让这里的渐变透过每个页面显示。
//
// IMPORTS (引入):
//   - LinearGradient     → from expo-linear-gradient (渐变背景组件)
//   - Stack              → from expo-router (路由栈导航)
//   - StatusBar          → from expo-status-bar (状态栏)
//   - StyleSheet         → from react-native (样式表)
//   - ParkingProvider    → from utils/ParkingContext (停车数据全局 Provider)
//   - ThemeProvider,
//     useTheme           → from utils/ThemeContext (主题全局 Provider 和 Hook)
//
// EXPORTS (导出):
//   - default RootLayout → the root layout component registered by expo-router
//                          (expo-router 注册的根布局组件，默认导出)
// ═══════════════════════════════════════════════════════════════════════════════

import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { ParkingProvider } from "../utils/ParkingContext";
import { ThemeProvider, useTheme } from "../utils/ThemeContext";

/*
   InnerLayout — renders inside ThemeProvider so it can read the current theme.
   内层布局 — 在 ThemeProvider 内渲染，因此能读取当前主题。
  
   Separated from RootLayout so useTheme() works correctly.
   与 RootLayout 分离是因为 useTheme() 必须在 ThemeProvider 内部使用。
*/
function InnerLayout() {
  const { theme } = useTheme(); // Get active theme colors and config (读取当前主题)

  // isDarkTheme=true  → dark background → StatusBar text should be "light" (浅色文字)
  // isDarkTheme=false → light background → StatusBar text should be "dark" (深色文字)
  const statusBarStyle = theme.isDarkTheme ? "light" : "dark";

  return (
    <>
      {/* StatusBar: automatically adapts to current theme brightness
          状态栏：自动适配当前主题的明暗 */}
      <StatusBar style={statusBarStyle} />

      {/* Full-screen gradient background (全屏渐变背景):
          - absoluteFill = position absolute, top/left/right/bottom = 0
            (绝对定位，铺满全屏)
          - z-index is lowest so it sits behind all content
            (层级最低，在所有内容之下)
          - start/end define the gradient direction (start/end 定义渐变方向)
            start={x:0.3,y:0} end={x:0.7,y:1} → slightly angled top-to-bottom
            (从顶部略偏左到底部略偏右，斜向渐变) */}
      <LinearGradient
        colors={theme.gradientColors as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />

      {/* Stack navigator — content is transparent so gradient shows through
          Stack 导航器 — contentStyle transparent 让渐变从下面透出来 */}
      <Stack
        screenOptions={{
          headerShown: false,                          /* Hide default headers (隐藏默认标题栏) */
          contentStyle: { backgroundColor: "transparent" }, /* Let gradient show through (透出渐变) */
          animation: "fade",                           /* Fade transition between screens (淡入淡出页面切换) */
        }}
      >
        {/* Route: app/index.tsx — Splash screen (启动画面) */}
        <Stack.Screen name="index" />

        {/* Route: app/(tabs)/ — Tab navigation group (标签导航组) */}
        <Stack.Screen name="(tabs)" />

        {/* Route: app/camera.tsx — Check-in camera screen (签入摄像头页面) */}
        <Stack.Screen name="camera" />
      </Stack>
    </>
  );
}

/*
   RootLayout — the outermost component exported as the app's root layout.
   根布局 — 导出为 App 根布局的最外层组件。
  
   Provider nesting order (Provider 嵌套顺序):
   ThemeProvider           — must be outermost (最外层，供所有子组件读取主题)
   ParkingProvider         — parking state (停车状态)
   InnerLayout             — reads theme via useTheme() (读取主题后渲染布局)
 
   @export default
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