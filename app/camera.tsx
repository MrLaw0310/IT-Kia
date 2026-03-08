import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useParkingContext } from '../utils/ParkingContext';
import { useTheme } from '../utils/ThemeContext';

const CHECKIN_KEY = "mdis_active_checkin";

type Step = "entry" | "confirm" | "success" | "checkout_confirm" | "checkout_success";

interface ActiveCheckIn {
  plate: string;
  time:  string;
  date:  string;
}

export default function CameraScreen() {
  const { theme: T } = useTheme();
  const router = useRouter();

  // ⭐ 直接从ParkingContext读vehicles，和profile完全同步
  const { vehicles } = useParkingContext();

  const [step,          setStep]   = useState<Step>("entry");
  const [plate,         setPlate]  = useState("");
  const [matchedPlate,  setMatched]= useState("");
  const [error,         setError]  = useState("");
  const [activeCheckIn, setActive] = useState<ActiveCheckIn | null>(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(useCallback(() => {
    loadActiveCheckIn();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []));

  async function loadActiveCheckIn() {
    try {
      const raw = await AsyncStorage.getItem(CHECKIN_KEY);
      setActive(raw ? JSON.parse(raw) : null);
    } catch { setActive(null); }
  }

  async function saveActiveCheckIn(data: ActiveCheckIn) {
    try { await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify(data)); } catch {}
  }

  async function clearActiveCheckIn() {
    try { await AsyncStorage.removeItem(CHECKIN_KEY); } catch {}
  }

  function animatePress() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
  }

  function handleScan() {
    animatePress();
    const cleaned = plate.trim().toUpperCase();
    if (!cleaned) { setError("Please enter your plate number."); return; }

    // ⭐ 直接比对ParkingContext的vehicles
    const match = vehicles.find(v => v.plate.toUpperCase().replace(/\s/g, "") === cleaned.replace(/\s/g, ""));
    if (!match) {
      setError(`"${cleaned}" is not registered under your account.\nPlease check or register in Profile.`);
      return;
    }
    setError(""); setMatched(match.plate); setStep("confirm");
  }

  async function handleConfirm() {
    animatePress();
    const now = new Date();
    const data: ActiveCheckIn = {
      plate: matchedPlate,
      time:  now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
      date:  now.toLocaleDateString("en-MY",  { day: "numeric", month: "short", year: "numeric" }),
    };
    await saveActiveCheckIn(data);
    setActive(data);
    setStep("success");
    timerRef.current = setTimeout(() => router.push("/(tabs)/map" as any), 1800);
  }

  function handleReset() {
    setPlate(""); setMatched(""); setError(""); setStep("entry");
  }

  function handleCheckOutPress() {
    animatePress(); setStep("checkout_confirm");
  }

  async function handleCheckOutConfirm() {
    animatePress();
    await clearActiveCheckIn();
    setActive(null);
    setStep("checkout_success");
    timerRef.current = setTimeout(() => {
      setStep("entry");
      router.push("/(tabs)/map" as any);
    }, 1800);
  }

  const stepIndex =
    step === "entry"            ? 0 :
    step === "confirm"          ? 1 :
    step === "success"          ? 2 :
    step === "checkout_confirm" ? 1 : 2;

  const isCheckOut  = step === "checkout_confirm" || step === "checkout_success";
  const headerTitle = isCheckOut ? "Check Out" : "Check In";
  const stepLabels  = isCheckOut
    ? ["Active Session", "Confirm", "Done"]
    : ["Enter Plate",    "Confirm", "Done"];

  // ⭐ 从ParkingContext的vehicles提取plate列表
  const registeredPlates = vehicles.map(v => v.plate);

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==="ios"?"padding":"height"}>
      <ScrollView style={[styles.screen,{backgroundColor:"transparent"}]}
        contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={()=>router.back()} style={styles.backArrow}>
            <Text style={[styles.backArrowText,{color:T.accent}]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle,{color:T.text}]}>{headerTitle}</Text>
          <View style={[styles.logoBadge,{backgroundColor:T.accent+"18",borderColor:T.accent+"44"}]}>
            <Text style={[styles.logoText,{color:T.accent}]}>MDIS</Text>
          </View>
        </View>

        {/* Active check-in banner */}
        {activeCheckIn && step==="entry" && (
          <View style={[styles.activeBanner,{backgroundColor:T.green+"15",borderColor:T.green+"44"}]}>
            <View style={{flex:1}}>
              <Text style={[styles.activeBannerTitle,{color:T.green}]}>🟢  Currently Checked In</Text>
              <Text style={[styles.activeBannerSub,{color:T.muted}]}>
                {activeCheckIn.plate}  ·  {activeCheckIn.time}  ·  {activeCheckIn.date}
              </Text>
            </View>
            <TouchableOpacity style={[styles.checkOutBtn,{backgroundColor:T.red}]}
              onPress={handleCheckOutPress} activeOpacity={0.85}>
              <Text style={styles.checkOutBtnText}>Check Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {stepLabels.map((s,i)=>{
            const active=i===stepIndex, done=i<stepIndex;
            return (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot,{backgroundColor:T.border},
                  done   &&{backgroundColor:T.green},
                  active &&{backgroundColor:isCheckOut?T.red:T.accent},
                ]}>
                  <Text style={styles.stepDotText}>{done?"✓":i+1}</Text>
                </View>
                <Text style={[styles.stepLabel,{color:T.muted},(active||done)&&{color:T.text}]}>{s}</Text>
                {i<2&&<View style={[styles.stepLine,{backgroundColor:T.border},done&&{backgroundColor:T.green}]}/>}
              </View>
            );
          })}
        </View>

        {/* STEP 1 — Entry */}
        {step==="entry"&&(
          <View style={styles.body}>
            <View style={[styles.plateIconCard,{backgroundColor:T.card,borderColor:T.border}]}>
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{plate.trim().toUpperCase()||"_ _ _ _ _ _ _"}</Text>
              </View>
              <Text style={[styles.plateIconSub,{color:T.muted}]}>Malaysian vehicle plate preview</Text>
            </View>

            <Text style={[styles.inputLabel,{color:T.muted}]}>Enter Your Plate Number</Text>
            <TextInput
              style={[styles.input,{backgroundColor:T.card,borderColor:error?T.red:T.border,color:T.text}]}
              value={plate} onChangeText={t=>{setPlate(t);setError("");}}
              placeholder="e.g. JHR 1234" placeholderTextColor={T.muted}
              autoCapitalize="characters" autoCorrect={false} maxLength={10}
            />
            {error?<Text style={[styles.errorText,{color:T.red}]}>{error}</Text>:null}

            <Text style={[styles.quickPickLabel,{color:T.muted}]}>Your Registered Vehicles</Text>
            <View style={styles.quickPickRow}>
              {registeredPlates.length===0
                ? <Text style={{color:T.muted,fontSize:12}}>No vehicles registered. Go to Profile to add one.</Text>
                : registeredPlates.map(p=>(
                  <TouchableOpacity key={p}
                    style={[styles.quickPickBtn,{backgroundColor:T.card,borderColor:T.accent+"44"}]}
                    onPress={()=>{setPlate(p);setError("");}} activeOpacity={0.75}>
                    <Text style={styles.quickPickIcon}>🚗</Text>
                    <Text style={[styles.quickPickText,{color:T.accent}]}>{p}</Text>
                  </TouchableOpacity>
                ))
              }
            </View>

            <Animated.View style={{transform:[{scale:scaleAnim}]}}>
              <TouchableOpacity style={[styles.primaryBtn,{backgroundColor:T.accent}]}
                onPress={handleScan} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>🔍  Verify Plate</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* STEP 2 — Confirm check-in */}
        {step==="confirm"&&(
          <View style={styles.body}>
            <View style={[styles.confirmCard,{backgroundColor:T.card,borderColor:T.border}]}>
              <Text style={styles.confirmIcon}>🅿️</Text>
              <Text style={[styles.confirmTitle,{color:T.text}]}>Plate Verified</Text>
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{matchedPlate}</Text>
              </View>
              <View style={[styles.confirmDetails,{backgroundColor:T.bg}]}>
                {[
                  ["Status",   "✅ Registered Vehicle"],
                  ["Pass",     "✅ Annual Fee Paid"],
                  ["Check In", new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})],
                  ["Date",     new Date().toLocaleDateString("en-MY",{day:"numeric",month:"short",year:"numeric"})],
                ].map(([k,v])=>(
                  <View key={k} style={styles.detailRow}>
                    <Text style={[styles.detailKey,{color:T.muted}]}>{k}</Text>
                    <Text style={[styles.detailVal,{color:T.text}]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Animated.View style={{transform:[{scale:scaleAnim}]}}>
              <TouchableOpacity style={[styles.primaryBtn,{backgroundColor:T.accent}]}
                onPress={handleConfirm} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>✅  Confirm Check-In</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={[styles.secondaryBtn,{backgroundColor:T.card,borderColor:T.border}]}
              onPress={handleReset} activeOpacity={0.8}>
              <Text style={[styles.secondaryBtnText,{color:T.text}]}>← Enter Different Plate</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3 — Check-in success */}
        {step==="success"&&(
          <View style={[styles.body,styles.successBody]}>
            <View style={[styles.successCircle,{backgroundColor:T.green+"20",borderColor:T.green+"55"}]}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={[styles.successTitle,{color:T.text}]}>Checked In!</Text>
            <Text style={[styles.successSub,{color:T.muted}]}>
              {matchedPlate} has been recorded.{"\n"}Redirecting to parking map...
            </Text>
            <View style={styles.plateFrame}>
              <Text style={styles.plateFrameCountry}>MYS</Text>
              <Text style={styles.plateFrameText}>{matchedPlate}</Text>
            </View>
          </View>
        )}

        {/* CHECK OUT — Confirm */}
        {step==="checkout_confirm"&&activeCheckIn&&(
          <View style={styles.body}>
            <View style={[styles.confirmCard,{backgroundColor:T.card,borderColor:T.border}]}>
              <Text style={styles.confirmIcon}>🚗</Text>
              <Text style={[styles.confirmTitle,{color:T.text}]}>Confirm Check-Out</Text>
              <View style={styles.plateFrame}>
                <Text style={styles.plateFrameCountry}>MYS</Text>
                <Text style={styles.plateFrameText}>{activeCheckIn.plate}</Text>
              </View>
              <View style={[styles.confirmDetails,{backgroundColor:T.bg}]}>
                {[
                  ["Plate",      activeCheckIn.plate],
                  ["Checked In", activeCheckIn.time],
                  ["Date",       activeCheckIn.date],
                  ["Check Out",  new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})],
                ].map(([k,v])=>(
                  <View key={k} style={styles.detailRow}>
                    <Text style={[styles.detailKey,{color:T.muted}]}>{k}</Text>
                    <Text style={[styles.detailVal,{color:T.text}]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Animated.View style={{transform:[{scale:scaleAnim}]}}>
              <TouchableOpacity style={[styles.primaryBtn,{backgroundColor:T.red}]}
                onPress={handleCheckOutConfirm} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>🚗  Confirm Check-Out</Text>
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={[styles.secondaryBtn,{backgroundColor:T.card,borderColor:T.border}]}
              onPress={()=>setStep("entry")} activeOpacity={0.8}>
              <Text style={[styles.secondaryBtnText,{color:T.text}]}>← Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CHECK OUT — Success */}
        {step==="checkout_success"&&(
          <View style={[styles.body,styles.successBody]}>
            <View style={[styles.successCircle,{backgroundColor:T.red+"20",borderColor:T.red+"55"}]}>
              <Text style={styles.successEmoji}>👋</Text>
            </View>
            <Text style={[styles.successTitle,{color:T.text}]}>Checked Out!</Text>
            <Text style={[styles.successSub,{color:T.muted}]}>
              {activeCheckIn?.plate ?? ""} has been released.{"\n"}Drive safely!
            </Text>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex:1},
  scroll: {padding:20,paddingTop:56,paddingBottom:60,backgroundColor:"transparent"},
  header:       {flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:20},
  backArrow:    {padding:4},
  backArrowText:{fontSize:16,fontWeight:"600"},
  headerTitle:  {fontSize:18,fontWeight:"800"},
  logoBadge:    {borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:5},
  logoText:     {fontWeight:"800",fontSize:13,letterSpacing:1.5},
  activeBanner:      {borderWidth:1,borderRadius:16,padding:14,marginBottom:20,flexDirection:"row",alignItems:"center",gap:12},
  activeBannerTitle: {fontSize:13,fontWeight:"800",marginBottom:3},
  activeBannerSub:   {fontSize:12},
  checkOutBtn:       {borderRadius:12,paddingHorizontal:14,paddingVertical:10},
  checkOutBtnText:   {color:"white",fontWeight:"800",fontSize:13},
  stepRow:    {flexDirection:"row",alignItems:"center",justifyContent:"center",marginBottom:32},
  stepItem:   {alignItems:"center",flexDirection:"row",gap:6},
  stepDot:    {width:28,height:28,borderRadius:14,justifyContent:"center",alignItems:"center"},
  stepDotText:{color:"white",fontSize:11,fontWeight:"800"},
  stepLabel:  {fontSize:11,fontWeight:"600"},
  stepLine:   {width:24,height:2,marginHorizontal:4},
  body:         {flex:1},
  plateIconCard:{borderWidth:1,borderRadius:20,padding:24,alignItems:"center",marginBottom:24},
  plateFrame:   {backgroundColor:"#FFF8DC",borderWidth:3,borderColor:"#1a1a1a",borderRadius:10,paddingHorizontal:24,paddingVertical:10,alignItems:"center",minWidth:200,marginBottom:8},
  plateFrameCountry:{color:"#003399",fontSize:10,fontWeight:"800",letterSpacing:2,marginBottom:2},
  plateFrameText:   {color:"#1a1a1a",fontSize:26,fontWeight:"900",letterSpacing:4},
  plateIconSub:     {fontSize:11},
  inputLabel:   {fontSize:12,letterSpacing:1,marginBottom:8},
  input:        {borderWidth:1,borderRadius:14,padding:16,fontSize:20,fontWeight:"800",letterSpacing:3,marginBottom:8,textAlign:"center"},
  errorText:    {fontSize:12,marginBottom:12,lineHeight:18},
  quickPickLabel:{fontSize:11,letterSpacing:1,marginBottom:10,marginTop:4},
  quickPickRow: {flexDirection:"row",gap:10,marginBottom:24,flexWrap:"wrap"},
  quickPickBtn: {borderWidth:1,borderRadius:12,padding:12,alignItems:"center",gap:4,minWidth:100},
  quickPickIcon:{fontSize:18},
  quickPickText:{fontWeight:"700",fontSize:13},
  primaryBtn:    {borderRadius:16,paddingVertical:16,alignItems:"center",marginBottom:12},
  primaryBtnText:{color:"white",fontWeight:"800",fontSize:16},
  secondaryBtn:  {borderWidth:1,borderRadius:16,paddingVertical:14,alignItems:"center"},
  secondaryBtnText:{fontWeight:"600",fontSize:14},
  confirmCard:   {borderWidth:1,borderRadius:20,padding:24,alignItems:"center",marginBottom:20},
  confirmIcon:   {fontSize:40,marginBottom:10},
  confirmTitle:  {fontSize:20,fontWeight:"800",marginBottom:20},
  confirmDetails:{borderRadius:14,padding:16,width:"100%",gap:12,marginTop:16},
  detailRow:     {flexDirection:"row",justifyContent:"space-between"},
  detailKey:     {fontSize:13},
  detailVal:     {fontWeight:"700",fontSize:13},
  successBody:   {alignItems:"center",paddingTop:40},
  successCircle: {width:100,height:100,borderRadius:50,borderWidth:2,justifyContent:"center",alignItems:"center",marginBottom:20},
  successEmoji:  {fontSize:48},
  successTitle:  {fontSize:28,fontWeight:"900",marginBottom:12},
  successSub:    {fontSize:14,textAlign:"center",lineHeight:22,marginBottom:24},
});