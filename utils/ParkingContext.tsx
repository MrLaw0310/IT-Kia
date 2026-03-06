import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

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

interface ParkingContextType {
  vehicles:      Vehicle[];
  setVehicles:   (v: Vehicle[]) => void;
  activeSession: ActiveSession | null;
  checkIn:       (spotId: string, plate: string) => void;
  checkOut:      () => void;
  activity:      ActivityItem[];
  addActivity:   (item: Omit<ActivityItem, "id">) => void;
}

const VEHICLES_KEY = "mdis_vehicles";
const SESSION_KEY  = "mdis_session";
const ACTIVITY_KEY = "mdis_activity";

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

export function ParkingProvider({ children }: { children: ReactNode }) {
  const [vehicles,      setVehiclesState] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activity,      setActivity]      = useState<ActivityItem[]>([]);
  const [loaded,        setLoaded]        = useState(false);

  // ── 启动时从 AsyncStorage 读取数据 ──
  useEffect(() => {
    async function load() {
      try {
        const [v, s, a] = await Promise.all([
          AsyncStorage.getItem(VEHICLES_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(ACTIVITY_KEY),
        ]);
        if (v) setVehiclesState(JSON.parse(v));
        if (s) setActiveSession(JSON.parse(s));
        if (a) setActivity(JSON.parse(a));
      } catch {}
      setLoaded(true);
    }
    load();
  }, []);

  // ── 每次 vehicles 变化就保存 ──
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles)).catch(() => {});
  }, [vehicles, loaded]);

  // ── 每次 activeSession 变化就保存 ──
  useEffect(() => {
    if (!loaded) return;
    if (activeSession) {
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(activeSession)).catch(() => {});
    } else {
      AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    }
  }, [activeSession, loaded]);

  // ── 每次 activity 变化就保存 ──
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)).catch(() => {});
  }, [activity, loaded]);

  function setVehicles(v: Vehicle[]) {
    setVehiclesState(v);
  }

  function now() {
    return new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  }

  function addActivity(item: Omit<ActivityItem, "id">) {
    setActivity(prev => [{ ...item, id: Date.now().toString() }, ...prev].slice(0, 20));
  }

  function checkIn(spotId: string, plate: string) {
    const time = now();
    setActiveSession({ spotId, plate, checkedIn: time });
    addActivity({ plate, action: "Checked In", spot: spotId, time, isIn: true });
  }

  function checkOut() {
    if (!activeSession) return;
    const time = now();
    addActivity({ plate: activeSession.plate, action: "Checked Out", spot: activeSession.spotId, time, isIn: false });
    setActiveSession(null);
  }

  return (
    <ParkingContext.Provider value={{ vehicles, setVehicles, activeSession, checkIn, checkOut, activity, addActivity }}>
      {children}
    </ParkingContext.Provider>
  );
}