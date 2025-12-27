import { db } from './config.js';
import {
    collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

export const attendanceService = {
    // 1. AMBIL DATA ABSENSI (Existing)
    async getRekap(docId) {
        try {
            const ref = doc(db, "rekap_absensi", docId);
            const snap = await getDoc(ref);
            return snap.exists() ? snap.data() : null;
        } catch (error) {
            console.error("Error getting rekap:", error);
            throw error;
        }
    },

    // 2. AMBIL MASTER SISWA (Jika data absensi belum ada)
    async getMasterSiswa(kelasId) {
        try {
            const q = query(
                collection(db, "siswa"),
                where("id_kelas", "==", kelasId),
                where("status_aktif", "==", "Aktif")
            );

            const snap = await getDocs(q);
            let mapSiswa = {};

            snap.forEach(s => {
                mapSiswa[s.id] = {
                    nama: s.data().nama_siswa,
                    nis: s.data().nis,
                    status: "Hadir", // Default status
                    keterangan: "-"
                };
            });
            return mapSiswa;
        } catch (error) {
            console.error("Error getting master siswa:", error);
            throw error;
        }
    },

    // 3. SIMPAN DATA (Update/Create)
    async saveRekap(docId, data) {
        try {
            const ref = doc(db, "rekap_absensi", docId);
            // Tambahkan timestamp jika data baru
            if (!data.created_at) {
                data.created_at = Timestamp.now();
            }
            // Update timestamp terakhir diubah
            data.updated_at = Timestamp.now();

            await setDoc(ref, data, { merge: true });
        } catch (error) {
            console.error("Error saving rekap:", error);
            throw error;
        }
    },

    // 4. KUNCI DATA (Lock)
    async lockRekap(docId) {
        try {
            const ref = doc(db, "rekap_absensi", docId);
            await updateDoc(ref, {
                is_locked: true,
                locked_at: Timestamp.now()
            });
        } catch (error) {
            console.error("Error locking rekap:", error);
            throw error;
        }
    },

    async getMonthlyReport(kelasId, monthStr) {
        // monthStr = "2023-10"
        const startStr = `${monthStr}-01`;
        const endStr = `${monthStr}-31`;

        const q = query(
            collection(db, "rekap_absensi"),
            where("kelas", "==", kelasId),
            where("tanggal", ">=", startStr),
            where("tanggal", "<=", endStr)
        );

        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    }
};