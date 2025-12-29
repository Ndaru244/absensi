import { auth } from '../firebase/config.js';
import { authService } from '../firebase/auth-service.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Track if guard already initialized to prevent duplicate checks
let isInitialized = false;

export function initAuthGuard(options = { requireAdmin: false, preventLoginAccess: false }) {
    // Prevent duplicate initialization
    if (isInitialized) {
        console.log('Auth guard already initialized');
        return;
    }
    isInitialized = true;

    onAuthStateChanged(auth, async (user) => {
        const isLoginPage = window.location.pathname.includes('login.html');
        
        // Not logged in
        if (!user) {
            if (!isLoginPage) {
                window.location.href = 'login.html';
            }
            return;
        }

        // OPTIMIZED: Use cached user data instead of Firestore query
        try {
            let userData = await authService.getUserData(user.uid, true); // useCache = true
            
            if (!userData) {
                console.warn('User data not found, waiting for Firestore sync...');
                await new Promise(resolve => setTimeout(resolve, 500));
                userData = await authService.getUserData(user.uid, false); // Force fresh read
            }
            if (!userData) {
                console.error('User data still not found after retry, logging out...');
                await auth.signOut();
                if (!isLoginPage) window.location.href = 'login.html';
                return;
            }

            // Handle login page access for authenticated users
            if (isLoginPage && options.preventLoginAccess) {
                if (userData.isVerified || userData.role === 'admin') {
                    window.location.replace(userData.role === 'admin' ? 'admin.html' : 'index.html');
                }
                return;
            }

            // --- UPDATE UI BASED ON ROLE ---
            updateAdminUI(userData.role);

            // Redirect if on login page but already authenticated
            if (options.preventLoginAccess) {
                window.location.href = userData.role === 'admin' ? 'admin.html' : 'index.html';
                return;
            }

            // Block unverified users (except admins)
            if (!userData.isVerified && userData.role !== 'admin') {
                alert("Akun belum diverifikasi Admin.");
                await auth.signOut();
                window.location.href = 'login.html';
                return;
            }

            // Block non-admin access to admin pages
            if (options.requireAdmin && userData.role !== 'admin') {
                window.location.href = 'index.html';
                return;
            }

        } catch (error) {
            console.error("Auth Guard Error:", error);
            // On error, fallback to logout for security
            await auth.signOut();
            window.location.href = 'login.html';
        }
    });
}

// Helper: Update admin link visibility
function updateAdminUI(role) {
    // Handle both single link and class-based links
    const adminLink = document.getElementById('navAdminLink');
    const adminOnlyElements = document.querySelectorAll('.admin-only');

    if (role === 'admin') {
        // Show single admin link
        if (adminLink) {
            adminLink.classList.remove('hidden');
            adminLink.classList.add('flex');
        }
        
        // Show all admin-only elements
        adminOnlyElements.forEach(el => {
            el.classList.remove('hidden');
            el.classList.add('flex');
        });
    } else {
        // Remove admin elements for non-admins
        if (adminLink) {
            adminLink.remove();
        }
        adminOnlyElements.forEach(el => el.remove());
    }
}

// Export helper to check auth status without redirect
export async function checkAuthStatus() {
    const user = auth.currentUser;
    if (!user) return null;

    try {
        const userData = await authService.getUserData(user.uid, true);
        return userData;
    } catch (error) {
        console.error('Check auth status error:', error);
        return null;
    }
}