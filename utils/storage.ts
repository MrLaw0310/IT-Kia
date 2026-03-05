// utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function savePlates(plates: string[]) {
  await AsyncStorage.setItem("registered_plates", JSON.stringify(plates));
}

export async function loadPlates(): Promise<string[]> {
  const data = await AsyncStorage.getItem("registered_plates");
  return data ? JSON.parse(data) : [];
}
export default {};