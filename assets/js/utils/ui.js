// assets/js/utils/ui.js
let modalCallback = null;
let promptCallback = null;

// 1. THEME TOGGLER LOGIC
function initTheme() {
    // Cek local storage atau system preference
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
}

// 2. TOAST NOTIFICATION (Pengganti Alert)
function showToast(message, type = 'info') {
    // Container toast (buat jika belum ada)
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-50 flex flex-col gap-3';
        document.body.appendChild(container);
    }

    // Warna berdasarkan tipe
    const colors = {
        success: 'bg-green-500 border-green-700',
        error: 'bg-red-500 border-red-700',
        info: 'bg-blue-500 border-blue-700',
        warning: 'bg-yellow-500 border-yellow-700'
    };
    const colorClass = colors[type] || colors.info;

    // Elemen Toast
    const toast = document.createElement('div');
    toast.className = `${colorClass} text-white px-6 py-4 rounded-lg shadow-lg border-l-4 transform transition-all duration-300 translate-x-full opacity-0 flex items-center min-w-[300px]`;

    // Icon (Sederhana text based)
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';

    toast.innerHTML = `
        <span class="mr-3 text-xl">${icon}</span>
        <span class="font-medium">${message}</span>
    `;

    container.appendChild(toast);

    // Animasi Masuk
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });

    // Auto Hapus setelah 3 detik
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Inisialisasi Tema saat file dimuat
initTheme();
function setupModal() {
    // Inject HTML Modal ke body jika belum ada
    if (!document.getElementById('custom-modal')) {
        const modalHTML = `
        <div id="custom-modal" class="fixed inset-0 z-[60] hidden flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity opacity-0">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 transform scale-95 transition-transform">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Konfirmasi</h3>
                <p id="modal-msg" class="text-gray-600 dark:text-gray-300 mb-6 text-sm"></p>
                <div class="flex justify-end gap-3">
                    <button id="btn-modal-cancel" class="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 font-medium transition">Batal</button>
                    <button id="btn-modal-yes" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition">Ya, Lanjutkan</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Event Listener
        document.getElementById('btn-modal-cancel').onclick = closeModal;
        document.getElementById('btn-modal-yes').onclick = () => {
            if (modalCallback) modalCallback();
            closeModal();
        };
    }
}

function showConfirm(message, onConfirm) {
    setupModal(); // Pastikan modal ada
    const modal = document.getElementById('custom-modal');
    const msgEl = document.getElementById('modal-msg');

    msgEl.innerText = message;
    modalCallback = onConfirm; // Simpan fungsi yang akan dijalankan

    // Tampilkan dengan animasi
    modal.classList.remove('hidden');
    // Sedikit delay biar transisi opacity jalan
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    if (!modal) return;

    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300); // Sesuaikan durasi transition CSS
}

// CUSTOM PROMPT LOGIC (Input Text)
function setupPrompt() {
    if (!document.getElementById('custom-prompt')) {
        const promptHTML = `
        <div id="custom-prompt" class="fixed inset-0 z-[70] hidden flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity opacity-0">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 transform scale-95 transition-transform">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Keterangan Tambahan</h3>
                <p id="prompt-msg" class="text-gray-600 dark:text-gray-300 mb-4 text-sm"></p>
                
                <textarea id="prompt-input" rows="2" class="w-full p-3 rounded-lg border bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none mb-4 text-sm" placeholder="Tulis alasan di sini..."></textarea>

                <div class="flex justify-end gap-3">
                    <button id="btn-prompt-skip" class="px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 text-sm font-medium transition">Kosongkan</button>
                    <button id="btn-prompt-save" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg text-sm transition">Simpan Keterangan</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', promptHTML);

        // Event Listener
        const modal = document.getElementById('custom-prompt');
        const input = document.getElementById('prompt-input');

        document.getElementById('btn-prompt-skip').onclick = () => {
            if (promptCallback) promptCallback("-"); // Kirim dash jika dikosongkan
            closePrompt();
        };
        
        document.getElementById('btn-prompt-save').onclick = () => {
            const val = input.value.trim() || "-";
            if (promptCallback) promptCallback(val);
            closePrompt();
        };
    }
}

function showPrompt(message, onSave) {
    setupPrompt();
    const modal = document.getElementById('custom-prompt');
    const msgEl = document.getElementById('prompt-msg');
    const inputEl = document.getElementById('prompt-input');
    
    msgEl.innerText = message;
    inputEl.value = ""; // Reset input
    promptCallback = onSave;

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
        inputEl.focus(); // Auto focus ke input
    }, 10);
}

function closePrompt() {
    const modal = document.getElementById('custom-prompt');
    if(!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

export { showToast, toggleTheme, showConfirm, showPrompt };