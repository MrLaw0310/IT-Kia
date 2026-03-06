import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ParkingProvider } from "../utils/ParkingContext";
import { ThemeProvider, useTheme } from "../utils/ThemeContext";

function InnerLayout() {
  const { theme } = useTheme();
  const isDark = theme.key === "tech" || theme.key === "ancient";

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown:  false,
          contentStyle: { backgroundColor: theme.bg },
          animation:    "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="camera" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ParkingProvider>
        <InnerLayout />
      </ParkingProvider>
    </ThemeProvider>
  );
}