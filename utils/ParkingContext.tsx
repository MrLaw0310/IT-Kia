/*
utils/ParkingContext.tsx — 全局停车状态管理器 / Global Parking State Manager

使用 React Context 管理整个停车应用的共享数据。
Manages all shared parking data via React Context.

数据存储策略 / Data storage strategy:
  - spots（停车格子状态）→ Firestore 实时同步，所有用户看到同一份数据
    spots (spot statuses) → Firestore real-time sync, all users see the same data
  - vehicles / session / activity → AsyncStorage 本地存储（待 Auth 完成后迁移）
    vehicles / session / activity → AsyncStorage local (to be migrated after Auth)

主要功能 / Key features:
  - 存储并持久化所有停车数据（车辆、车位、会话、活动记录）
    Stores and persists all parking data (vehicles, spots, session, activity)
  - 提供 Home 和 Map 两个页面共用的停车位格子数据
    Provides the parking spots grid shared by Home and Map screens
  - 处理签入/签出逻辑 | handles Check In / Check Out logic
  - 暴露预计算统计数据，各页面无需自己计算
    Exposes pre-calculated statistics so screens don't recompute them

⚠️  修改停车场布局后，必须更新 LAYOUT_VERSION，否则 App 继续加载旧布局。
⚠️  After editing generateSpots(), always bump LAYOUT_VERSION to clear the cache.

  如何修改停车场布局 / How to change the parking layout:
  1. 修改 generateSpots() 里的 addRow() 调用 / edit addRow() calls in generateSpots()
  2. 一个 group = 格子全连，无通道 / one group = all spots connected, no aisle
     两个 group = map.tsx 在两组之间渲染通道 / two groups = map.tsx renders an aisle
  3. 修改后必须更新 LAYOUT_VERSION (e.g. "v3" → "v4")
     Always bump LAYOUT_VERSION after any change here
*/

import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDocs, onSnapshot, writeBatch } from "firebase/firestore";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { db } from "./firebaseConfig";

// ─── Type Definitions (类型定义) ─────────────────────────────────────────────

/* 用户名下一辆注册车辆 / one registered vehicle belonging to the user */
export interface Vehicle {
  id: string;       // 唯一标识符 / unique ID
  plate: string;    // 车牌号，例如 "WXY 1234" / license plate
  model: string;    // 车型描述，例如 "Honda Civic (White)" / car model description
  isPaid: boolean;  // 是否已缴年费 / whether annual fee is paid
  isOKU: boolean;   // 是否有 OKU 停车权限 / whether this vehicle has OKU parking rights
}

/* 一条签入或签出事件记录 / one check-in or check-out event record */
export interface ActivityItem {
  id: string;                             // 唯一标识符 / unique ID
  plate: string;                          // 车牌号 / license plate
  action: "Checked In" | "Checked Out";  // 事件类型 / event type
  spot: string;                           // 车位编号，例如 "R1-3" / spot ID
  time: string;                           // 时间字符串，例如 "09:30 AM" / time string
  isIn: boolean;                          // true=签入, false=签出 / true = check-in
}

/* 当前进行中的停车会话（同时只有一个）/ the currently active parking session */
export interface ActiveSession {
  spotId: string;    // 占用的车位 ID / which spot is occupied
  plate: string;     // 使用该车位的车牌 / whose plate
  checkedIn: string; // 签入时间 / time of check-in
}

/* 车位是否空闲 / whether a spot is free or occupied */
export type SpotStatus = "free" | "occupied";

/* 普通位还是 OKU 专用位 / whether a spot is normal or OKU reserved */
export type SpotType = "normal" | "oku";

/* 完整停车场布局中的单个停车位 / a single parking spot in the full lot layout */
export interface ParkingSpot {
  id: string;           // 车位编号，例如 "R1-5" 或 "OKU-1" / spot ID
  row: number;          // 全局行索引 0~13 / global row index
  col: number;          // 行内列索引 / column index within row
  status: SpotStatus;   // free 或 occupied / free or occupied
  type: SpotType;       // normal 或 oku / normal or OKU
  section: string;      // 区域 ID，例如 "S1","S2","SR" — 用于分组渲染 / section ID for grouped rendering
  group: number;        // 行内子组：0=左侧/唯一组，1=右侧组（有通道时）/ sub-group: 0=left or only, 1=right
  plate?: string;       // 占用时的车牌（可选）/ license plate when occupied
  checkedIn?: string;   // 占用时的签入时间（可选）/ check-in time when occupied
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

⚠️  修改后必须更新 LAYOUT_VERSION，否则缓存仍会加载旧布局！
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
          id:      spotId,
          row:     globalRow,
          col,
          status:  "free",
          type:    groups[g].type,
          section,
          group:   g, // 0=左/唯一子组，1=右子组 / 0=left or only cluster, 1=right cluster
        });
        col++;
      }
    }
    globalRow++;
  }

  // 行定义 — 修改格数后记得更新 LAYOUT_VERSION / row definitions — bump LAYOUT_VERSION after edits
  addRow("S1", [{ type: "oku",    count: 2  }, { type: "normal", count: 13 }]); // Row 1:  2 OKU + 13 (独立行)
  addRow("S2", [{ type: "normal", count: 3  }, { type: "normal", count: 17 }]); // Row 2:  3 | aisle | 17 ┐ 背靠背
  addRow("S2", [{ type: "normal", count: 3  }, { type: "normal", count: 15 }]); // Row 3:  3 | aisle | 15 ┘
  addRow("S3", [{ type: "normal", count: 18 }]);                                 // Row 4:  18 ┐ 背靠背
  addRow("S3", [{ type: "normal", count: 18 }]);                                 // Row 5:  18 ┘
  addRow("S4", [{ type: "normal", count: 18 }]);                                 // Row 6:  18 ┐
  addRow("S4", [{ type: "normal", count: 18 }]);                                 // Row 7:  18 ┘
  addRow("S5", [{ type: "normal", count: 18 }]);                                 // Row 8:  18 ┐
  addRow("S5", [{ type: "normal", count: 18 }]);                                 // Row 9:  18 ┘
  addRow("S6", [{ type: "normal", count: 3  }, { type: "normal", count: 15 }]); // Row 10: 3 | aisle | 15 ┐ 有通道
  addRow("S6", [{ type: "normal", count: 3  }, { type: "normal", count: 17 }]); // Row 11: 3 | aisle | 17 ┘
  addRow("S7", [{ type: "normal", count: 23 }]);                                 // Row 12: 23 (独立行)
  addRow("SR", [{ type: "normal", count: 20 }]);                                 // Side:   20 (右侧竖排)

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
  checkIn: (spotId: string, plate: string) => void;  // 开始停车 / start a session
  checkOut: () => void;                               // 结束停车 / end the session

  // 活动记录日志 / activity log
  activity: ActivityItem[];
  addActivity: (item: Omit<ActivityItem, "id">) => void;

  // 首页直接使用的预计算统计数据 / pre-calculated statistics for Home screen
  freeCount:   number; // 普通空位数 / free normal spots
  occCount:    number; // 普通占用数 / occupied normal spots
  okuFree:     number; // OKU 空位数 / free OKU spots
  totalNormal: number; // 普通位总数 / total normal spots
  okuTotal:    number; // OKU 位总数 / total OKU spots
}

// ─── AsyncStorage Keys (持久化存储 Key 名) ───────────────────────────────────
// spots 已迁移到 Firestore，以下 Key 仅用于用户相关本地数据
// spots moved to Firestore; these keys are for local user data only
const VEHICLES_KEY = "mdis_vehicles"; // 注册车辆列表 / registered vehicles
const SESSION_KEY  = "mdis_session";  // 当前停车会话 / active session
const ACTIVITY_KEY = "mdis_activity"; // 活动记录 / activity log

// ─── Firestore Collection (Firestore 集合名) ──────────────────────────────────
const SPOTS_COLLECTION = "parking_spots"; // Firestore 停车格子集合 / Firestore spots collection

// ─── Layout Version (布局版本号) ──────────────────────────────────────────────
// ⚠️  每次修改 generateSpots()（增减行、增减格数），必须修改此字符串（例如 "v3" → "v4"）。
//     这样 Firestore 会丢弃旧数据，重新生成新布局。不修改此值会导致 App 显示旧布局！
// ⚠️  Whenever you change generateSpots(), bump this string (e.g. "v3" → "v4").
//     This forces Firestore to discard the old data and seed the new layout.
const LAYOUT_VERSION = "v3";
const LAYOUT_VERSION_KEY = "mdis_layout_version"; // 存在 AsyncStorage，记录当前版本 / stored in AsyncStorage

/* 首次启动时加载的默认演示车辆 / default demo vehicles loaded on first launch */
const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "1", plate: "WXY 1234", model: "Honda Civic (White)", isPaid: true,  isOKU: false },
  { id: "2", plate: "JHB 5678", model: "Toyota Vios (Silver)", isPaid: false, isOKU: false },
];

// ─── Context 初始值 / Context default value ──────────────────────────────────
const ParkingContext = createContext<ParkingContextType | null>(null);

/*
useParkingContext — 读取 ParkingContext 的自定义 Hook。
Custom hook to read ParkingContext.

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

// ─── Firestore helpers (Firestore 辅助函数) ───────────────────────────────────

/*
将 generateSpots() 生成的所有格子批量写入 Firestore。
Seeds Firestore with all spots generated by generateSpots().

使用 Firestore writeBatch 批量写入，避免 242 次单独请求。
Uses writeBatch to write all 242 spots in one go instead of 242 separate requests.
*/
async function seedSpotsToFirestore(spots: ParkingSpot[]) {
  // Firestore 每批最多 500 次操作，242 格子远低于上限，一批即可完成
  // Firestore batch limit is 500 ops; 242 spots is well within that — one batch is enough
  const batch = writeBatch(db);
  for (const spot of spots) {
    const ref = doc(db, SPOTS_COLLECTION, spot.id);
    batch.set(ref, spot);
  }
  await batch.commit();
}

/*
ParkingProvider — 将整个 App 包裹在此 Provider 中，以启用全局停车状态共享。
Wrap the entire app with this to enable shared parking state.

放置位置 / Place in: app/_layout.tsx → <ParkingProvider>...</ParkingProvider>
*/
export function ParkingProvider({ children }: { children: ReactNode }) {

  const [vehicles,      setVehiclesState] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [spots,         setSpotsState]    = useState<ParkingSpot[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activity,      setActivity]      = useState<ActivityItem[]>([]);
  const [loaded,        setLoaded]        = useState(false); // 本地数据是否已从 AsyncStorage 读取完毕 / whether local data is loaded

  // ─── 启动时从 AsyncStorage 读取本地数据 / Load local data from AsyncStorage on start ───
  useEffect(() => {
    async function loadLocal() {
      try {
        const [v, s, a] = await Promise.all([
          AsyncStorage.getItem(VEHICLES_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(ACTIVITY_KEY),
        ]);
        if (v) { setVehiclesState(JSON.parse(v)); }
        if (s) { setActiveSession(JSON.parse(s)); }
        if (a) { setActivity(JSON.parse(a)); }
      } catch {}
      setLoaded(true); // 无论是否出错都标记为已读取 / mark as loaded regardless of errors
    }
    loadLocal();
  }, []);

  // ─── Firestore 实时监听停车格子 / Firestore real-time listener for parking spots ───
  useEffect(() => {
    async function initSpots() {
      try {
        // 检查 Firestore 里是否已有格子数据，以及版本是否一致
        // Check if Firestore already has spot data and whether the version matches
        const snapshot = await getDocs(collection(db, SPOTS_COLLECTION));
        const savedVersion = await AsyncStorage.getItem(LAYOUT_VERSION_KEY);
        const versionOK = savedVersion === LAYOUT_VERSION;
        const hasData   = !snapshot.empty;

        if (!hasData || !versionOK) {
          // 首次启动或布局版本变更 → 重新生成格子并写入 Firestore
          // First launch or layout version changed → regenerate and seed Firestore
          const freshSpots = generateSpots();
          await seedSpotsToFirestore(freshSpots);
          await AsyncStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
        }
      } catch (e) {
        // Firestore 初始化失败时，回退到本地生成的格子数据
        // If Firestore init fails, fall back to locally generated spots
        setSpotsState(generateSpots());
        return;
      }

      // 订阅 Firestore 实时更新，任何用户签入/签出时自动更新所有客户端
      // Subscribe to Firestore real-time updates — auto-updates all clients on any check-in/out
      const unsubscribe = onSnapshot(
        collection(db, SPOTS_COLLECTION),
        (snapshot) => {
          const updatedSpots: ParkingSpot[] = [];
          snapshot.forEach((docSnap) => {
            updatedSpots.push(docSnap.data() as ParkingSpot);
          });
          // 按 row 再按 col 排序，确保格子顺序一致 / sort by row then col for consistent order
          updatedSpots.sort((a, b) => {
            if (a.row !== b.row) { return a.row - b.row; }
            return a.col - b.col;
          });
          setSpotsState(updatedSpots);
        },
        (error) => {
          // 监听出错时回退到本地数据 / fall back to local data if listener fails
          console.warn("Firestore listener error:", error);
        }
      );

      // 组件卸载时取消订阅，防止内存泄漏 / unsubscribe on unmount to prevent memory leaks
      return unsubscribe;
    }

    initSpots();
  }, []);

  // ─── 将本地 state 变化持久化到 AsyncStorage ──────────────────────────────────
  // 只在初始读取完成后执行，避免用默认值覆盖已保存数据
  // Only run after initial load to avoid overwriting saved data with defaults

  useEffect(() => {
    if (!loaded) { return; }
    AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles)).catch(() => {});
  }, [vehicles, loaded]);

  useEffect(() => {
    if (!loaded) { return; }
    if (activeSession) {
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(activeSession)).catch(() => {});
    } else {
      AsyncStorage.removeItem(SESSION_KEY).catch(() => {}); // 无会话时清除 / clear when no session
    }
  }, [activeSession, loaded]);

  useEffect(() => {
    if (!loaded) { return; }
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
  注意：spots 现在由 Firestore 驱动，直接调用此函数不会同步到 Firestore。
  Note: spots are now Firestore-driven; calling this won't sync to Firestore.
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
  签入到指定车位，同时更新 Firestore 和本地 state。
  Check in to a spot — writes to Firestore and updates local state.

  Firestore 更新会通过 onSnapshot 自动广播给所有客户端，
  本地 state 也同步更新确保当前用户界面立即响应。
  The Firestore write is broadcast to all clients via onSnapshot.
  Local state is also updated immediately so the current user's UI responds instantly.
  */
  function checkIn(spotId: string, plate: string) {
    const time = now();

    // 更新 Firestore 中的格子状态 / update spot status in Firestore
    const spotRef = doc(db, SPOTS_COLLECTION, spotId);
    const batch = writeBatch(db);
    batch.update(spotRef, {
      status:    "occupied",
      plate:     plate,
      checkedIn: time,
    });
    batch.commit().catch((e) => console.warn("Firestore checkIn error:", e));

    // 同时更新本地 session 和 activity（不需要等 Firestore 回调）
    // Also update local session and activity (no need to wait for Firestore)
    setActiveSession({ spotId, plate, checkedIn: time });
    addActivity({ plate, action: "Checked In", spot: spotId, time, isIn: true });
  }

  /*
  从当前会话签出，释放 Firestore 中的格子，清除本地会话。
  Check out — frees the spot in Firestore and clears the local session.
  */
  function checkOut() {
    if (!activeSession) { return; }
    const time   = now();
    const spotId = activeSession.spotId;
    const plate  = activeSession.plate;

    // 更新 Firestore，将格子状态改回空闲 / update Firestore to mark spot as free
    const spotRef = doc(db, SPOTS_COLLECTION, spotId);
    const batch = writeBatch(db);
    batch.update(spotRef, {
      status:    "free",
      plate:     null,
      checkedIn: null,
    });
    batch.commit().catch((e) => console.warn("Firestore checkOut error:", e));

    // 清除本地会话，记录活动日志 / clear local session and log activity
    setActiveSession(null);
    addActivity({ plate, action: "Checked Out", spot: spotId, time, isIn: false });
  }

  // 预计算统计数据，供 Home 页直接使用 / pre-computed statistics for the Home screen
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