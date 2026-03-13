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
//   - LAYOUT_VERSION guards against stale AsyncStorage cache when you change the
//     parking layout — bump it every time you edit generateSpots().
//     LAYOUT_VERSION 防止修改停车布局后 AsyncStorage 缓存仍加载旧数据 —
//     每次修改 generateSpots() 时必须更新此版本号。
//
// HOW TO CHANGE THE PARKING LAYOUT (如何修改停车场布局):
//   1. Edit the addRow() calls inside generateSpots() below.
//      修改 generateSpots() 里的 addRow() 调用。
//   2. One group  = spots are all connected (no aisle rendered by map.tsx).
//      一个 group = 格子全部连在一起（map.tsx 不渲染通道）。
//   3. Two groups = map.tsx draws an aisle between group 0 and group 1.
//      两个 group = map.tsx 在第 0 组和第 1 组之间渲染通道。
//   4. ⚠️  ALWAYS bump LAYOUT_VERSION after changing generateSpots(), or the app
//      will keep loading the old layout from the AsyncStorage cache.
//      ⚠️  修改 generateSpots() 后必须更新 LAYOUT_VERSION，否则 App 继续加载缓存旧布局。
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
//   - generateSpots()        → function: creates the full spot layout (生成完整车位布局)
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

/* A single parking spot in the full lot layout.
   完整停车场布局中的单个停车位 */
export interface ParkingSpot {
  id:        string;      // Spot ID e.g. "R1-5" or "OKU-1" (车位编号)
  row:       number;      // Global row index 0–13 (全局行索引 0~13)
  col:       number;      // Column index within row (行内列索引)
  status:    SpotStatus;  // free or occupied (空位或占用)
  type:      SpotType;    // normal or oku (普通或OKU)
  section:   string;      // Section ID e.g. "S1","S2","SR" — used for grouped rendering (区域ID，用于分组渲染)
  group:     number;      // Sub-group within a row (0 = left cluster, 1 = right cluster) (行内子组，0=左侧,1=右侧，有通道时用)
  plate?:    string;      // License plate when occupied (占用时的车牌，可选)
  checkedIn?: string;     // Check-in time when occupied (占用时的签入时间，可选)
}

// ─── Generate Initial Spots 生成初始车位 ─────────────────────────────────────
/*
   Full parking lot — 242 spots total (2 OKU + 240 normal):
   完整停车场，共 242 个车位（2 OKU + 240 普通）:

   Row 1  (S1): [OKU×2] + [normal×13]  = 15 total — independent (独立行, 2 OKU + 13 普通)
   Row 2  (S2): [normal×20]             = 20 total ┐ paired back-to-back, no aisle (背靠背，无通道)
   Row 3  (S2): [normal×18]             = 18 total ┘
   Row 4  (S3): [normal×18]                        ┐
   Row 5  (S3): [normal×18]                        ┘
   Row 6  (S4): [normal×18]                        ┐
   Row 7  (S4): [normal×18]                        ┘
   Row 8  (S5): [normal×18]                        ┐
   Row 9  (S5): [normal×18]                        ┘
   Row 10 (S6): [normal×3] | [normal×15]           ┐ aisle between left/right groups (通道分组)
   Row 11 (S6): [normal×3] | [normal×17]           ┘
   Row 12 (S7): [normal×23]            — independent (独立行)
   Side   (SR): [normal×20]            — right-side vertical column (右侧竖排)

   | = aisle gap between left/right sub-groups, only in S6 now (通道，现在只有S6有)

   ─────────────────────────────────────────────────────────────────────────────
   ⚠️  HOW TO CHANGE ROW/SPOT COUNTS (如何修改行数/格数):
   1. Edit the addRow() calls below.
      修改下面的 addRow() 调用。
   2. To have ALL spots connected in a row (no aisle gap), use ONE group:
      如果需要一行内所有格子连在一起（无通道），只用一个 group:
        addRow("S2", [{ type: "normal", count: 20 }]);   ← 20 格连续 ✅
   3. To split a row with an aisle, use TWO groups:
      如果需要用通道分隔左右两组，用两个 group:
        addRow("S6", [{ type: "normal", count: 3 }, { type: "normal", count: 15 }]);  ← 3 | 通道 | 15
   4. After ANY change here, you MUST bump LAYOUT_VERSION above (e.g. "v3" → "v4")
      so AsyncStorage clears the cache and your new layout actually loads.
      每次改完这里，必须修改上面的 LAYOUT_VERSION（例如 "v3" → "v4"），
      否则 AsyncStorage 缓存仍然会加载旧布局，改动看起来没有生效！
   ─────────────────────────────────────────────────────────────────────────────
*/
export function generateSpots(): ParkingSpot[] {
  const spots: ParkingSpot[] = [];
  let globalRow = 0;
  let okuCount  = 0;

  /*
     addRow — appends all spots for one physical row to the `spots` array.
     addRow — 将一行所有格子追加到 spots 数组。

     @param section  Section ID this row belongs to e.g. "S1", "S2", "SR"
                     该行所属区域 ID
     @param groups   Array of spot groups in left-to-right order.
                     按从左到右顺序排列的格子组数组。
                     • One group  → all spots are connected, no aisle drawn
                       一个组 → 所有格子连在一起，不渲染通道
                     • Two groups → map.tsx renders an aisle between group 0 and group 1
                       两个组 → map.tsx 在第 0 组和第 1 组之间渲染通道间隙
  */
  function addRow(section: string, groups: { type: SpotType; count: number }[]) {
    let col = 0;
    for (let g = 0; g < groups.length; g++) {
      for (let i = 0; i < groups[g].count; i++) {
        const isOKU = groups[g].type === "oku";
        if (isOKU) okuCount++;
        spots.push({
          id:      isOKU ? `OKU-${okuCount}` : `R${globalRow + 1}-${col + 1}`,
          row:     globalRow,
          col,
          status:  "free",
          type:    groups[g].type,
          section,
          group:   g,  // 0 = left cluster (or only cluster), 1 = right cluster (0=左/唯一子组, 1=右子组)
        });
        col++;
      }
    }
    globalRow++;
  }

  // ── Row definitions (行定义) ─────────────────────────────────────────────────
  // To change spot counts: edit the count values below, then bump LAYOUT_VERSION.
  // 修改格数：编辑下面的 count 值，然后更新 LAYOUT_VERSION。

  addRow("S1", [{ type: "oku", count: 2 }, { type: "normal", count: 13 }]); // Row 1:  2 OKU + 13 = 15 total (独立行)
  addRow("S2", [{ type: "normal", count: 3  }, { type: "normal", count: 17 }]); // Row 2:  3 | aisle | 17 ┐ paired
  addRow("S2", [{ type: "normal", count: 3  }, { type: "normal", count: 15 }]); // Row 3:  3 | aisle | 15 ┘
  addRow("S3", [{ type: "normal", count: 18 }]);                             // Row 4:  18 ┐ paired
  addRow("S3", [{ type: "normal", count: 18 }]);                             // Row 5:  18 ┘
  addRow("S4", [{ type: "normal", count: 18 }]);                             // Row 6:  18 ┐ paired
  addRow("S4", [{ type: "normal", count: 18 }]);                             // Row 7:  18 ┘
  addRow("S5", [{ type: "normal", count: 18 }]);                             // Row 8:  18 ┐ paired
  addRow("S5", [{ type: "normal", count: 18 }]);                             // Row 9:  18 ┘
  addRow("S6", [{ type: "normal", count: 3 }, { type: "normal", count: 15 }]); // Row 10: 3 | aisle | 15 ┐ paired (通道分组)
  addRow("S6", [{ type: "normal", count: 3 }, { type: "normal", count: 17 }]); // Row 11: 3 | aisle | 17 ┘
  addRow("S7", [{ type: "normal", count: 23 }]);                             // Row 12: 23 (独立行)
  addRow("SR", [{ type: "normal", count: 20 }]);                             // Side:   20 (右侧竖排)

  return spots; // Total: 242 (2 OKU + 240 normal) / 总计 242 个车位
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
const VEHICLES_KEY      = "mdis_vehicles";        // Registered vehicles list (注册车辆列表)
const SESSION_KEY       = "mdis_session";         // Active session (当前停车会话)
const ACTIVITY_KEY      = "mdis_activity";        // Activity log (活动记录)
const SPOTS_KEY         = "mdis_spots";           // Parking spot statuses (停车位状态)
const LAYOUT_VERSION_KEY = "mdis_layout_version"; // Layout version — bump to force cache clear (布局版本号，改变时强制清除缓存)

// ─── Layout Version (布局版本号) ──────────────────────────────────────────────
// ⚠️  IMPORTANT: Whenever you change generateSpots() — adding rows, removing rows,
//     or changing spot counts — you MUST increment this string (e.g. "v3" → "v4").
//     This forces AsyncStorage to discard the cached spots and reload the new layout.
//     If you don't bump this, the app will keep displaying the old layout from cache.
//
// ⚠️  重要：每次修改 generateSpots() 的布局（增减行、增减格数），必须修改此字符串
//     （例如 "v3" → "v4"）。这样 AsyncStorage 会丢弃旧的缓存格子，重新生成新布局。
//     如果不修改此值，App 将继续显示缓存中的旧布局，看起来好像改动没有生效。
const LAYOUT_VERSION = "v3";

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
  const [spots,         setSpotsState]    = useState<ParkingSpot[]>(generateSpots);  // 241 spots (241个车位：2 OKU + 239 普通)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activity,      setActivity]      = useState<ActivityItem[]>([]);
  const [loaded,        setLoaded]        = useState(false); // Whether AsyncStorage has been read (是否已从AsyncStorage读取完毕)

  // ── Load from AsyncStorage on app start (App 启动时从 AsyncStorage 读取数据) ─

  useEffect(() => {
    async function load() {
      try {
        // Read all keys in parallel for performance (并行读取所有Key，提升性能)
        const [v, s, a, sp, lv] = await Promise.all([
          AsyncStorage.getItem(VEHICLES_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(ACTIVITY_KEY),
          AsyncStorage.getItem(SPOTS_KEY),
          AsyncStorage.getItem(LAYOUT_VERSION_KEY),  // Check saved layout version (检查已保存的布局版本)
        ]);
        if (v)  setVehiclesState(JSON.parse(v));
        if (s)  setActiveSession(JSON.parse(s));
        if (a)  setActivity(JSON.parse(a));

        // ── Spots cache validation (车位缓存校验) ──────────────────────────────
        // Condition to USE the cached spots (使用缓存的条件，三者必须同时满足):
        //   1. Saved layout version matches current LAYOUT_VERSION
        //      已保存的布局版本与当前 LAYOUT_VERSION 一致
        //   2. Cached spot count matches generateSpots() output count
        //      缓存格子数量与 generateSpots() 输出数量一致
        // If EITHER check fails → regenerate from scratch and save the new version.
        // 任一条件不满足 → 重新生成并保存新版本号。
        if (sp) {
          const parsed      = JSON.parse(sp);
          const expected    = generateSpots().length;
          const versionOK   = lv === LAYOUT_VERSION;     // Version matches (版本一致)
          const countOK     = parsed.length === expected; // Spot count matches (格数一致)

          if (versionOK && countOK) {
            // Cache is valid — load it (缓存有效，直接加载)
            setSpotsState(parsed);
          } else {
            // Cache is stale — regenerate and save new version
            // 缓存过期（布局已改动）— 重新生成并保存新版本号
            setSpotsState(generateSpots());
            await AsyncStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION).catch(() => {});
          }
        } else {
          // No cached spots yet — save version for next launch (首次启动，保存版本号)
          await AsyncStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION).catch(() => {});
        }
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