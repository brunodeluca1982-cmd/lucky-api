import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@luckytrip/device_id";

function generateId(): string {
  const arr = new Uint8Array(16);
  for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  arr[6] = (arr[6] & 0x0f) | 0x40;
  arr[8] = (arr[8] & 0x3f) | 0x80;
  return [
    arr.slice(0, 4), arr.slice(4, 6), arr.slice(6, 8),
    arr.slice(8, 10), arr.slice(10, 16),
  ]
    .map((seg) => Array.from(seg).map((b) => b.toString(16).padStart(2, "0")).join(""))
    .join("-");
}

let _cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (_cached) return _cached;
  const stored = await AsyncStorage.getItem(KEY);
  if (stored) {
    _cached = stored;
    return stored;
  }
  const id = generateId();
  await AsyncStorage.setItem(KEY, id);
  _cached = id;
  return id;
}
