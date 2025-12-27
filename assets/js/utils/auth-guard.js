import { auth, db } from '../firebase/config.js';
import { authService } from '../firebase/auth-service.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

export function initAuthGuard(options = { requireAdmin: false, preventLoginAccess: false }) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            if (!options.preventLoginAccess) window.location.href = 'login.html';
            return;
        }

        try {
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (!userSnap.exists()) {
                await auth.signOut();
                window.location.href = 'login.html';
                return;
            }

            const userData = userSnap.data();
            // --- UPDATE UI BERDASARKAN ROLE ---
            const adminLink = document.getElementById('navAdminLink');
            if (adminLink) {
                if (userData.role === 'admin') {
                    adminLink.classList.remove('hidden');
                    adminLink.classList.add('flex');
                } else {
                    adminLink.remove();
                }
            }

            // --- SETUP LOGOUT BUTTON ---
            const btnLogout = document.getElementById('btnLogout');
            if (btnLogout) {
                // Hapus event listener lama (clone node) untuk mencegah double click event
                const newBtn = btnLogout.cloneNode(true);
                btnLogout.parentNode.replaceChild(newBtn, btnLogout);
                
                newBtn.addEventListener('click', async () => {
                    if(confirm('Yakin ingin keluar?')) {
                        await authService.logout();
                    }
                });
            }
            
            // Redirect jika di halaman login tapi sudah authenticated
            if (options.preventLoginAccess) {
                window.location.href = userData.role === 'admin' ? 'admin.html' : 'index.html';
                return;
            }

            // Blokir jika belum verifikasi (Kecuali Admin)
            if (!userData.isVerified && userData.role !== 'admin') {
                alert("Akun belum diverifikasi Admin."); // Gunakan alert agar blocking
                await auth.signOut();
                window.location.href = 'login.html';
                return;
            }

            // Blokir akses halaman Admin untuk user biasa
            if (options.requireAdmin && userData.role !== 'admin') {
                window.location.href = 'index.html';
                return;
            }

            // Log sukses opsional
            // console.log("Authorized as:", userData.role);

        } catch (error) {
            console.error("Auth Guard Error:", error);
        }
    });
}