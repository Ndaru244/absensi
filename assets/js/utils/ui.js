// assets/js/utils/ui.js
let modalCallback = null;
let promptCallback = null;

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
    if(window.lucide) window.lucide.createIcons();
}

// --- TOAST (LUCIDE) ---
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }

    const configs = {
        success: { color: 'bg-emerald-600', icon: 'check-circle' },
        error:   { color: 'bg-red-600', icon: 'alert-triangle' },
        warning: { color: 'bg-yellow-500', icon: 'alert-circle' },
        info:    { color: 'bg-blue-600', icon: 'info' }
    };
    const { color, icon } = configs[type] || configs.info;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white transform transition-all duration-300 translate-x-full opacity-0 ${color}`;
    toast.innerHTML = `<i data-lucide="${icon}" class="w-6 h-6 flex-shrink-0"></i><span class="font-bold text-sm tracking-wide">${message}</span>`;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ root: toast });

    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            toast.remove();
            if (!container.hasChildNodes()) container.remove();
        }, 300);
    }, 3000);
}

// --- MODAL HELPERS ---
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
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Input Keterangan</h3>
                    <p id="prompt-msg" class="text-gray-600 dark:text-gray-300 mb-4 text-sm"></p>
                    <input type="text" id="prompt-input" class="w-full p-3 mb-4 rounded-lg bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 outline-none focus:ring-2 focus:ring-blue-500">
                    <div class="flex justify-end gap-3">
                        <button onclick="document.getElementById('custom-prompt').classList.add('hidden')" class="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400">Batal</button>
                        <button id="btn-prompt-save" class="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700">Simpan</button>
                    </div>
                </div>
            </div>`);
        
        document.getElementById('btn-modal-yes').onclick = () => { if(modalCallback) modalCallback(); document.getElementById('custom-modal').classList.add('hidden'); };
        document.getElementById('btn-prompt-save').onclick = () => { 
            const val = document.getElementById('prompt-input').value.trim() || '-'; 
            if(promptCallback) promptCallback(val); 
            document.getElementById('custom-prompt').classList.add('hidden'); 
        };
    }
};

const _open = (id, msg, cb) => {
    _ensureModals();
    const el = document.getElementById(id);
    document.getElementById(id === 'custom-modal' ? 'modal-msg' : 'prompt-msg').innerText = msg;
    if(id === 'custom-prompt') { const inp = document.getElementById('prompt-input'); inp.value = ''; setTimeout(() => inp.focus(), 50); }
    if(id === 'custom-modal') modalCallback = cb; else promptCallback = cb;
    el.classList.remove('hidden');
    setTimeout(() => { el.classList.remove('opacity-0'); el.querySelector('div').classList.replace('scale-95', 'scale-100'); }, 10);
};

export const showConfirm = (msg, cb) => _open('custom-modal', msg, cb);
export const showPrompt = (msg, cb) => _open('custom-prompt', msg, cb);