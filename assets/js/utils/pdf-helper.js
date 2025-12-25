// Helper: Setup Dokumen PDF
const getDoc = (landscape = false) => {
    if (!window.jspdf) { alert("Library PDF error! Refresh halaman."); return null; }
    return new window.jspdf.jsPDF(landscape ? 'l' : 'p', 'mm', 'a4');
};

// Config: Gaya Tabel Hemat Tinta (Hitam Putih & Bersih)
const bwStyle = {
    theme: 'grid',
    headStyles: {
        fillColor: [240, 240, 240], // Abu-abu sangat muda
        textColor: 0,
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: 0,
        halign: 'center'
    },
    styles: {
        textColor: 0,
        lineColor: 0,
        lineWidth: 0.1,
        fontSize: 9, // Font sedikit lebih besar agar terbaca
        cellPadding: 1.5,
        valign: 'middle',
        halign: 'center' // Default rata tengah
    },
    alternateRowStyles: {
        fillColor: 255
    }
};

// 1. EXPORT HARIAN (Portrait)
export const exportToPDF = ({ tanggal, siswa }, kls) => {
    const doc = getDoc();
    if (!doc) return;

    let st = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
    const body = Object.values(siswa)
        .sort((a, b) => a.nama.localeCompare(b.nama))
        .map((s, i) => {
            if (st[s.status] !== undefined) st[s.status]++;
            // Ubah Status Text jadi Simbol jika perlu, atau biarkan Teks untuk harian
            return [i + 1, s.nis || '-', s.nama, s.status, s.keterangan || '-'];
        });

    doc.setFont("helvetica", "bold").setFontSize(14).text("LAPORAN ABSENSI HARIAN", 105, 15, { align: "center" });
    doc.setFontSize(10).setFont("helvetica", "normal");
    doc.text(`Kelas: ${kls}`, 14, 25);
    doc.text(`Tanggal: ${tanggal}`, 14, 30);
    doc.text(`Ringkasan: H=${st.Hadir} | S=${st.Sakit} | I=${st.Izin} | A=${st.Alpa}`, 14, 35);

    doc.autoTable({
        startY: 40,
        head: [['No', 'NIS', 'Nama Siswa', 'Status', 'Keterangan']],
        body: body,
        ...bwStyle,
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 25, halign: 'left' },
            2: { cellWidth: 60, halign: 'left' },
            3: { cellWidth: 25, fontStyle: 'bold' },
            4: { cellWidth: 'auto', halign: 'left' }
        }
    });

    doc.save(`Absensi_${kls}_${tanggal}.pdf`);
};

// 2. EXPORT BULANAN (Landscape)
export const exportMonthlyPDF = (master, reports, month, kls) => {
    const doc = getDoc(true);
    if (!doc) return;

    doc.setFont("helvetica", "bold").setFontSize(14).text("REKAP ABSENSI BULANAN", 148.5, 15, { align: "center" });
    doc.setFontSize(10).setFont("helvetica", "normal");
    doc.text(`Kelas: ${kls} | Periode: ${month}`, 14, 25);
    // Update Legenda PDF
    doc.text(`Ket: [H]adir, [S]akit, [I]zin, [A]lpa, [-]Kosong`, 14, 30);

    const days = new Date(month.split('-')[0], month.split('-')[1], 0).getDate();
    const map = {};
    
    reports.forEach(r => {
        const d = parseInt(r.tanggal.slice(-2));
        Object.entries(r.siswa).forEach(([id, s]) => {
            if (!map[id]) map[id] = {};
            map[id][d] = { s: s.status, k: s.keterangan };
        });
    });

    const body = Object.entries(master)
        .sort((a, b) => a[1].nama.localeCompare(b[1].nama))
        .map(([id, s], i) => {
            let row = [i + 1, s.nama], st = { H: 0, S: 0, I: 0, A: 0 }, notes = [];
            
            for (let d = 1; d <= days; d++) {
                const entry = map[id]?.[d] || { s: '-' };
                
                // [UPDATE] LOGIKA HURUF DI SINI
                let code = '-'; 
                if (entry.s === 'Hadir') { code = 'H'; st.H++; } 
                else if (entry.s === 'Sakit') { code = 'S'; st.S++; }
                else if (entry.s === 'Izin') { code = 'I'; st.I++; }
                else if (entry.s === 'Alpa') { code = 'A'; st.A++; }
                
                if (['Izin', 'Sakit', 'Alpa'].includes(entry.s) && entry.k && entry.k !== '-') 
                    notes.push(`Tgl ${d}:${entry.s}(${entry.k})`);
                
                row.push(code);
            }
            return [...row, st.H, st.S, st.I, st.A, notes.join(', ')];
        });

    // ... (Bagian autoTable sama, tapi hapus logic custom 'v' -> '✓') ...
    const head = [['No', 'Nama', ...Array.from({ length: days }, (_, i) => i + 1), 'H', 'S', 'I', 'A', 'Catatan']];
    
    doc.autoTable({
        startY: 35,
        head: head,
        body: body,
        ...bwStyle, // Pastikan bwStyle sudah didefinisikan (lihat jawaban sebelumnya)
        styles: { fontSize: 7, cellPadding: 1, valign: 'middle', halign: 'center', lineWidth: 0.1 },
        columnStyles: { 0: { cellWidth: 8 }, 1: { halign: 'left', cellWidth: 35 }, [days + 6]: { halign: 'left', cellWidth: 'auto', fontSize: 6 } },
        
        // Cukup tebalkan S, I, A. Huruf H biarkan normal agar tidak terlalu mendominasi.
        didParseCell: (data) => {
            if (data.section === 'body') {
                const val = data.cell.raw;
                if (['S', 'I', 'A'].includes(val)) {
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    doc.save(`Rekap_Bulanan_${kls}_${month}.pdf`);
};