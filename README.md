Siap 👍 Ini versi **Markdown yang lebih rapi, konsisten, dan enak dibaca**, tanpa mengubah isi teknisnya. Sudah saya perbaiki heading, tabel, code block, dan spacing-nya.

---

# 📊 Sistem Absensi Digital (Secure & Role-Based)

Sistem absensi berbasis web modern menggunakan **Firebase v11+ (Modular SDK)**.
Dibangun dengan **Tailwind CSS** untuk UI, **Lucide Icons** untuk visual, serta sistem keamanan bertingkat (**Admin vs Guru**).

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, Tailwind CSS (CDN), Lucide Icons
* **Backend:** Firebase Firestore (NoSQL Database)
* **Auth:** Firebase Authentication (Google Sign-In)
* **Features:**

  * PDF Export (jsPDF)
  * Toast Notifications
  * Real-time Listener

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
  "nama": "Nama User",
  "email": "user@gmail.com",
  "photo": "URL_Foto_Google",
  "role": "admin | viewer",
  "isVerified": true,
  "createdAt": "ISO_String"
}
```

---

### 2. Koleksi `kelas`

Master data kelas.

* **Doc ID:** Auto-generated
* **Fields:**

```json
{
  "nama": "X RPL 1"
}
```

---

### 3. Koleksi `siswa`

Master data siswa.

* **Doc ID:** Auto-generated
* **Fields:**

```json
{
  "nis": "12345",
  "nama_lengkap": "Budi Santoso",
  "kelas": "X RPL 1",
  "gender": "L | P"
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
  "tanggal": "2025-12-28",
  "kelas": "X RPL 1",
  "is_locked": false,
  "siswa": {
    "DOC_ID_SISWA": {
      "nama": "Budi Santoso",
      "nis": "12345",
      "status": "Hadir | Sakit | Izin | Alpa",
      "keterangan": "-"
    }
  }
}
```

---

## 📂 Struktur Folder

```text
/var/www/absensi/
├── index.html        # Dashboard Absensi (Guru)
├── admin.html        # Master Data (Admin Only)
├── users.html        # Manajemen User (Admin Only)
├── login.html        # Halaman Masuk
└── assets/
    └── js/
        ├── firebase/
        │   ├── config.js            # API Keys
        │   ├── auth-service.js      # Login / Logout
        │   ├── admin-service.js     # CRUD Data Master
        │   └── attendance-service.js
        ├── pages/
        │   ├── index.js             # Logic Dashboard
        │   └── admin.js             # Logic Admin Page
        └── utils/
            ├── auth-guard.js        # Proteksi Halaman
            ├── pdf-helper.js        # Export PDF
            └── ui.js                # Toast, Modal, Theme
```

---

## ⚙️ Cara Install & Setup

### 1. Setup Firebase Console

1. Buat proyek di **Firebase Console**
2. Aktifkan **Authentication → Google Sign-In**
3. Aktifkan **Firestore Database (Production Mode)**

---

### 2. Konfigurasi Security Rules (Wajib)

Salin kode berikut ke tab **Rules** di Firestore:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper Functions
    function isSignedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function userExists() {
      return exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isAdmin() {
      return isSignedIn() && userExists() && userDoc().role == 'admin';
    }

    function isVerified() {
      return isSignedIn() && userExists() &&
        (userDoc().isVerified == true || userDoc().role == 'admin');
    }

    // Users
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if request.auth.uid == userId;
      allow delete: if isAdmin();
      allow update: if isAdmin()
        || (request.auth.uid == userId &&
            !request.resource.data.diff(resource.data)
              .affectedKeys().hasAny(['role', 'isVerified']));
    }

    // Kelas
    match /kelas/{kelasId} {
      allow read: if isVerified();
      allow write: if isAdmin();
    }

    // Siswa
    match /siswa/{siswaId} {
      allow read: if isVerified();
      allow write: if isAdmin();
    }

    // Absensi
    match /rekap_absensi/{docId} {
      allow read, create: if isVerified();
      allow delete: if isAdmin();
      allow update: if isAdmin()
        || (isVerified() && resource.data.is_locked == false &&
            !request.resource.data.diff(resource.data)
              .affectedKeys().hasAny(['is_locked']));
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