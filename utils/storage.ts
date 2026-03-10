// ═══════════════════════════════════════════════════════════════════════════════
// FILE: utils/storage.ts
//
// PURPOSE (用途):
//   Simple helper functions for saving and loading the registered plates list
//   to/from AsyncStorage.
//   用于保存和读取已注册车牌列表到/从 AsyncStorage 的简单辅助函数。
//
// NOTE (注意):
//   This file is a legacy/early utility. The main app now stores vehicles
//   inside ParkingContext (ParkingContext.tsx) using the "mdis_vehicles" key.
//   此文件是早期遗留工具。现在应用主要通过 ParkingContext.tsx 中的
//   "mdis_vehicles" key 来存储车辆数据。
//
// IMPORTS (引入):
//   - AsyncStorage from @react-native-async-storage/async-storage
//     (本地持久化存储库)
//
// EXPORTS (导出):
//   - savePlates(plates)  → async function: saves string[] to AsyncStorage
//                           (异步函数：将字符串数组保存到 AsyncStorage)
//   - loadPlates()        → async function: loads string[] from AsyncStorage
//                           (异步函数：从 AsyncStorage 读取字符串数组)
//   - default {}          → empty default export (空的默认导出)
// ═══════════════════════════════════════════════════════════════════════════════

import AsyncStorage from "@react-native-async-storage/async-storage";

// Storage key for the plates list (车牌列表的存储 Key)
const PLATES_KEY = "registered_plates";

/*
   Save an array of plate strings to AsyncStorage.
   将车牌字符串数组保存到 AsyncStorage。
  
   @param plates  Array of plate strings e.g. ["WXY 1234", "JHB 5678"]
    车牌字符串数组，例如 ["WXY 1234", "JHB 5678"]
*/
export async function savePlates(plates: string[]) {
  await AsyncStorage.setItem(PLATES_KEY, JSON.stringify(plates));
}

/*
   Load the plates array from AsyncStorage.
   从 AsyncStorage 读取车牌数组。
  
   @returns  Array of plates, or empty array if nothing is saved.
    车牌数组，如果未保存则返回空数组。
*/
export async function loadPlates(): Promise<string[]> {
  const data = await AsyncStorage.getItem(PLATES_KEY);
  return data ? JSON.parse(data) : [];
}

export default {};