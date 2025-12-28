import { db } from './config.js';
import {
    collection, getDocs, doc, writeBatch, deleteDoc, setDoc, query, where, limit
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
        
        if (!forceRefresh) {
            const cached = CacheManager.get(cacheKey);
            if (cached) {
                console.log('✅ Classes loaded from cache');
                return cached;
            }
        }

        console.log('🔄 Fetching classes from Firebase...');
        const snap = await getDocs(collection(db, "kelas"));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        CacheManager.set(cacheKey, data, 1000 * 60 * 60); // Cache 1 jam
        return data;
    },

    // 2. CREATE CLASS (Invalidate cache)
    async createClass(id) {
        await setDoc(doc(db, "kelas", id), { nama_kelas: id });
        CacheManager.remove('classes'); // Hapus cache agar refresh di load berikutnya
    },

    // 3. GET STUDENTS BY CLASS (Cache per kelas: 15 menit)
    async getStudentsByClass(kelasId, forceRefresh = false) {
        if (!kelasId) return [];
        
        const cacheKey = `students_${kelasId}`;
        
        if (!forceRefresh) {
            const cached = CacheManager.get(cacheKey);
            if (cached) {
                console.log(`✅ Students for ${kelasId} loaded from cache`);
                return cached;
            }
        }

        console.log(`🔄 Fetching students for ${kelasId} from Firebase...`);
        const q = query(collection(db, "siswa"), where("id_kelas", "==", kelasId));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        CacheManager.set(cacheKey, data, 1000 * 60 * 15); // Cache 15 menit
        return data;
    },

    // 4. CHECK NIS EXISTS (Cache hasil pengecekan: 5 menit)
    async checkNISExists(nis) {
        const cacheKey = `nis_check_${nis}`;
        
        // Cek cache terlebih dahulu
        const cached = CacheManager.get(cacheKey);
        if (cached !== null) {
            console.log(`✅ NIS check for ${nis} from cache: ${cached}`);
            return cached;
        }

        try {
            console.log(`🔍 Checking NIS ${nis} in Firebase...`);
            const q = query(
                collection(db, "siswa"),
                where("nis", "==", nis),
                limit(1)
            );
            const snap = await getDocs(q);
            const exists = !snap.empty;
            
            // Cache hasil (exists: true/false)
            CacheManager.set(cacheKey, exists, 1000 * 60 * 5); // Cache 5 menit
            return exists;
        } catch (e) {
            console.error("Error checking NIS:", e);
            throw e;
        }
    },

    // 5. UPLOAD DRAFT BATCH (Invalidate affected caches)
    async uploadDraftBatch(draftData) {
        if (!draftData || draftData.length === 0) return;
        
        const batch = writeBatch(db);
        const studentsRef = collection(db, "siswa");
        const affectedClasses = new Set();

        draftData.forEach((student) => {
            const newDocRef = doc(studentsRef);
            batch.set(newDocRef, {
                id_kelas: student.id_kelas,
                nama_siswa: student.nama_siswa,
                nis: student.nis,
                status_aktif: 'Aktif'
            });
            affectedClasses.add(student.id_kelas);
        });

        await batch.commit();

        // Invalidate cache untuk kelas yang terpengaruh
        affectedClasses.forEach(kelasId => {
            CacheManager.remove(`students_${kelasId}`);
        });

        // Hapus cache NIS checks juga
        draftData.forEach(s => CacheManager.remove(`nis_check_${s.nis}`));

        console.log(`🗑️ Cache invalidated for classes: ${[...affectedClasses].join(', ')}`);
    },

    // 6. DELETE STUDENT (Single - Invalidate cache)
    async deleteStudent(id, kelasId) {
        await deleteDoc(doc(db, "siswa", id));
        
        // Hapus cache kelas terkait
        if (kelasId) {
            CacheManager.remove(`students_${kelasId}`);
        }
    },

    // 7. DELETE STUDENTS BATCH (Invalidate affected caches)
    async deleteStudentsBatch(ids, kelasId) {
        const batch = writeBatch(db);
        ids.forEach(id => batch.delete(doc(db, "siswa", id)));
        await batch.commit();

        // Invalidate cache kelas
        if (kelasId) {
            CacheManager.remove(`students_${kelasId}`);
        }
    },

    // 8. PROMOTE STUDENTS BATCH (Invalidate multiple caches)
    async promoteStudentsBatch(ids, newClassId, oldClassId) {
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.update(doc(db, "siswa", id), { id_kelas: newClassId });
        });
        await batch.commit();

        // Hapus cache untuk kelas lama dan baru
        CacheManager.remove(`students_${oldClassId}`);
        CacheManager.remove(`students_${newClassId}`);
    },

    // UTILITY: Force refresh all student caches
    refreshAllStudentCaches() {
        CacheManager.clear('students_');
    },

    // UTILITY: Clear all caches
    clearAllCaches() {
        CacheManager.clear();
    }
};

// Export CacheManager untuk debugging
export { CacheManager };