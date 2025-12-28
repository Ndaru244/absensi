import { db } from './config.js';
import {
    collection, getDocs, doc, getDoc, setDoc, query, where, updateDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ===== ATTENDANCE CACHE MANAGER =====
const AttendanceCache = {
    PREFIX: 'attendance_',

    // Simpan rekap absensi
    setRekap(docId, data) {
        try {
            localStorage.setItem(this.PREFIX + docId, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to cache rekap:', e);
        }
    },

    // Ambil rekap dari cache
    getRekap(docId) {
        try {
            const raw = localStorage.getItem(this.PREFIX + docId);
            return raw ? JSON.parse(raw).data : null;
        } catch {
            return null;
        }
    },

    // Hapus rekap tertentu
    removeRekap(docId) {
        localStorage.removeItem(this.PREFIX + docId);
    },

    // Simpan master siswa per kelas
    setMaster(kelasId, data) {
        try {
            localStorage.setItem(this.PREFIX + 'master_' + kelasId, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to cache master:', e);
        }
    },

    // Ambil master siswa dari cache
    getMaster(kelasId) {
        try {
            const raw = localStorage.getItem(this.PREFIX + 'master_' + kelasId);
            if (!raw) return null;

            const item = JSON.parse(raw);
            const age = Date.now() - item.timestamp;

            // Cache master siswa valid 1 jam
            if (age > 1000 * 60 * 60) {
                this.removeMaster(kelasId);
                return null;
            }

            return item.data;
        } catch {
            return null;
        }
    },

    removeMaster(kelasId) {
        localStorage.removeItem(this.PREFIX + 'master_' + kelasId);
    },

    // Cache monthly report (valid 10 menit)
    setMonthlyReport(kelasId, monthStr, data) {
        try {
            const key = `monthly_${kelasId}_${monthStr}`;
            localStorage.setItem(this.PREFIX + key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to cache monthly report:', e);
        }
    },

    getMonthlyReport(kelasId, monthStr) {
        try {
            const key = `monthly_${kelasId}_${monthStr}`;
            const raw = localStorage.getItem(this.PREFIX + key);
            if (!raw) return null;

            const item = JSON.parse(raw);
            const age = Date.now() - item.timestamp;

            // Cache valid 10 menit
            if (age > 1000 * 60 * 10) {
                localStorage.removeItem(this.PREFIX + key);
                return null;
            }

            return item.data;
        } catch {
            return null;
        }
    },

    // Clear all attendance caches
    clearAll() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    }
};

// ===== ATTENDANCE SERVICE WITH CACHE =====
export const attendanceService = {
    
    // 1. GET REKAP (Prioritas: Draft > Cache > Firebase)
    async getRekap(docId) {
        try {
            // Cek draft terlebih dahulu (prioritas tertinggi)
            const draft = localStorage.getItem('absensi_draft');
            if (draft) {
                const parsed = JSON.parse(draft);
                if (`${parsed.tanggal}_${parsed.kelas}` === docId) {
                    console.log('✅ Using draft data');
                    return parsed;
                }
            }

            // Cek cache
            const cached = AttendanceCache.getRekap(docId);
            if (cached && !cached.is_locked) {
                // Jangan gunakan cache untuk data yang sudah dikunci
                // (data locked harus selalu fresh dari server)
                console.log('✅ Rekap loaded from cache');
                return cached;
            }

            // Fetch dari Firebase
            console.log('🔄 Fetching rekap from Firebase...');
            const ref = doc(db, "rekap_absensi", docId);
            const snap = await getDoc(ref);
            
            if (snap.exists()) {
                const data = snap.data();
                AttendanceCache.setRekap(docId, data);
                return data;
            }

            return null;
        } catch (error) {
            console.error("Error getting rekap:", error);
            throw error;
        }
    },

    // 2. GET MASTER SISWA (Cache: 1 jam)
    async getMasterSiswa(kelasId, forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cached = AttendanceCache.getMaster(kelasId);
                if (cached) {
                    console.log(`✅ Master siswa for ${kelasId} from cache`);
                    return cached;
                }
            }

            console.log(`🔄 Fetching master siswa for ${kelasId}...`);
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
                    status: "Hadir",
                    keterangan: "-"
                };
            });

            AttendanceCache.setMaster(kelasId, mapSiswa);
            return mapSiswa;
        } catch (error) {
            console.error("Error getting master siswa:", error);
            throw error;
        }
    },

    // 3. SAVE REKAP (Save to Firebase + Update Cache)
    async saveRekap(docId, data) {
        try {
            const ref = doc(db, "rekap_absensi", docId);
            
            if (!data.created_at) {
                data.created_at = Timestamp.now();
            }
            data.updated_at = Timestamp.now();

            await setDoc(ref, data, { merge: true });

            // Update cache setelah berhasil save
            AttendanceCache.setRekap(docId, data);
            
            // Hapus draft karena sudah tersimpan
            localStorage.removeItem('absensi_draft');

            console.log('💾 Rekap saved to Firebase and cache updated');
        } catch (error) {
            console.error("Error saving rekap:", error);
            throw error;
        }
    },

    // 4. LOCK REKAP (Update Firebase + Cache)
    async lockRekap(docId) {
        try {
            const ref = doc(db, "rekap_absensi", docId);
            const lockData = {
                is_locked: true,
                locked_at: Timestamp.now()
            };

            await updateDoc(ref, lockData);

            // Update cache dengan status locked
            const cached = AttendanceCache.getRekap(docId);
            if (cached) {
                cached.is_locked = true;
                cached.locked_at = Timestamp.now();
                AttendanceCache.setRekap(docId, cached);
            }

            console.log('🔒 Rekap locked');
        } catch (error) {
            console.error("Error locking rekap:", error);
            throw error;
        }
    },

    // 5. GET MONTHLY REPORT (Cache: 10 menit)
    async getMonthlyReport(kelasId, monthStr, forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cached = AttendanceCache.getMonthlyReport(kelasId, monthStr);
                if (cached) {
                    console.log(`✅ Monthly report for ${kelasId} (${monthStr}) from cache`);
                    return cached;
                }
            }

            console.log(`🔄 Fetching monthly report for ${kelasId} (${monthStr})...`);
            const startStr = `${monthStr}-01`;
            const endStr = `${monthStr}-31`;

            const q = query(
                collection(db, "rekap_absensi"),
                where("kelas", "==", kelasId),
                where("tanggal", ">=", startStr),
                where("tanggal", "<=", endStr)
            );

            const snap = await getDocs(q);
            const data = snap.docs.map(d => d.data());

            AttendanceCache.setMonthlyReport(kelasId, monthStr, data);
            return data;
        } catch (error) {
            console.error("Error getting monthly report:", error);
            throw error;
        }
    },

    // UTILITY: Invalidate specific rekap cache
    invalidateRekap(docId) {
        AttendanceCache.removeRekap(docId);
    },

    // UTILITY: Invalidate master cache
    invalidateMaster(kelasId) {
        AttendanceCache.removeMaster(kelasId);
    },

    // UTILITY: Clear all attendance caches
    clearAllCaches() {
        AttendanceCache.clearAll();
    }
};

export { AttendanceCache };