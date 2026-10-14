/** In-memory stand-in for expo-sqlite/kv-store in logic tests. */
const data = new Map<string, string>();

const Storage = {
  getItemSync: (k: string) => data.get(k) ?? null,
  setItemSync: (k: string, v: string) => void data.set(k, v),
  removeItemSync: (k: string) => void data.delete(k),
  getItem: async (k: string) => data.get(k) ?? null,
  setItem: async (k: string, v: string) => void data.set(k, v),
  removeItem: async (k: string) => void data.delete(k),
};

export default Storage;
