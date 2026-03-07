import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Image, Linking, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from "../../utils/ParkingContext";
import { useTheme } from "../../utils/ThemeContext";

const MDIS_LAT = 1.43364;
const MDIS_LNG = 103.615175;

function AnimatedNumber({ value, style }: { value: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    Animated.timing(anim, { toValue:value, duration:1200, useNativeDriver:false }).start();
    anim.addListener(({ value:v }) => setDisplay(Math.floor(v)));
    return () => anim.removeAllListeners();
  }, [value]);
  return <Text style={style}>{display}</Text>;
}

function AvailabilityRing({ available, total, T }: { available:number; total:number; T:any }) {
  const pct   = available / total;
  const color = pct > 0.4 ? T.green : pct > 0.2 ? T.orange : T.red;
  return (
    <View style={styles.ringWrap}>
      <View style={[styles.ringOuter, { borderColor: color+"33" }]}>
        <View style={[styles.ringInner, { borderColor:color, backgroundColor:"transparent" }]}>
          <AnimatedNumber value={available} style={[styles.ringNumber, { color }]} />
          <Text style={[styles.ringLabel, { color:T.muted }]}>available</Text>
        </View>
      </View>
      <Text style={[styles.ringTotal, { color:T.muted }]}>out of {total} spots</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { activity, freeCount, occCount, okuFree, totalNormal, okuTotal } = useParkingContext();
  // ⭐ 这些数字直接从 ParkingContext 读，和 map 页完全同步
  const TOTAL_SPOTS     = totalNormal + okuTotal;  // ← 普通位 + OKU 位
  const AVAILABLE_SPOTS = freeCount + okuFree;
  const OCCUPIED_SPOTS  = occCount;
  const { theme: T } = useTheme();
  const router    = useRouter();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:600, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:600, useNativeDriver:true }),
    ]).start();
  }, []);

  function openMapsToMDIS() {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${MDIS_LAT},${MDIS_LNG}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`geo:${MDIS_LAT},${MDIS_LNG}?q=MDIS+Malaysia+EduCity+Iskandar+Puteri+Johor`)
    );
  }

  const pct         = Math.round((AVAILABLE_SPOTS / TOTAL_SPOTS) * 100);
  const statusColor = pct > 40 ? T.green : pct > 20 ? T.orange : T.red;
  const statusLabel = pct > 40 ? "Plenty of Space" : pct > 20 ? "Filling Up" : "Almost Full";

  return (
    <View style={[styles.screen, { backgroundColor: "transparent" }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <Animated.View style={[styles.header, { opacity:fadeAnim, transform:[{translateY:slideAnim}] }]}>
          <View>
            <Text style={[styles.greeting,  { color:T.muted }]}>Good morning 👋</Text>
            <Text style={[styles.pageTitle, { color:T.text  }]}>Parking Dashboard</Text>
          </View>
          <Image source={require('../../assets/images/itkia.png')} style={{ width:80, height:40, resizeMode:'contain' }} />
        </Animated.View>

        <Animated.View style={{ opacity:fadeAnim }}>
          <View style={[styles.gpsCard, { backgroundColor:T.card, borderColor:T.border }]}>
            <View style={styles.gpsLeft}>
              <Text style={styles.gpsIcon}>📍</Text>
              <View>
                <Text style={[styles.gpsTitle, { color:T.muted }]}>Campus Location</Text>
                <Text style={[styles.gpsVal, { color:T.text }]} numberOfLines={1} ellipsizeMode="tail">EduCity, Iskandar Puteri, Johor</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.directionsBtn, { backgroundColor:T.accent+"22", borderColor:T.accent+"55" }]}
              onPress={openMapsToMDIS} activeOpacity={0.8}>
              <Text style={[styles.directionsBtnText, { color:T.accent }]}>Navigate →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity:fadeAnim }}>
          <View style={[styles.statusBanner, { backgroundColor:T.card, borderColor:statusColor+"55" }]}>
            <View style={[styles.statusDot, { backgroundColor:statusColor }]} />
            <Text style={[styles.statusText, { color:statusColor, flex:1 }]}>{statusLabel}</Text>
            <Text style={[styles.statusTime, { color:T.muted }]}>Updated just now</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, styles.mainCard, { backgroundColor:T.card, borderColor:T.border, opacity:fadeAnim }]}>
          <Text style={[styles.cardLabel, { color:T.muted }]}>MDIS MAIN PARKING LOT</Text>
          <AvailabilityRing available={AVAILABLE_SPOTS} total={TOTAL_SPOTS} T={T} />
          <View style={[styles.progressBg, { backgroundColor:T.border }]}>
            <View style={[styles.progressFill, { width:`${pct}%` as any, backgroundColor:statusColor }]} />
          </View>
          <Text style={[styles.progressLabel, { color:T.muted }]}>{pct}% available</Text>
        </Animated.View>

        <Animated.View style={[styles.statsRow, { opacity:fadeAnim }]}>
          {[
            { label:"Free",     val:AVAILABLE_SPOTS, color:T.green  },
            { label:"Occupied", val:OCCUPIED_SPOTS,  color:T.red    },
            { label:"OKU",      val:okuTotal,         color:T.orange },
            { label:"Total",    val:TOTAL_SPOTS,     color:T.accent },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor:T.card, borderColor:s.color+"44" }]}>
              <Text style={[styles.statNumber, { color:s.color }]}>{s.val}</Text>
              <Text style={[styles.statLabel,  { color:T.muted }]}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Text style={[styles.sectionTitle, { color:T.muted }]}>QUICK ACTIONS</Text>
        {/* 2×2 网格：用两行 View 代替 flexWrap，确保每行精确 50/50 */}
        {[
          [
            { icon:"🗺️", label:"View Map",   bg:T.accent, textColor:"white", onPress:()=>router.push("/(tabs)/map" as any) },
            { icon:"📷", label:"Scan Plate", bg:T.card,   textColor:T.text,  onPress:()=>router.push("/camera" as any) },
          ],[
            { icon:"🕐", label:"History",    bg:T.card,   textColor:T.text,  onPress:()=>router.push("/(tabs)/history" as any) },
            { icon:"🧭", label:"Navigate",   bg:T.card,   textColor:T.text,  onPress:openMapsToMDIS },
          ]
        ].map((row, ri) => (
          <View key={ri} style={styles.actionsRow}>
            {row.map(a => (
              <TouchableOpacity key={a.label}
                style={[styles.actionBtn, { backgroundColor:a.bg, borderWidth:a.bg===T.card?1:0, borderColor:T.border }]}
                onPress={a.onPress} activeOpacity={0.8}>
                <Text style={styles.actionIcon}>{a.icon}</Text>
                <Text style={[styles.actionText, { color:a.textColor }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color:T.muted }]}>RECENT ACTIVITY</Text>
        {activity.length === 0 ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <Text style={{ color: T.muted, fontSize: 13 }}>No activity yet</Text>
          </View>
        ) : (
          activity.map(item => (
            <View key={item.id} style={[styles.activityCard, { backgroundColor:T.card, borderColor:T.border }]}>
              <View style={[styles.activityDot, { backgroundColor: item.isIn ? T.green : T.red }]} />
              <View style={{ flex:1 }}>
                <Text style={[styles.activityPlate,  { color:T.text }]}>{item.plate}</Text>
                <Text style={[styles.activityAction, { color:T.muted }]}>{item.action}</Text>
              </View>
              <Text style={[styles.activityTime, { color:T.muted }]}>{item.time}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{ flex:1 },
  scroll:{ padding:20, paddingTop:56, paddingBottom:100, backgroundColor:"transparent" },
  header:   { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  greeting: { fontSize:13 },
  pageTitle:{ fontSize:24, fontWeight:"800", letterSpacing:-0.5 },
  gpsCard:  { borderWidth:1, borderRadius:14, padding:14, marginBottom:12, flexDirection:"row", justifyContent:"space-between", alignItems:"center" },
  gpsLeft:  { flexDirection:"row", alignItems:"center", gap:10, flexShrink:1, maxWidth:"58%" },
  gpsIcon:  { fontSize:20 },
  gpsTitle: { fontSize:11, marginBottom:2 },
  gpsVal:   { fontWeight:"600", fontSize:13 },
  directionsBtn:    { borderWidth:1, borderRadius:10, paddingHorizontal:12, paddingVertical:7, flexShrink:0 },
  directionsBtnText:{ fontWeight:"700", fontSize:12 },
  statusBanner: { flexDirection:"row", alignItems:"center", gap:8, borderWidth:1, borderRadius:12, paddingHorizontal:14, paddingVertical:9, marginBottom:16 },
  statusDot:    { width:8, height:8, borderRadius:4 },
  statusText:   { fontWeight:"700", fontSize:13 },
  statusTime:   { fontSize:11 },
  card:         { borderWidth:1, borderRadius:20, padding:20, marginBottom:14 },
  mainCard:     { alignItems:"center" },
  cardLabel:    { fontSize:11, letterSpacing:1.5, marginBottom:16 },
  ringWrap:     { alignItems:"center", marginBottom:20 },
  ringOuter:    { width:150, height:150, borderRadius:75, borderWidth:12, justifyContent:"center", alignItems:"center", marginBottom:8 },
  ringInner:    { width:110, height:110, borderRadius:55, borderWidth:3, justifyContent:"center", alignItems:"center" },
  ringNumber:   { fontSize:36, fontWeight:"900", lineHeight:40 },
  ringLabel:    { fontSize:11 },
  ringTotal:    { fontSize:12 },
  progressBg:   { width:"100%", height:8, borderRadius:999, overflow:"hidden", marginBottom:6 },
  progressFill: { height:"100%", borderRadius:999 },
  progressLabel:{ fontSize:12 },
  statsRow: { flexDirection:"row", gap:8, marginBottom:24 },
  statCard: { flex:1, borderWidth:1, borderRadius:14, padding:12, alignItems:"center" },
  statNumber:{ fontSize:22, fontWeight:"900" },
  statLabel: { fontSize:10, marginTop:2 },
  sectionTitle:{ fontSize:11, letterSpacing:1.5, marginBottom:10 },
  actionsRow:  { flexDirection:"row", gap:10, marginBottom:10 },
  actionBtn:   { flex:1, borderRadius:14, paddingVertical:16, alignItems:"center", gap:6 },
  actionIcon:  { fontSize:24 },
  actionText:  { fontWeight:"700", fontSize:13 },
  activityCard:  { flexDirection:"row", alignItems:"center", borderWidth:1, borderRadius:12, padding:14, marginBottom:8, gap:12 },
  activityDot:   { width:10, height:10, borderRadius:5 },
  activityPlate: { fontWeight:"700", fontSize:14 },
  activityAction:{ fontSize:12 },
  activityTime:  { fontSize:12 },
});