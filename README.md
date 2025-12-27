📊 Sistem Absensi Digital (Secure & Role-Based)
===============================================

Sistem absensi berbasis web modern menggunakan **Firebase v11+ (Modular SDK)**. Dibangun dengan **Tailwind CSS** untuk UI, **Lucide Icons** untuk visual, dan sistem keamanan bertingkat (Admin vs Guru).

* * *

🛠️ Tech Stack
--------------

*   **Frontend:** HTML5, Tailwind CSS (CDN), Lucide Icons.
*   **Backend:** Firebase Firestore (NoSQL Database).
*   **Auth:** Firebase Authentication (Google Sign-In).
*   **Features:** PDF Export (jsPDF), Toast Notifications, Real-time Listener.

* * *

🔐 Manajemen Akses (RBAC)
-------------------------

Sistem menggunakan **Role-Based Access Control**. Pendaftar baru tidak langsung bisa mengakses data.

Role

Deskripsi

Hak Akses

**Viewer (Guru)**

User standar setelah registrasi.

*   Absen Harian
*   Lihat Laporan
*   ❌ Tidak bisa edit Data Master

**Admin**

Pengelola sistem.

*   Full Access (CRUD Siswa/Kelas)
*   Verifikasi User Baru
*   Kunci/Buka Absensi

**Pending**

Status awal (`isVerified: false`).

⛔ Tidak bisa masuk dashboard (Blocked)

* * *

🏗️ Arsitektur Database (Firestore)
-----------------------------------

### 1\. Koleksi `users`

Menyimpan data pengguna aplikasi.

*   **Doc ID:** `UID` (dari Google Auth)
*   **Fields:**

    {
      "nama": "Nama User",
      "email": "user@gmail.com",
      "photo": "URL_Foto_Google",
      "role": "admin" | "viewer",
      "isVerified": true | false,
      "createdAt": "ISO_String"
    }

### 2\. Koleksi `kelas`

Master data kelas.

*   **Doc ID:** Auto-generated
*   **Fields:**

    { 
      "nama": "X RPL 1" 
    }

### 3\. Koleksi `siswa`

Master data siswa.

*   **Doc ID:** Auto-generated
*   **Fields:**

    {
      "nis": "12345",
      "nama_lengkap": "Budi Santoso",
      "kelas": "X RPL 1",
      "gender": "L" | "P"
    }

### 4\. Koleksi `rekap_absensi` (Transaksi)

Menyimpan satu dokumen per **Kelas** per **Tanggal**.

*   **Doc ID:** `[TANGGAL]_[NAMA_KELAS]` (Contoh: `2025-12-28_X RPL 1`)
*   **Fields:**

    {
      "tanggal": "2025-12-28",
      "kelas": "X RPL 1",
      "is_locked": false,
      "siswa": {
         "DOC_ID_SISWA": {
            "nama": "Budi Santoso",
            "nis": "12345",
            "status": "Hadir" | "Sakit" | "Izin" | "Alpa",
            "keterangan": "-"
         }
      }
    }

* * *

📂 Struktur Folder
------------------

    /var/www/absensi/
    ├── index.html        # Dashboard Absensi (Guru)
    ├── admin.html        # Master Data (Admin Only)
    ├── users.html        # Manajemen User (Admin Only)
    ├── login.html        # Halaman Masuk
    └── assets/
        └── js/
            ├── firebase/
            │   ├── config.js         # API Keys
            │   ├── auth-service.js   # Logic Login/Logout
            │   ├── admin-service.js  # Logic CRUD Data Master
            │   └── attendance-service.js
            ├── pages/
            │   ├── index.js          # Logic Dashboard
            │   └── admin.js          # Logic Admin Page
            └── utils/
                ├── auth-guard.js     # Proteksi Halaman
                ├── pdf-helper.js     # Export PDF
                └── ui.js             # Toast, Modal, Theme

* * *

⚙️ Cara Install & Setup
-----------------------

### 1\. Setup Firebase Console

1.  Buat proyek di [Firebase Console](https://console.firebase.google.com/).
2.  Aktifkan **Authentication** > Sign-in method > **Google**.
3.  Aktifkan **Firestore Database** (Mode Production).

### 2\. Konfigurasi Security Rules (Wajib!)

Copy kode ini ke tab **Rules** di Firestore untuk keamanan maksimal:

    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        
        // Helper Functions
        function isSignedIn() { return request.auth != null; }
        function userDoc() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
        function userExists() { return exists(/databases/$(database)/documents/users/$(request.auth.uid)); }
        function isAdmin() { return isSignedIn() && userExists() && userDoc().role == 'admin'; }
        function isVerified() { return isSignedIn() && userExists() && (userDoc().isVerified == true || userDoc().role == 'admin'); }
    
        // Rules
        match /users/{userId} {
          allow read: if isSignedIn();
          allow create: if request.auth.uid == userId; // Self-registration
          allow delete: if isAdmin();
          allow update: if isAdmin() || (request.auth.uid == userId && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'isVerified']));
        }
    
        match /kelas/{kelasId} {
          allow read: if isVerified();
          allow write: if isAdmin();
        }
        
        match /siswa/{siswaId} {
          allow read: if isVerified();
          allow write: if isAdmin();
        }
    
        match /rekap_absensi/{docId} {
          allow read, create: if isVerified();
          allow delete: if isAdmin();
          allow update: if isAdmin() || (isVerified() && resource.data.is_locked == false && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['is_locked']));
        }
      }
    }

### 3\. Koneksi Kode

Update file `assets/js/firebase/config.js` dengan kredensial proyek Anda:

    const firebaseConfig = {
      apiKey: "AIzaSy...",
      authDomain: "project-id.firebaseapp.com",
      projectId: "project-id",
      // ...
    };

### 4\. Setup Admin Pertama (God Mode)

Karena sistem menggunakan _Approval_, pendaftar pertama (Anda) harus mengaktifkan diri sendiri secara manual:

1.  Login di web (`login.html`).
2.  Buka Firestore Console > Koleksi `users`.
3.  Edit dokumen Anda:
    *   Ubah `role` menjadi `admin`.
    *   Ubah `isVerified` menjadi `true`.
4.  Refresh web, dan Anda siap mengelola user lain lewat menu **Manajemen User**.