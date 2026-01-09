import { db } from "../firebase/config.js";
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { adminService } from "../firebase/admin-service.js";
import { showToast, showConfirm, initTheme, showCustomModal } from "../utils/ui.js";

const el = (id) => document.getElementById(id);
const state = {
  classes: new Set(),
  studentsCache: {},
  draft: [],
  selectedIds: new Set(),
};

// --- INIT ---
async function initAdmin() {
  initTheme();
  console.log("🚀 Init Admin Page...");

  // Load Classes dulu sebelum event listener
  await loadClasses(true); // True = Paksa refresh dari server saat pertama load untuk sinkronisasi

  setupEvents();

  // Auto Load Table jika filter terpilih (misal browser auto-fill)
  const currentFilter = el("filterKelasSiswa")?.value;
  if (currentFilter) loadStudentsByClass(currentFilter);
}

// --- 1. LOAD CLASSES & POPULATE DROPDOWNS ---
async function loadClasses(forceRefresh = false) {
  const selectNewStudent = el("selectKelasSiswa"); // Dropdown di Input Siswa
  const selectFilter = el("filterKelasSiswa");     // Dropdown di Tabel

  if (selectNewStudent) selectNewStudent.innerHTML = '<option>Memuat...</option>';
  if (selectFilter) selectFilter.innerHTML = '<option>Memuat...</option>';

  try {
    const data = await adminService.getClasses(forceRefresh);
    state.classes.clear();

    console.log(`✅ Classes Loaded: ${data.length} items`, data);

    if (data.length === 0) {
      if (selectNewStudent) selectNewStudent.innerHTML = '<option value="">-- Belum ada kelas --</option>';
      if (selectFilter) selectFilter.innerHTML = '<option value="">-- Belum ada kelas --</option>';
      return;
    }

    // Pisahkan Regular dan Khusus
    const regularClasses = data.filter(c => !c.is_khusus);

    // Sorting
    const sorter = (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true });
    regularClasses.sort(sorter);
    data.sort(sorter);

    // 1. Dropdown Input Siswa (HANYA REGULER)
    if (selectNewStudent) {
      const opts = regularClasses.map(c => `<option value="${c.id}">${c.nama_kelas || c.id}</option>`).join("");
      selectNewStudent.innerHTML = '<option value="">-- Pilih Kelas Reguler --</option>' + opts;
    }

    // 2. Dropdown Filter Tabel (SEMUA KELAS)
    if (selectFilter) {
      const opts = data.map(c => {
        state.classes.add(c.id);
        // Beri tanda visual untuk kelas khusus
        const label = c.is_khusus ? `★ ${c.nama_kelas} (Mapel)` : (c.nama_kelas || c.id);
        return `<option value="${c.id}">${label}</option>`;
      }).join("");
      selectFilter.innerHTML = '<option value="" disabled selected>-- Pilih Kelas Data --</option>' + opts;
    }

  } catch (e) {
    console.error("Load Class Error:", e);
    showToast("Gagal memuat daftar kelas. Cek koneksi.", "error");
  }
}

// --- 2. CLASS MANAGER (Kelola Kelas & Anggota) ---
window.openClassManager = async (forceRefresh = false) => {
  let classes = [];
  try {
    classes = await adminService.getClasses(forceRefresh);
    classes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  } catch (e) {
    return showToast("Gagal memuat data", "error");
  }

  const renderList = () => classes.map(c => {
    const isKhusus = c.is_khusus;
    return `
        <div class="flex justify-between items-center p-3 border-b hover:bg-gray-50 last:border-0">
            <div>
                <div class="font-bold text-gray-800 flex items-center gap-2">
                    ${c.nama_kelas || c.id}
                    ${isKhusus
        ? `<span class="bg-purple-100 text-purple-700 text-[10px] px-2 rounded-full border border-purple-200">MAPEL</span>`
        : `<span class="bg-blue-50 text-blue-600 text-[10px] px-2 rounded-full">REGULER</span>`}
                </div>
                <div class="text-xs text-gray-400 font-mono">ID: ${c.id}</div>
            </div>
            <div class="flex gap-2">
                ${isKhusus ?
        `<button onclick="openManageMembers('${c.id}')" class="text-xs bg-purple-600 text-white px-3 py-1.5 rounded hover:bg-purple-700 flex items-center gap-1 shadow-sm">
                        <i data-lucide="users" class="w-3 h-3"></i> + Siswa
                    </button>`
        : '<span class="text-[10px] text-gray-400 py-1 italic">Siswa via Input Master</span>'}
                
                <button onclick="handleDeleteClass('${c.id}')" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50" title="Hapus Kelas">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>`;
  }).join('');

  const html = `
        <div class="space-y-4">
             <div class="border rounded-lg bg-white max-h-[400px] overflow-y-auto shadow-inner" id="classListContainer">
                ${classes.length ? renderList() : '<div class="p-4 text-center text-gray-400">Belum ada kelas.</div>'}
             </div>
             <div class="flex justify-end">
                 <button onclick="openClassManager(true)" class="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <i data-lucide="refresh-cw" class="w-3 h-3"></i> Refresh Data Server
                 </button>
             </div>
        </div>
    `;

  showCustomModal("Daftar Kelas Aktif", html);
  if (window.lucide) lucide.createIcons();
};

// --- 3. KELOLA ANGGOTA KELAS KHUSUS (PENCARIAN) ---
window.openManageMembers = async (kelasId) => {
  showCustomModal("Memuat Data...", `<div class="text-center p-8"><span class="animate-spin text-2xl">↻</span><br>Mengambil data seluruh siswa...</div>`);

  try {
    // Ambil SEMUA siswa untuk dipilih
    const snap = await getDocs(collection(db, "siswa"));
    const allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter: Hanya siswa aktif
    const activeStudents = allStudents.filter(s => s.status_aktif === 'Aktif');

    // Sort
    activeStudents.sort((a, b) => (a.id_kelas || '').localeCompare(b.id_kelas || '') || a.nama_siswa.localeCompare(b.nama_siswa));

    const html = `
            <div class="space-y-3">
                <div class="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800">
                    <strong>Kelas: ${kelasId}</strong><br>
                    Centang siswa di bawah ini untuk dimasukkan ke kelas mapel ini. Kelas asli siswa (misal: 5-A) tidak akan berubah.
                </div>
                <input type="text" id="searchMember" placeholder="Ketik Nama Siswa atau Kelas Asal..." 
                    class="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" 
                    onkeyup="filterMember()">
                
                <div class="max-h-[300px] overflow-y-auto border rounded-lg p-1 bg-gray-50 space-y-1" id="listMember">
                    ${activeStudents.map(s => `
                    <label class="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded cursor-pointer hover:bg-indigo-50 item-member group transition">
                        <input type="checkbox" value="${s.id}" class="w-5 h-5 accent-purple-600 form-checkbox rounded">
                        <div class="flex-1">
                            <div class="font-bold text-sm text-gray-800 search-name group-hover:text-purple-700">${s.nama_siswa}</div>
                            <div class="text-xs text-gray-500 search-class">
                                <span class="bg-gray-200 px-1 rounded text-[10px] font-bold text-gray-600">${s.id_kelas || '?'}</span> 
                                <span class="font-mono ml-1">${s.nis}</span>
                            </div>
                        </div>
                    </label>
                    `).join('')}
                </div>

                <div class="pt-3 border-t flex justify-end">
                     <button id="btnSaveMembers" onclick="saveSpecialMembers('${kelasId}')" class="bg-purple-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-purple-700 shadow flex items-center gap-2 transition active:scale-95">
                        <i data-lucide="save" class="w-4 h-4"></i> Simpan Anggota
                     </button>
                </div>
            </div>
        `;

    showCustomModal(`Kelola Anggota: ${kelasId}`, html);

    // Logic Filter
    window.filterMember = () => {
      const term = el('searchMember').value.toLowerCase();
      document.querySelectorAll('.item-member').forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? 'flex' : 'none';
      });
    };

    // Logic Save
    window.saveSpecialMembers = async (kId) => {
      const checkboxes = document.querySelectorAll('#listMember input:checked');
      const selectedIds = Array.from(checkboxes).map(cb => cb.value);

      if (selectedIds.length === 0) return showToast("Pilih minimal 1 siswa", "info");

      const btn = el('btnSaveMembers');
      btn.innerHTML = "Menyimpan...";
      btn.disabled = true;

      try {
        await adminService.addSiswaToSpecialClass(kId, selectedIds);
        showToast(`${selectedIds.length} siswa ditambahkan!`, "success");
        // Refresh table jika filter yang sedang aktif adalah kelas ini
        if (el('filterKelasSiswa').value === kId) {
          loadStudentsByClass(kId, true);
        }
      } catch (e) {
        showToast("Gagal menyimpan: " + e.message, "error");
        btn.disabled = false;
        btn.innerHTML = "Simpan Anggota";
      }
    };

  } catch (e) {
    showToast("Gagal memuat data siswa: " + e.message, "error");
  }
};

// --- 4. CREATE CLASS (AUTO ID) ---
window.handleCreateClass = async () => {
  const nameInput = el('inputNamaKelas');
  const checkInput = el('isKhususCheck');

  if (!nameInput) return;

  const nama = nameInput.value.trim();
  const isKhusus = checkInput ? checkInput.checked : false;

  if (!nama) return showToast("Nama Kelas wajib diisi!", "warning");

  // Generate ID: "Agama Islam" -> "AGAMA-ISLAM"
  const id = nama.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');

  try {
    await adminService.createClass(id, nama, isKhusus);
    showToast(`Kelas ${nama} berhasil dibuat!`, "success");

    nameInput.value = '';
    if (checkInput) checkInput.checked = false;

    // Refresh UI
    await loadClasses(true);

  } catch (e) {
    showToast(e.message, "error");
  }
};

// --- 5. STUDENTS LOGIC (TABLE) ---
async function loadStudentsByClass(kelasId, forceRefresh = false) {
  if (!kelasId) return;
  state.selectedIds.clear();
  updateBatchUI();

  const tbody = el("tbodySiswa");
  if (!tbody) return;

  // Load Cache jika ada
  if (!forceRefresh && state.studentsCache[kelasId]) {
    renderTable(state.studentsCache[kelasId]);
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400"><span class="animate-spin inline-block">↻</span> Mengambil data siswa...</td></tr>`;

  try {
    const data = await adminService.getSiswaByKelas(kelasId);
    state.studentsCache[kelasId] = data;
    renderTable(data);
    if (forceRefresh) showToast("Data diperbarui", "success");
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 p-4">Gagal memuat data: ${err.message}</td></tr>`;
  }
}

function renderTable(listSiswa = []) {
  const tbody = el("tbodySiswa");
  if (!tbody) return;
  if (!listSiswa.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400 p-8 italic">Tidak ada siswa di kelas ini.</td></tr>';
    return;
  }

  tbody.innerHTML = listSiswa.map(s => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 border-b dark:border-gray-700">
            <td class="p-4 text-center"><input type="checkbox" class="student-checkbox w-4 h-4 rounded" data-id="${s.id}"></td>
            <td class="p-4 font-medium text-gray-800 dark:text-gray-200">${s.nama}</td>
            <td class="p-4 text-xs font-mono text-gray-500">${s.nis}</td>
            <td class="p-4"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">${s.id_kelas || '-'}</span></td>
            <td class="p-4 text-center">
                <button onclick="deleteStudent('${s.id}', '${el("filterKelasSiswa").value}')" class="text-red-400 hover:text-red-600 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `).join("");
  if (window.lucide) lucide.createIcons({ root: tbody });
}

// --- 6. DRAFT & BATCH ACTIONS ---
async function handleAddToDraft() {
  // Validasi data input
  const nama = el("inputNamaSiswa")?.value.trim();
  const nis = el("inputNISSiswa")?.value.trim();
  const kelas = el("selectKelasSiswa")?.value;

  if (!nama || !nis || !kelas) return showToast("Mohon lengkapi Nama, NIS, dan Kelas!", "warning");

  // Validasi Duplikat di Draft
  if (state.draft.some(d => d.nis === nis)) return showToast("NIS tersebut sudah ada di antrian!", "warning");

  state.draft.push({ nama_siswa: nama, nis, id_kelas: kelas, status_aktif: "Aktif" });

  // Reset Input
  el("inputNamaSiswa").value = "";
  el("inputNISSiswa").value = "";
  el("inputNamaSiswa").focus(); // Fokus balik ke nama

  renderDraftTable();
}

function renderDraftTable() {
  const tbody = el("tbodyDraft");
  const countEl = el("countDraft");
  const btnUpload = el("btnUploadBatch");

  if (countEl) countEl.innerText = `Antrian: ${state.draft.length}`;
  if (btnUpload) btnUpload.style.display = state.draft.length ? "flex" : "none";

  if (!tbody) return;

  tbody.innerHTML = state.draft.map((d, i) => `
        <tr class="border-b dark:border-gray-700 bg-white dark:bg-gray-800">
            <td class="p-2 font-medium text-xs text-gray-700 dark:text-gray-300">${d.nama_siswa}</td>
            <td class="p-2 text-xs font-bold text-gray-500">${d.id_kelas}</td>
            <td class="p-2 text-center">
                <button onclick="removeDraft(${i})" class="text-red-500 hover:text-red-700 p-1"><i data-lucide="x" class="w-3 h-3"></i></button>
            </td>
        </tr>`).join("");

  if (window.lucide) lucide.createIcons({ root: tbody });
}

// --- EVENTS SETUP ---
function setupEvents() {
  // Tombol Simpan Kelas
  el("btnSaveKelas")?.addEventListener("click", handleCreateClass);

  // Dropdown Filter Tabel (Load Siswa)
  el("filterKelasSiswa")?.addEventListener("change", (e) => loadStudentsByClass(e.target.value));

  // Tombol Refresh Tabel
  el("btnRefreshStudents")?.addEventListener("click", () => {
    const kls = el("filterKelasSiswa").value;
    if (kls) loadStudentsByClass(kls, true);
    else showToast("Pilih kelas terlebih dahulu", "info");
  });

  // Draft System
  el("btnAddToDraft")?.addEventListener("click", handleAddToDraft);
  el("btnUploadBatch")?.addEventListener("click", async () => {
    if (!state.draft.length) return;
    const btn = el("btnUploadBatch");
    const oriHtml = btn.innerHTML;

    btn.innerHTML = "Mengupload...";
    btn.disabled = true;

    try {
      await adminService.uploadDraftBatch(state.draft);
      state.draft = [];
      renderDraftTable();
      showToast("Data siswa berhasil disimpan!", "success");

      // Jika kelas yang sedang dibuka ada di draft, refresh tabel
      const currentKls = el("filterKelasSiswa").value;
      if (currentKls) loadStudentsByClass(currentKls, true);

    } catch (e) {
      showToast("Gagal upload: " + e.message, "error");
    } finally {
      btn.innerHTML = oriHtml;
      btn.disabled = false;
    }
  });

  // Checkbox All
  el("checkAll")?.addEventListener("change", (e) => {
    document.querySelectorAll(".student-checkbox").forEach(cb => {
      cb.checked = e.target.checked;
      e.target.checked ? state.selectedIds.add(cb.dataset.id) : state.selectedIds.delete(cb.dataset.id);
    });
    updateBatchUI();
  });

  // Delegasi Event Klik Tabel (untuk checkbox dan delete)
  el("tbodySiswa")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("student-checkbox")) {
      // Checkbox logic
      e.target.checked ? state.selectedIds.add(e.target.dataset.id) : state.selectedIds.delete(e.target.dataset.id);
      updateBatchUI();
    }
  });

  // Global Functions Expose (untuk onclick di HTML)
  window.removeDraft = (i) => { state.draft.splice(i, 1); renderDraftTable(); };
  window.deleteStudent = async (id, kelasId) => {
    const select = document.getElementById("filterKelasSiswa");
    const selectedText = select.options[select.selectedIndex].text;

    // Deteksi apakah ini kelas Mapel/Khusus berdasarkan teks dropdown
    const isKhusus = selectedText.includes("(Mapel)") || selectedText.includes("★");

    let title, message, btnText, btnColor;

    if (isKhusus) {
      title = "Keluarkan Siswa?";
      message = "Siswa hanya akan dikeluarkan dari Kelas Mapel ini. Data master siswa <b>TIDAK AKAN HILANG</b>.";
    } else {
      title = "Hapus Siswa Permanen?";
      message = "<b>PERINGATAN:</b> Anda menghapus data Master Siswa. Siswa ini akan hilang dari seluruh sistem! Tindakan ini tidak bisa dibatalkan.";
    }

    // Panggil Modal Custom langsung (Tanpa confirm bawaan browser)
    showConfirm(title, async () => {
      try {
        await adminService.deleteStudent(id, kelasId);
        showToast(isKhusus ? "Siswa dikeluarkan dari kelas" : "Siswa dihapus permanen", "success");

        // Refresh Tabel
        loadStudentsByClass(kelasId, true);
      } catch (e) {
        showToast("Gagal menghapus: " + e.message, "error");
      }
    }, message); // Pastikan parameter ke-3 ini didukung oleh ui.js Anda
  };
  window.handleDeleteClass = async (id) => {
    if (confirm(`Hapus Kelas ${id}? \nData siswa di kelas ini tidak akan terhapus, tetapi tidak akan memiliki kelas.`)) {
      await adminService.deleteClass(id);
      // Refresh Modal dan Dropdown utama
      window.openClassManager(true);
      loadClasses(true);
    }
  };
}

function updateBatchUI() {
  const cnt = state.selectedIds.size;
  const elCnt = el("countSelected");
  const btnDel = el("btnDeleteSelected");

  if (elCnt) elCnt.innerText = cnt;
  if (btnDel) btnDel.disabled = cnt === 0;
}

// Jalankan Init
initAdmin();