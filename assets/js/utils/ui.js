// assets/js/utils/ui.js
let modalCallback = null;
let promptCallback = null;
let htmlCallback = null;

// --- THEME ---
export const initTheme = () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
};

export function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
    if (window.lucide) window.lucide.createIcons();
}

// --- TOAST (LUCIDE) ---
const _ensureModals = () => {
    if (!document.getElementById('custom-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="custom-modal" class="fixed inset-0 z-[90] hidden flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity opacity-0">
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl transform scale-95 transition-all">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Konfirmasi</h3>
                    <p id="modal-msg" class="text-gray-600 dark:text-gray-300 mb-6 text-sm"></p>
                    <div class="flex justify-end gap-3">
                        <button onclick="document.getElementById('custom-modal').classList.add('hidden')" class="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-400">Batal</button>
                        <button id="btn-modal-yes" class="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>

            <div id="custom-prompt" class="fixed inset-0 z-[95] hidden flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity opacity-0">
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl transform scale-95 transition-all">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Input Data</h3>
                    <p id="prompt-msg" class="text-gray-600 dark:text-gray-300 mb-4 text-sm"></p>
                    <input type="text" id="prompt-input" class="w-full p-3 mb-4 rounded-lg bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white">
                    <div class="flex justify-end gap-3">
                        <button onclick="document.getElementById('custom-prompt').classList.add('hidden')" class="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400">Batal</button>
                        <button id="btn-prompt-save" class="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700">Simpan</button>
                    </div>
                </div>
            </div>

            <div id="custom-html" class="fixed inset-0 z-[95] hidden flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity opacity-0">
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform scale-95 transition-all">
                    <h3 id="html-title" class="text-lg font-bold text-gray-900 dark:text-white mb-4">Form</h3>
                    
                    <div id="html-body" class="mb-6"></div>

                    <div class="flex justify-end gap-3">
                        <button onclick="document.getElementById('custom-html').classList.add('hidden')" class="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-400">Batal</button>
                        <button id="btn-html-save" class="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700">Simpan</button>
                    </div>
                </div>
            </div>
        `);

        // Listener Confirm
        document.getElementById('btn-modal-yes').onclick = () => {
            if (modalCallback) modalCallback();
            document.getElementById('custom-modal').classList.add('hidden');
        };

        // Listener Prompt
        document.getElementById('btn-prompt-save').onclick = () => {
            const val = document.getElementById('prompt-input').value.trim() || '-';
            if (promptCallback) promptCallback(val);
            document.getElementById('custom-prompt').classList.add('hidden');
        };

        // Listener Custom HTML (NEW)
        document.getElementById('btn-html-save').onclick = () => {
            if (htmlCallback) htmlCallback(); // Callback menangani pengambilan value sendiri
            document.getElementById('custom-html').classList.add('hidden');
        };
    }
};

const _open = (id, content, cb, title = '') => {
    _ensureModals();
    const el = document.getElementById(id);

    // Logic berbeda untuk tiap tipe modal
    if (id === 'custom-html') {
        document.getElementById('html-title').innerText = title || 'Form Edit';
        document.getElementById('html-body').innerHTML = content; // Injeksi HTML
        htmlCallback = cb;
    } else {
        const msgId = id === 'custom-modal' ? 'modal-msg' : 'prompt-msg';
        document.getElementById(msgId).innerText = content;

        if (id === 'custom-prompt') {
            const inp = document.getElementById('prompt-input');
            inp.value = '';
            setTimeout(() => inp.focus(), 50);
            promptCallback = cb;
        } else {
            modalCallback = cb;
        }
    }

    // Animasi Masuk
    el.classList.remove('hidden');
    setTimeout(() => {
        el.classList.remove('opacity-0');
        el.querySelector('div').classList.replace('scale-95', 'scale-100');
    }, 10);
};

// export const showConfirm = (msg, cb) => _open('custom-modal', msg, cb);
export const showPrompt = (msg, cb) => _open('custom-prompt', msg, cb);

export function showConfirm(title, onConfirm, description = "") {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in transition-opacity opacity-0';

    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-95 transition-all duration-200">
            <div class="p-6 text-center">
                <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="alert-triangle" class="w-8 h-8"></i>
                </div>
                
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    ${title || "Konfirmasi"}
                </h3>
                
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                    ${description || "Apakah Anda yakin ingin melanjutkan tindakan ini?"}
                </p>
                
                <div class="flex gap-3 justify-center">
                    <button id="btnCancelConfirm" class="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition text-sm">
                        Batal
                    </button>
                    <button id="btnYesConfirm" class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-200 dark:shadow-none transition text-sm flex justify-center items-center gap-2">
                        Ya, Lanjutkan
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    });

    if (window.lucide) lucide.createIcons({ root: modal });

    const btnCancel = modal.querySelector('#btnCancelConfirm');
    const btnYes = modal.querySelector('#btnYesConfirm');

    btnCancel.focus();

    const closeModal = () => {
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.remove('scale-100');
        modal.querySelector('div').classList.add('scale-95');
        setTimeout(() => modal.remove(), 200);
    };

    btnCancel.onclick = closeModal;

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    btnYes.onclick = async () => {
        btnYes.innerHTML = `<span class="animate-spin inline-block">↻</span> Proses...`;
        btnYes.disabled = true;
        btnCancel.disabled = true;

        try {
            await onConfirm();
        } catch (e) {
            console.error(e);
        } finally {
            closeModal();
        }
    };
}

// Export Fungsi Baru
export const showCustomModal = (title, htmlContent, onSave) => _open('custom-html', htmlContent, onSave, title);
export const showToast = (msg, type = 'info') => {
    const div = document.createElement('div');
    div.className = `fixed top-4 right-4 z-[100] px-6 py-3 rounded-lg shadow-lg text-white font-medium transform transition-all duration-300 translate-y-[-20px] opacity-0 ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
    div.innerText = msg;
    document.body.appendChild(div);
    requestAnimationFrame(() => { div.classList.remove('translate-y-[-20px]', 'opacity-0'); });
    setTimeout(() => { div.classList.add('opacity-0'); setTimeout(() => div.remove(), 300); }, 3000);
};