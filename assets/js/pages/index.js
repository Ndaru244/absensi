import { attendanceService } from '../firebase/attendance-service.js';
import { adminService } from '../firebase/admin-service.js';
import { showToast, showConfirm, showPrompt } from '../utils/ui.js';
import { exportToPDF, exportMonthlyPDF } from '../utils/pdf-helper.js';

let state = {
    localData: null,
    currentDocId: null,
    isDirty: false,
    monthlyCache: { master: null, reports: null, monthStr: null }
};

// --- INIT ---
(async () => {
    const datePicker = document.getElementById('datePicker');
    if(datePicker) datePicker.valueAsDate = new Date();

    const picker = document.getElementById('kelasPicker');
    if(picker) {
        try {
            const classes = await adminService.getClasses();
            classes.sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric: true}));
            classes.forEach(c => picker.add(new Option(c.id, c.id)));
        } catch(e) { console.error("Load kelas error:", e); }
    }
    
    // Recovery Logic
    const savedDraft = localStorage.getItem('absensi_draft');
    if(savedDraft) {
        showToast("Draft tersimpan ditemukan!", "info");
        state.localData = JSON.parse(savedDraft);
        if(datePicker) datePicker.value = state.localData.tanggal;
        if(picker) picker.value = state.localData.kelas;
        state.currentDocId = `${state.localData.tanggal}_${state.localData.kelas}`;
        
        ['tabelAbsensi', 'actionButtons'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('loadingText').style.display = 'none';
        
        renderTable();
        setDirty(true); 
    }
})();

// --- LOGIC UTAMA ---
window.loadRekapData = async () => {
    const tgl = document.getElementById('datePicker').value;
    const kls = document.getElementById('kelasPicker').value;
    const loading = document.getElementById('loadingText');

    if (!tgl || !kls) return showToast("Pilih Tanggal & Kelas!", "warning");
    state.currentDocId = `${tgl}_${kls}`;
    
    document.getElementById('tabelAbsensi').classList.add('hidden');
    document.getElementById('actionButtons').classList.add('hidden');
    if(loading) { loading.style.display = 'block'; loading.innerText = "⏳ Mengambil data..."; }

    try {
        if(state.isDirty && state.localData?.tanggal === tgl && state.localData?.kelas === kls) {
            console.log("Using dirty local data");
        } else {
            let data = await attendanceService.getRekap(state.currentDocId);
            if (!data) {
                const master = await attendanceService.getMasterSiswa(kls);
                if (Object.keys(master).length === 0) {
                    if(loading) loading.innerText = "Kelas Kosong";
                    return showToast("Data siswa tidak ditemukan!", "error");
                }
                data = { tanggal: tgl, kelas: kls, siswa: master, is_locked: false };
                setDirty(true); showToast("Lembar baru dibuat", "info");
            }
            state.localData = data;
        }
        
        if(loading) loading.style.display = 'none';
        document.getElementById('tabelAbsensi').classList.remove('hidden');
        document.getElementById('actionButtons').classList.remove('hidden');
        renderTable();
        handleLockState(); // Update UI tombol

    } catch (e) {
        if(loading) loading.innerText = "Error mengambil data.";
        showToast(e.message, "error");
    }
};

function renderTable() {
    const tbody = document.getElementById('tbodySiswa');
    const { siswa } = state.localData;
    const sortedKeys = Object.keys(siswa).sort((a,b) => siswa[a].nama.localeCompare(siswa[b].nama));

    tbody.innerHTML = sortedKeys.map(id => {
        const s = siswa[id];
        return `
        <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <td class="p-4 align-top">
                <div class="font-bold text-gray-800 dark:text-gray-200">${s.nama}</div>
                <div class="text-xs text-gray-500 font-mono mb-1">${s.nis || '-'}</div>
                ${s.keterangan && s.keterangan !== '-' ? `<span class="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">📝 ${s.keterangan}</span>` : ''}
            </td>
            <td class="p-4 align-top">
                <div class="flex flex-wrap gap-2">
                    ${['Hadir', 'Sakit', 'Izin', 'Alpa'].map(st => `
                        <button onclick="updateStatus('${id}', '${st}')" 
                           class="px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition-all transform active:scale-95
                           ${s.status === st ? _getColor(st) : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600'}">
                           ${st}
                        </button>
                    `).join('')}
                </div>
            </td>
        </tr>`;
    }).join('');
}

function _getColor(st) {
    const c = { 
        Hadir: 'bg-green-600 text-white ring-green-200', 
        Sakit: 'bg-yellow-500 text-white ring-yellow-200', 
        Izin: 'bg-blue-600 text-white ring-blue-200', 
        Alpa: 'bg-red-600 text-white ring-red-200' 
    };
    return `${c[st]} border-${c[st].split(' ')[0].replace('bg-', '')} ring-2 dark:ring-opacity-20`;
}

window.updateStatus = (id, newStatus) => {
    if (state.localData.is_locked) return showToast("🔒 Data terkunci!", "warning");
    const s = state.localData.siswa[id];
    const update = () => { setDirty(true); renderTable(); localStorage.setItem('absensi_draft', JSON.stringify(state.localData)); };

    if (['Izin', 'Alpa'].includes(newStatus)) {
        showPrompt(`Alasan ${newStatus}:`, (ket) => { s.status = newStatus; s.keterangan = ket || '-'; update(); });
    } else { s.status = newStatus; s.keterangan = '-'; update(); }
};

window.saveDataToFirestore = async () => {
    showConfirm("Simpan data?", async () => {
        const btn = document.getElementById('btnSave');
        try {
            btn.innerText = "⏳ Saving..."; btn.disabled = true;
            await attendanceService.saveRekap(state.currentDocId, state.localData);
            showToast("✅ Data Tersimpan!", "success");
            setDirty(false); localStorage.removeItem('absensi_draft');
        } catch(e) { showToast("Gagal: " + e.message, "error"); } 
        finally { btn.innerText = "💾 SIMPAN"; btn.disabled = false; }
    });
};

// --- EXPORT PDF (UPDATE: CEK KUNCI) ---
window.exportToPDF = () => {
    if (!state.localData) return;
    
    // [BARU] Validasi Lock
    if (!state.localData.is_locked) {
        return showToast("⚠️ Kunci data terlebih dahulu sebelum download PDF!", "warning");
    }

    const klsText = document.getElementById('kelasPicker').value;
    exportToPDF(state.localData, klsText);
};

// --- UTILS & LOCK ---
function setDirty(val) {
    state.isDirty = val;
    document.getElementById('unsavedMsg')?.classList.toggle('hidden', !val);
}

function handleLockState() {
    const isLocked = state.localData.is_locked;
    const [msg, btnSave, btnLock, btnPdf] = ['lockedMessage', 'btnSave', 'btnLock', 'btnExport'].map(id => document.getElementById(id));

    if(msg) msg.classList.toggle('hidden', !isLocked);
    if(btnSave) btnSave.style.display = isLocked ? 'none' : 'block';
    if(btnLock) btnLock.style.display = isLocked ? 'none' : 'block';
    
    // [BARU] Visual Feedback untuk Tombol PDF
    if(btnPdf) {
        if(isLocked) {
            btnPdf.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btnPdf.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}

document.getElementById('btnLock').onclick = () => {
    if(state.isDirty) return showToast("Simpan perubahan dulu!", "warning");
    showConfirm("Kunci data? Data tidak bisa diedit lagi.", async () => {
        await attendanceService.lockRekap(state.currentDocId);
        state.localData.is_locked = true;
        handleLockState();
        showToast("Data Dikunci!", "success");
    });
};

// --- MODAL BULANAN ---
window.openMonthlyModal = () => {
    const modal = document.getElementById('modalMonthly');
    if (!modal) return;
    modal.classList.remove('hidden');
    const picker = document.getElementById('monthPickerReport');
    if (picker && !picker.value) picker.value = new Date().toISOString().slice(0, 7);
};

window.closeMonthlyModal = () => document.getElementById('modalMonthly')?.classList.add('hidden');

window.loadMonthlyReport = async () => {
    const [kls, month, tbody, thead, btnPrint] = ['kelasPicker', 'monthPickerReport', 'tbodyBulanan', 'headerRowBulanan', 'btnPrintMonthly'].map(id => document.getElementById(id));
    if (!kls.value || !month.value) return showToast("Pilih Kelas & Bulan!", "warning");

    tbody.innerHTML = '<tr><td colspan="40" class="p-8 text-center text-gray-500">⏳ Memproses data...</td></tr>';
    if(btnPrint) btnPrint.style.display = 'none';

    try {
        const [master, reports] = await Promise.all([attendanceService.getMasterSiswa(kls.value), attendanceService.getMonthlyReport(kls.value, month.value)]);
        state.monthlyCache = { master, reports, monthStr: month.value };
        
        const days = new Date(month.value.split('-')[0], month.value.split('-')[1], 0).getDate();
        
        // Render Header
        let head = '<th class="p-3 sticky left-0 bg-gray-100 dark:bg-gray-700 z-30 border dark:border-gray-600 min-w-[180px] shadow-sm">Nama Siswa</th>';
        for (let i = 1; i <= days; i++) head += `<th class="p-1 text-center w-8 border dark:border-gray-600 text-[10px] text-gray-500">${i}</th>`;
        thead.innerHTML = head + '<th class="p-2 border bg-green-50 dark:bg-green-900/20 text-green-700 font-bold">H</th><th class="p-2 border bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 font-bold">S</th><th class="p-2 border bg-blue-50 dark:bg-blue-900/20 text-blue-700 font-bold">I</th><th class="p-2 border bg-red-50 dark:bg-red-900/20 text-red-700 font-bold">A</th>';

        // Mapping Data
        let map = {};
        Object.keys(master).forEach(id => map[id] = Array(days + 1).fill({ status: '-', keterangan: '-' }));
        reports.forEach(r => {
            const d = parseInt(r.tanggal.split('-')[2]);
            Object.keys(r.siswa).forEach(id => { if(map[id]) map[id][d] = r.siswa[id]; });
        });

        // Render Body
        tbody.innerHTML = Object.keys(master).sort((a,b) => master[a].nama.localeCompare(master[b].nama)).map(id => {
            let row = `<td class="p-2 font-medium sticky left-0 bg-white dark:bg-darkcard border-r border-b dark:border-gray-700 z-20 shadow-sm whitespace-nowrap">${master[id].nama}</td>`;
            let st = { H:0, S:0, I:0, A:0 };
            
            for(let i=1; i<=days; i++) {
                const d = map[id][i], s = d.status;
                if(s==='Hadir') st.H++; else if(s==='Sakit') st.S++; else if(s==='Izin') st.I++; else if(s==='Alpa') st.A++;
                
                // [UPDATE] MENGGUNAKAN HURUF SAJA
                const badge = {
                    'Hadir': '<span class="text-green-700 font-bold">H</span>', 
                    'Sakit': '<span class="text-yellow-600 font-bold">S</span>', 
                    'Izin':  '<span class="text-blue-600 font-bold">I</span>', 
                    'Alpa':  '<span class="text-red-600 font-bold">A</span>', 
                    '-':     '<span class="text-gray-300">-</span>'
                }[s];
                
                const title = d.keterangan !== '-' ? `title="Tgl ${i}: ${d.keterangan}"` : '';
                row += `<td class="p-1 text-center border dark:border-gray-700 bg-white dark:bg-darkcard h-8 text-xs font-mono" ${title}>${badge}</td>`;
            }
            return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">${row}<td class="text-center font-bold text-green-700 border bg-green-50/30 text-xs">${st.H}</td><td class="text-center font-bold text-yellow-700 border bg-yellow-50/30 text-xs">${st.S}</td><td class="text-center font-bold text-blue-700 border bg-blue-50/30 text-xs">${st.I}</td><td class="text-center font-bold text-red-700 border bg-red-50/30 text-xs">${st.A}</td></tr>`;
        }).join('');

        // Tampilkan Tombol
        if(btnPrint) btnPrint.style.display = 'flex';
        const btnExcel = document.getElementById('btnExcelMonthly');
        if(btnExcel) btnExcel.style.display = 'flex';

    } catch (e) { tbody.innerHTML = `<tr><td class="p-4 text-center text-red-500">❌ Error: ${e.message}</td></tr>`; }
};

window.printMonthlyData = () => {
    if (!state.monthlyCache.master) return showToast("Data belum siap!", "error");
    exportMonthlyPDF(state.monthlyCache.master, state.monthlyCache.reports, state.monthlyCache.monthStr, document.getElementById('kelasPicker').value);
};