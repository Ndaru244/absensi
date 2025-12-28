import { db, auth } from "../firebase/config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
// FIX 1: Tambahkan showCustomModal ke import
import { showToast, showCustomModal, showConfirm } from "../utils/ui.js";

// State Global
let allUsers = [];

// 1. Fungsi Load Data
async function loadUsers() {
  const tableBody = document.getElementById("userTableBody");
  if (!tableBody) return;

  tableBody.innerHTML =
    '<tr><td colspan="4" class="text-center py-4">Loading...</td></tr>';

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    allUsers = [];
    querySnapshot.forEach((doc) => {
      allUsers.push({ id: doc.id, ...doc.data() });
    });

    // Memanggil fungsi render (Pastikan fungsi ini ada!)
    renderTable(allUsers);
  } catch (error) {
    console.error("Error loading users:", error);
    showToast("Gagal memuat data user", "error");
  }
}

// 2. Render Tabel (Wajib Ada)
function renderTable(users) {
  const tableBody = document.getElementById("userTableBody");
  const currentUser = auth.currentUser;
  tableBody.innerHTML = "";

  if (users.length === 0) {
    tableBody.innerHTML = `
            <tr class="block md:table-row w-full bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow md:shadow-none">
                <td colspan="4" class="block md:table-cell py-4 text-gray-500">Tidak ada data user.</td>
            </tr>`;
    return;
  }

  users.forEach((user) => {
    const isSelf = currentUser && user.id === currentUser.uid;

    // Styling Badge
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
        `;

    row.innerHTML = `
            <td class="block md:table-cell px-4 py-4 md:px-6 md:py-4 border-b border-gray-100 dark:border-gray-700 md:border-none">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <img class="h-10 w-10 rounded-full object-cover border dark:border-gray-600" 
                             src="${
                               user.photo ||
                               "https://ui-avatars.com/api/?name=" + user.nama
                             }" alt="${user.nama}">
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900 dark:text-white">${
                          user.nama
                        }</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">${
                          user.email
                        }</div>
                        <div class="md:hidden text-xs text-indigo-500 mt-1 font-mono">${
                          user.nip || "NIP: -"
                        }</div>
                        <div class="hidden md:block text-xs text-gray-400 dark:text-gray-500">${
                          user.nip || "NIP: -"
                        }</div>
                    </div>
                </div>
            </td>

            <td class="block md:table-cell px-4 py-3 md:px-6 md:py-4 flex justify-between items-center">
                <span class="text-xs font-bold text-gray-500 uppercase md:hidden">Role</span>
                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColor}">${
      user.role
    }</span>
            </td>

            <td class="block md:table-cell px-4 py-3 md:px-6 md:py-4 flex justify-between items-center">
                <span class="text-xs font-bold text-gray-500 uppercase md:hidden">Status</span>
                ${statusBadge}
            </td>

            <td class="block md:table-cell px-4 py-3 md:px-6 md:py-4 bg-gray-50 dark:bg-gray-700/50 md:bg-transparent rounded-b-xl md:rounded-none flex justify-end items-center gap-3">
                <span class="text-xs font-bold text-gray-500 uppercase md:hidden mr-auto">Aksi</span>
                
                <button class="btn-edit inline-flex items-center px-3 py-1.5 border border-indigo-600 rounded text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-400 dark:hover:bg-indigo-900/30 transition-colors" data-id="${
                  user.id
                }">
                    <i data-lucide="edit-2" class="w-3 h-3 mr-1"></i> Edit
                </button>

                ${
                  isSelf
                    ? `<span class="text-gray-400 text-xs italic cursor-not-allowed px-2">Owner</span>`
                    : `<button class="btn-delete inline-flex items-center px-3 py-1.5 border border-red-600 rounded text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-900/30 transition-colors" data-id="${user.id}">
                        <i data-lucide="trash-2" class="w-3 h-3 mr-1"></i> Hapus
                     </button>`
                }
            </td>
        `;
    tableBody.appendChild(row);
  });

  // PENTING: Attach event listener setiap kali render ulang
  attachEvents();
}

// 3. Attach Events (Fixed logic)
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

// 4. Logika Edit Modal (HANYA SATU VERSI - Menggunakan showCustomModal)
function openEditModal(uid) {
  const user = allUsers.find((u) => u.id === uid);
  if (!user) return;

  const formHtml = `
        <div class="space-y-4 text-left">
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                <input type="text" id="edit-nama" value="${
                  user.nama
                }" class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIP (Nomor Induk)</label>
                <input type="text" id="edit-nip" value="${
                  user.nip === "-" ? "" : user.nip || ""
                }" placeholder="Kosongkan jika bukan PNS" class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5">
            </div>
            <div class="grid grid-cols-1 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Akses</label>
                    <select id="edit-role" class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2.5">
                        <option value="viewer" ${
                          user.role === "viewer" ? "selected" : ""
                        }>Viewer (Guru)</option>
                        <option value="admin" ${
                          user.role === "admin" ? "selected" : ""
                        }>Administrator</option>
                    </select>
                </div>
                <div class="flex items-center p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <input id="edit-verified" type="checkbox" ${
                      user.isVerified ? "checked" : ""
                    } class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
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
      await updateDoc(userRef, {
        nama: newNama,
        nip: newNip,
        role: newRole,
        isVerified: newVerified,
        updatedAt: new Date().toISOString(),
      });

      showToast("Data user berhasil disimpan!", "success");
      loadUsers();
    } catch (error) {
      console.error(error);
      showToast("Gagal menyimpan: " + error.message, "error");
    }
  });
}

// 5. Logika Delete
function confirmDelete(uid) {
  // FIX 2: showConfirm di ui.js Anda hanya menerima (string, callback)
  // Jangan kirim object {title, message}

  showConfirm(
    "Apakah Anda yakin ingin menghapus user ini secara permanen?", // Parameter 1: String pesan
    async () => {
      // Parameter 2: Callback
      try {
        await deleteDoc(doc(db, "users", uid));
        showToast("User berhasil dihapus.", "success");
        loadUsers();
      } catch (error) {
        console.error(error);
        showToast("Gagal menghapus: " + error.message, "error");
      }
    }
  );
}

// Init saat halaman dimuat
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      loadUsers();
    }
  });
});
