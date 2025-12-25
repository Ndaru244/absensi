// File: assets/js/pages/index.js
import { db } from '../firebase/config.js';
// 1. IMPORT MODUL UI (Penting)
import { showToast, showConfirm, showPrompt } from '../utils/ui.js'; 
import { 
    collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc, Timestamp 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// --- GLOBAL VARIABLES ---
let localRekapData = null; 
let currentDocId = null;
let isDirty = false;

// Setup Default Date
const datePicker = document.getElementById('datePicker');
if(datePicker) datePicker.valueAsDate = new Date();

// Load Dropdown Kelas
(async () => {
    try {
        const snap = await getDocs(collection(db, "kelas"));
        const picker = document.getElementById('kelasPicker');
        if(!picker) return;
        
        snap.forEach(d => {
            let opt = document.createElement('option');
            opt.value = d.id; 
            opt.text = d.data().nama_kelas;
            picker.appendChild(opt);
        });
    } catch (e) {
        showToast("Gagal memuat list kelas: " + e.message, "error");
    }
})();

// --- CORE FUNCTION: LOAD DATA ---
window.loadRekapData = async function() {
    const tgl = document.getElementById('datePicker').value;
    const kls = document.getElementById('kelasPicker').value;
    const loading = document.getElementById('loadingText');
    const table = document.getElementById('tabelAbsensi');
    const actionBtns = document.getElementById('actionButtons');
    const lockMsg = document.getElementById('lockedMessage');

    // [REVISI] Ganti alert dengan Toast Warning
    if(!tgl || !kls) return showToast("Pilih Tanggal & Kelas terlebih dahulu!", "warning");

    // Reset UI
    if(table) table.style.display = 'none';
    if(actionBtns) actionBtns.classList.add('hidden'); // Pakai class Tailwind 'hidden'
    if(lockMsg) lockMsg.classList.add('hidden');
    
    setDirty(false);
    if(loading) {
        loading.innerText = "⏳ Sedang memuat data...";
        loading.style.display = 'block';
    }

    currentDocId = `${tgl}_${kls}`;
    const rekapRef = doc(db, "rekap_absensi", currentDocId);

    try {
        let rekapSnap = await getDoc(rekapRef);

        if (!rekapSnap.exists()) {
            console.log("Data baru, ambil master siswa...");
            const q = query(collection(db, "siswa"), where("id_kelas", "==", kls), where("status_aktif", "==", "Aktif"));
            const siswaSnap = await getDocs(q);

            if(siswaSnap.empty) {
                loading.innerText = "Kelas ini belum memiliki data siswa.";
                // [REVISI] Error Toast
                return showToast("Kelas ini kosong (Master Data Siswa tidak ditemukan)!", "error");
            }

            let mapSiswa = {};
            siswaSnap.forEach(s => {
                mapSiswa[s.id] = { nama: s.data().nama_siswa, nis: s.data().nis, status: "Hadir" };
            });

            localRekapData = {
                tanggal: tgl,
                kelas: kls,
                siswa: mapSiswa,
                is_locked: false,
                created_at: null 
            };
            setDirty(true); 
            showToast("Membuat lembar absensi baru", "info");

        } else {
            console.log("Data loaded form DB...");
            localRekapData = rekapSnap.data();
        }

        renderTable(localRekapData);
        
        if(loading) loading.style.display = 'none';
        if(table) table.style.display = 'table';
        if(actionBtns) actionBtns.classList.remove('hidden'); // Munculkan tombol

        handleLockState();

    } catch (e) {
        console.error(e);
        if(loading) loading.innerText = "Error";
        showToast("Terjadi kesalahan: " + e.message, "error");
    }
};

function handleLockState() {
    const btnLock = document.getElementById('btnLock');
    const btnSave = document.getElementById('btnSave');
    const btnExport = document.getElementById('btnExport'); // <--- Ambil elemen tombol PDF
    const lockMsg = document.getElementById('lockedMessage');

    if(localRekapData.is_locked) {
        // --- KONDISI DATA SUDAH TERKUNCI (FINAL) ---
        if(lockMsg) lockMsg.classList.remove('hidden');
        
        // Sembunyikan tombol edit
        if(btnLock) btnLock.style.display = 'none';
        if(btnSave) btnSave.style.display = 'none';
        
        // MUNCULKAN TOMBOL PDF
        if(btnExport) btnExport.style.display = 'inline-block'; 

        disableAllInputs();

    } else {
        // --- KONDISI DATA MASIH DRAFT (EDITABLE) ---
        if(lockMsg) lockMsg.classList.add('hidden');
        
        // Munculkan tombol edit
        if(btnLock) btnLock.style.display = 'inline-block';
        if(btnSave) btnSave.style.display = 'inline-block';
        
        // SEMBUNYIKAN TOMBOL PDF (Belum boleh print)
        if(btnExport) btnExport.style.display = 'none'; 

        // Logic tombol Kunci (tetap sama)
        btnLock.onclick = () => {
            if(isDirty) return showToast("Simpan perubahan dulu sebelum mengunci data!", "warning");
            
            showConfirm("Apakah Anda yakin ingin mengunci data ini? Data yang dikunci tidak dapat diedit lagi.", async () => {
                try {
                    await updateDoc(doc(db, "rekap_absensi", currentDocId), { 
                        is_locked: true, 
                        locked_at: Timestamp.now()
                    });
                    showToast("Data berhasil dikunci!", "success");
                    loadRekapData(); // Refresh UI agar tombol PDF muncul
                } catch (e) {
                    showToast("Gagal mengunci: " + e.message, "error");
                }
            });
        };
    }
}

function renderTable(data) {
    const tbody = document.getElementById('tbodySiswa');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const siswaMap = data.siswa;
    const sortedKeys = Object.keys(siswaMap).sort((a,b) => siswaMap[a].nama.localeCompare(siswaMap[b].nama));

    sortedKeys.forEach(siswaId => {
        const s = siswaMap[siswaId];
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b border-gray-100 dark:border-gray-700";
        
        // Cek apakah ada keterangan?
        const keteranganHTML = s.keterangan && s.keterangan !== '-' 
            ? `<div class="mt-1 text-xs text-amber-600 dark:text-amber-400 italic">📝 "${s.keterangan}"</div>` 
            : '';

        tr.innerHTML = `
            <td class="p-4 align-top">
                <div class="font-bold text-gray-800 dark:text-gray-100">${s.nama}</div>
                <div class="text-xs text-gray-500 font-mono">${s.nis || '-'}</div>
                ${keteranganHTML} </td>
            <td class="p-4 align-top">
                <div class="flex flex-wrap gap-2">
                    ${renderRadio(siswaId, 'Hadir', s.status)}
                    ${renderRadio(siswaId, 'Sakit', s.status)}
                    ${renderRadio(siswaId, 'Izin', s.status)}
                    ${renderRadio(siswaId, 'Alpa', s.status)}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Helper render radio button cantik (Tailwind)
function renderRadio(name, value, currentStatus) {
    const isChecked = currentStatus === value ? 'checked' : '';
    let colorClass = "";
    if(value === 'Hadir') colorClass = "peer-checked:bg-green-600 peer-checked:text-white";
    if(value === 'Sakit') colorClass = "peer-checked:bg-yellow-500 peer-checked:text-white";
    if(value === 'Izin') colorClass = "peer-checked:bg-blue-500 peer-checked:text-white";
    if(value === 'Alpa') colorClass = "peer-checked:bg-red-600 peer-checked:text-white";

    return `
    <label class="cursor-pointer">
        <input type="radio" name="${name}" value="${value}" ${isChecked} onchange="updateStatusLocal('${name}', '${value}')" class="peer sr-only">
        <span class="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-bold transition-all hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${colorClass}">
            ${value}
        </span>
    </label>
    `;
}

window.updateStatusLocal = function(siswaId, newStatus) {
    if(!localRekapData) return;
    
    // Cek jika status berubah
    if(localRekapData.siswa[siswaId].status !== newStatus) {
        
        // Logic Khusus: Izin atau Alpa minta keterangan
        if(newStatus === 'Izin' || newStatus === 'Alpa') {
            
            showPrompt(`Masukkan alasan untuk status ${newStatus}:`, (keterangan) => {
                // Callback ini jalan setelah user klik Simpan/Skip
                localRekapData.siswa[siswaId].status = newStatus;
                localRekapData.siswa[siswaId].keterangan = keterangan; // Simpan keterangan
                
                setDirty(true);
                renderTable(localRekapData); // Render ulang agar teks muncul
            });

        } else {
            // Kalau Hadir/Sakit, kita reset keterangannya jadi '-' atau kosong
            localRekapData.siswa[siswaId].status = newStatus;
            localRekapData.siswa[siswaId].keterangan = '-'; 
            
            setDirty(true);
            renderTable(localRekapData); // Render ulang (opsional, untuk update visual radio)
        }
    }
};

window.saveDataToFirestore = function() {
    // Validasi awal
    if(!currentDocId || !localRekapData) return;
    
    // Gunakan showConfirm dari ui.js
    showConfirm("Apakah Anda yakin ingin menyimpan perubahan data absensi ini ke database?", async () => {
        const btnSave = document.getElementById('btnSave');
        
        try {
            // UI Feedback: Loading State
            btnSave.innerText = "⏳ Menyimpan...";
            btnSave.disabled = true;

            // Pastikan timestamp ada untuk data baru
            if(!localRekapData.created_at) {
                localRekapData.created_at = Timestamp.now();
            }

            // Eksekusi Simpan ke Firestore
            await setDoc(doc(db, "rekap_absensi", currentDocId), localRekapData, { merge: true });
            
            // UI Feedback: Sukses
            showToast("Data berhasil disimpan ke server!", "success");
            setDirty(false); // Reset indikator 'unsaved changes'

        } catch(e) { 
            console.error(e); 
            showToast("Gagal menyimpan: " + e.message, "error"); 
        } finally { 
            // UI Feedback: Reset Tombol
            btnSave.innerText = "💾 SIMPAN"; 
            btnSave.disabled = false; 
        }
    });
};

function setDirty(status) {
    isDirty = status;
    const msg = document.getElementById('unsavedMsg');
    if(msg) {
        if(status) msg.classList.remove('hidden');
        else msg.classList.add('hidden');
    }
}

function disableAllInputs() {
    document.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);
}

// Export PDF (Logic tetap sama)
window.exportToPDF = function() {
    // 1. Validasi Data
    if (!localRekapData || !localRekapData.siswa) {
        return showToast("Data absensi belum dimuat!", "error");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Ambil Info Header
    const tgl = document.getElementById('datePicker').value;
    const klsEl = document.getElementById('kelasPicker');
    const klsText = klsEl.options[klsEl.selectedIndex].text;
    
    // --- HEADER LAPORAN ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("LAPORAN ABSENSI HARIAN", 105, 20, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Kelas       : ${klsText}`, 14, 35);
    doc.text(`Tanggal     : ${tgl}`, 14, 41);

    // --- HITUNG STATISTIK (Hadir, Sakit, dll) ---
    let stats = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
    
    // Persiapkan Data Baris (Ambil langsung dari localRekapData)
    const siswaMap = localRekapData.siswa;
    // Sort berdasarkan nama
    const sortedKeys = Object.keys(siswaMap).sort((a, b) => 
        siswaMap[a].nama.localeCompare(siswaMap[b].nama)
    );
    
    const rows = sortedKeys.map((key, index) => {
        const s = siswaMap[key];
        
        // Update Statistik
        if (stats[s.status] !== undefined) stats[s.status]++;
        
        return [
            index + 1,              // No
            s.nis || '-',           // NIS
            s.nama,                 // Nama Lengkap
            s.status,               // Status
            s.keterangan || '-'     // Keterangan
        ];
    });

    // Tampilkan Statistik di Header
    doc.setFont("helvetica", "bold");
    doc.text(
        `Ringkasan: Hadir (${stats.Hadir}) | Sakit (${stats.Sakit}) | Izin (${stats.Izin}) | Alpa (${stats.Alpa})`, 
        14, 48
    );

    // --- RENDER TABEL ---
    doc.autoTable({
        startY: 55,
        head: [['No', 'NIS', 'Nama Siswa', 'Status', 'Keterangan']],
        body: rows,
        theme: 'grid', // Tampilan grid kotak-kotak rapi
        headStyles: { 
            fillColor: [55, 65, 81], // Warna header abu gelap (sesuai tema UI)
            textColor: 255,
            halign: 'center',
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 }, // No
            1: { halign: 'center', cellWidth: 25 }, // NIS
            3: { halign: 'center', cellWidth: 25 }, // Status
            4: { cellWidth: 'auto' }                // Keterangan (Flexible)
        },
        styles: { 
            fontSize: 10, 
            cellPadding: 3,
            valign: 'middle'
        },
        // Mewarnai baris berdasarkan status (Visual Feedback di PDF)
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 3) {
                const status = data.cell.raw;
                if (status === 'Sakit') data.cell.styles.textColor = [202, 138, 4]; // Kuning gelap
                if (status === 'Izin') data.cell.styles.textColor = [37, 99, 235];  // Biru
                if (status === 'Alpa') data.cell.styles.textColor = [220, 38, 38];  // Merah
            }
        }
    });

    // --- AREA TANDA TANGAN ---
    // Cek posisi Y terakhir agar tidak menabrak tabel
    const finalY = doc.lastAutoTable.finalY + 20;
    
    // Jika terlalu bawah, pindah halaman
    if (finalY > 250) {
        doc.addPage();
        doc.text("Mengetahui,", 140, 20);
        doc.text("Wali Kelas / Guru Piket", 140, 25);
        doc.text("( ..................................... )", 140, 50);
    } else {
        doc.text("Mengetahui,", 140, finalY);
        doc.text("Wali Kelas / Guru Piket", 140, finalY + 5);
        doc.text("( ..................................... )", 140, finalY + 30);
    }

    // --- SIMPAN FILE ---
    doc.save(`Laporan_Absensi_${klsText}_${tgl}.pdf`);
    showToast("PDF berhasil diunduh!", "success");
};