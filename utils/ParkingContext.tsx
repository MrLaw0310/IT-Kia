/*
utils/ParkingContext.tsx — 全局停车状态管理器 / Global Parking State Manager

使用 React Context 管理整个停车应用的共享数据，并通过 AsyncStorage 持久化。
Manages all shared parking data via React Context, persisted with AsyncStorage.

主要功能 / Key features:
  - 存储并持久化所有停车数据（车辆、车位、会话、活动记录）
    Stores and persists all parking data (vehicles, spots, session, activity)
  - 提供 Home 和 Map 两个页面共用的停车位格子数据
    Provides the parking spots grid shared by Home and Map screens
  - 处理签入/签出逻辑 | handles Check In / Check Out logic
  - 暴露预计算统计数据，各页面无需自己计算
    Exposes pre-calculated statistics so screens don't recompute them

⚠️  修改停车场布局后，必须更新 LAYOUT_VERSION，否则 App 继续加载 AsyncStorage 缓存旧布局。
⚠️  After editing generateSpots(), always bump LAYOUT_VERSION to clear the cache.

  如何修改停车场布局 / How to change the parking layout:
  1. 修改 generateSpots() 里的 addRow() 调用 / edit addRow() calls in generateSpots()
  2. 一个 group = 格子全连，无通道 / one group = all spots connected, no aisle
     两个 group = map.tsx 在两组之间渲染通道 / two groups = map.tsx renders an aisle
  3. 修改后必须更新 LAYOUT_VERSION (e.g. "v3" → "v4")
     Always bump LAYOUT_VERSION after any change here
*/

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

// ─── Type Definitions (类型定义) ─────────────────────────────────────────────

/* 用户名下一辆注册车辆 / one registered vehicle belonging to the user */
export interface Vehicle {
  id: string; // 唯一标识符 / unique ID
  plate: string; // 车牌号，例如 "WXY 1234" / license plate
  model: string; // 车型描述，例如 "Honda Civic (White)" / car model description
  isPaid: boolean; // 是否已缴年费 / whether annual fee is paid
  isOKU: boolean; // 是否有 OKU 停车权限 / whether this vehicle has OKU parking rights
}

/* 一条签入或签出事件记录 / one check-in or check-out event record */
export interface ActivityItem {
  id: string; // 唯一标识符 / unique ID
  plate: string; // 车牌号 / license plate
  action: "Checked In" | "Checked Out"; // 事件类型 / event type
  spot: string; // 车位编号，例如 "R1-3" / spot ID
  time: string; // 时间字符串，例如 "09:30 AM" / time string
  isIn: boolean; // true=签入, false=签出 / true = check-in
}

/* 当前进行中的停车会话（同时只有一个）/ the currently active parking session */
export interface ActiveSession {
  spotId: string;  // 占用的车位 ID / which spot is occupied
  plate: string;  // 使用该车位的车牌 / whose plate
  checkedIn: string;  // 签入时间 / time of check-in
}

/* 车位是否空闲 / whether a spot is free or occupied */
export type SpotStatus = "free" | "occupied";

/* 普通位还是 OKU 专用位 / whether a spot is normal or OKU reserved */
export type SpotType = "normal" | "oku";

/** 完整停车场布局中的单个停车位 / a single parking spot in the full lot layout */
export interface ParkingSpot {
  id: string; // 车位编号，例如 "R1-5" 或 "OKU-1" / spot ID
  row: number; // 全局行索引 0~13 / global row index
  col: number; // 行内列索引 / column index within row
  status: SpotStatus; // free 或 occupied / free or occupied
  type: SpotType; // normal 或 oku / normal or OKU
  section: string; // 区域 ID，例如 "S1","S2","SR" — 用于分组渲染 / section ID for grouped rendering
  group: number; // 行内子组：0=左侧/唯一组，1=右侧组（有通道时）/ sub-group: 0=left or only, 1=right
  plate?: string; // 占用时的车牌（可选）/ license plate when occupied
  checkedIn?: string; // 占用时的签入时间（可选）/ check-in time when occupied
}

// ─── Generate Initial Spots (生成初始车位) ────────────────────────────────────
/*
生成完整停车场布局，共 242 个车位（2 OKU + 240 普通）。
Generates the full parking lot layout — 242 spots total (2 OKU + 240 normal).

布局概览 / Layout overview:
 Row 1  (S1): [OKU×2] + [normal×13] = 15（独立行 / independent）
 Row 2  (S2): [3 | aisle | 17] = 20  ┐ 背靠背 / paired
 Row 3  (S2): [3 | aisle | 15] = 18  ┘
 Row 4–9  (S3–S5): [normal×18] each  ┐ 背靠背，无通道 / paired, no aisle
 Row 10 (S6): [3 | aisle | 15] = 18  ┐ 背靠背，有通道 / paired, with aisle
 Row 11 (S6): [3 | aisle | 17] = 20  ┘
 Row 12 (S7): [normal×23]（独立行 / independent）
 Side   (SR): [normal×20]（右侧竖排 / right-side vertical column）

⚠️  修改后必须更新 LAYOUT_VERSION，否则 AsyncStorage 缓存仍会加载旧布局！
⚠️  After any change here, bump LAYOUT_VERSION or the cache will serve the old layout!

 单个 group  → 格子全连，map.tsx 不渲染通道 / one group → all spots connected, no aisle
 两个 groups → map.tsx 在 group 0 和 group 1 之间渲染通道 / two groups → aisle rendered
*/
export function generateSpots(): ParkingSpot[] {
  const spots: ParkingSpot[] = [];
  let globalRow = 0;
  let okuCount  = 0;

  /*
   将一行所有格子追加到 spots 数组。
   Appends all spots for one physical row to the spots array.
  
   @param section 该行所属区域 ID / section ID this row belongs to
   @param groups  按从左到右顺序排列的格子组数组 / left-to-right spot groups
  */
  function addRow(section: string, groups: { type: SpotType; count: number }[]) {
    let col = 0;
    for (let g = 0; g < groups.length; g++) {
      for (let i = 0; i < groups[g].count; i++) {
        const isOKU = groups[g].type === "oku";
        if (isOKU) {
          okuCount++;
        }

        // 决定车位 ID：OKU 用 "OKU-1" 格式，普通用 "R1-5" 格式
        // Decide spot ID: OKU uses "OKU-1" format, normal uses "R1-5" format
        let spotId = `R${globalRow + 1}-${col + 1}`;
        if (isOKU) {
          spotId = `OKU-${okuCount}`;
        }

        spots.push({
          id: spotId,
          row: globalRow,
          col,
          status: "free",
          type: groups[g].type,
          section,
          group: g, // 0=左/唯一子组，1=右子组 / 0=left or only cluster, 1=right cluster
        });
        col++;
      }
    }
    globalRow++;
  }

  // 行定义 — 修改格数后记得更新 LAYOUT_VERSION / row definitions — bump LAYOUT_VERSION after edits
  addRow("S1", [{ type: "oku", count: 2  }, { type: "normal", count: 13 }]); // Row 1:  2 OKU + 13 (独立行)
  addRow("S2", [{ type: "normal", count: 3  }, { type: "normal", count: 17 }]); // Row 2:  3 | aisle | 17 ┐ 背靠背
  addRow("S2", [{ type: "normal", count: 3  }, { type: "normal", count: 15 }]); // Row 3:  3 | aisle | 15 ┘
  addRow("S3", [{ type: "normal", count: 18 }]); // Row 4:  18 ┐ 背靠背
  addRow("S3", [{ type: "normal", count: 18 }]); // Row 5:  18 ┘
  addRow("S4", [{ type: "normal", count: 18 }]); // Row 6:  18 ┐
  addRow("S4", [{ type: "normal", count: 18 }]); // Row 7:  18 ┘
  addRow("S5", [{ type: "normal", count: 18 }]); // Row 8:  18 ┐
  addRow("S5", [{ type: "normal", count: 18 }]); // Row 9:  18 ┘
  addRow("S6", [{ type: "normal", count: 3  }, { type: "normal", count: 15 }]); // Row 10: 3 | aisle | 15 ┐ 有通道
  addRow("S6", [{ type: "normal", count: 3  }, { type: "normal", count: 17 }]); // Row 11: 3 | aisle | 17 ┘
  addRow("S7", [{ type: "normal", count: 23 }]); // Row 12: 23 (独立行)
  addRow("SR", [{ type: "normal", count: 20 }]); // Side:   20 (右侧竖排)

  return spots; // 总计 242 个车位（2 OKU + 240 普通）/ total 242 (2 OKU + 240 normal)
}

// ─── Context Shape (Context 接口定义) ────────────────────────────────────────
/* ParkingContext 向子组件暴露的所有数据和方法 / all data and methods exposed to child components */
interface ParkingContextType {
  // 注册车辆列表 / registered vehicles
  vehicles: Vehicle[];
  setVehicles: (v: Vehicle[]) => void;

  // 停车位格子，Home 和 Map 共用 / parking spots grid shared between Home and Map
  spots: ParkingSpot[];
  setSpots: (fn: (prev: ParkingSpot[]) => ParkingSpot[]) => void;

  // 当前停车会话 / active parking session
  activeSession: ActiveSession | null;
  checkIn: (spotId: string, plate: string) => void; // 开始停车 / start a session
  checkOut: () => void; // 结束停车 / end the session

  // 活动记录日志 / activity log
  activity: ActivityItem[];
  addActivity: (item: Omit<ActivityItem, "id">) => void;

  // 首页直接使用的预计算统计数据 / pre-calculated statistics for Home screen
  freeCount: number;  // 普通空位数 / free normal spots
  occCount: number;  // 普通占用数 / occupied normal spots
  okuFree:  number;  // OKU 空位数 / free OKU spots
  totalNormal: number;  // 普通位总数 / total normal spots
  okuTotal: number;  // OKU 位总数 / total OKU spots
}

// ─── AsyncStorage Keys (持久化存储 Key 名) ───────────────────────────────────
// 每个 Key 存储一段 state，格式为 JSON 字符串 / each key stores one state slice as JSON
const VEHICLES_KEY = "mdis_vehicles"; // 注册车辆列表 / registered vehicles
const SESSION_KEY = "mdis_session";  // 当前停车会话 / active session
const ACTIVITY_KEY = "mdis_activity"; // 活动记录 / activity log
const SPOTS_KEY = "mdis_spots"; // 停车位状态 / parking spot statuses
const LAYOUT_VERSION_KEY = "mdis_layout_version";  // 布局版本号，改变时强制清除缓存 / bump to force cache clear

// ─── Layout Version (布局版本号) ──────────────────────────────────────────────
// ⚠️  每次修改 generateSpots()（增减行、增减格数），必须修改此字符串（例如 "v3" → "v4"）。
//     这样 AsyncStorage 会丢弃旧缓存，重新生成新布局。不修改此值会导致 App 显示旧布局！
// ⚠️  Whenever you change generateSpots(), bump this string (e.g. "v3" → "v4").
//     This forces AsyncStorage to discard the old cache and load the new layout.
const LAYOUT_VERSION = "v3";

/* 首次启动时加载的默认演示车辆 / default demo vehicles loaded on first launch */
const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "1", plate: "WXY 1234", model: "Honda Civic (White)",  isPaid: true, isOKU: false },
  { id: "2", plate: "JHB 5678", model: "Toyota Vios (Silver)", isPaid: true, isOKU: false },
];

// 创建 Context 对象，初始值为 null / create context, initial value null
const ParkingContext = createContext<ParkingContextType | null>(null);

/*
useParkingContext — 在组件中读取 ParkingContext 的自定义 Hook。
Custom hook to read the ParkingContext in any component.

用法 / Usage:
 const { vehicles, checkIn, checkOut, ... } = useParkingContext();

 在 <ParkingProvider> 外使用会抛出错误 / throws if used outside <ParkingProvider>.
*/
export function useParkingContext() {
  const ctx = useContext(ParkingContext);
  if (!ctx) {
    throw new Error("useParkingContext must be used within ParkingProvider");
  }
  return ctx;
}

/*
ParkingProvider — 将整个 App 包裹在此 Provider 中，以启用全局停车状态共享。
Wrap the entire app with this to enable shared parking state.

放置位置 / Place in: app/_layout.tsx → <ParkingProvider>...</ParkingProvider>
*/
export function ParkingProvider({ children }: { children: ReactNode }) {

  const [vehicles, setVehiclesState] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [spots, setSpotsState] = useState<ParkingSpot[]>(generateSpots); // 242 个车位 / 242 spots
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false); // 是否已从 AsyncStorage 读取完毕 / whether initial load is done

  // App 启动时从 AsyncStorage 读取数据 / load all data from AsyncStorage on app start
  useEffect(() => {
    async function load() {
      try {
        // 并行读取所有 Key，提升性能 / read all keys in parallel for performance
        const [v, s, a, sp, lv] = await Promise.all([
          AsyncStorage.getItem(VEHICLES_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(ACTIVITY_KEY),
          AsyncStorage.getItem(SPOTS_KEY),
          AsyncStorage.getItem(LAYOUT_VERSION_KEY),
        ]);
        if (v) {
          setVehiclesState(JSON.parse(v));
        }
        if (s) {
          setActiveSession(JSON.parse(s));
        }
        if (a) {
          setActivity(JSON.parse(a));
        }

        // 车位缓存校验：版本一致 且 格数一致 → 使用缓存；否则重新生成
        // Spots cache: use if version AND count both match; otherwise regenerate
        if (sp) {
          const parsed = JSON.parse(sp);
          const expected = generateSpots().length;
          const versionOK = lv === LAYOUT_VERSION;
          const countOK = parsed.length === expected;

          if (versionOK && countOK) {
            setSpotsState(parsed); // 缓存有效，直接加载 / cache is valid, use it
          } else {
            // 缓存过期（布局已改动），重新生成并保存新版本号
            // Cache is stale, regenerate and save new version
            setSpotsState(generateSpots());
            await AsyncStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION).catch(() => {});
          }
        } else {
          // 首次启动，保存版本号 / first launch, save version
          await AsyncStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION).catch(() => {});
        }
      } catch {}
      setLoaded(true); // 无论是否出错都标记为已读取 / mark as loaded regardless of errors
    }
    load();
  }, []);

  // 将 state 变化持久化到 AsyncStorage（只在初始读取完成后，避免用默认值覆盖已保存数据）
  // Persist state changes to AsyncStorage — only after initial load to avoid overwriting saved data
  useEffect(() => {
    if (!loaded) {
      return;
    }
    AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles)).catch(() => {});
  }, [vehicles, loaded]);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    AsyncStorage.setItem(SPOTS_KEY, JSON.stringify(spots)).catch(() => {});
  }, [spots, loaded]);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    if (activeSession) {
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(activeSession)).catch(() => {});
    } else {
      AsyncStorage.removeItem(SESSION_KEY).catch(() => {}); // 无会话时清除 / clear when no session
    }
  }, [activeSession, loaded]);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)).catch(() => {});
  }, [activity, loaded]);

  // 辅助函数：获取当前时间字符串 / helper: get current time string
  function now() {
    return new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  }

  // ─── 通过 Context 暴露的方法 / Methods exposed via Context ──────────────────

  /* 更新注册车辆列表 / update the vehicles list */
  function setVehicles(v: Vehicle[]) {
    setVehiclesState(v);
  }

  /*
  停车位的函数式更新器，签名与 React setState(fn) 相同。
  Functional updater for spots — same signature as React setState(fn).
  供 map.tsx 使用，用于更新单个车位状态 / used by map.tsx to update individual spot statuses.
  */
  function setSpots(fn: (prev: ParkingSpot[]) => ParkingSpot[]) {
    setSpotsState(fn);
  }

  /*
  向活动记录添加一条记录（最多保留 20 条）。
  Add one record to the activity log (max 20 entries).
  */
  function addActivity(item: Omit<ActivityItem, "id">) {
    setActivity(prev => [{ ...item, id: Date.now().toString() }, ...prev].slice(0, 20));
  }

  /*
  签入到指定车位，更新：停车位格子、当前会话、活动日志。
  Check in to a parking spot. Updates: spots grid, active session, activity log.
  */
  function checkIn(spotId: string, plate: string) {
    const time = now();
    // 同时更新 spot 和 session，避免 useEffect 竞争
    // Update spot and session together to avoid useEffect race conditions
    setSpotsState(prev => prev.map(s => {
      // 找到对应车位，更新为占用状态 / find the matching spot and mark it as occupied
      if (s.id === spotId) {
        return { ...s, status: "occupied", plate, checkedIn: time };
      } else {
        return s;
      }
    }));
    setActiveSession({ spotId, plate, checkedIn: time });
    addActivity({ plate, action: "Checked In", spot: spotId, time, isIn: true });
  }

  /*
  从当前会话签出，释放车位、清除会话、记录活动。
  Check out from the current active session. Frees the spot and clears the session.
  */
  function checkOut() {
    if (!activeSession) {
      return;
    }
    const time = now();
    const spotId = activeSession.spotId;
    const plate = activeSession.plate;
    // 先释放车位，再清空会话 / free the spot first, then clear session
    setSpotsState(prev => prev.map(s => {
      // 找到对应车位，更新为空闲状态 / find the matching spot and mark it as free
      if (s.id === spotId) {
        return { ...s, status: "free", plate: undefined, checkedIn: undefined };
      } else {
        return s;
      }
    }));
    setActiveSession(null);
    addActivity({ plate, action: "Checked Out", spot: spotId, time, isIn: false });
  }

  // 预计算统计数据，供 Home 页直接使用 / pre-computed statistics for the Home screen
  const freeCount = spots.filter(s => s.status === "free"     && s.type === "normal").length;
  const occCount = spots.filter(s => s.status === "occupied"  && s.type === "normal").length;
  const okuFree = spots.filter(s => s.type   === "oku"       && s.status === "free").length;
  const totalNormal = spots.filter(s => s.type   === "normal").length;
  const okuTotal = spots.filter(s => s.type   === "oku").length;

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