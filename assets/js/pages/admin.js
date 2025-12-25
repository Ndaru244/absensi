// File: assets/js/pages/admin.js
import { db } from '../firebase/config.js'; 
import { showToast, showConfirm } from '../utils/ui.js'; // Import showConfirm
import { 
    doc, setDoc, collection, getDocs, writeBatch 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// --- GLOBAL STATE ---
let draftList = []; 
let existingKelas = new Set();

// --- 1. LOAD DATA KELAS ---
async function loadKelasOption() {
    try {
        const querySnapshot = await getDocs(collection(db, "kelas"));
        const select = document.getElementById('selectKelasSiswa');
        
        select.innerHTML = '<option value="">-- Pilih Kelas --</option>';
        existingKelas.clear();

        querySnapshot.forEach((doc) => {
            existingKelas.add(doc.id);
            const opt = document.createElement('option');
            opt.value = doc.id; 
            opt.text = doc.data().nama_kelas;
            select.appendChild(opt);
        });
    } catch (e) {
        showToast("Gagal memuat data kelas: " + e.message, "error");
    }
}
loadKelasOption();

// --- 2. LOGIC: TAMBAH DRAFT ---
const btnDraft = document.getElementById('btnAddToDraft');
if (btnDraft) {
    btnDraft.addEventListener('click', () => {
        const namaInput = document.getElementById('inputNamaSiswa');
        const nisInput = document.getElementById('inputNISSiswa');
        const kelasInput = document.getElementById('selectKelasSiswa');

        const nama = namaInput.value.trim();
        const nis = nisInput.value.trim();
        const kelasId = kelasInput.value;

        if(!nama || !nis || !kelasId) {
            return showToast("Data siswa belum lengkap!", "warning");
        }

        const isDuplicate = draftList.some(item => item.nis === nis);
        if(isDuplicate) {
            return showToast(`NIS ${nis} sudah ada di antrian!`, "error");
        }

        draftList.push({
            nama_siswa: nama,
            nis: nis,
            id_kelas: kelasId,
            status_aktif: "Aktif"
        });

        // Reset & Focus
        namaInput.value = '';
        nisInput.value = '';
        namaInput.focus();
        
        showToast("Masuk antrian", "success");
        renderDraftTable();
    });
}

// --- 3. RENDER TABEL DENGAN TOMBOL TAILWIND ---
function renderDraftTable() {
    const tbody = document.getElementById('tbodyDraft');
    const btnUpload = document.getElementById('btnUploadBatch');
    const countSpan = document.getElementById('countDraft');
    
    tbody.innerHTML = '';
    
    // Update Counter jika elemen ada
    if(countSpan) countSpan.innerText = draftList.length;

    if (draftList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-400 italic">Antrian kosong...</td></tr>';
        if(btnUpload) btnUpload.style.display = 'none';
        return;
    }

    if(btnUpload) {
        btnUpload.style.display = 'inline-flex';
        btnUpload.innerHTML = `<span>🚀</span> UPLOAD ${draftList.length} DATA`;
    }

    draftList.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b border-gray-100 dark:border-gray-700 last:border-0";
        
        // PERBAIKAN TOMBOL HAPUS DISINI
        tr.innerHTML = `
            <td class="p-4 font-medium text-gray-800 dark:text-gray-200">${item.nama_siswa}</td>
            <td class="p-4 font-mono text-gray-500 text-sm">${item.nis}</td>
            <td class="p-4"><span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded text-xs font-bold">${item.id_kelas}</span></td>
            <td class="p-4 text-center">
                <button onclick="window.hapusDraft(${index})" 
                    class="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow transition flex items-center justify-center mx-auto gap-1">
                    🗑️ Hapus
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Global Hapus Function
window.hapusDraft = function(index) {
    // Kita hapus langsung tanpa confirm karena ini baru draft (UX lebih cepat)
    draftList.splice(index, 1);
    renderDraftTable();
    showToast("Data dihapus dari draft", "info");
};

// --- 4. UPLOAD BATCH KE FIRESTORE ---
const btnUpload = document.getElementById('btnUploadBatch');
if (btnUpload) {
    btnUpload.addEventListener('click', async () => {
        if(draftList.length === 0) return;
        
        // GANTI CONFIRM BAWAAN DENGAN MODAL CUSTOM
        showConfirm(`Yakin ingin menyimpan ${draftList.length} siswa ini ke database?`, async () => {
            
            // Logic Upload (Dijalankan jika user klik Ya)
            try {
                btnUpload.disabled = true;
                btnUpload.innerHTML = "⏳ Sedang Mengupload...";
                
                const batch = writeBatch(db);
                draftList.forEach(siswa => {
                    const newDocRef = doc(collection(db, "siswa"));
                    batch.set(newDocRef, siswa);
                });

                await batch.commit();

                showToast(`BERHASIL! ${draftList.length} siswa tersimpan.`, "success");
                draftList = [];
                renderDraftTable();

            } catch (e) {
                console.error(e);
                showToast("Gagal Upload: " + e.message, "error");
            } finally {
                btnUpload.disabled = false;
            }
        });
    });
}

// --- 5. LOGIC SIMPAN KELAS ---
const btnSaveKelas = document.getElementById('btnSaveKelas');
if(btnSaveKelas) {
    btnSaveKelas.addEventListener('click', async () => {
        const idInput = document.getElementById('inputKelasID');
        const id = idInput.value.toUpperCase().trim();
        
        if (!id) return showToast("Kode Kelas kosong!", "warning");
        if (existingKelas.has(id)) return showToast(`Kelas "${id}" sudah ada!`, "error");

        try {
            await setDoc(doc(db, "kelas", id), { nama_kelas: id });
            showToast(`Kelas ${id} berhasil dibuat!`, "success");
            
            existingKelas.add(id);
            const select = document.getElementById('selectKelasSiswa');
            const opt = document.createElement('option');
            opt.value = id; opt.text = id;
            select.appendChild(opt);
            idInput.value = '';

        } catch (e) { 
            showToast("Error: " + e.message, "error"); 
        }
    });
}