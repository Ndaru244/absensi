import { auth, db } from "./config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

export const authService = {
  waitForAuth() {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  async loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const newUserData = {
          uid: user.uid,
          nama: user.displayName,
          email: user.email,
          photo: user.photoURL,
          role: "viewer",
          isVerified: false,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newUserData);
        return newUserData;
      }
      return userSnap.data();
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  },

  // PERBAIKAN DI SINI: Hapus kata 'function'
  async updateProfileData(uid, data) {
    try {
      const userRef = doc(db, "users", uid);

      // Menyiapkan data yang aman untuk di-update
      const safeData = {
        nama: data.nama,
        nip: data.nip || "-", // Default strip jika kosong
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(userRef, safeData);
      return { success: true };
    } catch (error) {
      console.error("Update Profile Error:", error);
      throw error;
    }
  },

  async logout() {
    await signOut(auth);
    window.location.href = "login.html";
  },
};
