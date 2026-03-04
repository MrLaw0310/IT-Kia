import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

// ─── Colours ──────────────────────────────────────────────────────────
const C = {
  bg:       "#060D1F",
  tabBar:   "#080F22",
  border:   "#1A2F5A",
  accent:   "#1E90FF",
  inactive: "#6B7FA8",
};

// ─── Custom Tab Icon ──────────────────────────────────────────────────
function TabIcon({
  emoji,
  label,
  focused,
}: {
  emoji: string;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={styles.emoji}>{emoji}</Text>
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   C.accent,
        tabBarInactiveTintColor: C.inactive,
        tabBarStyle: {
          backgroundColor:  C.tabBar,
          borderTopColor:   C.border,
          borderTopWidth:   1,
          height:           68,
          paddingBottom:    12,
          paddingTop:       8,
        },
        tabBarLabelStyle: {
          fontSize:   10,
          fontWeight: "700",
          letterSpacing: 0.5,
        },
      }}
    >
      {/* Home — Dashboard */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Home" focused={focused} />
          ),
        }}
      />

      {/* Map — Parking Grid */}
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🗺️" label="Map" focused={focused} />
          ),
        }}
      />

      {/* History — Parking Records */}
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🕐" label="History" focused={focused} />
          ),
        }}
      />

      {/* Profile — Student Info */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 32,
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: "rgba(30,144,255,0.12)",
  },
  emoji: {
    fontSize: 20,
  },
  activeDot: {
    position: "absolute",
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1E90FF",
  },
});