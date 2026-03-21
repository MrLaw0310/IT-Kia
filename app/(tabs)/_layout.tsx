/*
app/(tabs)/_layout.tsx — 底部标签导航栏 / Bottom Tab Navigation Bar

定义底部标签栏，4 个主页面（Home / Map / History / Profile）共用此布局。
Defines the bottom tab bar shared across all 4 main screens.

所有颜色从 useTheme() 读取，用户切换主题时自动更新。
All colours are sourced from useTheme() and update automatically on theme change.

sceneStyle 设为透明，使 app/_layout.tsx 的背景渐变透过每个页面显示。
sceneStyle is transparent so the gradient in app/_layout.tsx shows through.
*/

import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../utils/ThemeContext";

// ─── Styles for TabIcon ───────────────────────────────────────────────────────
const tabIconStyles = StyleSheet.create({

  // 包裹 emoji 图标的圆角容器
  // Rounded container that wraps the emoji icon
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 32,
    borderRadius: 10,
  },

  // emoji 图标字号
  // Font size for the emoji icon
  emoji: {
    fontSize: 20,
  },

  // 标签激活时显示在 emoji 正下方的小圆点
  // Small dot shown directly below the emoji when the tab is active
  activeDot: {
    position: "absolute",
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

// ─── TabIcon ──────────────────────────────────────────────────────────────────
/*
渲染单个 Tab 图标：圆角容器内的 emoji，选中时有半透明背景和底部小圆点。
Renders one tab icon: emoji inside a rounded box.
When focused: tinted background + active dot below the emoji.

@param emoji   图标 emoji 字符 / emoji character used as the icon
@param focused 当前标签是否选中 / true when this tab is currently active
*/
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {

  // 读取当前主题颜色
  // Read active theme colours
  const { theme } = useTheme();

  // 选中时的半透明背景色（主题强调色 + 20% 透明度）
  // Tinted background when focused — accent colour at 20% opacity
  const focusedBackground = theme.accent + "20";

  // 根据是否选中决定 iconWrap 的样式
  // Decide iconWrap style based on focused state
  let iconWrapStyle;
  if (focused) {
    iconWrapStyle = [tabIconStyles.iconWrap, { backgroundColor: focusedBackground }];
  } else {
    iconWrapStyle = tabIconStyles.iconWrap;
  }

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <View style={iconWrapStyle}>

      {/* emoji 图标 / Emoji icon */}
      <Text style={tabIconStyles.emoji}>{emoji}</Text>

      {/* 选中状态小圆点，仅在 focused 时渲染
          Active indicator dot — only rendered when this tab is focused */}
      {focused && (
        <View style={[tabIconStyles.activeDot, { backgroundColor: theme.accent }]} />
      )}

    </View>
  );
}

// ─── TabLayout ────────────────────────────────────────────────────────────────
/*
定义底部导航栏并注册全部 4 个标签路由。
在 RootLayout（app/_layout.tsx）内渲染，ThemeProvider 已由外层提供。

Defines the bottom nav bar and registers all 4 tab routes.
Rendered inside RootLayout; ThemeProvider is already available from the parent.
*/
export default function TabLayout() {

  // 读取当前主题颜色
  // Read active theme colours
  const { theme } = useTheme();

  // ── 标签栏外观配置 / Tab bar appearance config ───────────────────────────────
  // 提取为具名常量，避免在 JSX 里写内联对象
  // Extracted as named constants to avoid inline objects in JSX

  const tabBarStyleConfig = {
    backgroundColor: theme.tabBar,    // 标签栏背景色 / bar background colour
    borderTopColor:  theme.tabBorder, // 顶部分隔线颜色 / top border colour
    borderTopWidth:  1,
    height:          68,              // 标签栏总高度 / total bar height
    paddingBottom:   12,              // 标签文字下方内边距 / space below label text
    paddingTop:      8,               // 图标上方内边距 / space above icons
  };

  const tabBarLabelStyleConfig = {
    fontSize:      10,
    fontWeight:    "700" as const,
    letterSpacing: 0.5,
  };

  // ── 渲染 / Render ────────────────────────────────────────────────────────────
  return (
    <Tabs
      screenOptions={{
        headerShown:             false,                        // 隐藏默认标题栏 / hide default header
        tabBarActiveTintColor:   theme.accent,                 // 选中标签文字颜色 / active label colour
        tabBarInactiveTintColor: theme.muted,                  // 未选中标签文字颜色 / inactive label colour
        tabBarStyle:             tabBarStyleConfig,
        tabBarLabelStyle:        tabBarLabelStyleConfig,
        sceneStyle:              { backgroundColor: "transparent" }, // 透明让渐变透出 / reveal gradient
      }}
    >
      {/* 首页：停车位可用情况总览 / Home: parking availability overview */}
      <Tabs.Screen
        name="home"
        options={{
          title:       "Home",
          tabBarIcon:  ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      {/* 地图：交互式停车位格子 / Map: interactive parking spot grid */}
      <Tabs.Screen
        name="map"
        options={{
          title:       "Map",
          tabBarIcon:  ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
        }}
      />

      {/* 历史：签入/签出活动记录 / History: check-in/out activity log */}
      <Tabs.Screen
        name="history"
        options={{
          title:       "History",
          tabBarIcon:  ({ focused }) => <TabIcon emoji="🕐" focused={focused} />,
        }}
      />

      {/* 个人：车辆管理和主题设置 / Profile: vehicle management & theme settings */}
      <Tabs.Screen
        name="profile"
        options={{
          title:       "Profile",
          tabBarIcon:  ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}