// ─────────────────────────────────────────────────────────────────────────────
// app/(tabs)/_layout.tsx  （Tab Bar Layout）
//
// 底部导航栏，包含 4 个 Tab：Home / Map / History / Profile
// 颜色跟随主题自动变化
// ─────────────────────────────────────────────────────────────────────────────

import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../utils/ThemeContext";

// ─── 自定义 Tab 图标 ──────────────────────────────────────────────────
function TabIcon({
  emoji,
  focused,
}: {
  emoji:   string;
  focused: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View style={[
      styles.iconWrap,
      // 选中时显示主题色背景
      focused && { backgroundColor: theme.accent + "20" },
    ]}>
      <Text style={styles.emoji}>{emoji}</Text>
      {/* 选中时底部显示小圆点 */}
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: theme.accent }]} />
      )}
    </View>
  );
}

// ─── Tab Layout ───────────────────────────────────────────────────────
export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // Tab 标签颜色随主题变化
        tabBarActiveTintColor:   theme.accent,
        tabBarInactiveTintColor: theme.muted,

        // Tab 栏背景随主题变化
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor:  theme.tabBorder,
          borderTopWidth:  1,
          height:          68,
          paddingBottom:   12,
          paddingTop:      8,
        },
        // 让 tab 页面背景透明，让 _layout 的渐变透出来
        sceneStyle: { backgroundColor: "transparent" },
        tabBarLabelStyle: {
          fontSize:      10,
          fontWeight:    "700",
          letterSpacing: 0.5,
        },
      }}
    >
      {/* 首页 */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      {/* 停车地图 */}
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" focused={focused} />,
        }}
      />

      {/* 历史记录 */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🕐" focused={focused} />,
        }}
      />

      {/* 个人资料 & 主题设置 */}
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

const styles = StyleSheet.create({
  iconWrap: {
    alignItems:      "center",
    justifyContent:  "center",
    width:           40,
    height:          32,
    borderRadius:    10,
  },
  emoji: { fontSize: 20 },
  activeDot: {
    position:     "absolute",
    bottom:       -4,
    width:        4,
    height:       4,
    borderRadius: 2,
  },
});