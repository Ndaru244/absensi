import { adminService } from "../firebase/admin-service.js";
import { showToast, showConfirm, initTheme } from "../utils/ui.js";

const el = (id) => document.getElementById(id);
const state = {
  classes: new Set(),
  studentsCache: {},
  draft: [],
  selectedIds: new Set(),
};

async function initAdmin() {
  initTheme();
  await loadClasses();
  setupEvents();
}

// --- LOAD DATA ---
async function loadClasses() {
  const [select, filter] = [el("selectKelasSiswa"), el("filterKelasSiswa")];
  try {
    const data = await adminService.getClasses();
    state.classes.clear();
    data.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const opts = data
      .map((c) => {
        state.classes.add(c.id);
        return `<option value="${c.id}">${c.id}</option>`;
      })
      .join("");
    if (select)
      select.innerHTML = '<option value="">-- Pilih Kelas --</option>' + opts;
    if (filter)
      filter.innerHTML =
        '<option value="" disabled selected>-- Pilih Kelas Data --</option>' +
        opts;
  } catch (e) {
    showToast("Gagal memuat kelas", "error");
  }
}

async function loadStudentsByClass(kelasId) {
  if (!kelasId) return;
  state.selectedIds.clear();
  updateBatchUI();

  const tbody = el("tbodySiswa");

  // CEK CACHE: Jika sudah pernah dimuat, jangan panggil Firestore lagi
  if (state.studentsCache[kelasId]) {
    console.log(`Using cached data for class: ${kelasId}`);
    renderTable(state.studentsCache[kelasId]);
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div></td></tr>`;

  try {
    // Ambil data dari server (Hanya terjadi 1x per kelas)
    const data = await adminService.getStudentsByClass(kelasId);

    // Simpan ke Cache
    state.studentsCache[kelasId] = data;

    renderTable(data);
  } catch (err) {
    showToast(err.message, "error");
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Gagal memuat data</td></tr>`;
  }
}

function renderTable(listSiswa = []) { 
    const tbody = el('tbodySiswa');
    
    // Validasi data
    if (!listSiswa || listSiswa.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400 italic">📭 Kelas kosong</td></tr>';
        return;
    }

    // Gunakan listSiswa untuk mapping
    const sorted = [...listSiswa].sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));
    
    tbody.innerHTML = sorted.map(s => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 border-b dark:border-gray-700">
            <td class="p-4"><input type="checkbox" class="student-checkbox w-4 h-4 rounded" data-id="${s.id}"></td>
            <td class="p-4 font-medium">${s.nama_siswa}</td>
            <td class="p-4 text-xs font-mono">${s.nis}</td>
            <td class="p-4"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">${s.id_kelas}</span></td>
            <td class="p-4 text-center">
                <button onclick="window.deleteStudent('${s.id}', '${s.id_kelas}')" class="text-red-400 p-2"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </td>
        </tr>`).join('');
    
    if(window.lucide) window.lucide.createIcons({ root: tbody });
}

// --- DRAFT LOGIC ---
async function handleAddToDraft() {
  const [nama, nis, kelas] = [
    el("inputNamaSiswa").value.trim(),
    el("inputNISSiswa").value.trim(),
    el("selectKelasSiswa").value,
  ];
  if (!nama || !nis || !kelas) return showToast("Lengkapi data!", "warning");
  if (state.draft.some((d) => d.nis === nis))
    return showToast("NIS sudah di draft!", "warning");

  const btn = el("btnAddToDraft");
  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Cek NIS...`;
  if (window.lucide) window.lucide.createIcons({ root: btn });

  try {
    if (await adminService.checkNISEXists(nis))
      return showToast("NIS sudah terdaftar!", "error");
    state.draft.push({
      nama_siswa: nama,
      nis,
      id_kelas: kelas,
      status_aktif: "Aktif",
    });
    el("inputNamaSiswa").value = "";
    el("inputNISSiswa").value = "";
    el("inputNamaSiswa").focus();
    renderDraftTable();
    showToast("Masuk antrian", "success");
  } catch (e) {
    showToast("Gagal cek NIS", "error");
  } finally {
    btn.innerHTML = `<i data-lucide="arrow-down-to-line" class="w-5 h-5"></i> Masuk Antrian`;
    if (window.lucide) window.lucide.createIcons({ root: btn });
  }
}

function renderDraftTable() {
  const tbody = el("tbodyDraft");
  el("countDraft").innerText = `Antrian: ${state.draft.length}`;
  el("btnUploadBatch").style.display = state.draft.length ? "flex" : "none"; // Flex for icon alignment
  el(
    "btnUploadBatch"
  ).innerHTML = `<i data-lucide="rocket" class="w-4 h-4"></i> UPLOAD ${state.draft.length} DATA`;

  tbody.innerHTML = state.draft.length
    ? state.draft
        .map(
          (d, i) => `
        <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            <td class="p-2 font-medium">${d.nama_siswa}</td><td class="p-2 text-xs font-mono">${d.nis}</td>
            <td class="p-2 text-xs font-bold">${d.id_kelas}</td>
            <td class="p-2 text-center">
                <button onclick="window.removeDraft(${i})" class="text-red-400 hover:text-red-600 transition p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>`
        )
        .join("")
    : "";

  if (window.lucide) {
    window.lucide.createIcons({ root: tbody });
    window.lucide.createIcons({ root: el("btnUploadBatch") });
  }
}

// --- EVENTS ---
function setupEvents() {
  el("filterKelasSiswa")?.addEventListener("change", (e) =>
    loadStudentsByClass(e.target.value)
  );
  el("btnRefreshStudents")?.addEventListener("click", () => {
    const kls = el("filterKelasSiswa").value;
    if (kls) {
      delete state.studentsCache[kls]; // Hapus cache agar ambil data fresh
      loadStudentsByClass(kls);
    } else {
      showToast("Pilih kelas", "info");
    }
  });
  el("btnAddToDraft")?.addEventListener("click", handleAddToDraft);

  el("btnUploadBatch")?.addEventListener("click", () => {
    if (state.draft.length === 0) return;
    showConfirm(`Upload ${state.draft.length} data?`, async () => {
      const btn = el("btnUploadBatch");
      const originalHTML = btn.innerHTML;
      try {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>...`;

        await adminService.uploadDraftBatch(state.draft);

        // UNTUK SINGLE FETCH: Cari kelas apa saja yang ada di draft dan hapus cachenya
        const affectedClasses = [
          ...new Set(state.draft.map((d) => d.id_kelas)),
        ];
        affectedClasses.forEach((kls) => delete state.studentsCache[kls]);

        showToast("Data Tersimpan!", "success");
        state.draft = [];
        renderDraftTable();

        const currentFilter = el("filterKelasSiswa").value;
        if (currentFilter) loadStudentsByClass(currentFilter);
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        if (window.lucide) window.lucide.createIcons({ root: btn });
      }
    });
  });

  el("btnSaveKelas")?.addEventListener("click", async () => {
    const id = el("inputKelasID").value.toUpperCase().trim();
    if (!id || state.classes.has(id))
      return showToast("Kelas invalid / duplikat", "warning");
    try {
      await adminService.createClass(id);
      state.classes.add(id);
      el("inputKelasID").value = "";
      showToast("Kelas dibuat", "success");
      loadClasses();
    } catch (e) {
      showToast(e.message, "error");
    }
  });

  // Checkbox Logic
  const toggleCheck = (id, checked) => {
    checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
    updateBatchUI();
  };
  el("checkAll")?.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    // Ambil semua checkbox yang ada di dalam tbody saja
    const checkboxes = document.querySelectorAll(".student-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = isChecked;
      const id = cb.dataset.id;
      isChecked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
    });
    updateBatchUI();
  });
  el("tbodySiswa")?.addEventListener("click", (e) => {
    // Pastikan yang diklik adalah input checkbox
    if (e.target.classList.contains("student-checkbox")) {
      toggleCheck(e.target.dataset.id, e.target.checked);
    }
  });

  // Batch Actions
  el("btnDeleteSelected")?.addEventListener("click", () => {
  const selectedCount = state.selectedIds.size;
  if (selectedCount === 0) return;

  showConfirm(`Hapus ${selectedCount} siswa terpilih?`, async () => {
    const currentKelas = el("filterKelasSiswa").value;
    try {
      // 1. Eksekusi hapus di Firestore
      await adminService.deleteStudentsBatch(Array.from(state.selectedIds));

      // 2. SINKRONISASI CACHE LOKAL (PENTING!)
      if (state.studentsCache[currentKelas]) {
        // Filter keluar semua ID yang baru saja dihapus
        state.studentsCache[currentKelas] = state.studentsCache[currentKelas].filter(
          (s) => !state.selectedIds.has(s.id)
        );
      }

      // 3. Reset state pilihan
      state.selectedIds.clear();

      // 4. Update UI
      showToast(`${selectedCount} Siswa dihapus`, "success");
      updateBatchUI();
      
      // Render ulang menggunakan data cache yang sudah bersih
      renderTable(state.studentsCache[currentKelas]);

    } catch (e) {
      console.error("Batch Delete Error:", e);
      showToast("Gagal menghapus: " + e.message, "error");
    }
  });
});

  // Promote Logic
  const modal = el("modalPromote");
  const closeModal = () => {
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 200);
  };
  el("btnPromoteClass")?.addEventListener("click", () => {
    el("promoteCount").innerText = state.selectedIds.size;
    el("selectTargetPromote").innerHTML =
      '<option value="" disabled selected>-- Pilih Kelas Tujuan --</option>';
    Array.from(state.classes)
      .sort()
      .forEach(
        (c) =>
          c !== el("filterKelasSiswa").value &&
          el("selectTargetPromote").appendChild(new Option(c, c))
      );
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
  });
  el("btnClosePromote")?.addEventListener("click", closeModal);
  el("btnCancelPromote")?.addEventListener("click", closeModal);
  el("btnConfirmPromote")?.addEventListener("click", async () => {
    const target = el("selectTargetPromote").value;
    const source = el("filterKelasSiswa").value;
    if (!target) return showToast("Pilih kelas tujuan!", "warning");
    try {
      await adminService.promoteStudentsBatch(
        Array.from(state.selectedIds),
        target
      );

      // Bersihkan cache kedua kelas agar data sinkron
      delete state.studentsCache[source];
      delete state.studentsCache[target];

      showToast("Berhasil dipromote!", "success");
      closeModal();
      loadStudentsByClass(source);
    } catch (e) {
      showToast(e.message, "error");
    }
  });
}

function updateBatchUI() {
    // 1. Hitung berapa banyak checkbox yang dicentang
    const cnt = state.selectedIds.size;
    
    // 2. Hitung berapa banyak checkbox yang ada di tabel saat ini (DOM)
    const totalInTable = document.querySelectorAll('.student-checkbox').length;
    
    // 3. Update Label Jumlah Terpilih
    if (el('countSelected')) el('countSelected').innerText = cnt;
    
    // 4. Sinkronisasi Checkbox "Check All"
    // Centang otomatis 'Check All' jika semua baris yang tampil dipilih manual
    if (el('checkAll')) {
        el('checkAll').checked = (totalInTable > 0 && cnt === totalInTable);
    }
    
    // 5. Enable/Disable Tombol Aksi Batch
    const btnPromote = el('btnPromoteClass');
    const btnDelete = el('btnDeleteSelected');
    
    if (btnPromote) btnPromote.disabled = (cnt === 0);
    if (btnDelete) btnDelete.disabled = (cnt === 0);
}

// Global Handlers
window.removeDraft = (i) => {
  state.draft.splice(i, 1);
  renderDraftTable();
};
window.deleteStudent = (id, kelasId) =>
  showConfirm("Hapus siswa?", async () => {
    try {
      await adminService.deleteStudent(id);

      // Hapus dari cache lokal secara manual
      if (state.studentsCache[kelasId]) {
        state.studentsCache[kelasId] = state.studentsCache[kelasId].filter(
          (s) => s.id !== id
        );
      }

      showToast("Terhapus", "success");
      renderTable(state.studentsCache[kelasId]); // Render ulang dari cache yang sudah bersih
    } catch (e) {
      showToast("Gagal menghapus", "error");
    }
  });

initAdmin();
