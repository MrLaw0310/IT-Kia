// ─────────────────────────────────────────────────────────────────────────────
// app/_layout.tsx  （Root Layout）
//
// ⚠️ 这个文件非常重要！
// ThemeProvider 必须包在最外层，所有页面才能用 useTheme() 读到主题颜色。
// 如果没有这个文件或没有 ThemeProvider，切换主题不会有任何效果。
// ─────────────────────────────────────────────────────────────────────────────

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "../utils/ThemeContext";

// ─── InnerLayout — 读取主题后配置 Stack ───────────────────────────────
// 单独拆出来是因为 ThemeProvider 内部才能用 useTheme()
function InnerLayout() {
  const { theme } = useTheme();

  // 科技风和古风是深色背景 → 状态栏用浅色文字
  // 温柔风和日系风是浅色背景 → 状态栏用深色文字
  const isDark = theme.key === "tech" || theme.key === "ancient";

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Stack
        screenOptions={{
          headerShown:  false,                         // 隐藏顶部导航栏
          contentStyle: { backgroundColor: theme.bg }, // 页面背景随主题变化
          animation:    "fade",                        // 页面切换淡入淡出
        }}
      >
        {/* Splash 启动页 */}
        <Stack.Screen name="index" />

        {/* 底部 Tab 页（home / map / history / profile） */}
        <Stack.Screen name="(tabs)" />

        {/* Check In 扫描页（不在 Tab 里） */}
        <Stack.Screen name="camera" />
      </Stack>
    </>
  );
}

// ─── RootLayout — App 最外层，ThemeProvider 在这里 ────────────────────
export default function RootLayout() {
  return (
    // ⭐ ThemeProvider 包裹 InnerLayout，所有子页面都能 useTheme()
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}