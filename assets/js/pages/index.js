import { auth, db } from "../firebase/config.js";
import { attendanceService } from "../firebase/attendance-service.js";
import { adminService } from "../firebase/admin-service.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { showToast, showConfirm, showCustomModal } from "../utils/ui.js";
import { exportToPDF, exportMonthlyPDF } from "../utils/pdf-helper.js";

let state = {
  localData: null,
  currentDocId: null,
  isDirty: false,
  monthlyCache: null,
  // Default Values sebelum data ter-load dari Firestore
  currentUser: {
    nama: "Memuat...",
    nip: "-",
  },
  kepalaSekolah: {
    nama: "..........................",
    nip: "..........................",
  },
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      // Kita ambil 2 data sekaligus (Parallel Fetching) agar cepat:
      // 1. Data User (Guru Piket) dari 'users/{uid}'
      // 2. Data Kepsek dari 'settings/kepala_sekolah'
      const [userSnap, kepsekSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDoc(doc(db, "settings", "kepala_sekolah")),
      ]);

      // A. SET GURU PIKET
      if (userSnap.exists()) {
        const uData = userSnap.data();
        state.currentUser = {
          nama: uData.nama || user.displayName || "Guru Piket",
          nip: uData.nip || "-",
        };
      } else {
        state.currentUser = { nama: user.displayName || "Admin", nip: "-" };
      }

      // B. SET KEPALA SEKOLAH
      if (kepsekSnap.exists()) {
        const kData = kepsekSnap.data();
        state.kepalaSekolah = {
          nama: kData.nama || "..........................",
          nip: kData.nip || "..........................",
        };
      } else {
        console.warn("Data settings/kepala_sekolah belum dibuat di Firestore!");
      }
    } catch (e) {
      console.error("Gagal ambil data profil/settings:", e);
      showToast("Gagal memuat data profil", "error");
    }
  }
});

window.exportToPDF = () => {
  // 1. Validasi keberadaan data
  if (!state.localData)
    return showToast("Data absensi belum dimuat!", "warning");

  // 2. Validasi status kunci (Policy: Export hanya bisa dilakukan jika data terkunci)
  if (!state.localData.is_locked)
    return showToast("Kunci data dulu!", "warning");

  // 3. Susun Payload Lengkap
  const payload = {
    tanggal: state.localData.tanggal,
    siswa: state.localData.siswa,
    guruPiket: state.currentUser, // Mengambil Object {nama, nip}
    kepalaSekolah: state.kepalaSekolah, // Mengambil Object {nama, nip}
  };

  const kelasId = document.getElementById("kelasPicker").value;

  // 5. Eksekusi fungsi dari pdf-helper.js
  exportToPDF(payload, kelasId);
};

// --- INIT ---
(async () => {
  const [datePicker, picker] = [
    document.getElementById("datePicker"),
    document.getElementById("kelasPicker"),
  ];

  if (datePicker) datePicker.valueAsDate = new Date();

  if (picker) {
    try {
      const classes = await adminService.getClasses();
      classes
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
        .forEach((c) => picker.add(new Option(c.id, c.id)));
    } catch (e) {
      console.error(e);
    }
  }

  // Restore draft dari localStorage
  const saved = localStorage.getItem("absensi_draft");
  if (saved) {
    state.localData = JSON.parse(saved);
    if (datePicker) datePicker.value = state.localData.tanggal;
    if (picker) picker.value = state.localData.kelas;
    state.currentDocId = `${state.localData.tanggal}_${state.localData.kelas}`;

    ["tabelAbsensi", "actionButtons"].forEach((id) =>
      document.getElementById(id)?.classList.remove("hidden")
    );
    document.getElementById("loadingText").style.display = "none";
    renderTable();
    setDirty(true);
    showToast("Draft dipulihkan", "info");
  }
})();

// --- LOGIC UTAMA ---
window.loadRekapData = async () => {
  const tgl = document.getElementById("datePicker").value;
  const kls = document.getElementById("kelasPicker").value;

  if (!tgl || !kls) return showToast("Pilih Tanggal & Kelas!", "warning");

  const newDocId = `${tgl}_${kls}`;
  if (state.localData && state.currentDocId === newDocId) return;

  state.currentDocId = newDocId;
  const loading = document.getElementById("loadingText");
  loading.style.display = "block";
  loading.innerText = "⏳ Mengambil data...";
  document.getElementById("tabelAbsensi").classList.add("hidden");

  try {
    // Cek draft vs server
    if (
      !(
        state.isDirty &&
        state.localData?.tanggal === tgl &&
        state.localData?.kelas === kls
      )
    ) {
      let data = await attendanceService.getRekap(state.currentDocId);

      if (!data) {
        const master = await attendanceService.getMasterSiswa(kls);
        if (!Object.keys(master).length)
          throw new Error("Kelas Kosong / Belum ada Siswa");

        data = {
          tanggal: tgl,
          kelas: kls,
          siswa: master,
          is_locked: false,
        };
        setDirty(true);
        showToast("Lembar absensi baru dibuat", "info");
      }
      state.localData = data;
    }

    loading.style.display = "none";
    ["tabelAbsensi", "actionButtons"].forEach((id) =>
      document.getElementById(id)?.classList.remove("hidden")
    );
    renderTable();
    handleLockState();
  } catch (e) {
    loading.innerText = "Error: " + e.message;
    showToast(e.message, "error");
  }
};

function renderTable() {
  const tbody = document.getElementById("tbodySiswa");
  const { siswa } = state.localData;

  tbody.innerHTML = Object.keys(siswa)
    .sort((a, b) => siswa[a].nama.localeCompare(siswa[b].nama))
    .map((id) => {
      const s = siswa[id];
      // Styling badge keterangan
      const ketBadge =
        s.keterangan && s.keterangan !== "-"
          ? `<span class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                    <i data-lucide="sticky-note" class="w-3 h-3"></i> ${s.keterangan}
                   </span>`
          : "";

      return `
            <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition group">
                <td class="p-4 align-top">
                    <div class="font-bold text-gray-800 dark:text-gray-200">${
                      s.nama
                    }</div>
                    <div class="text-xs text-gray-500 font-mono">${
                      s.nis || "-"
                    }</div>
                    ${ketBadge}
                </td>
                <td class="p-4 align-top">
                    <div class="flex flex-wrap gap-2">
                        ${["Hadir", "Sakit", "Izin", "Alpa"]
                          .map(
                            (st) => `
                                <button onclick="updateStatus('${id}', '${st}')" 
                                    class="px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition-all transform active:scale-95 flex items-center gap-1 
                                    ${
                                      s.status === st
                                        ? _getColor(st)
                                        : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-200"
                                    }">
                                    ${
                                      st === "Hadir" && s.status === "Hadir"
                                        ? '<i data-lucide="check" class="w-3 h-3"></i>'
                                        : ""
                                    } 
                                    ${st}
                                </button>
                            `
                          )
                          .join("")}
                    </div>
                </td>
            </tr>`;
    })
    .join("");

  if (window.lucide) window.lucide.createIcons({ root: tbody });
}

function _getColor(st) {
  const c = {
    Hadir:
      "bg-green-600 text-white border-green-700 ring-2 ring-green-200 dark:ring-green-900",
    Sakit:
      "bg-yellow-500 text-white border-yellow-600 ring-2 ring-yellow-200 dark:ring-yellow-900",
    Izin: "bg-blue-600 text-white border-blue-700 ring-2 ring-blue-200 dark:ring-blue-900",
    Alpa: "bg-red-600 text-white border-red-700 ring-2 ring-red-200 dark:ring-red-900",
  };
  return c[st];
}

// --- IMPLEMENTASI BARU: showCustomModal ---
window.updateStatus = (id, newStatus) => {
  if (state.localData.is_locked) return showToast("Data terkunci!", "warning");

  const s = state.localData.siswa[id];

  // Fungsi internal update state
  const executeUpdate = (ket = "-") => {
    s.status = newStatus;
    s.keterangan = ket;
    setDirty(true);
    renderTable();
    // Auto-save draft
    localStorage.setItem("absensi_draft", JSON.stringify(state.localData));
  };

  // Jika Sakit, Izin, atau Alpa -> Buka Modal Keterangan
  if (["Sakit", "Izin", "Alpa"].includes(newStatus)) {
    // Ambil keterangan lama jika ada, biar user gak ngetik ulang kalau cuma mau edit
    const oldKet = s.keterangan !== "-" ? s.keterangan : "";

    // Template HTML Modal
    const htmlContent = `
            <div class="space-y-3 text-left">
                <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex gap-2">
                    <i data-lucide="info" class="w-4 h-4 shrink-0"></i>
                    <span>Masukkan alasan untuk status <strong>${newStatus}</strong>.</span>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan / Alasan</label>
                    <textarea id="input-keterangan" rows="3" 
                        class="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white p-3 focus:ring-blue-500 focus:border-blue-500 text-sm" 
                        placeholder="Contoh: Demam tinggi, Acara keluarga, Tanpa keterangan...">${oldKet}</textarea>
                </div>
            </div>
        `;

    showCustomModal(`Update Status: ${newStatus}`, htmlContent, () => {
      // Callback saat tombol Simpan ditekan
      const val = document.getElementById("input-keterangan").value.trim();
      executeUpdate(val || "-"); // Jika kosong simpan "-"
    });

    // Re-init icon di dalam modal
    setTimeout(() => lucide.createIcons(), 50);
  } else {
    // Jika Hadir, langsung update tanpa modal
    executeUpdate("-");
  }
};

window.saveDataToFirestore = () =>
  showConfirm("Simpan data ke server?", async () => {
    const btn = document.getElementById("btnSave");
    try {
      btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...`;
      if (window.lucide) window.lucide.createIcons({ root: btn });
      btn.disabled = true;

      await attendanceService.saveRekap(state.currentDocId, state.localData);

      showToast("Data berhasil disimpan!", "success");
      setDirty(false);
      // Hapus draft setelah sukses save
      localStorage.removeItem("absensi_draft");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      btn.innerHTML = `<i data-lucide="save" class="w-5 h-5"></i> SIMPAN`;
      btn.disabled = false;
      if (window.lucide) window.lucide.createIcons({ root: btn });
    }
  });

function setDirty(val) {
  state.isDirty = val;
  document.getElementById("unsavedMsg")?.classList.toggle("hidden", !val);
}

function handleLockState() {
  const isLocked = state.localData.is_locked;
  document
    .getElementById("lockedMessage")
    ?.classList.toggle("hidden", !isLocked);
  ["btnSave", "btnLock"].forEach(
    (id) =>
      (document.getElementById(id).style.display = isLocked ? "none" : "flex")
  );

  const btnPdf = document.getElementById("btnExport");
  if (isLocked) {
    btnPdf.classList.remove("opacity-50", "cursor-not-allowed");
    btnPdf.disabled = false;
  } else {
    btnPdf.classList.add("opacity-50", "cursor-not-allowed");
    btnPdf.disabled = true;
  }
}

document.getElementById("btnLock").onclick = () =>
  state.isDirty
    ? showToast("Simpan perubahan dulu!", "warning")
    : showConfirm(
        "Kunci data permanen? Data tidak bisa diedit lagi.",
        async () => {
          await attendanceService.lockRekap(state.currentDocId);
          state.localData.is_locked = true;
          handleLockState();
          showToast("Data terkunci", "success");
        }
      );

// --- MONTHLY REPORT (Tetap menggunakan Logic Modal HTML bawaan) ---
// Catatan: Monthly report biasanya tabelnya besar, jadi tidak cocok dimasukkan ke showCustomModal (max-w-md).
// Kita biarkan logic ini menggunakan container modal bawaan di HTML, tapi logicnya kita rapikan.

window.openMonthlyModal = () => {
  document.getElementById("modalMonthly").classList.remove("hidden");
  const p = document.getElementById("monthPickerReport");
  if (!p.value) p.value = new Date().toISOString().slice(0, 7); // Default bulan ini
};

window.closeMonthlyModal = () =>
  document.getElementById("modalMonthly").classList.add("hidden");

window.loadMonthlyReport = async () => {
  const kls = document.getElementById("kelasPicker").value;
  const month = document.getElementById("monthPickerReport").value;
  const tbody = document.getElementById("tbodyBulanan");

  if (!kls || !month) return showToast("Pilih Kelas & Bulan!", "warning");

  // Reset UI & Tampilkan Loader
  tbody.innerHTML =
    '<tr><td colspan="40" class="p-8 text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div> Memproses data...</td></tr>';
  document.getElementById("btnPrintMonthly").style.display = "none";

  try {
    const [master, reports] = await Promise.all([
      attendanceService.getMasterSiswa(kls),
      attendanceService.getMonthlyReport(kls, month),
    ]);

    // Simpan ke cache untuk proses Export PDF nanti
    state.monthlyCache = { master, reports, monthStr: month };

    const [year, monthNum] = month.split("-");
    const days = new Date(year, monthNum, 0).getDate();

    // 1. Render Header (Nama Siswa + Tanggal 1-31 + Statistik)
    let headHtml =
      '<th class="p-3 sticky left-0 bg-gray-100 dark:bg-gray-700 z-30 border dark:border-gray-600 min-w-[150px] shadow-sm">Nama Siswa</th>';
    for (let i = 1; i <= days; i++) {
      headHtml += `<th class="p-1 text-center min-w-[30px] border dark:border-gray-600 text-[10px] text-gray-500">${i}</th>`;
    }
    headHtml += `
            <th class="p-2 border bg-green-100 text-green-800 text-xs">H</th>
            <th class="p-2 border bg-yellow-100 text-yellow-800 text-xs">S</th>
            <th class="p-2 border bg-blue-100 text-blue-800 text-xs">I</th>
            <th class="p-2 border bg-red-100 text-red-800 text-xs">A</th>
        `;
    document.getElementById("headerRowBulanan").innerHTML = headHtml;

    // 2. Mapping Data (FIXED: Menggunakan Array.from agar objek tiap hari unik)
    let map = {};
    Object.keys(master).forEach((id) => {
      // Memastikan setiap hari memiliki objek "status" & "keterangan" sendiri di memori
      map[id] = Array.from({ length: days + 1 }, () => ({
        status: "-",
        keterangan: "-",
      }));
    });

    // Isi map dengan data real dari laporan harian
    reports.forEach((r) => {
      const d = parseInt(r.tanggal.split("-")[2]);
      if (r.siswa) {
        Object.keys(r.siswa).forEach((id) => {
          if (map[id]) {
            map[id][d] = {
              status: r.siswa[id].status || "-",
              keterangan: r.siswa[id].keterangan || "-",
            };
          }
        });
      }
    });

    // 3. Render Body
    tbody.innerHTML = Object.keys(master)
      .sort((a, b) => master[a].nama.localeCompare(master[b].nama))
      .map((id) => {
        let rowHtml = `<td class="p-2 font-medium sticky left-0 bg-white dark:bg-darkcard border-r border-b dark:border-gray-700 z-20 whitespace-nowrap shadow-sm text-sm">${master[id].nama}</td>`;
        let st = { H: 0, S: 0, I: 0, A: 0 };

        for (let i = 1; i <= days; i++) {
          const dataHari = map[id][i];
          const s = dataHari.status;

          if (s === "Hadir") st.H++;
          else if (s === "Sakit") st.S++;
          else if (s === "Izin") st.I++;
          else if (s === "Alpa") st.A++;

          const badge =
            {
              Hadir: '<span class="text-green-600 font-bold">H</span>',
              Sakit: '<span class="text-yellow-600 font-bold text-lg">S</span>',
              Izin: '<span class="text-blue-600 font-bold text-lg">I</span>',
              Alpa: '<span class="text-red-600 font-bold text-lg">A</span>',
              "-": '<span class="text-gray-200 dark:text-gray-700">.</span>',
            }[s] || '<span class="text-gray-200">.</span>';

          const title =
            dataHari.keterangan !== "-"
              ? `Tgl ${i}: ${dataHari.keterangan}`
              : "";
          rowHtml += `<td class="p-0 text-center border dark:border-gray-700 bg-white dark:bg-darkcard h-8 text-[10px] font-mono cursor-default hover:bg-gray-50" title="${title}">${badge}</td>`;
        }

        return `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    ${rowHtml}
                    <td class="text-center font-bold text-xs text-green-700 border bg-green-50/30">${st.H}</td>
                    <td class="text-center font-bold text-xs text-yellow-700 border bg-yellow-50/30">${st.S}</td>
                    <td class="text-center font-bold text-xs text-blue-700 border bg-blue-50/30">${st.I}</td>
                    <td class="text-center font-bold text-xs text-red-700 border bg-red-50/30">${st.A}</td>
                </tr>`;
      })
      .join("");

    document.getElementById("btnPrintMonthly").style.display = "flex";
  } catch (e) {
    console.error("Monthly Load Error:", e);
    tbody.innerHTML = `<tr><td colspan="40" class="p-4 text-center text-red-500">❌ ${e.message}</td></tr>`;
  }
};

window.printMonthlyData = () => {
  if (state.monthlyCache?.master) {
    exportMonthlyPDF(
      state.monthlyCache.master,
      state.monthlyCache.reports,
      state.monthlyCache.monthStr,
      document.getElementById("kelasPicker").value,
      {
        // Data REAL dari Firestore
        guruPiket: state.currentUser,
        kepalaSekolah: state.kepalaSekolah,
      }
    );
  } else {
    showToast("Data belum siap!", "error");
  }
};
