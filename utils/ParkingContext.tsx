// ═══════════════════════════════════════════════════════════════════════════════
// FILE: utils/ParkingContext.tsx
//
// PURPOSE (用途):
//   Global state manager for the entire parking app using React Context.
//   全局状态管理器，使用 React Context 管理整个停车应用的共享数据。
//
// WHAT IT DOES (功能说明):
//   - Stores & persists all parking data via AsyncStorage (车辆、车位、会话、活动记录)
//   - Provides shared parking spots grid used by both Home and Map screens
//     (提供 Home 和 Map 两个页面共用的停车位格子数据)
//   - Handles Check In / Check Out logic (处理签入/签出逻辑)
//   - Exposes pre-calculated statistics so screens don't recompute them
//     (暴露预计算统计数据，各页面无需自己计算)
//
// IMPORTS (引入):
//   - AsyncStorage           → local persistent storage (本地持久化存储)
//   - createContext,
//     ReactNode,
//     useContext,
//     useEffect,
//     useState               → React hooks & context API (React 钩子与 Context)
//
// EXPORTS (导出):
//   - Vehicle                → type: one registered car (一辆注册车辆的类型)
//   - ActivityItem           → type: a check-in/out log entry (签入/签出记录类型)
//   - ActiveSession          → type: the current active parking session (当前停车会话类型)
//   - SpotStatus             → type: "free" | "occupied"
//   - SpotType               → type: "normal" | "oku"
//   - ParkingSpot            → type: a single parking spot object (单个停车位对象类型)
//   - generateSpots()        → function: creates the initial 7×10 spot grid (生成初始70个车位)
//   - useParkingContext()    → hook: consume the context in any component (在组件中读取 context)
//   - ParkingProvider        → component: wrap app with this to enable context (包裹 App 的 Provider)
// ═══════════════════════════════════════════════════════════════════════════════

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

// ─── Type Definitions 类型定义 ────────────────────────────────────────────────

/* One registered vehicle belonging to the user.
   用户名下一辆注册车辆 */
export interface Vehicle {
  id:     string;   // Unique ID (唯一标识符)
  plate:  string;   // License plate e.g. "WXY 1234" (车牌号)
  model:  string;   // Car model e.g. "Honda Civic (White)" (车型描述)
  isPaid: boolean;  // Whether annual fee is paid (是否已缴年费)
  isOKU:  boolean;  // Whether this vehicle has OKU parking rights (是否有OKU停车权限)
}

/* One record of a check-in or check-out event.
    一条签入或签出事件记录 */
export interface ActivityItem {
  id:     string;                          // Unique ID (唯一标识符)
  plate:  string;                          // License plate (车牌号)
  action: "Checked In" | "Checked Out";   // Event type (事件类型)
  spot:   string;                          // Spot ID e.g. "R1-3" (车位编号)
  time:   string;                          // Time string e.g. "09:30 AM" (时间字符串)
  isIn:   boolean;                         // true = check-in, false = check-out (签入为true)
}

/* The currently active parking session (only one at a time).
   当前进行中的停车会话（同时只有一个） */
export interface ActiveSession {
  spotId:    string;  // Which spot is occupied (占用的车位 ID)
  plate:     string;  // Whose plate (使用该车位的车牌)
  checkedIn: string;  // Time of check-in (签入时间)
}

// ── Spot types shared with map.tsx (停车位类型，与 map.tsx 共用) ──────────────

/* Whether a spot is free or occupied (车位是否空闲) */
export type SpotStatus = "free" | "occupied";

/* Whether a spot is a normal student spot or OKU reserved (普通位还是OKU专用位) */
export type SpotType   = "normal" | "oku";

/* A single parking spot in the 7×10 grid.
   7×10 格子中的单个停车位 */
export interface ParkingSpot {
  id:        string;      // Spot ID e.g. "R1-5" or "OKU-1" (车位编号)
  row:       number;      // Row index 0–6 (行索引 0~6)
  col:       number;      // Column index 0–9 (列索引 0~9)
  status:    SpotStatus;  // free or occupied (空位或占用)
  type:      SpotType;    // normal or oku (普通或OKU)
  plate?:    string;      // License plate when occupied (占用时的车牌，可选)
  checkedIn?: string;     // Check-in time when occupied (占用时的签入时间，可选)
}

// ─── Generate Initial Spots 生成初始车位 ─────────────────────────────────────
/* Creates the initial 7 rows × 10 columns = 70 parking spots.
   生成初始 7 行 × 10 列 = 70 个停车位。
   The top-left 2 spots (row=0, col=0 and col=1) are OKU reserved.
   左上角两个车位 (row=0, col=0~1) 为 OKU 专用。*/

export function generateSpots(): ParkingSpot[] {
  const spots: ParkingSpot[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 10; col++) {
      const isOKU = row === 0 && col < 2; // First 2 spots in row 0 are OKU (第0行前两格为OKU)
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

// ─── Context Shape (Context 接口定义) ────────────────────────────────────────
/*
   Defines all data and methods that ParkingContext exposes to child components.
   定义 ParkingContext 向子组件暴露的所有数据和方法。
*/
interface ParkingContextType {
  // Registered vehicles (注册车辆列表)
  vehicles:      Vehicle[];
  setVehicles:   (v: Vehicle[]) => void;

  // Parking spots grid — shared between Home and Map (停车位格子，Home和Map共用)
  spots:         ParkingSpot[];
  setSpots:      (fn: (prev: ParkingSpot[]) => ParkingSpot[]) => void;

  // Active session (当前停车会话)
  activeSession: ActiveSession | null;
  checkIn:       (spotId: string, plate: string) => void;  // Start a session (开始停车)
  checkOut:      () => void;                                // End the session (结束停车)

  // Activity log (活动记录日志)
  activity:      ActivityItem[];
  addActivity:   (item: Omit<ActivityItem, "id">) => void;

  // Pre-computed statistics for Home screen (首页直接使用的预计算统计数据)
  freeCount:     number;   // Free normal spots (普通空位数)
  occCount:      number;   // Occupied normal spots (普通占用数)
  okuFree:       number;   // Free OKU spots (OKU空位数)
  totalNormal:   number;   // Total normal spots (普通位总数)
  okuTotal:      number;   // Total OKU spots (OKU位总数)
}

// ─── AsyncStorage Keys (持久化存储的Key名) ───────────────────────────────────
// Each key stores one slice of state as a JSON string.
// 每个 Key 存储一段 state，格式为 JSON 字符串。
const VEHICLES_KEY = "mdis_vehicles";   // Registered vehicles list (注册车辆列表)
const SESSION_KEY  = "mdis_session";    // Active session (当前停车会话)
const ACTIVITY_KEY = "mdis_activity";   // Activity log (活动记录)
const SPOTS_KEY    = "mdis_spots";      // Parking spot statuses (停车位状态)

/** Default demo vehicles loaded on first launch (首次启动时加载的默认演示车辆) */
const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "1", plate: "WXY 1234", model: "Honda Civic (White)",  isPaid: true, isOKU: false },
  { id: "2", plate: "JHB 5678", model: "Toyota Vios (Silver)", isPaid: true, isOKU: false },
];

// Create the context (创建 Context 对象，初始值为 null)
const ParkingContext = createContext<ParkingContextType | null>(null);

/*
   Custom hook to read the ParkingContext.
   自定义 Hook，用于在组件中读取 ParkingContext。
   
   Usage / 用法:
     const { vehicles, checkIn, checkOut, ... } = useParkingContext();
  
   Throws if used outside <ParkingProvider>.
   如果在 <ParkingProvider> 外使用会抛出错误。
 */
export function useParkingContext() {
  const ctx = useContext(ParkingContext);
  if (!ctx) throw new Error("useParkingContext must be used within ParkingProvider");
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════════
/*
   ParkingProvider — wrap the entire app with this to enable shared parking state.
   将整个 App 包裹在此 Provider 中，以启用全局停车状态共享。
  
   Place in: app/_layout.tsx → <ParkingProvider>...</ParkingProvider>
   放置位置: app/_layout.tsx 中
 */
export function ParkingProvider({ children }: { children: ReactNode }) {
  // ── State Declarations (状态声明) ─────────────────────────────────────────

  const [vehicles,      setVehiclesState] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [spots,         setSpotsState]    = useState<ParkingSpot[]>(generateSpots);  // 70 spots (70个车位)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activity,      setActivity]      = useState<ActivityItem[]>([]);
  const [loaded,        setLoaded]        = useState(false); // Whether AsyncStorage has been read (是否已从AsyncStorage读取完毕)

  // ── Load from AsyncStorage on app start (App 启动时从 AsyncStorage 读取数据) ─

  useEffect(() => {
    async function load() {
      try {
        // Read all four keys in parallel for performance (并行读取4个Key，提升性能)
        const [v, s, a, sp] = await Promise.all([
          AsyncStorage.getItem(VEHICLES_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(ACTIVITY_KEY),
          AsyncStorage.getItem(SPOTS_KEY),
        ]);
        if (v)  setVehiclesState(JSON.parse(v));
        if (s)  setActiveSession(JSON.parse(s));
        if (a)  setActivity(JSON.parse(a));
        if (sp) setSpotsState(JSON.parse(sp));
      } catch {}
      setLoaded(true); // Mark as loaded regardless of errors (无论是否出错都标记为已读取)
    }
    load();
  }, []);

  // ── Persist state changes to AsyncStorage (将 state 变化持久化到 AsyncStorage) ─
  // Only persist after initial load to avoid overwriting with defaults.
  // 只在初始读取完成后才持久化，避免用默认值覆盖已保存的数据。

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles)).catch(() => {});
  }, [vehicles, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SPOTS_KEY, JSON.stringify(spots)).catch(() => {});
  }, [spots, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (activeSession) {
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(activeSession)).catch(() => {});
    } else {
      AsyncStorage.removeItem(SESSION_KEY).catch(() => {}); // Clear when no session (无会话时清除)
    }
  }, [activeSession, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)).catch(() => {});
  }, [activity, loaded]);

  // ── Helper: current time string (辅助函数：获取当前时间字符串) ───────────────
  function now() {
    return new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  }

  // ── Methods exposed via Context (通过 Context 暴露的方法) ───────────────────

  /* Update the vehicles list (更新注册车辆列表) */
  function setVehicles(v: Vehicle[]) {
    setVehiclesState(v);
  }

  /*
     Functional updater for spots, same signature as React setState(fn).
     停车位的函数式更新器，签名与 React setState(fn) 相同。
     Used by map.tsx to update individual spot statuses.
     供 map.tsx 使用，用于更新单个车位状态。
  */
  function setSpots(fn: (prev: ParkingSpot[]) => ParkingSpot[]) {
    setSpotsState(fn);
  }

  /*
     Add one record to the activity log (max 20 entries).
     向活动记录添加一条记录（最多保留20条）。
  */
  function addActivity(item: Omit<ActivityItem, "id">) {
    setActivity(prev => [{ ...item, id: Date.now().toString() }, ...prev].slice(0, 20));
  }

  /*
     Check in to a parking spot.
     签入到指定车位。
     Updates: spots grid, active session, activity log.
     更新：停车位格子、当前会话、活动日志。
  */
  function checkIn(spotId: string, plate: string) {
    const time = now();
    // Update spot status simultaneously to avoid useEffect race conditions
    // 同时更新 spot 状态和 session，避免 useEffect 竞争
    setSpotsState(prev => prev.map(s =>
      s.id === spotId
        ? { ...s, status: "occupied", plate, checkedIn: time }
        : s
    ));
    setActiveSession({ spotId, plate, checkedIn: time });
    addActivity({ plate, action: "Checked In", spot: spotId, time, isIn: true });
  }

  /*
     Check out from the current active session.
     从当前会话签出。
     Frees the spot, clears the session, logs the activity.
     释放车位、清除会话、记录活动。
  */
  function checkOut() {
    if (!activeSession) return;
    const time   = now();
    const spotId = activeSession.spotId;
    const plate  = activeSession.plate;
    // Free the spot first, then clear session
    // 先释放车位，再清空会话
    setSpotsState(prev => prev.map(s =>
      s.id === spotId ? { ...s, status: "free", plate: undefined, checkedIn: undefined } : s
    ));
    setActiveSession(null);
    addActivity({ plate, action: "Checked Out", spot: spotId, time, isIn: false });
  }

  // ── Pre-computed Statistics (预计算统计数据，供 Home 页直接使用) ────────────
  const freeCount   = spots.filter(s => s.status === "free"     && s.type === "normal").length;
  const occCount    = spots.filter(s => s.status === "occupied"  && s.type === "normal").length;
  const okuFree     = spots.filter(s => s.type   === "oku"       && s.status === "free").length;
  const totalNormal = spots.filter(s => s.type   === "normal").length;
  const okuTotal    = spots.filter(s => s.type   === "oku").length;

  // ── Provide context value to all children (向所有子组件提供 context 值) ─────
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