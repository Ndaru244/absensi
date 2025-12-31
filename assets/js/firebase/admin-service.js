import { db } from './config.js';
import {
    collection, getDocs, doc, writeBatch, deleteDoc, setDoc, query, where, limit, getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ===== CACHE MANAGER =====
const CacheManager = {
    PREFIX: 'app_cache_',
    TTL: 1000 * 60 * 30, // 30 menit default

    set(key, data, ttl = this.TTL) {
        try {
            const item = {
                data,
                timestamp: Date.now(),
                ttl
            };
            localStorage.setItem(this.PREFIX + key, JSON.stringify(item));
        } catch (e) {
            console.warn('Cache write failed:', e);
        }
    },

    get(key) {
        try {
            const raw = localStorage.getItem(this.PREFIX + key);
            if (!raw) return null;

            const item = JSON.parse(raw);
            const age = Date.now() - item.timestamp;

            // Cek apakah cache masih valid
            if (age > item.ttl) {
                this.remove(key);
                return null;
            }

            return item.data;
        } catch (e) {
            console.warn('Cache read failed:', e);
            return null;
        }
    },

    remove(key) {
        localStorage.removeItem(this.PREFIX + key);
    },

    clear(pattern = '') {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.PREFIX + pattern)) {
                localStorage.removeItem(key);
            }
        });
    },

    // Untuk data yang sering berubah, cek validitas dengan timestamp
    isStale(key, maxAge = this.TTL) {
        const raw = localStorage.getItem(this.PREFIX + key);
        if (!raw) return true;

        try {
            const item = JSON.parse(raw);
            return (Date.now() - item.timestamp) > maxAge;
        } catch {
            return true;
        }
    }
};

// ===== ADMIN SERVICE WITH CACHE =====
export const adminService = {

    // 1. GET CLASSES (Cache: 1 jam)
    async getClasses(forceRefresh = false) {
        const cacheKey = 'classes';

        // Cek Cache Dulu!
        if (!forceRefresh) {
            const cached = CacheManager.get(cacheKey);
            if (cached) {
                console.log('✅ Classes loaded from cache (No Firebase Cost)');
                return cached;
            }
        }

        console.log('🔄 Fetching classes from Firebase...');
        const snap = await getDocs(collection(db, "kelas"));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        CacheManager.set(cacheKey, data, 1000 * 60 * 60); // Cache 1 jam
        return data;
    },

    // 2. CREATE CLASS
    async createClass(id) {
        // Cek dulu di cache client-side sebelum ke server
        const cachedClasses = CacheManager.get('classes') || [];
        if (cachedClasses.some(c => c.id === id)) {
            throw new Error("Kelas sudah ada (Cek Cache)");
        }

        await setDoc(doc(db, "kelas", id), { nama_kelas: id });
        CacheManager.remove('classes');
    },

    // ... (Fungsi getStudentsByClass, checkNISExists, dll) ...

    async getStudentsByClass(kelasId, forceRefresh = false) {
        if (!kelasId) return [];
        const cacheKey = `students_${kelasId}`;

        if (!forceRefresh) {
            const cached = CacheManager.get(cacheKey);
            if (cached) return cached;
        }

        console.log(`🔄 Fetching students for ${kelasId}...`);
        const q = query(collection(db, "siswa"), where("id_kelas", "==", kelasId));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        CacheManager.set(cacheKey, data, 1000 * 60 * 15);
        return data;
    },

    async checkNISExists(nis) {
        const cacheKey = `nis_check_${nis}`;
        const cached = CacheManager.get(cacheKey);
        if (cached !== null) return cached;

        const q = query(collection(db, "siswa"), where("nis", "==", nis), limit(1));
        const snap = await getDocs(q);
        const exists = !snap.empty;
        CacheManager.set(cacheKey, exists, 1000 * 60 * 5);
        return exists;
    },

    async uploadDraftBatch(draftData) {
        if (!draftData || draftData.length === 0) return;
        const batch = writeBatch(db);
        const affectedClasses = new Set();

        draftData.forEach((student) => {
            const newDocRef = doc(collection(db, "siswa"));
            batch.set(newDocRef, {
                id_kelas: student.id_kelas,
                nama_siswa: student.nama_siswa,
                nis: student.nis,
                status_aktif: 'Aktif'
            });
            affectedClasses.add(student.id_kelas);
        });

        await batch.commit();
        affectedClasses.forEach(kelasId => CacheManager.remove(`students_${kelasId}`));
        draftData.forEach(s => CacheManager.remove(`nis_check_${s.nis}`));
    },

    async deleteStudentsBatch(ids, kelasId) {
        const batch = writeBatch(db);
        ids.forEach(id => batch.delete(doc(db, "siswa", id)));
        await batch.commit();
        if (kelasId) CacheManager.remove(`students_${kelasId}`);
    },

    async promoteStudentsBatch(ids, newClassId, oldClassId) {
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.update(doc(db, "siswa", id), { id_kelas: newClassId });
        });
        await batch.commit();
        CacheManager.remove(`students_${oldClassId}`);
        CacheManager.remove(`students_${newClassId}`);
    },

    async deleteStudent(id, kelasId) {
        await deleteDoc(doc(db, "siswa", id));
        if (kelasId) CacheManager.remove(`students_${kelasId}`);
    }
};

// Export CacheManager untuk debugging
export { CacheManager };