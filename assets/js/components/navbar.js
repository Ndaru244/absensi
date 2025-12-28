import { profileService } from '../firebase/profile-service.js';
import { authService } from '../firebase/auth-service.js';

// ===== NAVBAR COMPONENT =====
export async function initNavbarProfile() {
    try {
        // TUNGGU: Jangan panggil profile sebelum Auth siap
        const user = await authService.waitForAuth();

        if (!user) return renderFallbackProfile();

        const profile = await profileService.getCurrentUserProfile();
        renderProfileButton(profile);
        renderMobileProfile(profile);
        setupProfileDropdown();
    } catch (error) {
        console.error('Failed to load profile:', error);
        renderFallbackProfile();
    }
}

// Render Profile Button
function renderProfileButton(profile) {
    const profileContainer = document.getElementById('navbar-profile');
    if (!profileContainer) return;

    const avatarUrl = profileService.getAvatarUrl(profile);
    const displayName = profileService.getDisplayName(profile);
    const role = profile.role || 'viewer';
    const roleLabel = role === 'admin' ? 'Admin' : 'Viewer';
    const roleBadge = role === 'admin'
        ? 'bg-purple-100 text-purple-700 border-purple-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';

    profileContainer.innerHTML = `
        <div class="relative">
            <button id="profile-dropdown-btn" 
                    class="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-2 py-1.5 transition-all group">
                <img src="${avatarUrl}" 
                     alt="${displayName}"
                     class="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 group-hover:border-indigo-400 transition">
                <div class="hidden md:flex flex-col items-start">
                    <span class="text-sm font-bold text-gray-800 dark:text-white">${displayName}</span>
                    <span class="text-[10px] font-medium ${roleBadge} px-1.5 py-0.5 rounded border">${roleLabel}</span>
                </div>
                <i data-lucide="chevron-down" class="hidden md:block w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition"></i>
            </button>
            
            <!-- Dropdown Menu -->
            <div id="profile-dropdown" 
                 class="hidden absolute right-0 mt-2 w-72 bg-white dark:bg-darkcard rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                
                <!-- Profile Header -->
                <div class="px-4 py-3 border-b dark:border-gray-700">
                    <div class="flex items-center gap-3">
                        <img src="${avatarUrl}" 
                             alt="${displayName}"
                             class="w-12 h-12 rounded-full object-cover border-2 border-indigo-400">
                        <div class="flex-1">
                            <p class="font-bold text-gray-900 dark:text-white">${displayName}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${profile.email}</p>
                            <span class="inline-flex items-center gap-1 mt-1 text-[10px] font-bold ${roleBadge} px-2 py-0.5 rounded border">
                                <i data-lucide="${role === 'admin' ? 'crown' : 'user'}" class="w-3 h-3"></i>
                                ${roleLabel.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Menu Items -->
                <div class="py-1">
                    <button onclick="window.refreshProfile()" 
                            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition">
                        <i data-lucide="refresh-cw" class="w-4 h-4 text-gray-400"></i>
                        Refresh Profile
                    </button>
                    
                    <button onclick="window.toggleTheme()" 
                            class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition">
                        <i data-lucide="sun-moon" class="w-4 h-4 text-gray-400"></i>
                        Ganti Tema
                    </button>
                    
                    <div class="border-t dark:border-gray-700 my-1"></div>
                    
                    <button onclick="window.handleLogout()" 
                            class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition font-medium">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                        Keluar
                    </button>
                </div>
            </div>
        </div>
    `;

    // Re-render lucide icons
    if (window.lucide) {
        window.lucide.createIcons({ root: profileContainer });
    }
}

// Setup Dropdown Toggle
function setupProfileDropdown() {
    const btn = document.getElementById('profile-dropdown-btn');
    const dropdown = document.getElementById('profile-dropdown');

    if (!btn || !dropdown) return;

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdown.classList.add('hidden');
        }
    });
}

// Render Mobile Profile
function renderMobileProfile(profile) {
    const mobileContainer = document.getElementById('navbar-profile-mobile');
    if (!mobileContainer) return;

    const avatarUrl = profileService.getAvatarUrl(profile);
    const displayName = profileService.getDisplayName(profile);
    const role = profile.role || 'viewer';
    const roleLabel = role === 'admin' ? 'Admin' : 'Viewer';
    const roleBadge = role === 'admin'
        ? 'bg-purple-100 text-purple-700 border-purple-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';

    mobileContainer.innerHTML = `
        <div class="flex items-center gap-3">
            <img src="${avatarUrl}" 
                 alt="${displayName}"
                 class="w-12 h-12 rounded-full object-cover border-2 border-indigo-400">
            <div class="flex-1">
                <p class="font-bold text-gray-900 dark:text-white">${displayName}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${profile.email}</p>
                <span class="inline-flex items-center gap-1 mt-1 text-[10px] font-bold ${roleBadge} px-2 py-0.5 rounded border">
                    <i data-lucide="${role === 'admin' ? 'crown' : 'user'}" class="w-3 h-3"></i>
                    ${roleLabel.toUpperCase()}
                </span>
            </div>
        </div>
    `;

    if (window.lucide) {
        window.lucide.createIcons({ root: mobileContainer });
    }
}

// Fallback Profile (if error)
function renderFallbackProfile() {
    const profileContainer = document.getElementById('navbar-profile');
    if (profileContainer) {
        profileContainer.innerHTML = `
            <button onclick="window.handleLogout()" 
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                <i data-lucide="log-out" class="w-4 h-4"></i>
                <span class="hidden md:inline">Keluar</span>
            </button>
        `;
        if (window.lucide) {
            window.lucide.createIcons({ root: profileContainer });
        }
    }

    const mobileContainer = document.getElementById('navbar-profile-mobile');
    if (mobileContainer) {
        mobileContainer.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 text-sm">
                <i data-lucide="alert-circle" class="w-5 h-5 inline"></i>
                <p class="mt-1">Profile tidak dapat dimuat</p>
            </div>
        `;
        if (window.lucide) {
            window.lucide.createIcons({ root: mobileContainer });
        }
    }
}

// Global Functions
window.refreshProfile = async () => {
    try {
        const profile = await profileService.getCurrentUserProfile(true);
        renderProfileButton(profile);
        renderMobileProfile(profile);
        setupProfileDropdown();

        if (window.showToast) {
            window.showToast('Profile diperbarui!', 'success');
        }
    } catch (error) {
        console.error('Failed to refresh profile:', error);
        if (window.showToast) {
            window.showToast('Gagal memuat profile', 'error');
        }
    }
};

window.handleLogout = async () => {
    if (window.showConfirm) {
        window.showConfirm('Yakin ingin keluar?', async () => {
            profileService.clearCache();
            await authService.logout();
        });
    } else {
        if (confirm('Yakin ingin keluar?')) {
            profileService.clearCache();
            await authService.logout();
        }
    }
};