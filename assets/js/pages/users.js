import { db, auth } from "../firebase/config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { showToast, showCustomModal, showConfirm } from "../utils/ui.js";

// ===== CACHE MANAGER =====
const UsersCache = {
  KEY: "users_list_cache",
  TTL: 1000 * 60 * 15, // 15 minutes

  set(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn("Cache write failed:", e);
    }
  },

  get() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;

      const item = JSON.parse(raw);
      const age = Date.now() - item.timestamp;

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
    localStorage.removeItem(this.KEY);
  },

  getAge() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const item = JSON.parse(raw);
      return Date.now() - item.timestamp;
    } catch {
      return null;
    }
  }
};

// State Global
let allUsers = [];
let isLoading = false;

// 1. Load Users (Cache-First Strategy)
// 1. Load Users (Updated)
async function loadUsers(forceRefresh = false) {
  const tableBody = document.getElementById("userTableBody");

  // Prevent duplicate requests
  if (isLoading) return;

  // Cek cache dulu (kecuali dipaksa refresh)
  if (!forceRefresh) {
    const cached = UsersCache.get();
    if (cached) {
      allUsers = cached;
      renderTable(allUsers);
      updateRefreshButton('idle'); // Status diam
      return;
    }
  }

  isLoading = true;
  updateRefreshButton('loading'); // Status memuat

  // Skeleton / Loading State di Tabel
  if (tableBody) {
    tableBody.innerHTML = `
        <tr class="animate-pulse">
            <td colspan="4" class="p-8 text-center text-gray-400">
                <div class="flex justify-center items-center gap-2">
                    <i data-lucide="loader-2" class="w-6 h-6 animate-spin text-blue-500"></i>
                    <span>Sedang mengambil data terbaru...</span>
                </div>
            </td>
        </tr>`;
    lucide.createIcons();
  }

  try {
    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(usersQuery);

    allUsers = [];
    snapshot.forEach((docSnap) => {
      allUsers.push({ id: docSnap.id, ...docSnap.data() });
    });

    UsersCache.set(allUsers);
    renderTable(allUsers);

    // --- VISUAL FEEDBACK: SUKSES ---
    if (forceRefresh) {
      updateRefreshButton('success'); // Ubah jadi hijau sejenak
      showToast(`✅ Data diperbarui (${allUsers.length} pengguna)`, "success");
    } else {
      updateRefreshButton('idle');
    }

  } catch (error) {
    console.error("Load error:", error);
    showToast("Gagal: " + error.message, "error");
    updateRefreshButton('idle'); // Kembali ke normal meski gagal (opsional: bisa buat state error)
  } finally {
    isLoading = false;
  }
}

// 2. Update Refresh Button State (LOGIC BARU)
function updateRefreshButton(state) {
  const btn = document.getElementById("btnRefreshUsers");
  const iconContainer = btn.querySelector("i"); // Ambil elemen icon
  const text = document.getElementById("refreshText");

  if (!btn) return;

  // Reset Class Awal
  btn.className = "inline-flex items-center gap-2 px-4 py-2.5 font-bold rounded-lg shadow transition-all active:scale-95 text-white";

  if (state === 'loading') {
    // STATE: MEMUAT (Biru Pudar + Spin)
    btn.classList.add("bg-blue-600", "opacity-75", "cursor-not-allowed");
    btn.disabled = true;

    // Ganti Icon jadi Loader
    if (iconContainer) iconContainer.setAttribute("data-lucide", "loader-2");
    if (iconContainer) iconContainer.classList.add("animate-spin");
    if (text) text.textContent = "Memuat...";

  } else if (state === 'success') {
    // STATE: SUKSES (Hijau + Ceklis)
    btn.classList.add("bg-green-600", "hover:bg-green-700");
    btn.disabled = false;

    // Ganti Icon jadi Check
    if (iconContainer) iconContainer.setAttribute("data-lucide", "check");
    if (iconContainer) iconContainer.classList.remove("animate-spin");
    if (text) text.textContent = "Berhasil!";

    // Kembalikan ke Idle setelah 1.5 detik
    setTimeout(() => {
      updateRefreshButton('idle');
    }, 1500);

  } else {
    // STATE: IDLE / DIAM (Biru Normal + Waktu)
    btn.classList.add("bg-blue-600", "hover:bg-blue-700");
    btn.disabled = false;

    // Ganti Icon Balik ke Refresh
    if (iconContainer) iconContainer.setAttribute("data-lucide", "refresh-cw");
    if (iconContainer) iconContainer.classList.remove("animate-spin");

    // Update Waktu Cache
    const age = UsersCache.getAge();
    if (age && text) {
      const minutes = Math.floor(age / 60000);
      if (minutes < 1) text.textContent = "Baru saja";
      else if (minutes === 1) text.textContent = "1 min lalu";
      else text.textContent = `${minutes} min lalu`;
    } else {
      if (text) text.textContent = "Refresh";
    }
  }

  // Refresh Icon Lucide agar perubahan attribut terbaca
  lucide.createIcons();
}

// 2. Update Refresh Button State
// function updateRefreshButton(loading) {
//   const btn = document.getElementById("btnRefreshUsers");
//   const icon = document.getElementById("refreshIcon");
//   const text = document.getElementById("refreshText");

//   if (!btn) return;

//   if (loading) {
//     btn.disabled = true;
//     btn.classList.add("opacity-50", "cursor-not-allowed");
//     icon?.classList.add("animate-spin");
//     if (text) text.textContent = "Memuat...";
//   } else {
//     btn.disabled = false;
//     btn.classList.remove("opacity-50", "cursor-not-allowed");
//     icon?.classList.remove("animate-spin");
//     if (text) text.textContent = "Refresh";

//     // Show cache age
//     const age = UsersCache.getAge();
//     if (age && text) {
//       const minutes = Math.floor(age / 60000);
//       if (minutes < 1) {
//         text.textContent = "Baru saja";
//       } else if (minutes === 1) {
//         text.textContent = "1 menit lalu";
//       } else {
//         text.textContent = `${minutes} menit lalu`;
//       }
//     }
//   }
// }

// 3. Render Table
function renderTable(users) {
  const tableBody = document.getElementById("userTableBody");
  const currentUser = auth.currentUser;
  tableBody.innerHTML = "";

  if (users.length === 0) {
    tableBody.innerHTML = `
      <tr class="block md:table-row w-full bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow md:shadow-none">
        <td colspan="4" class="block md:table-cell py-4 text-gray-500">
          <i data-lucide="users" class="w-8 h-8 mx-auto mb-2 text-gray-400"></i>
          <p>Belum ada pengguna terdaftar</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  users.forEach((user, index) => {
    const isSelf = currentUser && user.id === currentUser.uid;

    const roleColor =
      user.role === "admin"
        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";

    const statusBadge = user.isVerified
      ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Verified</span>'
      : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Pending</span>';

    const row = document.createElement("tr");
    row.className = `
      flex flex-col md:table-row 
      bg-white dark:bg-gray-800 
      rounded-xl shadow-sm md:shadow-none md:rounded-none
      border border-gray-200 dark:border-gray-700 md:border-b md:border-x-0 md:border-t-0
      mb-4 md:mb-0
      transition-all hover:bg-gray-50 dark:hover:bg-gray-750
      animate-fade-in
    `;

    row.innerHTML = `
      <td class="block md:table-cell px-4 py-4 md:px-6 md:py-4 border-b border-gray-100 dark:border-gray-700 md:border-none">
        <div class="flex items-center">
          <div class="flex-shrink-0 h-10 w-10">
            <img class="h-10 w-10 rounded-full object-cover border dark:border-gray-600" 
                 src="${user.photo || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.nama)}" 
                 alt="${user.nama}"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.nama)}'">
          </div>
          <div class="ml-4">
            <div class="text-sm font-medium text-gray-900 dark:text-white">${user.nama}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">${user.email}</div>
            <div class="md:hidden text-xs text-indigo-500 mt-1 font-mono">${user.nip || "NIP: -"}</div>
            <div class="hidden md:block text-xs text-gray-400 dark:text-gray-500">${user.nip || "NIP: -"}</div>
          </div>
        </div>
      </td>

      <td class="block md:table-cell px-4 py-3 md:px-6 md:py-4 flex justify-between items-center">
        <span class="text-xs font-bold text-gray-500 uppercase md:hidden">Role</span>
        <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColor}">${user.role}</span>
      </td>

      <td class="block md:table-cell px-4 py-3 md:px-6 md:py-4 flex justify-between items-center">
        <span class="text-xs font-bold text-gray-500 uppercase md:hidden">Status</span>
        ${statusBadge}
      </td>

      <td class="block md:table-cell px-4 py-3 md:px-6 md:py-4 bg-gray-50 dark:bg-gray-700/50 md:bg-transparent rounded-b-xl md:rounded-none flex justify-end items-center gap-3">
        <span class="text-xs font-bold text-gray-500 uppercase md:hidden mr-auto">Aksi</span>
        
        <button class="btn-edit inline-flex items-center px-3 py-1.5 border border-indigo-600 rounded text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-400 dark:hover:bg-indigo-900/30 transition-colors" data-id="${user.id}">
          <i data-lucide="edit-2" class="w-3 h-3 mr-1"></i> Edit
        </button>

        ${isSelf
        ? `<span class="text-gray-400 text-xs italic cursor-not-allowed px-2">Owner</span>`
        : `<button class="btn-delete inline-flex items-center px-3 py-1.5 border border-red-600 rounded text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-900/30 transition-colors" data-id="${user.id}">
                <i data-lucide="trash-2" class="w-3 h-3 mr-1"></i> Hapus
             </button>`
      }
      </td>
    `;

    tableBody.appendChild(row);
  });

  lucide.createIcons();
  attachEvents();
}

// 4. Attach Event Listeners
function attachEvents() {
  document.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetBtn = e.target.closest(".btn-edit");
      const uid = targetBtn.dataset.id;
      if (uid) openEditModal(uid);
    });
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const targetBtn = e.target.closest(".btn-delete");
      const uid = targetBtn.dataset.id;
      if (uid) confirmDelete(uid);
    });
  });
}

// 5. Edit Modal with Cache Invalidation
function openEditModal(uid) {
  const user = allUsers.find((u) => u.id === uid);
  if (!user) return;

  const formHtml = `
    <div class="space-y-4 text-left">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
        <input type="text" id="edit-nama" value="${user.nama}" class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIP (Nomor Induk)</label>
        <input type="text" id="edit-nip" value="${user.nip === "-" ? "" : user.nip || ""}" placeholder="Kosongkan jika bukan PNS" class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5">
      </div>
      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Akses</label>
          <select id="edit-role" class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5">
            <option value="viewer" ${user.role === "viewer" ? "selected" : ""}>Viewer (Guru)</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrator</option>
          </select>
        </div>
        <div class="flex items-center p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <input id="edit-verified" type="checkbox" ${user.isVerified ? "checked" : ""} class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
          <label for="edit-verified" class="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
            Akun Terverifikasi (Bisa Login)
          </label>
        </div>
      </div>
    </div>
  `;

  showCustomModal("Edit Data Pengguna", formHtml, async () => {
    const newNama = document.getElementById("edit-nama").value.trim();
    const newNip = document.getElementById("edit-nip").value.trim() || "-";
    const newRole = document.getElementById("edit-role").value;
    const newVerified = document.getElementById("edit-verified").checked;

    if (!newNama) {
      showToast("Nama tidak boleh kosong!", "error");
      return;
    }

    try {
      const userRef = doc(db, "users", uid);

      // Optimistic UI update
      const userIndex = allUsers.findIndex(u => u.id === uid);
      if (userIndex !== -1) {
        allUsers[userIndex] = {
          ...allUsers[userIndex],
          nama: newNama,
          nip: newNip,
          role: newRole,
          isVerified: newVerified
        };
        renderTable(allUsers);
      }

      await updateDoc(userRef, {
        nama: newNama,
        nip: newNip,
        role: newRole,
        isVerified: newVerified,
        updatedAt: new Date().toISOString(),
      });

      // Invalidate cache after successful update
      UsersCache.clear();
      showToast("✅ Data user berhasil disimpan!", "success");

    } catch (error) {
      console.error(error);
      showToast("Gagal menyimpan: " + error.message, "error");
      await loadUsers(true); // Reload on error
    }
  });
}

// 6. Delete with Cache Invalidation
function confirmDelete(uid) {
  const user = allUsers.find(u => u.id === uid);
  const userName = user ? user.nama : "user ini";

  showConfirm(
    `Apakah Anda yakin ingin menghapus "${userName}" secara permanen?`,
    async () => {
      try {
        // Optimistic UI
        allUsers = allUsers.filter(u => u.id !== uid);
        renderTable(allUsers);

        await deleteDoc(doc(db, "users", uid));

        // Invalidate cache
        UsersCache.clear();
        showToast("✅ User berhasil dihapus.", "success");

      } catch (error) {
        console.error(error);
        showToast("Gagal menghapus: " + error.message, "error");
        await loadUsers(true); // Reload on error
      }
    }
  );
}

// 7. Initialize
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      loadUsers(false); // Load with cache

      // Setup refresh button
      const refreshBtn = document.getElementById("btnRefreshUsers");
      if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
          loadUsers(true); // Force refresh
        });
      }
    }
  });
});

// Export for external use
window.refreshUsersList = () => loadUsers(true);