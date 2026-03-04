import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export default function SplashScreen() {
  const router = useRouter();

  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoScale     = useRef(new Animated.Value(0.8)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const barWidth      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(logoScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(sloganOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
        Animated.timing(barWidth, { toValue: 1, duration: 900, useNativeDriver: false }).start(() => {
          setTimeout(() => router.replace("/(tabs)/home"), 200);
        });
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Text style={styles.logoMDIS}>MDIS</Text>
      </Animated.View>

      <Animated.Text style={[styles.slogan, { opacity: sloganOpacity }]}>
        Management &amp; Science University
      </Animated.Text>
      <Animated.Text style={[styles.appName, { opacity: sloganOpacity }]}>
        Campus Parking
      </Animated.Text>

      {/* Loading bar */}
      <Animated.View style={styles.barBg}>
        <Animated.View
          style={[styles.barFill, {
            width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          }]}
        />
      </Animated.View>

      <Text style={styles.footer}>Smart Parking · MDIS Campus</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#060D1F",
    justifyContent: "center", alignItems: "center",
  },
  glowTop: {
    position: "absolute", top: -80,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(30,144,255,0.07)",
  },
  glowBottom: {
    position: "absolute", bottom: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: "rgba(30,144,255,0.05)",
  },
  logoWrap: { marginBottom: 14 },
  logoMDIS: {
    fontSize: 60, fontWeight: "900",
    color: "#1E90FF", letterSpacing: 6,
  },
  slogan: {
    fontSize: 12, color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5, marginBottom: 6,
    textAlign: "center", paddingHorizontal: 30,
  },
  appName: {
    fontSize: 18, color: "rgba(255,255,255,0.75)",
    fontWeight: "700", letterSpacing: 1, marginBottom: 48,
  },
  barBg: {
    width: 160, height: 3,
    backgroundColor: "rgba(30,144,255,0.2)",
    borderRadius: 999, overflow: "hidden", marginBottom: 48,
  },
  barFill: { height: "100%", backgroundColor: "#1E90FF", borderRadius: 999 },
  footer: {
    position: "absolute", bottom: 40,
    color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: 1,
  },
});