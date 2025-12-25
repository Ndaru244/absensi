// assets/js/utils/ui.js
let modalCallback = null;
let promptCallback = null;

// --- THEME ---
export const initTheme = () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
};

export const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
};

// --- TOAST ---
export const showToast = (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }

    const colors = {
        success: 'bg-emerald-600', error: 'bg-red-600', 
        info: 'bg-blue-600', warning: 'bg-yellow-600'
    };

    const toast = document.createElement('div');
    toast.className = `${colors[type] || colors.info} text-white px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-300 translate-x-full opacity-0 pointer-events-auto flex items-center gap-3 min-w-[300px] border border-white/10`;
    toast.innerHTML = `<span class="text-xl">${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span><span class="font-bold text-sm tracking-wide">${message}</span>`;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));

    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- CONFIRM MODAL (Yes/No) ---
export const showConfirm = (message, onConfirm) => {
    _ensureModalsExist();
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-msg').innerText = message;
    modalCallback = onConfirm;
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.replace('scale-95', 'scale-100');
    }, 10);
};

// --- PROMPT MODAL (Input Text) ---
export const showPrompt = (message, onSave) => {
    _ensureModalsExist();
    const modal = document.getElementById('custom-prompt');
    const input = document.getElementById('prompt-input');
    
    document.getElementById('prompt-msg').innerText = message;
    input.value = ''; // Reset input
    promptCallback = onSave;
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.replace('scale-95', 'scale-100');
        input.focus();
    }, 10);
};

// --- INTERNAL HELPERS ---
const _closeModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.replace('scale-100', 'scale-95');
    setTimeout(() => modal.classList.add('hidden'), 200);
};

const _ensureModalsExist = () => {
    // 1. Inject Confirm Modal
    if (!document.getElementById('custom-modal')) {
        const confirmHTML = `
        <div id="custom-modal" class="fixed inset-0 z-[90] hidden flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity opacity-0 duration-200">
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700 transform scale-95 transition-all duration-200">
                <h3 class="text-lg font-extrabold text-gray-900 dark:text-white mb-2">Konfirmasi</h3>
                <p id="modal-msg" class="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed"></p>
                <div class="flex justify-end gap-3">
                    <button id="btn-modal-cancel" class="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition">Batal</button>
                    <button id="btn-modal-yes" class="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 transition">Ya, Lanjutkan</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', confirmHTML);
        
        document.getElementById('btn-modal-cancel').onclick = () => _closeModal('custom-modal');
        document.getElementById('btn-modal-yes').onclick = () => {
            if (modalCallback) modalCallback();
            _closeModal('custom-modal');
        };
    }

    // 2. Inject Prompt Modal (NEW)
    if (!document.getElementById('custom-prompt')) {
        const promptHTML = `
        <div id="custom-prompt" class="fixed inset-0 z-[95] hidden flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity opacity-0 duration-200">
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-gray-200 dark:border-gray-700 transform scale-95 transition-all duration-200">
                <h3 class="text-lg font-extrabold text-gray-900 dark:text-white mb-2">Input Keterangan</h3>
                <p id="prompt-msg" class="text-gray-600 dark:text-gray-300 mb-4 text-sm"></p>
                
                <input type="text" id="prompt-input" class="w-full p-3 mb-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200" placeholder="Tulis alasan di sini...">
                
                <div class="flex justify-end gap-3">
                    <button id="btn-prompt-cancel" class="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition">Batal</button>
                    <button id="btn-prompt-save" class="px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition">Simpan</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', promptHTML);

        document.getElementById('btn-prompt-cancel').onclick = () => _closeModal('custom-prompt');
        
        // Save Logic
        document.getElementById('btn-prompt-save').onclick = () => {
            const val = document.getElementById('prompt-input').value.trim() || '-';
            if (promptCallback) promptCallback(val);
            _closeModal('custom-prompt');
        };

        // Allow Enter key to save
        document.getElementById('prompt-input').onkeydown = (e) => {
            if(e.key === 'Enter') document.getElementById('btn-prompt-save').click();
        };
    }
};