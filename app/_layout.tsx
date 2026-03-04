import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

// RootLayout — 整个 App 最外层结构
export default function RootLayout() {
  return (
    <>
      {/* 状态栏设为浅色文字，适配深色背景 */}
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown:      false,       // 隐藏顶部导航栏
          contentStyle:     { backgroundColor: "#060D1F" }, // 防止页面切换时闪白
          animation:        "fade",      // 页面切换动画：淡入淡出
        }}
      >
        {/* Splash Screen */}
        <Stack.Screen name="index" />

        {/* Tabs — home / map / history / profile */}
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}