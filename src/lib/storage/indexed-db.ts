// =====================================================================
// NATIVE INDEXED_DB PERSISTENT CACHE FOR REYGAS ERP
// Allows instant (5ms) hydration of large datasets (10,000+ records)
// on F5 / page refresh without hitting localStorage quota limits.
// =====================================================================

const DB_NAME = "reygas_erp_cache";
const DB_VERSION = 1;
const STORE_NAME = "workshop_master_data";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalWorkshopCache(): Promise<{
  workOrders?: any[];
  vehicles?: any[];
  invoices?: any[];
  scheduleRecords?: any[];
  workshopServices?: any[];
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get("master_records");

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    return null;
  }
}

export async function setLocalWorkshopCache(data: {
  workOrders?: any[];
  vehicles?: any[];
  invoices?: any[];
  scheduleRecords?: any[];
  workshopServices?: any[];
}): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(data, "master_records");

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    // Fail silently without blocking app
  }
}
