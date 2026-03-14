/*
app/(tabs)/_layout.tsx — 底部标签导航栏 / Bottom Tab Navigation Bar

定义底部标签栏，4个主页面（Home / Map / History / Profile）共用此布局。
Defines the bottom tab bar shared across all 4 main screens.

所有颜色从 useTheme() 读取，用户切换主题时自动更新。
All colours are sourced from useTheme() and update automatically on theme change.
 *
sceneStyle 设为透明，使 app/_layout.tsx 的背景渐变透过每个页面显示。
sceneStyle is transparent so the gradient in app/_layout.tsx shows through.
*/

import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../utils/ThemeContext";

// ─── TabIcon (自定义标签图标组件) ────────────────────────────────────────────
/*
渲染单个 Tab 图标：圆角容器内的 emoji，带焦点状态指示器。
Renders one tab icon: an emoji inside a rounded box with a focus dot.

@param emoji   图标 emoji 字符 / emoji character to show as icon
@param focused 当前标签是否选中 / true when this tab is active
*/
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const { theme } = useTheme(); // 读取当前主题颜色 / read active theme colours

  return (
    <View
      style={[
        styles.iconWrap,
        // 选中时显示主题色半透明背景 / tinted background when focused
        focused && { backgroundColor: theme.accent + "20" },
      ]}
    >
      {/* emoji 图标 / icon */}
      <Text style={styles.emoji}>{emoji}</Text>

      {/* 底部小圆点，仅在选中时出现 / active dot shown only when focused */}
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />
      )}
    </View>
  );
}

// ─── TabLayout (标签栏布局组件) ──────────────────────────────────────────────
/*
定义底部导航栏并注册全部 4 个标签路由。
Defines the bottom nav bar and registers all 4 tab routes.

在 RootLayout（app/_layout.tsx）内渲染，ThemeProvider 已由外层提供。
Rendered inside RootLayout; ThemeProvider is already available from the parent.
*/
export default function TabLayout() {
  const { theme } = useTheme(); // 读取当前主题颜色 / active theme colours

  return (
    <Tabs
      screenOptions={{
        headerShown: false, // 隐藏默认导航标题栏 / hide default header

        tabBarActiveTintColor: theme.accent, // 选中标签颜色 / active label + icon colour
        tabBarInactiveTintColor: theme.muted,  // 未选中标签颜色 / inactive colour

        tabBarStyle: {
          backgroundColor: theme.tabBar, // 标签栏背景 / bar background
          borderTopColor: theme.tabBorder, // 顶部边框 / top border colour
          borderTopWidth: 1,
          height: 68, // 标签栏总高度 / total bar height
          paddingBottom: 12, // 标签文字下方内边距 / space below labels
          paddingTop: 8, // 图标上方内边距 / space above icons
        },

        // 透明场景，让 app/_layout.tsx 渐变背景透出 / transparent so gradient shows through
        sceneStyle: { backgroundColor: "transparent" },

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.5,
        },
      }}
    >
      {/* 首页标签：停车位可用情况总览 / Home: parking availability overview */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      {/* 地图标签：交互式停车位格子 / Map: interactive parking spot grid */}
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
        }}
      />

      {/* 历史标签：签入/签出活动记录 / History: check-in/out activity log */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🕐" focused={focused} />,
        }}
      />

      {/* 个人标签：车辆管理和主题设置 / Profile: vehicle management & theme settings */}
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
  // 包裹每个 Tab 图标的圆角容器 / rounded container wrapping each tab icon
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 32,
    borderRadius: 10,
  },

  emoji: { fontSize: 20 }, // emoji 图标大小 / icon size

  // 标签激活时 emoji 下方的小圆点 / dot shown below icon when tab is active
  activeDot: {
    position: "absolute",
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});