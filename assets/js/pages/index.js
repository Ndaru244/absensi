import { attendanceService } from '../firebase/attendance-service.js';
import { adminService } from '../firebase/admin-service.js';
import { showToast, showConfirm, showPrompt } from '../utils/ui.js';
import { exportToPDF, exportMonthlyPDF } from '../utils/pdf-helper.js';

let state = { localData: null, currentDocId: null, isDirty: false, monthlyCache: null };

// --- INIT ---
(async () => {
    const [datePicker, picker] = [document.getElementById('datePicker'), document.getElementById('kelasPicker')];
    if(datePicker) datePicker.valueAsDate = new Date();
    if(picker) {
        try { (await adminService.getClasses()).sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric:true})).forEach(c => picker.add(new Option(c.id, c.id))); } 
        catch(e) { console.error(e); }
    }
    const saved = localStorage.getItem('absensi_draft');
    if(saved) {
        state.localData = JSON.parse(saved);
        if(datePicker) datePicker.value = state.localData.tanggal;
        if(picker) picker.value = state.localData.kelas;
        state.currentDocId = `${state.localData.tanggal}_${state.localData.kelas}`;
        ['tabelAbsensi', 'actionButtons'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('loadingText').style.display = 'none';
        renderTable(); setDirty(true);
        showToast("Draft dipulihkan", "info");
    }
})();

// --- LOGIC ---
window.loadRekapData = async () => {
    const tgl = document.getElementById('datePicker').value;
    const kls = document.getElementById('kelasPicker').value;
    if (!tgl || !kls) return showToast("Pilih Tanggal & Kelas!", "warning");
    
    state.currentDocId = `${tgl}_${kls}`;
    const loading = document.getElementById('loadingText');
    loading.style.display = 'block'; loading.innerText = "⏳ Mengambil data...";
    document.getElementById('tabelAbsensi').classList.add('hidden');

    try {
        if(!(state.isDirty && state.localData?.tanggal === tgl && state.localData?.kelas === kls)) {
            let data = await attendanceService.getRekap(state.currentDocId);
            if (!data) {
                const master = await attendanceService.getMasterSiswa(kls);
                if (!Object.keys(master).length) throw new Error("Kelas Kosong");
                data = { tanggal: tgl, kelas: kls, siswa: master, is_locked: false };
                setDirty(true); showToast("Lembar baru", "info");
            }
            state.localData = data;
        }
        loading.style.display = 'none';
        ['tabelAbsensi', 'actionButtons'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        renderTable(); handleLockState();
    } catch (e) { loading.innerText = "Error: " + e.message; showToast(e.message, "error"); }
};

function renderTable() {
    const tbody = document.getElementById('tbodySiswa');
    const { siswa } = state.localData;
    tbody.innerHTML = Object.keys(siswa).sort((a,b) => siswa[a].nama.localeCompare(siswa[b].nama)).map(id => {
        const s = siswa[id];
        return `
        <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <td class="p-4 align-top">
                <div class="font-bold text-gray-800 dark:text-gray-200">${s.nama}</div>
                <div class="text-xs text-gray-500 font-mono mb-1">${s.nis || '-'}</div>
                ${s.keterangan && s.keterangan !== '-' ? `<span class="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded flex items-center w-fit gap-1"><i data-lucide="sticky-note" class="w-3 h-3"></i> ${s.keterangan}</span>` : ''}
            </td>
            <td class="p-4 align-top">
                <div class="flex flex-wrap gap-2">
                    ${['Hadir', 'Sakit', 'Izin', 'Alpa'].map(st => `
                        <button onclick="updateStatus('${id}', '${st}')" class="px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition-all transform active:scale-95 flex items-center gap-1 ${s.status === st ? _getColor(st) : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100'}">
                            ${st === 'Hadir' ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''} ${st}
                        </button>
                    `).join('')}
                </div>
            </td>
        </tr>`;
    }).join('');
    if(window.lucide) window.lucide.createIcons({ root: tbody });
}

function _getColor(st) {
    const c = { Hadir: 'bg-green-600 text-white ring-green-200', Sakit: 'bg-yellow-500 text-white ring-yellow-200', Izin: 'bg-blue-600 text-white ring-blue-200', Alpa: 'bg-red-600 text-white ring-red-200' };
    return `${c[st]} border-${c[st].split(' ')[0].replace('bg-', '')} ring-2 dark:ring-opacity-20`;
}

window.updateStatus = (id, newStatus) => {
    if (state.localData.is_locked) return showToast("Data terkunci!", "warning");
    const s = state.localData.siswa[id];
    const update = () => { setDirty(true); renderTable(); localStorage.setItem('absensi_draft', JSON.stringify(state.localData)); };
    ['Izin', 'Alpa'].includes(newStatus) ? showPrompt(`Alasan ${newStatus}:`, (k) => { s.status = newStatus; s.keterangan = k || '-'; update(); }) : (s.status = newStatus, s.keterangan = '-', update());
};

window.saveDataToFirestore = () => showConfirm("Simpan data?", async () => {
    const btn = document.getElementById('btnSave');
    try {
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...`; if(window.lucide) window.lucide.createIcons({root: btn});
        btn.disabled = true;
        await attendanceService.saveRekap(state.currentDocId, state.localData);
        showToast("Tersimpan!", "success"); setDirty(false); localStorage.removeItem('absensi_draft');
    } catch(e) { showToast(e.message, "error"); } 
    finally { btn.innerHTML = `<i data-lucide="save" class="w-5 h-5"></i> SIMPAN`; btn.disabled = false; if(window.lucide) window.lucide.createIcons({root: btn}); }
});

window.exportToPDF = () => !state.localData ? null : (!state.localData.is_locked ? showToast("Kunci data dulu!", "warning") : exportToPDF(state.localData, document.getElementById('kelasPicker').value));

function setDirty(val) { state.isDirty = val; document.getElementById('unsavedMsg')?.classList.toggle('hidden', !val); }
function handleLockState() {
    const isLocked = state.localData.is_locked;
    document.getElementById('lockedMessage')?.classList.toggle('hidden', !isLocked);
    ['btnSave', 'btnLock'].forEach(id => document.getElementById(id).style.display = isLocked ? 'none' : 'flex');
    const btnPdf = document.getElementById('btnExport');
    isLocked ? btnPdf.classList.remove('opacity-50', 'cursor-not-allowed') : btnPdf.classList.add('opacity-50', 'cursor-not-allowed');
}

document.getElementById('btnLock').onclick = () => state.isDirty ? showToast("Simpan perubahan dulu!", "warning") : showConfirm("Kunci data permanen?", async () => {
    await attendanceService.lockRekap(state.currentDocId); state.localData.is_locked = true; handleLockState(); showToast("Terkunci", "success");
});

// --- MONTHLY REPORT ---
window.openMonthlyModal = () => { document.getElementById('modalMonthly').classList.remove('hidden'); const p = document.getElementById('monthPickerReport'); if(!p.value) p.value = new Date().toISOString().slice(0, 7); };
window.closeMonthlyModal = () => document.getElementById('modalMonthly').classList.add('hidden');
window.loadMonthlyReport = async () => {
    const [kls, month, tbody] = ['kelasPicker', 'monthPickerReport', 'tbodyBulanan'].map(id => document.getElementById(id).value || document.getElementById(id));
    if (!kls || !month) return showToast("Pilih Kelas & Bulan!", "warning");
    tbody.innerHTML = '<tr><td colspan="40" class="p-8 text-center">⏳ Memproses data...</td></tr>';
    
    try {
        const [master, reports] = await Promise.all([attendanceService.getMasterSiswa(kls), attendanceService.getMonthlyReport(kls, month)]);
        state.monthlyCache = { master, reports, monthStr: month };
        const days = new Date(month.split('-')[0], month.split('-')[1], 0).getDate();
        
        // Header
        let head = '<th class="p-3 sticky left-0 bg-gray-100 dark:bg-gray-700 z-30 border dark:border-gray-600 min-w-[180px]">Nama Siswa</th>';
        for (let i = 1; i <= days; i++) head += `<th class="p-1 text-center w-8 border dark:border-gray-600 text-[10px] text-gray-500">${i}</th>`;
        document.getElementById('headerRowBulanan').innerHTML = head + '<th class="p-2 border bg-green-100 text-green-800">H</th><th class="p-2 border bg-yellow-100 text-yellow-800">S</th><th class="p-2 border bg-blue-100 text-blue-800">I</th><th class="p-2 border bg-red-100 text-red-800">A</th>';

        // Body
        let map = {}; Object.keys(master).forEach(id => map[id] = Array(days + 1).fill({ status: '-', keterangan: '-' }));
        reports.forEach(r => { const d = parseInt(r.tanggal.split('-')[2]); Object.keys(r.siswa).forEach(id => { if(map[id]) map[id][d] = r.siswa[id]; }); });

        tbody.innerHTML = Object.keys(master).sort((a,b) => master[a].nama.localeCompare(master[b].nama)).map(id => {
            let row = `<td class="p-2 font-medium sticky left-0 bg-white dark:bg-darkcard border-r border-b dark:border-gray-700 z-20 whitespace-nowrap">${master[id].nama}</td>`;
            let st = { H:0, S:0, I:0, A:0 };
            for(let i=1; i<=days; i++) {
                const s = map[id][i].status;
                if(s==='Hadir') st.H++; else if(s==='Sakit') st.S++; else if(s==='Izin') st.I++; else if(s==='Alpa') st.A++;
                const badge = { 'Hadir':'<span class="text-green-600 font-bold">H</span>', 'Sakit':'<span class="text-yellow-600 font-bold">S</span>', 'Izin':'<span class="text-blue-600 font-bold">I</span>', 'Alpa':'<span class="text-red-600 font-bold">A</span>', '-': '<span class="text-gray-300">-</span>' }[s];
                row += `<td class="p-1 text-center border dark:border-gray-700 bg-white dark:bg-darkcard h-8 text-xs font-mono" title="${map[id][i].keterangan}">${badge}</td>`;
            }
            return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">${row}<td class="text-center font-bold text-green-700 border bg-green-50/30">${st.H}</td><td class="text-center font-bold text-yellow-700 border bg-yellow-50/30">${st.S}</td><td class="text-center font-bold text-blue-700 border bg-blue-50/30">${st.I}</td><td class="text-center font-bold text-red-700 border bg-red-50/30">${st.A}</td></tr>`;
        }).join('');
        
        document.getElementById('btnPrintMonthly').style.display = 'flex';
    } catch (e) { tbody.innerHTML = `<tr><td class="p-4 text-center text-red-500">❌ ${e.message}</td></tr>`; }
};

window.printMonthlyData = () => state.monthlyCache?.master ? exportMonthlyPDF(state.monthlyCache.master, state.monthlyCache.reports, state.monthlyCache.monthStr, document.getElementById('kelasPicker').value) : showToast("Data belum siap!", "error");