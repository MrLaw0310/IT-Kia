import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

// ─── 类型定义 ──────────────────────────────────────────────────────────
export interface Vehicle {
  id:     string;
  plate:  string;
  model:  string;
  isPaid: boolean;
  isOKU:  boolean;
}

export interface ActivityItem {
  id:     string;
  plate:  string;
  action: "Checked In" | "Checked Out";
  spot:   string;
  time:   string;
  isIn:   boolean;
}

export interface ActiveSession {
  spotId:    string;
  plate:     string;
  checkedIn: string;
}

// ── 停车位类型（从 map.tsx 移过来共享）────────────────────────────────
export type SpotStatus = "free" | "occupied";
export type SpotType   = "normal" | "oku";

export interface ParkingSpot {
  id:        string;
  row:       number;
  col:       number;
  status:    SpotStatus;
  type:      SpotType;
  plate?:    string;
  checkedIn?: string;
}

// ─── 生成初始停车位（从 map.tsx 移过来）──────────────────────────────
// 7 行 × 10 列 = 70 个位，左上角 2 个是 OKU
export function generateSpots(): ParkingSpot[] {
  const spots: ParkingSpot[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 10; col++) {
      const isOKU = row === 0 && col < 2;
      spots.push({
        id:     isOKU ? `OKU-${col + 1}` : `R${row + 1}-${col + 1}`,
        row, col,
        type:   isOKU ? "oku" : "normal",
        status: "free",
      });
    }
  }
  return spots;
}

// ─── Context 类型 ──────────────────────────────────────────────────────
interface ParkingContextType {
  // 车辆
  vehicles:      Vehicle[];
  setVehicles:   (v: Vehicle[]) => void;

  // 停车位（⭐ 新增，home 和 map 共用这一份）
  spots:         ParkingSpot[];
  setSpots:      (fn: (prev: ParkingSpot[]) => ParkingSpot[]) => void;

  // 当前会话
  activeSession: ActiveSession | null;
  checkIn:       (spotId: string, plate: string) => void;
  checkOut:      () => void;

  // 活动记录
  activity:      ActivityItem[];
  addActivity:   (item: Omit<ActivityItem, "id">) => void;

  // 统计（方便 home 直接读，不用自己算）
  freeCount:     number;   // 普通空位数
  occCount:      number;   // 普通占用数
  okuFree:       number;   // OKU 空位数
  totalNormal:   number;   // 普通位总数
  okuTotal:      number;   // OKU 位总数
}

// ─── AsyncStorage Keys ────────────────────────────────────────────────
const VEHICLES_KEY = "mdis_vehicles";
const SESSION_KEY  = "mdis_session";
const ACTIVITY_KEY = "mdis_activity";
const SPOTS_KEY    = "mdis_spots";   // ⭐ 新增

const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "1", plate: "WXY 1234", model: "Honda Civic (White)",  isPaid: true, isOKU: false },
  { id: "2", plate: "JHB 5678", model: "Toyota Vios (Silver)", isPaid: true, isOKU: false },
];

const ParkingContext = createContext<ParkingContextType | null>(null);

export function useParkingContext() {
  const ctx = useContext(ParkingContext);
  if (!ctx) throw new Error("useParkingContext must be used within ParkingProvider");
  return ctx;
}

// ═════════════════════════════════════════════════════════════════════
export function ParkingProvider({ children }: { children: ReactNode }) {
  const [vehicles,      setVehiclesState] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [spots,         setSpotsState]    = useState<ParkingSpot[]>(generateSpots);  // ⭐
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activity,      setActivity]      = useState<ActivityItem[]>([]);
  const [loaded,        setLoaded]        = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [v, s, a, sp] = await Promise.all([
          AsyncStorage.getItem(VEHICLES_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(ACTIVITY_KEY),
          AsyncStorage.getItem(SPOTS_KEY),   // ⭐
        ]);
        if (v)  setVehiclesState(JSON.parse(v));
        if (s)  setActiveSession(JSON.parse(s));
        if (a)  setActivity(JSON.parse(a));
        if (sp) setSpotsState(JSON.parse(sp));  // ⭐
      } catch {}
      setLoaded(true);
    }
    load();
  }, []);

  // ── 持久化 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles)).catch(() => {});
  }, [vehicles, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SPOTS_KEY, JSON.stringify(spots)).catch(() => {});  // ⭐
  }, [spots, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (activeSession) {
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(activeSession)).catch(() => {});
    } else {
      AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    }
  }, [activeSession, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)).catch(() => {});
  }, [activity, loaded]);

  // ── activeSession 变化时同步更新 spots ────────────────────────────
  // spots 同步直接在 checkIn / checkOut 函数里完成，不用 useEffect

  // ── 方法 ────────────────────────────────────────────────────────────
  function setVehicles(v: Vehicle[]) {
    setVehiclesState(v);
  }

  // ⭐ 暴露给 map.tsx 用，签名和原来 setSpots(fn) 一样
  function setSpots(fn: (prev: ParkingSpot[]) => ParkingSpot[]) {
    setSpotsState(fn);
  }

  function now() {
    return new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  }

  function addActivity(item: Omit<ActivityItem, "id">) {
    setActivity(prev => [{ ...item, id: Date.now().toString() }, ...prev].slice(0, 20));
  }

  function checkIn(spotId: string, plate: string) {
    const time = now();
    // 同时更新 spots + session，避免 useEffect 竞争
    setSpotsState(prev => prev.map(s =>
      s.id === spotId
        ? { ...s, status: "occupied", plate, checkedIn: time }
        : s
    ));
    setActiveSession({ spotId, plate, checkedIn: time });
    addActivity({ plate, action: "Checked In", spot: spotId, time, isIn: true });
  }

  function checkOut() {
    if (!activeSession) return;
    const time    = now();
    const spotId  = activeSession.spotId;
    const plate   = activeSession.plate;
    // 先释放 spot，再清空 session
    setSpotsState(prev => prev.map(s =>
      s.id === spotId ? { ...s, status: "free", plate: undefined, checkedIn: undefined } : s
    ));
    setActiveSession(null);
    addActivity({ plate, action: "Checked Out", spot: spotId, time, isIn: false });
  }

  // ── 统计（home.tsx 直接用，不用自己算）────────────────────────────
  const freeCount   = spots.filter(s => s.status === "free"     && s.type === "normal").length;
  const occCount    = spots.filter(s => s.status === "occupied"  && s.type === "normal").length;
  const okuFree     = spots.filter(s => s.type   === "oku"       && s.status === "free").length;
  const totalNormal = spots.filter(s => s.type   === "normal").length;
  const okuTotal    = spots.filter(s => s.type   === "oku").length;

  return (
    <ParkingContext.Provider value={{
      vehicles, setVehicles,
      spots, setSpots,
      activeSession, checkIn, checkOut,
      activity, addActivity,
      freeCount, occCount, okuFree, totalNormal, okuTotal,
    }}>
      {children}
    </ParkingContext.Provider>
  );
}