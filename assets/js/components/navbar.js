import { profileService } from '../firebase/profile-service.js';
import { authService } from '../firebase/auth-service.js';

// ===== HELPER: ROLE UI CONFIG =====
function getRoleMetadata(role) {
    switch (role) {
        case 'super_admin':
            return {
                label: 'SUPER ADMIN',
                badge: 'bg-rose-100 text-rose-700 border-rose-200',
                icon: 'shield-alert'
            };
        case 'admin':
            return {
                label: 'GURU PIKET',
                badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                icon: 'shield-check'
            };
        case 'guru':
            return {
                label: 'GURU',
                badge: 'bg-blue-50 text-blue-700 border-blue-200',
                icon: 'graduation-cap' // atau 'user'
            };
        default: // viewer
            return {
                label: 'VIEWER',
                badge: 'bg-gray-100 text-gray-600 border-gray-200',
                icon: 'eye'
            };
    }
}

// ===== MAIN FUNCTION =====
export async function initNavbarProfile() {
    try {
        // TUNGGU: Jangan panggil profile sebelum Auth siap
        const user = await authService.waitForAuth();

        if (!user) return renderFallbackProfile();

        // Load profile dari cache/server
        const profile = await profileService.getCurrentUserProfile();
        
        renderProfileButton(profile);
        renderMobileProfile(profile);
        setupProfileDropdown();
    } catch (error) {
        console.error('Failed to load profile:', error);
        renderFallbackProfile();
    }
}

// 1. RENDER DESKTOP BUTTON
function renderProfileButton(profile) {
    const profileContainer = document.getElementById('navbar-profile');
    if (!profileContainer) return;

    const avatarUrl = profileService.getAvatarUrl(profile);
    const displayName = profileService.getDisplayName(profile);
    
    const { label, badge, icon } = getRoleMetadata(profile.role);

    profileContainer.innerHTML = `
        <div class="relative">
            <button id="profile-dropdown-btn" 
                    class="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl px-2 py-1.5 transition-all group border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
                
                <img src="${avatarUrl}" 
                     alt="${displayName}"
                     class="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-600 group-hover:shadow-sm transition">
                
                <div class="hidden md:flex flex-col items-start text-left">
                    <span class="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">${displayName}</span>
                    <span class="text-[10px] font-bold ${badge} px-1.5 py-0.5 rounded border mt-0.5 inline-flex items-center gap-1">
                        ${label}
                    </span>
                </div>
                
                <i data-lucide="chevron-down" class="hidden md:block w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition ml-1"></i>
            </button>
            
            <div id="profile-dropdown" 
                 class="hidden absolute right-0 mt-2 w-72 bg-white dark:bg-darkcard rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 ring-1 ring-black ring-opacity-5 focus:outline-none transform opacity-0 scale-95 transition-all duration-100 origin-top-right">
                
                <div class="px-5 py-4 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <div class="flex items-center gap-4">
                        <img src="${avatarUrl}" 
                             alt="${displayName}"
                             class="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-sm">
                        <div class="flex-1 overflow-hidden">
                            <p class="font-bold text-gray-900 dark:text-white truncate">${displayName}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">${profile.email}</p>
                            <span class="inline-flex items-center gap-1 text-[10px] font-bold ${badge} px-2 py-0.5 rounded border">
                                <i data-lucide="${icon}" class="w-3 h-3"></i>
                                ${label}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="py-2 px-2 space-y-1">
                    <button onclick="window.refreshProfile()" 
                            class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-400 rounded-lg flex items-center gap-3 transition">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh Profile
                    </button>
                    
                    <button onclick="window.toggleTheme()" 
                            class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3 transition">
                        <i data-lucide="sun-moon" class="w-4 h-4"></i>
                        Ganti Tema
                    </button>
                    
                    <div class="border-t dark:border-gray-700 my-1 mx-2"></div>
                    
                    <button onclick="window.handleLogout()" 
                            class="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 rounded-lg flex items-center gap-3 transition font-medium">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                        Keluar Aplikasi
                    </button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: profileContainer });
}

// 2. RENDER MOBILE PROFILE
function renderMobileProfile(profile) {
    const mobileContainer = document.getElementById('navbar-profile-mobile');
    if (!mobileContainer) return;

    const avatarUrl = profileService.getAvatarUrl(profile);
    const displayName = profileService.getDisplayName(profile);
    const { label, badge, icon } = getRoleMetadata(profile.role);

    mobileContainer.innerHTML = `
        <div class="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <img src="${avatarUrl}" 
                 alt="${displayName}"
                 class="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-600">
            <div class="flex-1 min-w-0">
                <p class="font-bold text-gray-900 dark:text-white truncate text-sm">${displayName}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">${profile.email}</p>
                <span class="inline-flex items-center gap-1 text-[10px] font-bold ${badge} px-2 py-0.5 rounded border">
                    <i data-lucide="${icon}" class="w-3 h-3"></i>
                    ${label}
                </span>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ root: mobileContainer });
}

// 3. SETUP DROPDOWN INTERACTION
function setupProfileDropdown() {
    const btn = document.getElementById('profile-dropdown-btn');
    const dropdown = document.getElementById('profile-dropdown');

    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown.classList.contains('hidden')) {
            dropdown.classList.remove('hidden');
            setTimeout(() => {
                dropdown.classList.remove('opacity-0', 'scale-95');
                dropdown.classList.add('opacity-100', 'scale-100');
            }, 10);
        } else {
            closeDropdown();
        }
    });

    function closeDropdown() {
        dropdown.classList.remove('opacity-100', 'scale-100');
        dropdown.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            dropdown.classList.add('hidden');
        }, 100);
    }

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            closeDropdown();
        }
    });
}

// 4. FALLBACK (ERROR STATE)
function renderFallbackProfile() {
    const profileContainer = document.getElementById('navbar-profile');
    if (profileContainer) {
        profileContainer.innerHTML = `
            <button onclick="window.handleLogout()" 
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
                <i data-lucide="log-in" class="w-4 h-4"></i>
                <span>Login Ulang</span>
            </button>
        `;
        if (window.lucide) window.lucide.createIcons({ root: profileContainer });
    }
}

// ===== GLOBAL HANDLERS =====

window.refreshProfile = async () => {
    const btn = document.querySelector('#profile-dropdown-btn i[data-lucide="chevron-down"]');
    if(btn) btn.classList.add('animate-spin');
    
    try {
        const profile = await profileService.getCurrentUserProfile(true);
        renderProfileButton(profile);
        renderMobileProfile(profile);
        setupProfileDropdown();

        if (window.showToast) window.showToast('Profile data diperbarui', 'success');
    } catch (error) {
        console.error('Refresh failed:', error);
    }
};

window.handleLogout = async () => {
    const action = async () => {
        profileService.clearCache();
        await authService.logout();
    };

    if (window.showConfirm) {
        window.showConfirm('Apakah Anda yakin ingin keluar dari aplikasi?', action);
    } else if (confirm('Keluar dari aplikasi?')) {
        action();
    }
};