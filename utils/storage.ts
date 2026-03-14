/*
utils/storage.ts — 早期遗留工具 / Legacy Storage Utility

用于保存和读取已注册车牌列表到/从 AsyncStorage 的辅助函数。
Simple helpers for saving and loading the registered plates list via AsyncStorage.

注意：此文件为早期遗留工具。
现在应用主要通过 ParkingContext.tsx 中的 "mdis_vehicles" key 来存储车辆数据。

 Note: This is a legacy utility. The main app now stores vehicles inside
 ParkingContext.tsx using the "mdis_vehicles" key.
*/

import AsyncStorage from "@react-native-async-storage/async-storage";

// 车牌列表的存储 Key / storage key for the plates list
const PLATES_KEY = "registered_plates";

/*
将车牌字符串数组保存到 AsyncStorage。
Saves an array of plate strings to AsyncStorage.

@param plates 车牌字符串数组，例如 ["WXY 1234", "JHB 5678"]
              Array of plates e.g. ["WXY 1234", "JHB 5678"]
*/
export async function savePlates(plates: string[]) {
  await AsyncStorage.setItem(PLATES_KEY, JSON.stringify(plates));
}

/*
从 AsyncStorage 读取车牌数组。
Loads the plates array from AsyncStorage.

@returns 车牌数组，如果未保存则返回空数组。
         Array of plates, or empty array if nothing is saved.
*/
export async function loadPlates(): Promise<string[]> {
  const data = await AsyncStorage.getItem(PLATES_KEY);
  return data ? JSON.parse(data) : [];
}

export default {};