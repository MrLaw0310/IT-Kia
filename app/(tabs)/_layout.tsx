// ═══════════════════════════════════════════════════════════════════════════════
// FILE: app/(tabs)/_layout.tsx  (Tab Bar Layout — Bottom Navigation)
//
// PURPOSE (用途):
//   Defines the bottom tab navigation bar shared across all 4 main screens.
//   定义底部标签导航栏，被全部4个主页面共用。
//
// TAB SCREENS (标签页面列表):
//   - home     → Home screen: parking availability overview (首页：停车位可用情况总览)
//   - map      → Map screen: interactive parking spot grid (地图页：交互式停车位格子)
//   - history  → History screen: check-in/out activity log (历史页：签入/签出记录)
//   - profile  → Profile screen: vehicles & theme settings (个人页：车辆管理和主题设置)
//
// CUSTOM TAB ICON (自定义 Tab 图标):
//   TabIcon component renders an emoji inside a rounded container.
//   TabIcon 组件在圆角容器内显示 emoji 图标。
//   When focused:
//     - Background tinted with accent color at 12% opacity (背景显示主题色，透明度12%)
//     - Small dot indicator appears below the emoji (emoji 下方出现小圆点指示器)
//   When unfocused:
//     - Transparent background, muted label color (透明背景，标签文字使用静音色)
//
// THEMING (主题适配):
//   All colors (tab bar background, border, active/inactive tint) are read
//   from useTheme() so they update automatically when the user switches themes.
//   所有颜色（Tab栏背景、边框、激活/非激活色调）均从 useTheme() 读取，
//   用户切换主题时自动更新。
//
// TRANSPARENT BACKGROUND (透明背景):
//   sceneStyle sets backgroundColor to "transparent" so the gradient from
//   app/_layout.tsx shows through every tab screen seamlessly.
//   sceneStyle 将背景设为 transparent，使 app/_layout.tsx 的渐变
//   能无缝透过每个标签页面显示。
//
// IMPORTS (引入):
//   - Tabs              → from expo-router, renders bottom tab navigator
//                         (expo-router 提供的底部标签导航器)
//   - StyleSheet,
//     Text, View        → from react-native, layout and styling primitives
//                         (React Native 布局和样式基础组件)
//   - useTheme          → from utils/ThemeContext, provides active theme colors
//                         (从 ThemeContext 读取当前主题颜色)
//
// EXPORTS (导出):
//   - default TabLayout → the tab bar layout component registered by expo-router
//                         (expo-router 注册的标签栏布局组件，默认导出)
// ═══════════════════════════════════════════════════════════════════════════════

import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../utils/ThemeContext";

// ─── TabIcon Component (自定义 Tab 图标组件) ──────────────────────────────────
/*
   Renders a single tab icon: an emoji in a rounded container with a focus indicator.
   渲染单个 Tab 图标：圆角容器内的 emoji，带焦点状态指示器。
  
   @param emoji   - Emoji character to display as the icon (用作图标的 emoji 字符)
   @param focused - Whether this tab is currently active (当前标签是否处于激活状态)
*/
function TabIcon({
  emoji,
  focused,
}: {
  emoji:   string;  /* Icon emoji character (图标 emoji 字符) */
  focused: boolean; /* True when this tab is selected (当前标签被选中时为 true) */
}) {
  const { theme } = useTheme(); /* Read active theme colors (读取当前主题颜色) */

  return (
    <View style={[
      styles.iconWrap,
      /* When focused: show accent-colored background tint (选中时显示主题色背景) */
      focused && { backgroundColor: theme.accent + "20" },
    ]}>
      {/* Emoji icon (emoji 图标) */}
      <Text style={styles.emoji}>{emoji}</Text>

      {/* Active dot indicator shown only when this tab is focused
          仅在当前标签激活时显示底部小圆点指示器 */}
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />
      )}
    </View>
  );
}

// ─── TabLayout Component (标签栏布局组件) ────────────────────────────────────
/*
   TabLayout — defines the bottom navigation bar and registers all 4 tab routes.
   标签栏布局 — 定义底部导航栏并注册全部4个标签路由。
  
   Rendered inside RootLayout (app/_layout.tsx) which provides ThemeProvider.
   在 RootLayout（app/_layout.tsx）内渲染，ThemeProvider 已由外层提供。
*/
export default function TabLayout() {
  const { theme } = useTheme(); /* Read active theme colors (读取当前主题颜色) */

  return (
    <Tabs
      screenOptions={{
        headerShown: false, /* Hide the default navigation header (隐藏默认导航标题栏) */

        /* Active tab label and icon tint color (激活标签的文字和图标颜色) */
        tabBarActiveTintColor:   theme.accent,

        /* Inactive tab label and icon tint color (非激活标签的文字和图标颜色) */
        tabBarInactiveTintColor: theme.muted,

        /* Tab bar container style — follows current theme (标签栏容器样式，跟随当前主题) */
        tabBarStyle: {
          backgroundColor: theme.tabBar,   /* Bar background color (栏背景颜色) */
          borderTopColor:  theme.tabBorder, /* Top border color (顶部边框颜色) */
          borderTopWidth:  1,               /* 1px top border (1像素顶部边框) */
          height:          68,              /* Total bar height in points (标签栏总高度) */
          paddingBottom:   12,              /* Space below labels (标签下方内边距) */
          paddingTop:      8,               /* Space above icons (图标上方内边距) */
        },

        /* Transparent scene so gradient from app/_layout.tsx shows through
           透明场景背景，让 app/_layout.tsx 的渐变从下面透出来 */
        sceneStyle: { backgroundColor: "transparent" },

        /* Tab label text style (标签文字样式) */
        tabBarLabelStyle: {
          fontSize:      10,    /* Small label font size (标签字体大小) */
          fontWeight:    "700", /* Bold weight for readability (加粗提高可读性) */
          letterSpacing: 0.5,   /* Slight letter spacing (轻微字间距) */
        },
      }}
    >
      {/* ── Home Tab: parking availability overview (首页标签：停车位可用情况总览) */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home", /* Label shown below icon (图标下方显示的标签文字) */
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      {/* ── Map Tab: interactive parking spot grid (地图标签：交互式停车位格子) */}
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
        }}
      />

      {/* ── History Tab: check-in/out activity log (历史标签：签入/签出活动记录) */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🕐" focused={focused} />,
        }}
      />

      {/* ── Profile Tab: vehicle management & theme settings
          个人标签：车辆管理和主题设置 */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

// ─── Styles (样式) ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  /* Rounded container wrapping each tab icon (包裹每个 Tab 图标的圆角容器) */
  iconWrap: {
    alignItems:     "center",  /* Center icon horizontally (水平居中图标) */
    justifyContent: "center",  /* Center icon vertically (垂直居中图标) */
    width:          40,        /* Fixed width to keep layout stable (固定宽度保持布局稳定) */
    height:         32,        /* Fixed height (固定高度) */
    borderRadius:   10,        /* Rounded corners (圆角) */
  },

  /* Emoji icon size (emoji 图标字体大小) */
  emoji: { fontSize: 20 },

  /* Small dot shown below emoji when the tab is active (标签激活时 emoji 下方的小圆点) */
  activeDot: {
    position:     "absolute", /* Positioned relative to iconWrap (相对于 iconWrap 定位) */
    bottom:       -4,         /* Slightly below the icon container (略低于图标容器) */
    width:        4,          /* Dot width in points (圆点宽度) */
    height:       4,          /* Dot height in points (圆点高度) */
    borderRadius: 2,          /* Full circle (radius = half of width) (全圆，半径=宽度一半) */
  },
});