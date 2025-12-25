import { adminService } from '../firebase/admin-service.js';
import { showToast, showConfirm, initTheme } from '../utils/ui.js';

// Helper Singkat untuk ambil elemen DOM
const el = (id) => document.getElementById(id);
const state = { classes: new Set(), students: [], draft: [], selectedIds: new Set() };

async function initAdmin() {
    initTheme();
    await loadClasses();
    setupEventListeners();
}

// --- 1. LOAD CLASSES ---
async function loadClasses() {
    const [select, filter] = [el('selectKelasSiswa'), el('filterKelasSiswa')];
    if(select) select.innerHTML = '<option>Loading...</option>';
    if(filter) filter.innerHTML = '<option>Loading...</option>';

    try {
        const data = await adminService.getClasses();
        state.classes.clear();
        data.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true}));
        
        const opts = data.map(c => {
            state.classes.add(c.id);
            return `<option value="${c.id}">${c.id}</option>`;
        }).join('');

        if (select) select.innerHTML = '<option value="">-- Pilih Kelas --</option>' + opts;
        if (filter) filter.innerHTML = '<option value="" disabled selected>-- Pilih Kelas Data --</option>' + opts;
    } catch (e) {
        console.error(e);
        showToast("Gagal memuat data kelas.", "error");
    }
}

// --- 2. LOAD STUDENTS ---
async function loadStudentsByClass(kelasId) {
    const tbody = el('tbodySiswa');
    if (!kelasId) return;

    state.selectedIds.clear();
    updateBatchUI();

    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div><p class="mt-2 text-gray-500 text-sm">Mengambil data...</p></td></tr>`;
    
    try {
        state.students = await adminService.getStudentsByClass(kelasId);
        renderTable();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500">❌ Gagal memuat data</td></tr>';
        showToast(err.message, "error");
    }
}

function renderTable() {
    const tbody = el('tbodySiswa');
    if (!state.students.length) return tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400 italic">📭 Kelas kosong</td></tr>';
    
    state.students.sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));
    tbody.innerHTML = state.students.map(s => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 border-b dark:border-gray-700 group">
            <td class="p-4"><input type="checkbox" class="student-checkbox w-4 h-4 rounded cursor-pointer" data-id="${s.id}" ${state.selectedIds.has(s.id) ? 'checked' : ''}></td>
            <td class="p-4 font-medium dark:text-gray-100">${s.nama_siswa}</td>
            <td class="p-4 text-xs text-gray-500 font-mono">${s.nis}</td>
            <td class="p-4"><span class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded text-xs font-bold">${s.id_kelas}</span></td>
            <td class="p-4 text-center"><button onclick="window.deleteStudent('${s.id}')" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 px-2 transition">🗑️</button></td>
        </tr>
    `).join('');
}

// --- 3. DRAFT & INPUT ---
async function handleAddToDraft() {
    const [namaIn, nisIn, klsIn, btn] = [el('inputNamaSiswa'), el('inputNISSiswa'), el('selectKelasSiswa'), el('btnAddToDraft')];
    const [nama, nis, kelas] = [namaIn.value.trim(), nisIn.value.trim(), klsIn.value];

    if (!nama || !nis || !kelas) return showToast("Lengkapi data!", "warning");
    if (state.draft.some(d => d.nis === nis)) return showToast(`NIS ${nis} sudah di draft!`, "error");

    try {
        btn.disabled = true; btn.innerText = "🔍 Cek NIS...";
        if (await adminService.checkNISEXists(nis)) return showToast(`NIS ${nis} sudah terdaftar di database!`, "error");
    } catch (e) { return showToast("Gagal cek NIS.", "error"); } 
    finally { btn.disabled = false; btn.innerText = "⬇️ Masuk Antrian"; }

    state.draft.push({ nama_siswa: nama, nis, id_kelas: kelas, status_aktif: 'Aktif' });
    namaIn.value = ''; nisIn.value = ''; namaIn.focus();
    renderDraftTable();
    showToast("Masuk antrian", "success");
}

function renderDraftTable() {
    const tbody = el('tbodyDraft');
    const btn = el('btnUploadBatch');
    
    el('countDraft').innerText = `Antrian: ${state.draft.length}`;
    btn.style.display = state.draft.length ? 'block' : 'none';
    if(state.draft.length) btn.innerHTML = `🚀 UPLOAD ${state.draft.length} DATA`;

    tbody.innerHTML = state.draft.length ? state.draft.map((d, i) => `
        <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            <td class="p-2 font-medium">${d.nama_siswa}</td><td class="p-2 text-xs font-mono">${d.nis}</td>
            <td class="p-2 text-xs font-bold">${d.id_kelas}</td>
            <td class="p-2 text-center"><button onclick="window.removeDraft(${i})" class="text-red-500 hover:text-red-700 text-xs">❌</button></td>
        </tr>`).join('') : '<tr><td colspan="4" class="p-4 text-center text-xs italic text-gray-400">Antrian kosong...</td></tr>';
}

async function handleUploadDraft() {
    if(!state.draft.length) return;
    showConfirm(`Upload ${state.draft.length} data?`, async () => {
        const btn = el('btnUploadBatch');
        btn.disabled = true; btn.innerText = "⏳ Uploading...";
        try {
            await adminService.uploadDraftBatch(state.draft);
            showToast(`${state.draft.length} Data Tersimpan!`, "success");
            state.draft = []; renderDraftTable();
            if(el('filterKelasSiswa').value) loadStudentsByClass(el('filterKelasSiswa').value);
        } catch (e) { showToast(e.message, "error"); } 
        finally { btn.disabled = false; }
    });
}

// --- 4. EVENTS & UTILS ---
function updateBatchUI() {
    const cnt = state.selectedIds.size;
    el('countSelected').innerText = cnt;
    el('checkAll').checked = (cnt > 0 && cnt === state.students.length);
    el('btnPromoteClass').disabled = el('btnDeleteSelected').disabled = cnt === 0;
}

function setupEventListeners() {
    el('filterKelasSiswa')?.addEventListener('change', (e) => loadStudentsByClass(e.target.value));
    el('btnRefreshStudents')?.addEventListener('click', () => el('filterKelasSiswa').value ? loadStudentsByClass(el('filterKelasSiswa').value) : showToast("Pilih kelas", "info"));
    el('btnAddToDraft')?.addEventListener('click', handleAddToDraft);
    el('btnUploadBatch')?.addEventListener('click', handleUploadDraft);
    
    el('btnSaveKelas')?.addEventListener('click', async () => {
        const input = el('inputKelasID');
        const id = input.value.toUpperCase().trim();
        if(!id) return showToast("Isi nama kelas!", "warning");
        if(state.classes.has(id)) return showToast("Kelas sudah ada!", "error");
        
        try { await adminService.createClass(id); state.classes.add(id); input.value = ''; showToast(`Kelas ${id} dibuat`, "success"); loadClasses(); } 
        catch(e) { showToast(e.message, "error"); }
    });

    el('checkAll')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.student-checkbox').forEach(cb => {
            cb.checked = checked; checked ? state.selectedIds.add(cb.dataset.id) : state.selectedIds.delete(cb.dataset.id);
        });
        updateBatchUI();
    });

    el('tbodySiswa')?.addEventListener('change', (e) => {
        if (e.target.classList.contains('student-checkbox')) {
            e.target.checked ? state.selectedIds.add(e.target.dataset.id) : state.selectedIds.delete(e.target.dataset.id);
            updateBatchUI();
        }
    });

    // Modal Actions
    el('btnPromoteClass')?.addEventListener('click', openPromoteModal);
    el('btnClosePromote')?.addEventListener('click', closePromoteModal);
    el('btnCancelPromote')?.addEventListener('click', closePromoteModal);
    el('btnConfirmPromote')?.addEventListener('click', executePromote);
    
    el('btnDeleteSelected')?.addEventListener('click', () => {
        if(!state.selectedIds.size) return;
        showConfirm(`Hapus ${state.selectedIds.size} siswa?`, async () => {
            try { await adminService.deleteStudentsBatch(Array.from(state.selectedIds)); showToast("Dihapus", "success"); loadStudentsByClass(el('filterKelasSiswa').value); }
            catch(e) { showToast(e.message, "error"); }
        });
    });
}

function openPromoteModal() {
    const [modal, select, count] = [el('modalPromote'), el('selectTargetPromote'), el('promoteCount')];
    count.innerText = state.selectedIds.size;
    select.innerHTML = '<option value="" disabled selected>-- Pilih Kelas Tujuan --</option>';
    Array.from(state.classes).sort().forEach(c => c !== el('filterKelasSiswa').value && select.appendChild(new Option(c, c)));
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); modal.querySelector('div').classList.replace('scale-95', 'scale-100'); }, 10);
}

function closePromoteModal() {
    const modal = el('modalPromote');
    modal.classList.add('opacity-0'); modal.querySelector('div').classList.replace('scale-100', 'scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

async function executePromote() {
    const target = el('selectTargetPromote').value;
    const btn = el('btnConfirmPromote');
    if (!target) return showToast("Pilih kelas tujuan!", "warning");

    btn.disabled = true; btn.innerText = '⏳ Processing...';
    try {
        await adminService.promoteStudentsBatch(Array.from(state.selectedIds), target);
        showToast("Berhasil dipromote!", "success"); closePromoteModal(); loadStudentsByClass(el('filterKelasSiswa').value);
    } catch (e) { showToast(e.message, "error"); } 
    finally { btn.disabled = false; btn.innerText = '✅ Pindahkan Sekarang'; }
}

// GLOBAL EXPORTS
window.removeDraft = (i) => { state.draft.splice(i, 1); renderDraftTable(); };
window.deleteStudent = (id) => showConfirm("Hapus siswa?", async () => {
    await adminService.deleteStudent(id); showToast("Terhapus", "success"); loadStudentsByClass(el('filterKelasSiswa').value);
});

initAdmin();