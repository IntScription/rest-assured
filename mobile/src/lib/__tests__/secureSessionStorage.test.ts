const mockSecureStoreState = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreState.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreState.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreState.delete(key);
  }),
}));

// jest.mock above must run before these imports resolve expo-secure-store.
// eslint-disable-next-line import/first
import AsyncStorage from "@react-native-async-storage/async-storage";
// eslint-disable-next-line import/first
import { secureSessionStorage } from "../secureSessionStorage";

const KEY = "sb-znbmrridvdtombbtujnj-auth-token";

beforeEach(async () => {
  mockSecureStoreState.clear();
  await AsyncStorage.clear();
});

describe("secureSessionStorage", () => {
  it("round-trips a small value", async () => {
    await secureSessionStorage.setItem(KEY, "hello");
    expect(await secureSessionStorage.getItem(KEY)).toBe("hello");
  });

  it("round-trips a large session-shaped payload (>2KB)", async () => {
    const fakeSession = JSON.stringify({
      access_token: "a".repeat(1200),
      refresh_token: "b".repeat(400),
      user: { id: "user-1", email: "test@example.com", app_metadata: { note: "c".repeat(800) } },
    });
    expect(fakeSession.length).toBeGreaterThan(2048);

    await secureSessionStorage.setItem(KEY, fakeSession);
    expect(await secureSessionStorage.getItem(KEY)).toBe(fakeSession);
  });

  it("never stores the plaintext value in AsyncStorage", async () => {
    await secureSessionStorage.setItem(KEY, "super-secret-refresh-token");
    const raw = await AsyncStorage.getItem(KEY);
    expect(raw).not.toBe(null);
    expect(raw).not.toContain("super-secret-refresh-token");
  });

  it("returns null when nothing has been stored", async () => {
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it("removeItem clears both the encrypted payload and the key", async () => {
    await secureSessionStorage.setItem(KEY, "hello");
    await secureSessionStorage.removeItem(KEY);

    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it("uses a distinct encryption key per storage key", async () => {
    await secureSessionStorage.setItem("key-a", "value-a");
    await secureSessionStorage.setItem("key-b", "value-b");

    expect(await secureSessionStorage.getItem("key-a")).toBe("value-a");
    expect(await secureSessionStorage.getItem("key-b")).toBe("value-b");
  });
});
