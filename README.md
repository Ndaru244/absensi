
---

# 📊 Sistem Absensi Digital (Secure & Role-Based)

Sistem absensi berbasis web modern yang dirancang untuk efektivitas pendataan kehadiran siswa secara harian dan bulanan. Aplikasi ini menggunakan **Firebase v12+ (Modular SDK)** dengan sistem keamanan bertingkat (**Admin vs Guru**).

**URL Aplikasi:** [https://absensi-internal.web.app/](https://absensi-internal.web.app/)

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, Tailwind CSS (CDN), Lucide Icons.
* **Backend:** Firebase Firestore (NoSQL Database).
* **Auth:** Firebase Authentication (Google Sign-In dengan metode Redirect).
* **Fitur Utama:**
    * **PDF Export:** Laporan harian (Portrait) dan bulanan (Landscape) via jsPDF & AutoTable.
    * **Cache Manager:** Strategi *Cache-First* pada LocalStorage untuk efisiensi kuota Firestore.
    * **Secure Guards:** Proteksi rute otomatis berdasarkan *Role* dan status verifikasi.
    * **Visual Feedback:** Indikator status loading dan sukses pada aksi pengguna.

---

## 🔐 Manajemen Akses (RBAC)

Sistem menggunakan **Role-Based Access Control (RBAC)**.
Pendaftar baru **tidak langsung** bisa mengakses data.

### Role & Hak Akses

| Role              | Deskripsi                         | Hak Akses                                                                            |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| **Viewer (Guru)** | User standar setelah registrasi   | - Absen Harian<br>- Lihat Laporan<br>- ❌ Tidak bisa edit Data Master                 |
| **Admin**         | Pengelola sistem                  | - Full Access (CRUD Siswa/Kelas)<br>- Verifikasi User Baru<br>- Kunci / Buka Absensi |
| **Pending**       | Status awal (`isVerified: false`) | ⛔ Tidak bisa masuk dashboard (Blocked)                                               |

---

## 🏗️ Arsitektur Database (Firestore)

### 1. Koleksi `users`

Menyimpan data pengguna aplikasi.

* **Doc ID:** `UID` (Google Auth UID)
* **Fields:**

```json
{
  "nama": "Ndaru L Santosa",
  "email": "ndarulanggeng110@gmail.com",
  "nip": "199409230612025004",
  "role": "viewer | admin",
  "isVerified": true,
  "photo": "https://lh3.googleusercontent.com/...",
  "createdAt": "2025-12-29T09:50:19.970Z",
  "updatedAt": "2025-12-29T10:13:48.095Z"
}
```

---

### 2. Koleksi `kelas`

Master data kelas.

* **Doc ID:** Auto-generated
* **Fields:**

```json
{
  "nama_kelas": "1A"
}
```

---

### 3. Koleksi `siswa`

Master data siswa.

* **Doc ID:** Auto-generated
* **Fields:**

```json
{
  "nis": "2818",
  "nama_siswa": "MUHAMMAD ZABIR AGHA",
  "id_kelas": "6B",
  "status_aktif": "Aktif"
}
```

---

### 4. Koleksi `rekap_absensi` (Transaksi)

Menyimpan **1 dokumen per Kelas per Tanggal**.

* **Doc ID:** `[TANGGAL]_[NAMA_KELAS]`
  Contoh: `2025-12-28_X RPL 1`

* **Fields:**

```json
{
  "tanggal": "2025-12-26",
  "kelas": "6B",
  "is_locked": true,
  "locked_at": "December 28, 2025...",
  "siswa": {
    "DOC_ID_SISWA": {
      "nama": "MUHAMMAD ZABIR AGHA",
      "nis": "2818",
      "status": "Hadir | Sakit | Izin | Alpa",
      "keterangan": "-"
    }
  }
}
```

---

### 5. Koleksi `settings`

Menyimpan  **konfigurasi global seperti data Kepala Sekolah.**. untuk kebutuhan Print PDF

* **Doc ID:** `kepala_sekolah`

* **Fields:**

```json
{
  "nama": "SUPARTI",
  "nip": "197104191996062001"
}
```

---

## 📂 Struktur Folder

```text
/var/www/absensi/
├── index.html                # Dashboard Absensi Harian
├── admin.html                # Manajemen Data Master (Kelas/Siswa)
├── users.html                # Manajemen User & Akses (Admin Only)
├── login.html                # Halaman Autentikasi Google
├── assets/
│   ├── js/
│   │   ├── components/
│   │   │   └── navbar.js       # UI Profile & Logout di Navigasi
│   │   ├── firebase/
│   │   │   ├── config.js       # Inisialisasi Firebase
│   │   │   ├── auth-service.js # Logika Login & Session
│   │   │   ├── user-service.js # CRUD & Role Management
│   │   │   └── attendance-service.js
│   │   ├── pages/
│   │   │   ├── index.js        # Logic Harian & Dashboard
│   │   │   ├── admin.js        # Logic Master Data
│   │   │   └── users.js        # Logic Manajemen User & Caching
│   │   └── utils/
│   │       ├── auth-guard.js   # Proteksi Route & Role
│   │       ├── pdf-helper.js   # Export Harian & Bulanan
│   │       └── ui.js           # Modal, Toast, & Feedback Visual
```

---

## ⚙️ Cara Install & Setup

### 1. Setup Firebase Console

1. Buat proyek di **Firebase Console**
2. Aktifkan **Authentication → Google Sign-In**
3. Aktifkan **Firestore Database (Production Mode)**

---

### 2. Konfigurasi Security Rules (Wajib)

Gunakan kode ini di Firebase Console bagian **Firestore > Rules** Kode ini mengatur hak akses berdasarkan role (admin/viewer) dan status verifikasi user.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // --- GLOBAL HELPERS ---
    function isSignedIn() {
      return request.auth != null;
    }
    // Mengambil data user saat ini untuk cek Role/Status
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    // --- RULES ---
    // 1. Koleksi Users (Kunci Performa Login)
    match /users/{userId} {
      // Izinkan baca tanpa 'isVerified' agar proses login/verifikasi lancar
      allow read: if isSignedIn();
      allow create: if request.auth.uid == userId;
      // Update role/isVerified hanya boleh oleh Admin
      allow update: if isAdmin() || (
        request.auth.uid == userId && 
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'isVerified'])
      );
      allow delete: if isAdmin() && request.auth.uid != userId;
    }
    // 2. Data Master & Settings
    match /kelas/{kelasId} {
      allow read: if isVerified();
      allow write: if isAdmin();
    }
    
    match /siswa/{siswaId} {
      allow read: if isVerified();
      allow write: if isAdmin();
    }
    match /settings/{docId} {
      allow read: if isVerified();
      allow write: if isAdmin();
    }
    // 3. Rekap Absensi
    match /rekap_absensi/{docId} {
      allow read, create: if isVerified();
      allow delete: if isAdmin();
      allow update: if isAdmin() || (
        isVerified() && 
        resource.data.is_locked == false && 
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['is_locked'])
      );
    }
    // --- REUSEABLE LOGIC HELPERS ---
    function isAdmin() {
      return isSignedIn() && getUserData().role == 'admin';
    }
    function isVerified() {
      let data = getUserData();
      return isSignedIn() && (data.isVerified == true || data.role == 'admin');
    }
  }
}
```

---

### 3. Koneksi Firebase ke Kode

Edit file `assets/js/firebase/config.js`:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id"
};
```

---

### 4. Setup Admin Pertama (God Mode)

Karena sistem menggunakan **Approval**, admin pertama perlu diaktifkan manual:

1. Login melalui `login.html`
2. Buka **Firestore Console → collection `users`**
3. Edit dokumen user Anda:

   * `role` → `admin`
   * `isVerified` → `true`
4. Refresh web
5. Anda siap mengelola user lain lewat **Manajemen User**

---