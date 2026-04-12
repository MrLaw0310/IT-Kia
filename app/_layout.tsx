/*
app/_layout.tsx — 根布局 / Root Layout (App Entry Point)

整个 App 的最外层布局，设置全局 Provider 并渲染全屏渐变背景。
Outermost layout — sets up global providers and the full-screen gradient background.

渲染层级（从下到上）/ Rendering order (bottom to top):
 1. LinearGradient  — 最底层全屏渐变背景 / full-screen gradient at the very bottom
 2. Stack navigator — 页面内容层（透明背景）/ page content (transparent bg)
 3. StatusBar       — 自动根据主题明暗切换 / auto dark/light based on theme

为什么各页面设 transparent 背景？/ Why transparent backgrounds on child pages?
 所有子页面设 transparent，让此处渐变透过每个页面显示。
 All tab screens use transparent so this gradient shows through seamlessly.

Provider 嵌套顺序 / Provider nesting order:
 ThemeProvider → AuthProvider → ParkingProvider → InnerLayout
*/

import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "../utils/AuthContext";
import { ParkingProvider } from "../utils/ParkingContext";
import { ThemeProvider, useTheme } from "../utils/ThemeContext";

// ─── InnerLayout ──────────────────────────────────────────────────────────────
/*
在 ThemeProvider 和 AuthProvider 内部渲染，可以安全调用 useTheme() 和 useAuth()。
Rendered inside ThemeProvider and AuthProvider so it can safely call useTheme() and useAuth().
*/
function InnerLayout() {

  const { theme } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();
  const splashReady = useRef(false);

  useEffect(() => {
  const timer = setTimeout(() => {
    splashReady.current = true;
    // 不管 loading，直接跳转
    router.replace(!user ? "/login" : "/(tabs)/home");
  }, 5000);
  return () => clearTimeout(timer);
}, [user]); // ← 依赖加上 user


  // 深色主题 → 状态栏文字用亮色；浅色主题 → 用暗色
  // Dark theme → light status bar text; light theme → dark text
  let statusBarStyle: "light" | "dark";
  if (theme.isDarkTheme) {
    statusBarStyle = "light";
  } else {
    statusBarStyle = "dark";
  }

  // 登录状态检查完毕后，根据 user 决定跳转目标
  // After auth state is confirmed, navigate based on user
  useEffect(() => {
  if (loading) return;
  if (!splashReady.current) return;
  router.replace(!user ? "/login" : "/(tabs)/home");
}, [user, loading]);

  return (
    <>
      {/* 状态栏：根据主题明暗自动切换文字颜色
          StatusBar: text colour adapts to current theme brightness */}
      <StatusBar style={statusBarStyle} />

      {/* 全屏渐变背景，绝对定位铺满，层级最低，所有页面内容叠加在其上方
          Full-screen gradient: absoluteFill, lowest z-index, all page content sits above it */}
      <LinearGradient
        colors={theme.gradientColors as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />

      {/* Stack 导航器：contentStyle 设透明让渐变透出来
          Stack navigator: transparent contentStyle so the gradient below shows through */}
      <Stack
        screenOptions={{
          headerShown: false,                               // 隐藏默认标题栏 / hide default header
          contentStyle: { backgroundColor: "transparent" }, // 透明，让渐变透出 / reveal gradient
          animation: "fade",                                // 页面切换淡入淡出 / fade transition
        }}
      >
        {/* app/index.tsx — 启动画面 / Splash screen */}
        <Stack.Screen name="index" />

        {/* app/login.tsx — 登录/注册页面 / Login & Registration screen */}
        <Stack.Screen name="login" />

        {/* app/(tabs)/ — 标签导航组 / Tab navigation group */}
        <Stack.Screen name="(tabs)" />

        {/* app/camera.tsx — 签入摄像头页面 / Check-in camera screen */}
        <Stack.Screen name="camera" />
      </Stack>
    </>
  );
}

// ─── RootLayout ───────────────────────────────────────────────────────────────
/*
导出为 App 根布局。expo-router 自动将此组件用作整个应用的最外层。
Exported as the app's root layout. expo-router automatically uses this as the outermost wrapper.
*/
export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ParkingProvider>
          <InnerLayout />
        </ParkingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}