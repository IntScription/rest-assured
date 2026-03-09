import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "ra-cache:v1:";

export function cacheKey(parts: Array<string | number | null | undefined>) {
  return PREFIX + parts.filter((p) => p !== null && p !== undefined).join(":");
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

