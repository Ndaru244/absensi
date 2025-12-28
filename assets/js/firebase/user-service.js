import { db } from "./config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ===== USER CACHE MANAGER =====
const UserCache = {
  PREFIX: "users_",
  CACHE_KEY: "users_list",
  TTL: 1000 * 60 * 5, // 5 menit

  set(data) {
    try {
      localStorage.setItem(
        this.PREFIX + this.CACHE_KEY,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
    } catch (e) {
      console.warn("Failed to cache users:", e);
    }
  },

  get() {
    try {
      const raw = localStorage.getItem(this.PREFIX + this.CACHE_KEY);
      if (!raw) return null;

      const item = JSON.parse(raw);
      const age = Date.now() - item.timestamp;

      // Cache valid selama TTL
      if (age > this.TTL) {
        this.clear();
        return null;
      }

      return item.data;
    } catch {
      return null;
    }
  },

  clear() {
    localStorage.removeItem(this.PREFIX + this.CACHE_KEY);
  },
};

// ===== USER SERVICE =====
export const userService = {
  _snapshot: null, // Menyimpan unsubscribe function

  // 1. GET USERS (Initial Load dengan Cache)
  async getUsers(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = UserCache.get();
      if (cached) {
        console.log("✅ Users loaded from cache");
        return cached;
      }
    }

    console.log("🔄 Fetching users from Firebase...");
    const snap = await getDocs(collection(db, "users"));
    const users = [];

    snap.forEach((docSnap) => {
      users.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

    UserCache.set(users);
    return users;
  },

  // 2. SETUP REALTIME LISTENER (Dengan Initial Cache)
  setupRealtimeListener(callback) {
    // Cleanup listener lama jika ada
    if (this._snapshot) {
      this._snapshot();
    }

    const usersRef = collection(db, "users");
    let isInitialLoad = true;

    this._snapshot = onSnapshot(
      usersRef,
      (snapshot) => {
        // OPTIMASI: Gunakan cache untuk initial load
        if (isInitialLoad) {
          const cached = UserCache.get();
          if (cached) {
            console.log("✅ Initial load from cache, waiting for changes...");
            callback(cached, true); // true = dari cache
            isInitialLoad = false;
            return;
          }
        }

        // Proses data dari snapshot
        const users = [];
        snapshot.forEach((docSnap) => {
          users.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });

        // Update cache
        UserCache.set(users);

        // Callback dengan data baru
        callback(users, false); // false = dari Firebase
        isInitialLoad = false;
      },
      (error) => {
        console.error("Realtime listener error:", error);
      }
    );

    return this._snapshot; // Return unsubscribe function
  },

  // 3. UPDATE USER STATUS
  async updateUserStatus(userId, isVerified) {
    await updateDoc(doc(db, "users", userId), { isVerified });
    // Cache akan otomatis update via onSnapshot
  },

  // 4. TOGGLE USER ROLE
  async toggleUserRole(userId, currentRole) {
    const newRole = currentRole === "admin" ? "viewer" : "admin";
    await updateDoc(doc(db, "users", userId), { role: newRole });
    return newRole;
  },

  // 5. DELETE USER
  async deleteUser(userId) {
    await deleteDoc(doc(db, "users", userId));
    // Cache akan otomatis update via onSnapshot
  },

  // 6. STOP LISTENER
  stopListener() {
    if (this._snapshot) {
      this._snapshot();
      this._snapshot = null;
    }
  },
};

export { UserCache };
