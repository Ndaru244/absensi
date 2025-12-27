import { adminService } from '../firebase/admin-service.js';
import { showToast, showConfirm, initTheme } from '../utils/ui.js';

const el = (id) => document.getElementById(id);
const state = { classes: new Set(), students: [], draft: [], selectedIds: new Set() };

async function initAdmin() {
    initTheme();
    await loadClasses();
    setupEvents();
}

// --- LOAD DATA ---
async function loadClasses() {
    const [select, filter] = [el('selectKelasSiswa'), el('filterKelasSiswa')];
    try {
        const data = await adminService.getClasses();
        state.classes.clear();
        data.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true}));
        const opts = data.map(c => { state.classes.add(c.id); return `<option value="${c.id}">${c.id}</option>`; }).join('');
        if (select) select.innerHTML = '<option value="">-- Pilih Kelas --</option>' + opts;
        if (filter) filter.innerHTML = '<option value="" disabled selected>-- Pilih Kelas Data --</option>' + opts;
    } catch (e) { showToast("Gagal memuat kelas", "error"); }
}

async function loadStudentsByClass(kelasId) {
    if (!kelasId) return;
    state.selectedIds.clear(); updateBatchUI();
    el('tbodySiswa').innerHTML = `<tr><td colspan="5" class="p-8 text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div></td></tr>`;
    try {
        state.students = await adminService.getStudentsByClass(kelasId);
        renderTable();
    } catch (err) { showToast(err.message, "error"); }
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
            <td class="p-4 text-center">
                <button onclick="window.deleteStudent('${s.id}')" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>`).join('');
    
    if(window.lucide) window.lucide.createIcons({ root: tbody });
}

// --- DRAFT LOGIC ---
async function handleAddToDraft() {
    const [nama, nis, kelas] = [el('inputNamaSiswa').value.trim(), el('inputNISSiswa').value.trim(), el('selectKelasSiswa').value];
    if (!nama || !nis || !kelas) return showToast("Lengkapi data!", "warning");
    if (state.draft.some(d => d.nis === nis)) return showToast("NIS sudah di draft!", "warning");

    const btn = el('btnAddToDraft');
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Cek NIS...`;
    if(window.lucide) window.lucide.createIcons({ root: btn });
    
    try {
        if (await adminService.checkNISEXists(nis)) return showToast("NIS sudah terdaftar!", "error");
        state.draft.push({ nama_siswa: nama, nis, id_kelas: kelas, status_aktif: 'Aktif' });
        el('inputNamaSiswa').value = ''; el('inputNISSiswa').value = ''; el('inputNamaSiswa').focus();
        renderDraftTable();
        showToast("Masuk antrian", "success");
    } catch (e) { showToast("Gagal cek NIS", "error"); } 
    finally { 
        btn.innerHTML = `<i data-lucide="arrow-down-to-line" class="w-5 h-5"></i> Masuk Antrian`; 
        if(window.lucide) window.lucide.createIcons({ root: btn });
    }
}

function renderDraftTable() {
    const tbody = el('tbodyDraft');
    el('countDraft').innerText = `Antrian: ${state.draft.length}`;
    el('btnUploadBatch').style.display = state.draft.length ? 'flex' : 'none'; // Flex for icon alignment
    el('btnUploadBatch').innerHTML = `<i data-lucide="rocket" class="w-4 h-4"></i> UPLOAD ${state.draft.length} DATA`;
    
    tbody.innerHTML = state.draft.length ? state.draft.map((d, i) => `
        <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            <td class="p-2 font-medium">${d.nama_siswa}</td><td class="p-2 text-xs font-mono">${d.nis}</td>
            <td class="p-2 text-xs font-bold">${d.id_kelas}</td>
            <td class="p-2 text-center">
                <button onclick="window.removeDraft(${i})" class="text-red-500 hover:text-red-700 p-1"><i data-lucide="x" class="w-3 h-3"></i></button>
            </td>
        </tr>`).join('') : '';
        
    if(window.lucide) { window.lucide.createIcons({ root: tbody }); window.lucide.createIcons({ root: el('btnUploadBatch') }); }
}

// --- EVENTS ---
function setupEvents() {
    el('filterKelasSiswa')?.addEventListener('change', (e) => loadStudentsByClass(e.target.value));
    el('btnRefreshStudents')?.addEventListener('click', () => el('filterKelasSiswa').value ? loadStudentsByClass(el('filterKelasSiswa').value) : showToast("Pilih kelas", "info"));
    el('btnAddToDraft')?.addEventListener('click', handleAddToDraft);
    
    el('btnUploadBatch')?.addEventListener('click', () => {
        showConfirm(`Upload ${state.draft.length} data?`, async () => {
            try {
                await adminService.uploadDraftBatch(state.draft);
                showToast(`${state.draft.length} Data Tersimpan!`, "success");
                state.draft = []; renderDraftTable();
                if(el('filterKelasSiswa').value) loadStudentsByClass(el('filterKelasSiswa').value);
            } catch (e) { showToast(e.message, "error"); }
        });
    });

    el('btnSaveKelas')?.addEventListener('click', async () => {
        const id = el('inputKelasID').value.toUpperCase().trim();
        if(!id || state.classes.has(id)) return showToast("Kelas invalid / duplikat", "warning");
        try { await adminService.createClass(id); state.classes.add(id); el('inputKelasID').value = ''; showToast("Kelas dibuat", "success"); loadClasses(); } 
        catch(e) { showToast(e.message, "error"); }
    });

    // Checkbox Logic
    const toggleCheck = (id, checked) => { checked ? state.selectedIds.add(id) : state.selectedIds.delete(id); updateBatchUI(); };
    el('checkAll')?.addEventListener('change', (e) => document.querySelectorAll('.student-checkbox').forEach(cb => { cb.checked = e.target.checked; toggleCheck(cb.dataset.id, e.target.checked); }));
    el('tbodySiswa')?.addEventListener('change', (e) => e.target.classList.contains('student-checkbox') && toggleCheck(e.target.dataset.id, e.target.checked));

    // Batch Actions
    el('btnDeleteSelected')?.addEventListener('click', () => showConfirm(`Hapus ${state.selectedIds.size} siswa?`, async () => {
        try { await adminService.deleteStudentsBatch(Array.from(state.selectedIds)); showToast("Dihapus", "success"); loadStudentsByClass(el('filterKelasSiswa').value); } 
        catch(e) { showToast(e.message, "error"); }
    }));
    
    // Promote Logic
    const modal = el('modalPromote');
    const closeModal = () => { modal.classList.add('opacity-0'); setTimeout(() => modal.classList.add('hidden'), 200); };
    el('btnPromoteClass')?.addEventListener('click', () => {
        el('promoteCount').innerText = state.selectedIds.size;
        el('selectTargetPromote').innerHTML = '<option value="" disabled selected>-- Pilih Kelas Tujuan --</option>';
        Array.from(state.classes).sort().forEach(c => c !== el('filterKelasSiswa').value && el('selectTargetPromote').appendChild(new Option(c, c)));
        modal.classList.remove('hidden'); setTimeout(() => modal.classList.remove('opacity-0'), 10);
    });
    el('btnClosePromote')?.addEventListener('click', closeModal);
    el('btnCancelPromote')?.addEventListener('click', closeModal);
    el('btnConfirmPromote')?.addEventListener('click', async () => {
        const target = el('selectTargetPromote').value;
        if (!target) return showToast("Pilih kelas tujuan!", "warning");
        try { await adminService.promoteStudentsBatch(Array.from(state.selectedIds), target); showToast("Berhasil dipromote!", "success"); closeModal(); loadStudentsByClass(el('filterKelasSiswa').value); } 
        catch (e) { showToast(e.message, "error"); }
    });
}

function updateBatchUI() {
    const cnt = state.selectedIds.size;
    el('countSelected').innerText = cnt;
    el('checkAll').checked = (cnt > 0 && cnt === state.students.length);
    el('btnPromoteClass').disabled = el('btnDeleteSelected').disabled = cnt === 0;
}

// Global Handlers
window.removeDraft = (i) => { state.draft.splice(i, 1); renderDraftTable(); };
window.deleteStudent = (id) => showConfirm("Hapus siswa?", async () => { 
    await adminService.deleteStudent(id); showToast("Terhapus", "success"); loadStudentsByClass(el('filterKelasSiswa').value); 
});

initAdmin();