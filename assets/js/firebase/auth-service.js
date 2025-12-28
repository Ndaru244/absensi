import { auth, db } from './config.js';
import { GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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
                    role: 'viewer',
                    isVerified: false,
                    createdAt: new Date().toISOString()
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

    async logout() {
        await signOut(auth);
        window.location.href = 'login.html';
    }
};