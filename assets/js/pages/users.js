// ===== IMPORT MODULES =====
import { userService } from '../firebase/user-service.js';
import { initAuthGuard } from '../utils/auth-guard.js';
import { authService } from '../firebase/auth-service.js';
import { showToast, showConfirm, toggleTheme } from '../utils/ui.js';

window.toggleTheme = toggleTheme;

// ===== STATE MANAGEMENT =====
const state = {
    users: [],
    renderedIds: new Set(), // Track mana yang sudah di-render
};

// ===== INIT SYSTEM =====
lucide.createIcons();
initAuthGuard({ requireAdmin: true });

// ===== EVENT LISTENERS =====
document.getElementById('btnLogout')?.addEventListener('click', () => authService.logout());
document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu').classList.toggle('hidden');
});

document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu').classList.toggle('hidden');
});

// ===== SMART RENDERING =====
function renderUserRow(user) {
    const isVerified = user.isVerified;
    const isAdmin = user.role === 'admin';
    const avatar = user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nama || 'User')}&background=random`;

    return `
    <tr id="user-row-${user.id}" class="flex flex-col md:table-row p-4 md:p-0 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        
        <td class="px-2 py-3 md:px-6 md:py-4 block md:table-cell">
            <div class="flex items-center">
                <img class="h-12 w-12 md:h-10 md:w-10 rounded-full object-cover border dark:border-gray-600 shadow-sm" src="${avatar}" alt="">
                <div class="ml-4">
                    <div class="text-sm font-bold text-gray-900 dark:text-white">${user.nama || 'Tanpa Nama'}</div>
                    <div class="text-xs text-gray-500 font-mono truncate max-w-[200px] md:max-w-none">${user.email}</div>
                </div>
            </div>
        </td>

        <td class="px-2 py-2 md:px-6 md:py-4 flex md:table-cell items-center justify-between border-t md:border-none border-gray-100 dark:border-gray-800">
            <span class="md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hak Akses</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${isAdmin ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-gray-100 text-gray-700 border-gray-200'}">
                ${isAdmin ? '<i data-lucide="crown" class="w-3 h-3"></i> ADMIN' : '<i data-lucide="glasses" class="w-3 h-3"></i> VIEWER'}
            </span>
        </td>

        <td class="px-2 py-2 md:px-6 md:py-4 flex md:table-cell items-center justify-between">
            <span class="md:hidden text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status Akun</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${isVerified ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}">
                ${isVerified ? '<i data-lucide="check-circle" class="w-3 h-3"></i> VERIFIED' : '<i data-lucide="clock" class="w-3 h-3"></i> PENDING'}
            </span>
        </td>

        <td class="px-2 py-4 md:px-6 md:py-4 flex md:table-cell items-center justify-end gap-2 border-t md:border-none mt-2 pt-4">
            ${!isVerified ? `
                <button onclick="window.updateStatus('${user.id}', true)" 
                    class="flex-1 md:flex-none justify-center text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition shadow flex items-center gap-1 font-bold">
                    <i data-lucide="check" class="w-3 h-3"></i> Verify
                </button>` : ''
            }
            
            <button onclick="toggleRole('${user.id}', '${user.role}')" 
                class="flex-1 md:flex-none justify-center text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2 rounded-lg transition text-gray-700 dark:text-gray-300 font-medium">
                ${isAdmin ? 'Demote' : 'Promote'}
            </button>
            
            <button onclick="deleteUser('${user.id}')" 
                class="justify-center text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg transition border border-red-100">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    </tr>`;
}

function renderUsers(users, fromCache = false) {
    const tableBody = document.getElementById('userTableBody');

    if (!users || users.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-gray-500 italic">Belum ada user terdaftar.</td></tr>`;
        state.renderedIds.clear();
        return;
    }

    // OPTIMASI: Deteksi perubahan untuk incremental update
    const newIds = new Set(users.map(u => u.id));
    const currentIds = state.renderedIds;

    // Jika initial load atau complete rebuild diperlukan
    if (fromCache || currentIds.size === 0 || Math.abs(newIds.size - currentIds.size) > 3) {
        // Full render
        const html = users.map(user => renderUserRow(user)).join('');
        tableBody.innerHTML = html;
        state.renderedIds = newIds;
        state.users = users;
    } else {
        // Incremental update (hanya update yang berubah)

        // 1. Hapus user yang tidak ada lagi
        currentIds.forEach(id => {
            if (!newIds.has(id)) {
                const row = document.getElementById(`user-row-${id}`);
                if (row) row.remove();
                state.renderedIds.delete(id);
            }
        });

        // 2. Update atau tambah user baru
        users.forEach(user => {
            const existingRow = document.getElementById(`user-row-${user.id}`);

            if (existingRow) {
                // Cek apakah data berubah (compare dengan state lama)
                const oldUser = state.users.find(u => u.id === user.id);
                if (JSON.stringify(oldUser) !== JSON.stringify(user)) {
                    // Data berubah, update row
                    const temp = document.createElement('tbody');
                    temp.innerHTML = renderUserRow(user);
                    existingRow.replaceWith(temp.firstChild);
                }
            } else {
                // User baru, tambahkan
                tableBody.insertAdjacentHTML('beforeend', renderUserRow(user));
                state.renderedIds.add(user.id);
            }
        });

        state.users = users;
    }

    // Re-render icons (hanya untuk elemen baru)
    lucide.createIcons({ root: tableBody });

    // Log untuk debugging
    if (fromCache) {
        console.log('🎨 Rendered from cache (instant load)');
    } else {
        console.log('🔄 Updated from Firebase');
    }
}

// ===== SETUP REALTIME LISTENER =====
userService.setupRealtimeListener((users, fromCache) => {
    renderUsers(users, fromCache);
});

// ===== GLOBAL WINDOW ACTIONS =====
window.updateStatus = async (id, status) => {
    try {
        await userService.updateUserStatus(id, status);
        showToast("Status user diperbarui", "success");
    } catch (e) {
        showToast(e.message, "error");
    }
};

window.toggleRole = async (id, currentRole) => {
    const newRole = currentRole === 'admin' ? 'viewer' : 'admin';
    showConfirm(`Ubah role menjadi ${newRole.toUpperCase()}?`, async () => {
        try {
            await userService.toggleUserRole(id, currentRole);
            showToast(`Role diubah ke ${newRole}`, "success");
        } catch (e) {
            showToast(e.message, "error");
        }
    });
};

window.deleteUser = async (id) => {
    showConfirm('Hapus user ini secara permanen?', async () => {
        try {
            await userService.deleteUser(id);
            showToast("User dihapus", "success");
        } catch (e) {
            showToast(e.message, "error");
        }
    });
};

// ===== CLEANUP ON PAGE UNLOAD =====
window.addEventListener('beforeunload', () => {
    userService.stopListener();
});