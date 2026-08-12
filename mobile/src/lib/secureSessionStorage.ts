import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as aesjs from "aes-js";

/**
 * Supabase auth sessions (access + refresh token, user metadata) can exceed
 * SecureStore/Keychain-friendly sizes, especially on Android. The standard
 * pattern (per Supabase's own Expo guidance) is: generate a random AES key
 * per storage key, keep that small key in SecureStore, and store the actual
 * (encrypted, size-unconstrained) session payload in AsyncStorage.
 */
function encrypt(encryptionKey: Uint8Array, value: string) {
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  return aesjs.utils.hex.fromBytes(encryptedBytes);
}

function decrypt(encryptionKey: Uint8Array, value: string) {
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;

    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;

    return decrypt(aesjs.utils.hex.toBytes(encryptionKeyHex), encrypted);
  },

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = Crypto.getRandomValues(new Uint8Array(32));
    const encrypted = encrypt(encryptionKey, value);

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    await AsyncStorage.setItem(key, encrypted);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};
