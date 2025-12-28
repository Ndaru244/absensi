import { db } from "../firebase/config.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { adminService } from "../firebase/admin-service.js";
import {
  showToast,
  showConfirm,
  initTheme,
  showCustomModal,
} from "../utils/ui.js";

// --- HELPERS & STATE ---
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
async function editKepsek() {
  // 1. Ambil Data Lama
  const docRef = doc(db, "settings", "kepala_sekolah");
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : { nama: "", nip: "" };

  // 2. Buat Form
  const html = `
        <div class="space-y-3">
            <label class="block text-sm">Nama Kepala Sekolah</label>
            <input id="kepsek-nama" value="${data.nama}" class="w-full border p-2 rounded">
            
            <label class="block text-sm">NIP</label>
            <input id="kepsek-nip" value="${data.nip}" class="w-full border p-2 rounded">
        </div>
    `;

  // 3. Tampilkan Modal
  showCustomModal("Edit Data Kepala Sekolah", html, async () => {
    const nama = document.getElementById("kepsek-nama").value;
    const nip = document.getElementById("kepsek-nip").value;

    // 4. Simpan ke Firestore
    await setDoc(docRef, { nama, nip });
    showToast("Data Kepala Sekolah berhasil diupdate!", "success");
  });
}

async function loadClasses(forceRefresh = false) {
  const [select, filter] = [el("selectKelasSiswa"), el("filterKelasSiswa")];
  try {
    const data = await adminService.getClasses(forceRefresh);
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

async function loadStudentsByClass(kelasId, forceRefresh = false) {
  if (!kelasId) return;
  state.selectedIds.clear();
  updateBatchUI();

  const tbody = el("tbodySiswa");
  if (!tbody) return;

  // CEK IN-MEMORY CACHE dulu
  if (!forceRefresh && state.studentsCache[kelasId]) {
    console.log(`Using in-memory cache for class: ${kelasId}`);
    renderTable(state.studentsCache[kelasId]);
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div></td></tr>`;

  try {
    const data = await adminService.getStudentsByClass(kelasId, forceRefresh);
    state.studentsCache[kelasId] = data;
    renderTable(data);
  } catch (err) {
    showToast(err.message, "error");
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Gagal memuat data</td></tr>`;
  }
}

function renderTable(listSiswa = []) {
  const tbody = el("tbodySiswa");
  if (!tbody) return;

  if (!listSiswa || listSiswa.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="p-8 text-center text-gray-400 italic">📭 Kelas kosong</td></tr>';
    return;
  }

  const sorted = [...listSiswa].sort((a, b) =>
    a.nama_siswa.localeCompare(b.nama_siswa)
  );

  tbody.innerHTML = sorted
    .map(
      (s) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 border-b dark:border-gray-700">
            <td class="p-4"><input type="checkbox" class="student-checkbox w-4 h-4 rounded" data-id="${s.id}"></td>
            <td class="p-4 font-medium">${s.nama_siswa}</td>
            <td class="p-4 text-xs font-mono">${s.nis}</td>
            <td class="p-4"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">${s.id_kelas}</span></td>
            <td class="p-4 text-center">
                <button onclick="window.deleteStudent('${s.id}', '${s.id_kelas}')" class="text-red-400 p-2"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
            </td>
        </tr>`
    )
    .join("");

  if (window.lucide) window.lucide.createIcons({ root: tbody });
}

// --- DRAFT LOGIC ---
async function handleAddToDraft() {
  const [nama, nis, kelas] = [
    el("inputNamaSiswa")?.value.trim(),
    el("inputNISSiswa")?.value.trim(),
    el("selectKelasSiswa")?.value,
  ];
  if (!nama || !nis || !kelas) return showToast("Lengkapi data!", "warning");
  if (state.draft.some((d) => d.nis === nis))
    return showToast("NIS sudah di draft!", "warning");

  const btn = el("btnAddToDraft");
  if (!btn) return;

  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Cek NIS...`;
  if (window.lucide) window.lucide.createIcons({ root: btn });

  try {
    if (await adminService.checkNISExists(nis))
      return showToast("NIS sudah terdaftar!", "error");

    state.draft.push({
      nama_siswa: nama,
      nis,
      id_kelas: kelas,
      status_aktif: "Aktif",
    });

    const inputNama = el("inputNamaSiswa");
    const inputNIS = el("inputNISSiswa");
    if (inputNama) inputNama.value = "";
    if (inputNIS) inputNIS.value = "";
    if (inputNama) inputNama.focus();

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
  const countDraft = el("countDraft");
  const btnUpload = el("btnUploadBatch");

  if (!tbody) return;

  if (countDraft) countDraft.innerText = `Antrian: ${state.draft.length}`;
  if (btnUpload) {
    btnUpload.style.display = state.draft.length ? "flex" : "none";
    btnUpload.innerHTML = `<i data-lucide="rocket" class="w-4 h-4"></i> UPLOAD ${state.draft.length} DATA`;
  }

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
    if (btnUpload) window.lucide.createIcons({ root: btnUpload });
  }
}

// --- EVENTS ---
function setupEvents() {
  const filterKelas = el("filterKelasSiswa");
  const btnRefresh = el("btnRefreshStudents");
  const btnAddDraft = el("btnAddToDraft");
  const btnUpload = el("btnUploadBatch");
  const btnSaveKelas = el("btnSaveKelas");
  const checkAll = el("checkAll");
  const tbodySiswa = el("tbodySiswa");
  const btnDelete = el("btnDeleteSelected");
  const btnPromote = el("btnPromoteClass");
  const btnClosePromote = el("btnClosePromote");
  const btnCancelPromote = el("btnCancelPromote");
  const btnConfirmPromote = el("btnConfirmPromote");

  // Event: Filter Kelas
  filterKelas?.addEventListener("change", (e) =>
    loadStudentsByClass(e.target.value)
  );

  // Event: Refresh Students
  btnRefresh?.addEventListener("click", () => {
    const kls = el("filterKelasSiswa")?.value;
    if (kls) {
      delete state.studentsCache[kls];
      loadStudentsByClass(kls, true);
    } else {
      showToast("Pilih kelas", "info");
    }
  });

  // Event: Add to Draft
  btnAddDraft?.addEventListener("click", handleAddToDraft);

  // Event: Upload Batch
  btnUpload?.addEventListener("click", () => {
    if (state.draft.length === 0) return;
    showConfirm(`Upload ${state.draft.length} data?`, async () => {
      const btn = el("btnUploadBatch");
      if (!btn) return;

      const originalHTML = btn.innerHTML;
      try {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>...`;

        await adminService.uploadDraftBatch(state.draft);

        const affectedClasses = [
          ...new Set(state.draft.map((d) => d.id_kelas)),
        ];
        affectedClasses.forEach((kls) => delete state.studentsCache[kls]);

        showToast("Data Tersimpan!", "success");
        state.draft = [];
        renderDraftTable();

        const currentFilter = el("filterKelasSiswa")?.value;
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

  // Event: Save Kelas
  btnSaveKelas?.addEventListener("click", async () => {
    const inputKelas = el("inputKelasID");
    if (!inputKelas) return;

    const id = inputKelas.value.toUpperCase().trim();
    if (!id || state.classes.has(id))
      return showToast("Kelas invalid / duplikat", "warning");
    try {
      await adminService.createClass(id);
      state.classes.add(id);
      inputKelas.value = "";
      showToast("Kelas dibuat", "success");
      loadClasses(true);
    } catch (e) {
      showToast(e.message, "error");
    }
  });

  // Event: Check All
  checkAll?.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll(".student-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = isChecked;
      const id = cb.dataset.id;
      isChecked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
    });
    updateBatchUI();
  });

  // Event: Individual Checkbox
  tbodySiswa?.addEventListener("click", (e) => {
    if (e.target.classList.contains("student-checkbox")) {
      const id = e.target.dataset.id;
      const checked = e.target.checked;
      checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
      updateBatchUI();
    }
  });

  // Event: Batch Delete
  btnDelete?.addEventListener("click", () => {
    const selectedCount = state.selectedIds.size;
    if (selectedCount === 0) return;

    showConfirm(`Hapus ${selectedCount} siswa terpilih?`, async () => {
      const currentKelas = el("filterKelasSiswa")?.value;
      if (!currentKelas) return;

      try {
        await adminService.deleteStudentsBatch(
          Array.from(state.selectedIds),
          currentKelas
        );

        if (state.studentsCache[currentKelas]) {
          state.studentsCache[currentKelas] = state.studentsCache[
            currentKelas
          ].filter((s) => !state.selectedIds.has(s.id));
        }

        state.selectedIds.clear();
        showToast(`${selectedCount} Siswa dihapus`, "success");
        updateBatchUI();
        renderTable(state.studentsCache[currentKelas]);
      } catch (e) {
        console.error("Batch Delete Error:", e);
        showToast("Gagal menghapus: " + e.message, "error");
      }
    });
  });

  // Event: Promote Modal Open
  btnPromote?.addEventListener("click", () => {
    const modal = el("modalPromote");
    const promoteCount = el("promoteCount");
    const selectTarget = el("selectTargetPromote");
    const currentKelas = el("filterKelasSiswa")?.value;

    if (!modal) return;

    if (promoteCount) promoteCount.innerText = state.selectedIds.size;

    if (selectTarget) {
      selectTarget.innerHTML =
        '<option value="" disabled selected>-- Pilih Kelas Tujuan --</option>';
      Array.from(state.classes)
        .sort()
        .forEach(
          (c) =>
            c !== currentKelas && selectTarget.appendChild(new Option(c, c))
        );
    }

    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
  });

  // Event: Close Modal
  const closeModal = () => {
    const modal = el("modalPromote");
    if (!modal) return;
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 200);
  };

  btnClosePromote?.addEventListener("click", closeModal);
  btnCancelPromote?.addEventListener("click", closeModal);

  // Event: Confirm Promote
  btnConfirmPromote?.addEventListener("click", async () => {
    const target = el("selectTargetPromote")?.value;
    const source = el("filterKelasSiswa")?.value;

    if (!target) return showToast("Pilih kelas tujuan!", "warning");
    if (!source) return;

    try {
      await adminService.promoteStudentsBatch(
        Array.from(state.selectedIds),
        target,
        source
      );

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
  const cnt = state.selectedIds.size;
  const totalInTable = document.querySelectorAll(".student-checkbox").length;

  const countSelected = el("countSelected");
  const checkAll = el("checkAll");
  const btnPromote = el("btnPromoteClass");
  const btnDelete = el("btnDeleteSelected");

  if (countSelected) countSelected.innerText = cnt;
  if (checkAll) checkAll.checked = totalInTable > 0 && cnt === totalInTable;
  if (btnPromote) btnPromote.disabled = cnt === 0;
  if (btnDelete) btnDelete.disabled = cnt === 0;
}

// Global Handlers
window.removeDraft = (i) => {
  state.draft.splice(i, 1);
  renderDraftTable();
};

window.openSchoolSettings = async function () {
  const docRef = doc(db, "settings", "kepala_sekolah");

  // Loading sementara
  let currentData = { nama: "", nip: "" };

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      currentData = snap.data();
    }
  } catch (e) {
    console.error("Gagal ambil data settings", e);
    // Tetap lanjut agar modal muncul meski error fetch (bisa input baru)
  }

  // Form HTML
  const formHtml = `
        <div class="space-y-4 text-left">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                <p class="text-xs text-blue-600 dark:text-blue-300 flex items-center gap-2">
                    <i data-lucide="info" class="w-4 h-4"></i>
                    Data ini akan muncul di bagian Tanda Tangan PDF.
                </p>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Kepala Sekolah</label>
                <input type="text" id="set-nama" value="${currentData.nama}" 
                    placeholder="Contoh: Dr. H. Budi, M.Pd"
                    class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5">
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIP (Tanpa Spasi)</label>
                <input type="text" id="set-nip" value="${currentData.nip}" 
                    placeholder="Contoh: 198001012000121001"
                    class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5">
            </div>
        </div>
    `;

  // Tampilkan Modal
  showCustomModal("Pengaturan Kepala Sekolah", formHtml, async () => {
    const nama = document.getElementById("set-nama").value.trim();
    const nip = document.getElementById("set-nip").value.trim();

    if (!nama) {
      showToast("Nama Kepala Sekolah wajib diisi!", "error");
      return;
    }

    try {
      // Simpan ke Firestore
      await setDoc(docRef, { nama, nip }, { merge: true });
      showToast("Data Kepala Sekolah berhasil disimpan.", "success");
    } catch (error) {
      console.error(error);
      showToast("Gagal menyimpan: " + error.message, "error");
    }
  });
};

window.deleteStudent = (id, kelasId) =>
  showConfirm("Hapus siswa?", async () => {
    try {
      await adminService.deleteStudent(id, kelasId);

      if (state.studentsCache[kelasId]) {
        state.studentsCache[kelasId] = state.studentsCache[kelasId].filter(
          (s) => s.id !== id
        );
      }

      showToast("Terhapus", "success");
      renderTable(state.studentsCache[kelasId]);
    } catch (e) {
      showToast("Gagal menghapus", "error");
    }
  });

initAdmin();
