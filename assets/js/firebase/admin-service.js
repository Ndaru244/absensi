import { db } from './config.js';
// PERHATIKAN: Saya menambahkan 'query', 'where', 'limit' di import ini
import {
    collection, getDocs, doc, writeBatch, deleteDoc, updateDoc, setDoc, query, where, limit
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

export const adminService = {
    // 1. Ambil daftar kelas
    async getClasses() {
        const snap = await getDocs(collection(db, "kelas"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // 2. Buat Kelas Baru
    async createClass(id) {
        await setDoc(doc(db, "kelas", id), { nama_kelas: id });
    },

    // 3. Ambil Siswa per Kelas
    async getStudentsByClass(kelasId) {
        if (!kelasId) return [];
        const q = query(collection(db, "siswa"), where("id_kelas", "==", kelasId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // 4. [PENTING] Cek NIS Global (Fungsi yang Error Tadi)
    async checkNISEXists(nis) {
        try {
            // Cari di seluruh tabel siswa, apakah ada NIS yang sama?
            // limit(1) agar hemat, begitu ketemu 1 langsung berhenti.
            const q = query(
                collection(db, "siswa"),
                where("nis", "==", nis),
                limit(1)
            );
            const snap = await getDocs(q);
            return !snap.empty; // Return true jika ada, false jika kosong
        } catch (e) {
            console.error("Error checking NIS:", e);
            throw e;
        }
    },

    // 5. Upload Draft (Batch Insert)
    async uploadDraftBatch(students) {
        const batch = writeBatch(db);
        students.forEach(s => {
            const ref = doc(collection(db, "siswa")); // Auto ID
            batch.set(ref, s);
        });
        await batch.commit();
    },

    // 6. Hapus Siswa (Single)
    async deleteStudent(id) {
        await deleteDoc(doc(db, "siswa", id));
    },

    // 7. Hapus Siswa (Batch)
    async deleteStudentsBatch(ids) {
        const batch = writeBatch(db);
        ids.forEach(id => batch.delete(doc(db, "siswa", id)));
        await batch.commit();
    },

    // 8. Promote Kelas (Batch Update)
    async promoteStudentsBatch(ids, newClassId) {
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.update(doc(db, "siswa", id), { id_kelas: newClassId });
        });
        await batch.commit();
    }
};