// ==================== APP.JS - FULL SCRIPT LENGKAP ====================
// Sistem Komentar + Upload File (PDF/Foto) ke Dropbox
// Dengan Persistensi State & Realtime Attachment

// ==================== STORAGE KEYS UNTUK PERSISTENSI ====================
const STORAGE_KEYS = {
    ACTIVE_YEAR: 'efk_active_year',
    CURRENT_VIEW: 'efk_current_view',
    ACTIVE_FILTERS: 'efk_active_filters',
    ACTIVE_SALES_PER_PROJECT: 'efk_active_sales_per_project'
};

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA630jQdTLNt1XHjVAXX10IjIeMVJ_vNn8",
    authDomain: "pipelineefk.firebaseapp.com",
    projectId: "pipelineefk",
    storageBucket: "pipelineefk.appspot.com",
    messagingSenderId: "763507094626",
    appId: "1:763507094626:web:57838068505c964f654d3b"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const dealsCollection = db.collection('deals');
const deletedDealsCollection = db.collection('deletedDeals');
const activitiesCollection = db.collection('activities');
const usersCollection = db.collection('users');
const dropdownOptionsCollection = db.collection('dropdownOptions');
const commentsCollection = db.collection('comments');
const attachmentsCollection = db.collection('attachments');

// Konfigurasi Dropbox
const DROPBOX_ACCESS_TOKEN = "sl.u.AGdNefxCacqxqVEqT1rMu34JrXZ6wLspYfjo8-z6-u-1SeiWFML-FLYw35v_GqPQOU8Nzq5z1WhVV1du9OBDyk0rK38rpSswuS7NXoJMs-4HmXv76Jhs40TMlskrO-_vcjhwglgmxUV26b31rEKTT3O5iMZe1_akhOEI4NRmXM1ccP-fgX1V7TaUyPleyDu8j29RVSQ31-KjK0OK-RBBt2B8L7Dh8w-x7qsk34bRqBx81byIWr5quJJ2MARdFuMiCC05LZ4WVyg4rR76dH6ziqY4rdAoHJkrmOIA1Mv1vzF5aXBwVby393DrlTvkMduhjfm5NPSfhuOSar-3boYYkBjon9EhHJ7voJ62DfhfyBWUMkCxv8j5gqmqEzE7Azv6b0RgTUtQGsYlMb7Q9C0taHRRTm0d8lUiKIMhwdDUYv-fWVNeTYes3vC_xolTO9jwBdqudekSNFiNWTaQuJmg43jvGyj3efomxwUp-zy4n55swbwL6QsITua1mws3bj67zChSzQYBqhVDHhQ7Xs307nzDWCwAD2QniifhyFy6lnRMx0mFBaeS05CxtwFirYsk9HccCXlT3NHx2cV5FVnb894oiMnic76qw_RlcD4C6fZl9ttluawvOHf3GN9q8wM_74UeFT58k1c1TqLabDz6pmruc7lmgLCXZbMjvEPtTiwukGsTZDlJEPZbXG3UgZ_wTT2253nuTW_NAtmX7-O-1RY0stjz_aHn7RGQh3kFnzMrLn-Gbc8_ZOY9VNm5-aIyMntVoYeszUhfEw5Vf0QDBTAIO5uxDvLdPpU83HoAG-Kk8je8iW3QE1Fk94rWGodbL1TTlUQuSWi9NKMq2RyWl3pc5lQiFEVz6E468ZyS2LzeqX5xY_mMvDWOVymuyFGGutte0b2OB18UhBnqX7Pejhklk5f72Csx8oBThcfc1s39SPtEUcCaEwFmhQUf1zL9oZsncEjmsBJ4yNStznB1K7jysiA6rJfgcFPWBgyidrdi_sAzhmAcCgPo2jHUtWByFOK8X-b_pdd57rDFpy95ykXMuIFi3urFIQqleVufOFpi3BfeTqOcTSVJTm8OeG1jjqzbUWrsTLGtbkT2O63LXVBLUFHpQ3Z0WTr9J9Y6_YwMKJLZTwZ72NVwIEE2x0J7lo1bP8RPXXWqUYewyfSSk8TScyY5jNarO4CCiWvQy5qQdxj18UnB5cx2yl3-b0hP8gPtrje3pJI8NsQWQM10SxQeyH16ahbGm4o4RwIrtJAG8NcZXKXEk6W135VwBsoZxdJQivGtScyOg7M1bTEev4X0T8Yaix9PZvp13r7e8Y3RqXMXE4Pz6w_AsnE-4qdYUQA";
const DROPBOX_APP_FOLDER = "owncloud-efk";

let deals = [];
let deletedDeals = [];
let activities = [];
let charts = {};
const DEFAULT_STAGE = 'identified';
let currentUserRole = 'user';
let currentUserEmail = null;
let currentSalesName = null;
let sortableInstances = {};
let authInitialized = false;

// Data sets
let uniqueConsultants = new Set();
let uniqueContractors = new Set();
let uniquePICs = new Set();
let uniqueOwners = new Set();
let uniqueProducts = new Set();
let uniqueFacilities = new Set();
let uniquePackages = new Set();
let uniqueYears = new Set();
let uniqueSales = new Set();

// State dengan persistensi
let activeYear = 'all';
let currentView = 'card';
let activeFilters = {
    searchTerm: '',
    priority: 'all',
    year: 'all',
    stage: 'all',
    sales: 'all',
    consultant: 'all',
    contractor: 'all',
    facility: 'all',
    product: 'all',
    package: 'all'
};

// Cache
let priorityStatsCache = { 'all': null, '2025': null, '2026': null };
let dealsByYearCache = { 'all': null, '2025': null, '2026': null };
let activitiesCache = { data: [], lastFetch: null };
let commentsMigrationCompleted = false;
let dealsByIdCache = new Map();

// Active sales per project
let activeSalesPerProject = {};

// Realtime listeners
let attachmentsUnsubscribe = null;
let dealsUnsubscribe = null;

const CACHE_DURATION = 5 * 60 * 1000;

// DOM elements
let facilitySelect, newFacilityInput;
let packageSelect, newPackageInput;
let consultantSearchInput, consultantHiddenInput, consultantSuggestionsDiv;

// Email mapping
const emailToSalesNameMap = {
    'rory@genetek.co.id': 'Rory',
    'pamungkas@genetek.co.id': 'Pamungkas',
    'dhea@genetek.co.id': 'Dhea',
    'bintang@genetek.co.id': 'Bintang',
    'andy@genetek.co.id': 'Andy',
    'rangga@genetek.co.id': 'Rangga',
    'm_husni@genetek.co.id': 'Husni',
    'edwin@genetek.co.id': 'Edwin',
    'engineering@genetek.co.id': 'Engineering'
};

const salesNameToEmailMap = {};
Object.entries(emailToSalesNameMap).forEach(([email, name]) => {
    salesNameToEmailMap[name] = email;
});

const managerEmails = [
    'hadi@genetek.co.id',
    'david@genetek.co.id',
    'crenata@genetek.co.id',
    'agoesdh@genetek.co.id',
    'yib_wahyu@genetek.co.id',
    'satriopk@genetek.co.id',
    'admin@genetek.co.id'
];

let currentDealIdForComments = null;
let dealToDeleteId = null;
let dealToDeleteName = '';
let currentCommentAttachmentFile = null;

// Modal state
let activityModalState = { isOpen: false, scrollPosition: 0 };
let isActivityModalOpening = false;

// Sales charts
let salesCharts = {
    salesStageChart: null,
    salesPriorityChart: null,
    salesTimelineChart: null,
    priorityStageChart: null,
    prioritySalesChart: null,
    priorityTimelineChart: null
};

// ==================== FUNGSI PERSISTENSI STATE ====================

function saveStateToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_YEAR, activeYear);
        localStorage.setItem(STORAGE_KEYS.CURRENT_VIEW, currentView);
        localStorage.setItem(STORAGE_KEYS.ACTIVE_FILTERS, JSON.stringify(activeFilters));
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SALES_PER_PROJECT, JSON.stringify(activeSalesPerProject));
        console.log("State saved to localStorage");
    } catch (error) {
        console.error("Error saving state:", error);
    }
}

function loadStateFromLocalStorage() {
    try {
        const savedYear = localStorage.getItem(STORAGE_KEYS.ACTIVE_YEAR);
        if (savedYear && (savedYear === 'all' || savedYear === '2025' || savedYear === '2026')) {
            activeYear = savedYear;
        }
        
        const savedView = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW);
        if (savedView && (savedView === 'card' || savedView === 'list')) {
            currentView = savedView;
        }
        
        const savedFilters = localStorage.getItem(STORAGE_KEYS.ACTIVE_FILTERS);
        if (savedFilters) {
            const parsed = JSON.parse(savedFilters);
            activeFilters = { ...activeFilters, ...parsed };
        }
        
        const savedSalesPerProject = localStorage.getItem(STORAGE_KEYS.ACTIVE_SALES_PER_PROJECT);
        if (savedSalesPerProject) {
            activeSalesPerProject = JSON.parse(savedSalesPerProject);
        }
        
        console.log("State loaded from localStorage:", { activeYear, currentView, activeFilters });
    } catch (error) {
        console.error("Error loading state:", error);
    }
}

function updateYearBadgeUI() {
    document.querySelectorAll('.year-badge').forEach(badge => {
        if (badge.dataset.year === activeYear) {
            badge.classList.add('active');
        } else {
            badge.classList.remove('active');
        }
    });
}

function updateViewToggleUI() {
    const cardViewBtn = document.getElementById('cardViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (cardViewBtn && listViewBtn) {
        if (currentView === 'card') {
            cardViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
        } else {
            cardViewBtn.classList.remove('active');
            listViewBtn.classList.add('active');
        }
    }
}

// ==================== REALTIME ATTACHMENT LISTENER ====================

function setupRealtimeAttachments(dealId) {
    if (attachmentsUnsubscribe) {
        attachmentsUnsubscribe();
        attachmentsUnsubscribe = null;
    }
    
    if (!dealId) return;
    
    attachmentsUnsubscribe = attachmentsCollection
        .where('dealId', '==', dealId)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            console.log(`Realtime attachment update for deal ${dealId}, changes:`, snapshot.docChanges().length);
            
            const detailModal = document.getElementById('dealDetailModal');
            const dealModal = document.getElementById('dealModal');
            
            if (detailModal && !detailModal.classList.contains('hidden')) {
                renderAttachments(document.getElementById('detailAttachmentsList'), dealId);
            }
            
            if (dealModal && !dealModal.classList.contains('hidden') && currentDealIdForComments === dealId) {
                renderAttachments(document.getElementById('dealAttachmentsList'), dealId);
            }
        }, (error) => {
            console.error("Realtime attachment error:", error);
        });
}

function stopRealtimeAttachments() {
    if (attachmentsUnsubscribe) {
        attachmentsUnsubscribe();
        attachmentsUnsubscribe = null;
    }
}

// ==================== REALTIME DEALS LISTENER ====================

function setupRealtimeDeals() {
    if (dealsUnsubscribe) {
        dealsUnsubscribe();
        dealsUnsubscribe = null;
    }
    
    dealsUnsubscribe = dealsCollection.orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        console.log("Realtime deals update, changes:", snapshot.docChanges().length);
        
        let hasChanges = false;
        
        snapshot.docChanges().forEach(change => {
            const dealData = change.doc.data();
            const deal = { id: change.doc.id, ...dealData };
            
            if (change.type === 'added') {
                const existingIndex = deals.findIndex(d => d.id === change.doc.id);
                if (existingIndex === -1) {
                    deals.unshift(deal);
                    hasChanges = true;
                }
                dealsByIdCache.set(change.doc.id, deal);
                
                if (dealData.salesName) uniqueSales.add(dealData.salesName);
                if (dealData.createdAt) {
                    try {
                        let year;
                        if (dealData.createdAt.toDate) {
                            year = dealData.createdAt.toDate().getFullYear().toString();
                        } else if (dealData.createdAt.seconds) {
                            year = new Date(dealData.createdAt.seconds * 1000).getFullYear().toString();
                        } else {
                            year = new Date(dealData.createdAt).getFullYear().toString();
                        }
                        uniqueYears.add(year);
                    } catch (e) {}
                }
            } else if (change.type === 'modified') {
                const index = deals.findIndex(d => d.id === change.doc.id);
                if (index !== -1) {
                    deals[index] = deal;
                    hasChanges = true;
                }
                dealsByIdCache.set(change.doc.id, deal);
            } else if (change.type === 'removed') {
                const index = deals.findIndex(d => d.id === change.doc.id);
                if (index !== -1) {
                    deals.splice(index, 1);
                    hasChanges = true;
                }
                dealsByIdCache.delete(change.doc.id);
            }
        });
        
        if (hasChanges) {
            priorityStatsCache = { 'all': null, '2025': null, '2026': null };
            dealsByYearCache = { 'all': null, '2025': null, '2026': null };
            
            populateYearDropdown();
            populateFilterDropdowns();
            createPriorityDashboard();
            applyActiveFilters();
        }
    }, (error) => {
        console.error("Realtime deals error:", error);
    });
}

// ==================== FUNGSI DROPBOX UPLOAD ====================

async function uploadToDropbox(file, dropboxPath) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({
                    path: dropboxPath,
                    mode: 'add',
                    autorename: true,
                    mute: false
                })
            },
            body: uint8Array
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error_summary || 'Upload failed');
        }
        
        const result = await response.json();
        
        let downloadUrl = '';
        try {
            const shareResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: result.path_display,
                    settings: {
                        requested_visibility: 'public',
                        audience: 'public',
                        access: 'viewer'
                    }
                })
            });
            
            if (shareResponse.ok) {
                const shareData = await shareResponse.json();
                downloadUrl = shareData.url.replace('?dl=0', '?dl=1');
            } else {
                const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ path: result.path_display })
                });
                if (listResponse.ok) {
                    const listResult = await listResponse.json();
                    if (listResult.links && listResult.links.length > 0) {
                        downloadUrl = listResult.links[0].url.replace('?dl=0', '?dl=1');
                    }
                }
            }
        } catch (linkError) {
            console.warn('Could not create shared link:', linkError);
        }
        
        return {
            success: true,
            path: result.path_display,
            downloadUrl: downloadUrl,
            name: file.name,
            size: file.size,
            type: file.type
        };
    } catch (error) {
        console.error('Upload to Dropbox error:', error);
        throw error;
    }
}

async function deleteFromDropbox(path) {
    try {
        const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: path })
        });
        return response.ok;
    } catch (error) {
        console.error('Error deleting from Dropbox:', error);
        return false;
    }
}

async function saveAttachmentToFirestore(attachmentData) {
    try {
        const docRef = await attachmentsCollection.add({
            ...attachmentData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { id: docRef.id, ...attachmentData };
    } catch (error) {
        console.error('Error saving attachment to Firestore:', error);
        throw error;
    }
}

async function deleteAttachment(attachmentId, dropboxPath) {
    try {
        if (dropboxPath) {
            await deleteFromDropbox(dropboxPath);
        }
        await attachmentsCollection.doc(attachmentId).delete();
        showToast('Attachment berhasil dihapus', 2000);
        
        if (currentDealIdForComments) {
            await renderAttachments(document.getElementById('dealAttachmentsList'), currentDealIdForComments);
            await renderAttachments(document.getElementById('detailAttachmentsList'), currentDealIdForComments);
        }
        await refreshCommentAttachments();
    } catch (error) {
        console.error('Error deleting attachment:', error);
        showToast('Gagal menghapus attachment', 3000);
    }
}

async function loadAttachmentsForDeal(dealId) {
    try {
        const querySnapshot = await attachmentsCollection
            .where('dealId', '==', dealId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const attachments = [];
        querySnapshot.forEach(doc => {
            attachments.push({ id: doc.id, ...doc.data() });
        });
        return attachments;
    } catch (error) {
        console.error('Error loading attachments:', error);
        return [];
    }
}

async function renderAttachments(container, dealId) {
    if (!container) return;
    
    const attachments = await loadAttachmentsForDeal(dealId);
    
    if (attachments.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-2 text-sm">
                <i class="fas fa-paperclip"></i> Belum ada attachment
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    attachments.forEach(attachment => {
        const isImage = attachment.type && attachment.type.startsWith('image/');
        const isPdf = attachment.type === 'application/pdf';
        const fileIcon = isImage ? 'fa-image' : isPdf ? 'fa-file-pdf' : 'fa-file';
        const fileColor = isImage ? 'text-blue-500' : isPdf ? 'text-red-500' : 'text-gray-500';
        
        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'attachment-item bg-gray-50 rounded-lg p-2 mb-2 flex items-center justify-between hover:bg-gray-100 transition';
        
        let previewHtml = '';
        if ((isImage || isPdf) && attachment.downloadUrl) {
            previewHtml = `
                <button class="preview-attachment-btn text-blue-500 hover:text-blue-700 p-1" data-url="${attachment.downloadUrl}" data-name="${escapeHtml(attachment.fileName)}" data-type="${isImage ? 'image' : 'pdf'}">
                    <i class="fas fa-eye"></i>
                </button>
            `;
        }
        
        attachmentDiv.innerHTML = `
            <div class="flex items-center space-x-3 flex-1 min-w-0">
                <i class="fas ${fileIcon} ${fileColor} text-lg"></i>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate" title="${escapeHtml(attachment.fileName)}">${escapeHtml(attachment.fileName)}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(attachment.fileSize)} • ${formatDateTime(attachment.createdAt)}</p>
                    <p class="text-xs text-gray-400">Upload oleh: ${escapeHtml(attachment.uploadedByName || '-')}</p>
                </div>
            </div>
            <div class="flex space-x-2">
                ${previewHtml}
                <a href="${attachment.downloadUrl}" target="_blank" class="text-green-600 hover:text-green-800 p-1" title="Download">
                    <i class="fas fa-download"></i>
                </a>
                ${(currentUserRole === 'admin' || currentUserRole === 'manager' || attachment.uploadedBy === auth.currentUser?.email) ? `
                    <button class="delete-attachment-btn text-red-600 hover:text-red-800 p-1" data-id="${attachment.id}" data-path="${escapeHtml(attachment.dropboxPath || '')}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                ` : ''}
            </div>
        `;
        
        container.appendChild(attachmentDiv);
    });
    
    container.querySelectorAll('.delete-attachment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const attachmentId = btn.dataset.id;
            const dropboxPath = btn.dataset.path;
            await deleteAttachment(attachmentId, dropboxPath);
        });
    });
    
    container.querySelectorAll('.preview-attachment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = btn.dataset.url;
            const name = btn.dataset.name;
            const type = btn.dataset.type;
            openAttachmentPreview(url, name, type);
        });
    });
}

function openAttachmentPreview(url, name, type) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[300] p-4';
    modal.id = 'previewModal';
    
    let contentHtml = '';
    if (type === 'image') {
        contentHtml = `
            <div class="max-w-full max-h-full">
                <img src="${url}" alt="${escapeHtml(name)}" class="max-w-full max-h-[80vh] object-contain mx-auto">
            </div>
        `;
    } else {
        contentHtml = `
            <iframe src="${url}" class="w-full h-[80vh] rounded-lg" frameborder="0"></iframe>
        `;
    }
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden">
            <div class="flex justify-between items-center p-4 border-b">
                <h3 class="text-lg font-semibold text-gray-800 truncate">Preview: ${escapeHtml(name)}</h3>
                <button class="close-preview text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div class="p-4 overflow-auto max-h-[calc(90vh-70px)] flex justify-center">
                ${contentHtml}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.close-preview').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadAttachmentForDeal(dealId, file) {
    if (!dealId) {
        showToast('Deal ID tidak ditemukan', 3000);
        return false;
    }
    
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('Ukuran file maksimal 10MB', 3000);
        return false;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Hanya file PDF dan gambar yang diperbolehkan', 3000);
        return false;
    }
    
    try {
        showToast('Mengupload file...', 2000);
        
        let deal = getDealById(dealId);
        if (!deal) deal = deals.find(d => d.id === dealId);
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) deal = { id: dealDoc.id, ...dealDoc.data() };
        }
        
        const projectName = deal?.dealName || 'unknown';
        const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const dropboxPath = `/${DROPBOX_APP_FOLDER}/deals/${safeProjectName}/${timestamp}_${safeFileName}`;
        
        const uploadResult = await uploadToDropbox(file, dropboxPath);
        
        if (uploadResult.success) {
            const attachmentData = {
                dealId: dealId,
                projectName: projectName,
                fileName: file.name,
                originalFileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                dropboxPath: uploadResult.path,
                downloadUrl: uploadResult.downloadUrl,
                uploadedBy: auth.currentUser?.email,
                uploadedByName: getCurrentSalesName() || auth.currentUser?.email
            };
            
            await saveAttachmentToFirestore(attachmentData);
            
            await activitiesCollection.add({
                message: `Attachment "${file.name}" diupload untuk deal "${projectName}" oleh ${auth.currentUser?.email}.`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: auth.currentUser?.email,
                read: false,
                dealId: dealId
            });
            
            showToast('File berhasil diupload!', 2000);
            return true;
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        console.error('Error uploading attachment:', error);
        showToast('Gagal mengupload file: ' + error.message, 3000);
        return false;
    }
}

// ==================== FUNGSI UPLOAD ATTACHMENT UNTUK KOMENTAR ====================

async function uploadAttachmentForComment(dealId, file, commentContent) {
    if (!dealId) {
        showToast('Deal ID tidak ditemukan', 3000);
        return false;
    }
    
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('Ukuran file maksimal 10MB', 3000);
        return false;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Hanya file PDF dan gambar yang diperbolehkan', 3000);
        return false;
    }
    
    try {
        showToast('Mengupload attachment komentar...', 2000);
        
        let deal = getDealById(dealId);
        if (!deal) deal = deals.find(d => d.id === dealId);
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) deal = { id: dealDoc.id, ...dealDoc.data() };
        }
        
        const projectName = deal?.dealName || 'unknown';
        const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const dropboxPath = `/${DROPBOX_APP_FOLDER}/comments/${safeProjectName}/${timestamp}_${safeFileName}`;
        
        const uploadResult = await uploadToDropbox(file, dropboxPath);
        
        if (uploadResult.success) {
            const attachmentData = {
                dealId: dealId,
                projectName: projectName,
                fileName: file.name,
                originalFileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                dropboxPath: uploadResult.path,
                downloadUrl: uploadResult.downloadUrl,
                uploadedBy: auth.currentUser?.email,
                uploadedByName: getCurrentSalesName() || auth.currentUser?.email,
                isCommentAttachment: true,
                commentContent: commentContent
            };
            
            const savedAttachment = await saveAttachmentToFirestore(attachmentData);
            showToast('Attachment komentar berhasil diupload!', 2000);
            return savedAttachment;
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        console.error('Error uploading comment attachment:', error);
        showToast('Gagal mengupload attachment komentar: ' + error.message, 3000);
        return false;
    }
}

function setupCommentAttachmentInput() {
    const commentAttachmentInput = document.getElementById('commentAttachmentInput');
    const commentAttachmentPreview = document.getElementById('commentAttachmentPreview');
    
    if (commentAttachmentInput) {
        commentAttachmentInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                currentCommentAttachmentFile = file;
                if (commentAttachmentPreview) {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            commentAttachmentPreview.innerHTML = `
                                <div class="relative inline-block mt-2">
                                    <img src="${evt.target.result}" class="h-16 w-16 object-cover rounded border">
                                    <button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" id="removeCommentAttachment">×</button>
                                </div>
                            `;
                            const removeBtn = commentAttachmentPreview.querySelector('#removeCommentAttachment');
                            if (removeBtn) removeBtn.addEventListener('click', removeCommentAttachment);
                        };
                        reader.readAsDataURL(file);
                    } else {
                        commentAttachmentPreview.innerHTML = `
                            <div class="relative inline-block mt-2">
                                <div class="bg-gray-100 rounded p-2 flex items-center space-x-2">
                                    <i class="fas fa-file-pdf text-red-500"></i>
                                    <span class="text-xs truncate max-w-32">${file.name}</span>
                                </div>
                                <button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" id="removeCommentAttachment">×</button>
                            </div>
                        `;
                        const removeBtn = commentAttachmentPreview.querySelector('#removeCommentAttachment');
                        if (removeBtn) removeBtn.addEventListener('click', removeCommentAttachment);
                    }
                    commentAttachmentPreview.classList.remove('hidden');
                }
            }
        });
    }
}

function removeCommentAttachment() {
    currentCommentAttachmentFile = null;
    const commentAttachmentInput = document.getElementById('commentAttachmentInput');
    const commentAttachmentPreview = document.getElementById('commentAttachmentPreview');
    if (commentAttachmentInput) commentAttachmentInput.value = '';
    if (commentAttachmentPreview) {
        commentAttachmentPreview.innerHTML = '';
        commentAttachmentPreview.classList.add('hidden');
    }
}

function setupDetailCommentAttachmentInput() {
    const detailCommentAttachmentInput = document.getElementById('detailCommentAttachmentInput');
    const detailCommentAttachmentPreview = document.getElementById('detailCommentAttachmentPreview');
    
    if (detailCommentAttachmentInput) {
        detailCommentAttachmentInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                currentCommentAttachmentFile = file;
                if (detailCommentAttachmentPreview) {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            detailCommentAttachmentPreview.innerHTML = `
                                <div class="relative inline-block mt-2">
                                    <img src="${evt.target.result}" class="h-16 w-16 object-cover rounded border">
                                    <button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" id="removeDetailCommentAttachment">×</button>
                                </div>
                            `;
                            const removeBtn = detailCommentAttachmentPreview.querySelector('#removeDetailCommentAttachment');
                            if (removeBtn) removeBtn.addEventListener('click', removeDetailCommentAttachment);
                        };
                        reader.readAsDataURL(file);
                    } else {
                        detailCommentAttachmentPreview.innerHTML = `
                            <div class="relative inline-block mt-2">
                                <div class="bg-gray-100 rounded p-2 flex items-center space-x-2">
                                    <i class="fas fa-file-pdf text-red-500"></i>
                                    <span class="text-xs truncate max-w-32">${file.name}</span>
                                </div>
                                <button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" id="removeDetailCommentAttachment">×</button>
                            </div>
                        `;
                        const removeBtn = detailCommentAttachmentPreview.querySelector('#removeDetailCommentAttachment');
                        if (removeBtn) removeBtn.addEventListener('click', removeDetailCommentAttachment);
                    }
                    detailCommentAttachmentPreview.classList.remove('hidden');
                }
            }
        });
    }
}

function removeDetailCommentAttachment() {
    currentCommentAttachmentFile = null;
    const detailCommentAttachmentInput = document.getElementById('detailCommentAttachmentInput');
    const detailCommentAttachmentPreview = document.getElementById('detailCommentAttachmentPreview');
    if (detailCommentAttachmentInput) detailCommentAttachmentInput.value = '';
    if (detailCommentAttachmentPreview) {
        detailCommentAttachmentPreview.innerHTML = '';
        detailCommentAttachmentPreview.classList.add('hidden');
    }
}

async function refreshCommentAttachments() {
    if (currentDealIdForComments) {
        await renderAttachments(document.getElementById('dealAttachmentsList'), currentDealIdForComments);
        await renderAttachments(document.getElementById('detailAttachmentsList'), currentDealIdForComments);
    }
}

// ==================== FUNGSI KOMENTAR ====================

function renderComments(comments, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!comments || comments.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <i class="fas fa-comments text-2xl mb-2"></i>
                <p>Belum ada komentar</p>
                <p class="text-xs mt-1">Semua sales yang mengerjakan project ini dapat melihat komentar</p>
            </div>
        `;
        
        const commentsCountElement = document.getElementById(containerId === 'commentsList' ? 'commentsCount' : 'detailCommentsCount');
        if (commentsCountElement) commentsCountElement.textContent = '0 komentar';
        return;
    }
    
    const sortedComments = [...comments].sort((a, b) => {
        const timeA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0;
        const timeB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0;
        return timeA - timeB;
    });
    
    sortedComments.forEach(comment => {
        const commentItem = document.createElement('div');
        const isManager = managerEmails.includes(comment.userEmail);
        const isCurrentUser = comment.userEmail === auth.currentUser?.email;
        
        commentItem.className = `comment-item ${isManager ? 'manager' : 'sales'}`;
        const canDelete = currentUserRole === 'admin' || currentUserRole === 'manager' || isCurrentUser;
        const salesInfo = comment.salesName ? `<span class="comment-sales ml-2">(Sales: ${escapeHtml(comment.salesName)})</span>` : '';
        
        let timeStr = '-';
        if (comment.timestamp) {
            try {
                timeStr = comment.timestamp.toDate ? formatDateTime(comment.timestamp) : formatDateTime(comment.timestamp);
            } catch(e) {}
        }
        
        let attachmentHtml = '';
        if (comment.attachmentInfo) {
            const isImage = comment.attachmentInfo.fileType && comment.attachmentInfo.fileType.startsWith('image/');
            const fileIcon = isImage ? 'fa-image' : 'fa-file-pdf';
            attachmentHtml = `
                <div class="comment-attachment mt-2">
                    <a href="${comment.attachmentInfo.downloadUrl}" target="_blank" class="text-blue-500 hover:text-blue-700 text-sm flex items-center">
                        <i class="fas ${fileIcon} mr-1"></i>
                        ${escapeHtml(comment.attachmentInfo.fileName)}
                    </a>
                </div>
            `;
        }
        
        commentItem.innerHTML = `
            <div class="comment-header">
                <div>
                    <span class="comment-author">${escapeHtml(comment.userEmail)}</span>
                    ${salesInfo}
                    <span class="comment-role ${isManager ? 'manager' : 'sales'} ml-2">
                        ${isManager ? 'Manager' : 'Sales'}
                    </span>
                </div>
                <div class="comment-time">${timeStr}</div>
            </div>
            <div class="comment-content">${escapeHtml(comment.content)}</div>
            ${attachmentHtml}
            ${canDelete ? `<button class="comment-delete-btn" data-comment-id="${comment.id}"><i class="fas fa-trash"></i></button>` : ''}
        `;
        
        container.appendChild(commentItem);
    });
    
    container.querySelectorAll('.comment-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await deleteComment(btn.dataset.commentId);
        });
    });
    
    const commentsCountElement = document.getElementById(containerId === 'commentsList' ? 'commentsCount' : 'detailCommentsCount');
    if (commentsCountElement) commentsCountElement.textContent = `${comments.length} komentar`;
}

async function addComment(dealId, content) {
    if ((!content || !content.trim()) && !currentCommentAttachmentFile) {
        showToast("Komentar atau attachment tidak boleh kosong", 3000);
        return;
    }
    
    try {
        let deal = getDealById(dealId);
        if (!deal) deal = deals.find(d => d.id === dealId);
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) deal = { id: dealDoc.id, ...dealDoc.data() };
        }
        
        if (!deal || !deal.dealName) {
            showToast("Project tidak ditemukan", 3000);
            return;
        }
        
        const projectKey = getProjectKey(deal.dealName);
        const projectName = deal.dealName.trim();
        const currentSalesNameValue = getCurrentSalesName();
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            showToast("Anda harus login untuk berkomentar", 3000);
            return;
        }
        
        let attachmentUrl = null;
        let attachmentInfo = null;
        
        if (currentCommentAttachmentFile) {
            const uploadResult = await uploadAttachmentForComment(dealId, currentCommentAttachmentFile, content);
            if (uploadResult) {
                attachmentUrl = uploadResult.downloadUrl;
                attachmentInfo = {
                    fileName: currentCommentAttachmentFile.name,
                    fileSize: currentCommentAttachmentFile.size,
                    fileType: currentCommentAttachmentFile.type,
                    downloadUrl: uploadResult.downloadUrl
                };
            }
        }
        
        const commentData = {
            projectKey: projectKey,
            projectName: projectName,
            dealId: dealId,
            content: content?.trim() || (currentCommentAttachmentFile ? `[Attachment: ${currentCommentAttachmentFile.name}]` : ''),
            userEmail: currentUser.email,
            salesName: currentSalesNameValue,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            attachmentUrl: attachmentUrl,
            attachmentInfo: attachmentInfo
        };
        
        await commentsCollection.add(commentData);
        
        removeCommentAttachment();
        removeDetailCommentAttachment();
        currentCommentAttachmentFile = null;
        
        const comments = await loadCommentsByProjectName(dealId);
        renderComments(comments, 'detailCommentsList');
        if (document.getElementById('commentsList')) renderComments(comments, 'commentsList');
        
        const detailCommentInput = document.getElementById('detailCommentInput');
        if (detailCommentInput) detailCommentInput.value = '';
        const commentInput = document.getElementById('commentInput');
        if (commentInput) commentInput.value = '';
        
        showToast("Komentar berhasil ditambahkan", 2000);
    } catch (error) {
        console.error("Error adding comment:", error);
        showToast("Gagal menambahkan komentar: " + error.message, 3000);
    }
}

async function deleteComment(commentId) {
    if (!commentId) return;
    try {
        await commentsCollection.doc(commentId).delete();
        showToast("Komentar berhasil dihapus", 2000);
        if (currentDealIdForComments) {
            const comments = await loadCommentsByProjectName(currentDealIdForComments);
            renderComments(comments, 'detailCommentsList');
            if (document.getElementById('commentsList')) renderComments(comments, 'commentsList');
        }
    } catch (error) {
        console.error("Error deleting comment:", error);
        showToast("Gagal menghapus komentar", 3000);
    }
}

// ==================== FUNGSI UTILITAS DASAR ====================

function getCurrentSalesName() {
    if (currentUserEmail && emailToSalesNameMap[currentUserEmail]) {
        return emailToSalesNameMap[currentUserEmail];
    }
    return null;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getProjectKey(dealName) {
    if (!dealName) return null;
    return dealName.trim().toLowerCase();
}

function filterDealsByUser(dealsList) {
    if (currentUserRole === 'admin' || currentUserRole === 'manager') return dealsList;
    const currentSales = getCurrentSalesName();
    if (!currentSales) return [];
    return dealsList.filter(deal => deal.salesName === currentSales);
}

function getFilteredDeals() {
    let baseDeals = deals;
    baseDeals = filterDealsByUser(baseDeals);
    baseDeals = getDealsByYear(activeYear, baseDeals);
    
    return baseDeals.filter(deal => {
        const matchesSearchTerm = () => {
            const term = activeFilters.searchTerm.toLowerCase();
            if (term === '') return true;
            if (deal.dealName && deal.dealName.toLowerCase().includes(term)) return true;
            if (deal.salesName && deal.salesName.toLowerCase().includes(term)) return true;
            if (deal.consultant && deal.consultant.toLowerCase().includes(term)) return true;
            if (deal.contractor) {
                if (Array.isArray(deal.contractor)) {
                    for (const contractor of deal.contractor) {
                        if (contractor && contractor.toLowerCase().includes(term)) return true;
                    }
                } else if (deal.contractor.toLowerCase().includes(term)) return true;
            }
            return false;
        };
        
        const matchesSearch = matchesSearchTerm();
        const matchesPriority = activeFilters.priority === 'all' || (deal.priority === activeFilters.priority);
        const matchesStage = activeFilters.stage === 'all' || (deal.stage === activeFilters.stage);
        const matchesSales = activeFilters.sales === 'all' || (deal.salesName === activeFilters.sales);
        const matchesConsultant = activeFilters.consultant === 'all' || (deal.consultant === activeFilters.consultant);
        const matchesContractor = activeFilters.contractor === 'all' || 
            (deal.contractor && (Array.isArray(deal.contractor) ? deal.contractor.includes(activeFilters.contractor) : deal.contractor === activeFilters.contractor));
        const matchesProduct = activeFilters.product === 'all' || 
            (deal.product && (Array.isArray(deal.product) ? deal.product.includes(activeFilters.product) : deal.product === activeFilters.product));
        const matchesFacility = activeFilters.facility === 'all' || (deal.facility === activeFilters.facility);
        const matchesPackage = activeFilters.package === 'all' || (deal.package === activeFilters.package);
        
        return matchesSearch && matchesPriority && matchesStage && matchesSales &&
            matchesConsultant && matchesContractor && matchesFacility && matchesProduct && matchesPackage;
    });
}

function getDealsByYear(year, baseDeals = null) {
    const sourceDeals = baseDeals !== null ? baseDeals : filterDealsByUser(deals);
    
    if (dealsByYearCache[year] && baseDeals === null) return dealsByYearCache[year];
    
    if (year === 'all') {
        if (baseDeals === null) dealsByYearCache[year] = sourceDeals;
        return sourceDeals;
    }
    
    const filtered = sourceDeals.filter(deal => {
        if (!deal.createdAt) return false;
        try {
            let dealDate;
            if (deal.createdAt.toDate) dealDate = deal.createdAt.toDate();
            else if (deal.createdAt.seconds) dealDate = new Date(deal.createdAt.seconds * 1000);
            else dealDate = new Date(deal.createdAt);
            if (isNaN(dealDate.getTime())) return false;
            return dealDate.getFullYear().toString() === year;
        } catch (e) { return false; }
    });
    
    if (baseDeals === null) dealsByYearCache[year] = filtered;
    return filtered;
}

function getUniqueProjectsForDashboard(dealsList) {
    const projectMap = new Map();
    const allProjectsByName = new Map();
    
    dealsList.forEach(deal => {
        const projectName = deal.dealName?.trim();
        if (!projectName) return;
        if (!allProjectsByName.has(projectName)) allProjectsByName.set(projectName, []);
        allProjectsByName.get(projectName).push(deal);
    });
    
    const maxValueByProjectName = new Map();
    for (const [projectName, projectDeals] of allProjectsByName) {
        const activeProjects = projectDeals.filter(d => d.stage !== 'lost');
        if (activeProjects.length > 0) {
            const maxValue = Math.max(...activeProjects.map(d => d.value || 0));
            maxValueByProjectName.set(projectName, maxValue);
        }
    }
    
    dealsList.forEach(deal => {
        const projectName = deal.dealName?.trim();
        const priority = deal.priority || 'Priority';
        if (!projectName) return;
        const key = `${projectName}|${priority}`;
        if (!projectMap.has(key)) projectMap.set(key, []);
        projectMap.get(key).push(deal);
    });
    
    const uniqueProjects = [];
    projectMap.forEach((duplicateDeals, key) => {
        const [projectName, priority] = key.split('|');
        const activeDeals = duplicateDeals.filter(deal => deal.stage !== 'lost');
        if (activeDeals.length === 0) return;
        
        const allDealsWithSameName = allProjectsByName.get(projectName) || [];
        const activeProjectsCount = allDealsWithSameName.filter(d => d.stage !== 'lost').length;
        const isLastProject = (activeProjectsCount === 1);
        
        activeDeals.forEach(deal => {
            let displayValue;
            let hasHigherValueFromOtherPriority = false;
            
            if (isLastProject) {
                displayValue = deal.value || 0;
            } else {
                const highestValue = maxValueByProjectName.get(projectName) || 0;
                displayValue = highestValue;
                hasHigherValueFromOtherPriority = (deal.value || 0) < highestValue;
            }
            
            const newDeal = { ...deal };
            newDeal.hasMultipleEntries = duplicateDeals.length > 1;
            newDeal.totalEntries = duplicateDeals.length;
            newDeal.displayValue = displayValue;
            newDeal.hasHigherValueFromOtherPriority = hasHigherValueFromOtherPriority;
            newDeal.isLastActiveProject = isLastProject;
            newDeal.activeProjectsCount = activeProjectsCount;
            uniqueProjects.push(newDeal);
        });
    });
    
    const seenIds = new Set();
    const finalUniqueProjects = [];
    for (const project of uniqueProjects) {
        if (!seenIds.has(project.id)) {
            seenIds.add(project.id);
            finalUniqueProjects.push(project);
        }
    }
    return finalUniqueProjects;
}

function initYearFilter() {
    const yearFilterContainer = document.querySelector('.year-filter-container');
    if (!yearFilterContainer) return;

    yearFilterContainer.addEventListener('click', (e) => {
        const yearBadge = e.target.closest('.year-badge');
        if (!yearBadge) return;
        const year = yearBadge.dataset.year;
        
        document.querySelectorAll('.year-badge').forEach(badge => badge.classList.remove('active'));
        yearBadge.classList.add('active');
        activeYear = year;
        if (!priorityStatsCache[year]) priorityStatsCache[year] = null;
        activeFilters.year = year;
        saveStateToLocalStorage();
        applyActiveFilters();
        createPriorityDashboard();
        showToast(`Menampilkan data tahun ${year === 'all' ? 'semua tahun' : year}`, 2000);
    });
}

function calculatePriorityStats(year) {
    if (priorityStatsCache[year]) return priorityStatsCache[year];
    
    const yearDeals = getDealsByYear(year);
    const userYearDeals = filterDealsByUser(yearDeals);
    const uniqueProjects = getUniqueProjectsForDashboard(userYearDeals);
    
    const priorityStats = {
        'Hot Priority': { count: 0, value: 0, deals: [] },
        'Priority': { count: 0, value: 0, deals: [] },
        'Win': { count: 0, value: 0, deals: [] },
        'Behind': { count: 0, value: 0, deals: [] },
        'On Track': { count: 0, value: 0, deals: [] }
    };
    
    uniqueProjects.forEach(deal => {
        const priority = deal.priority || 'Priority';
        if (priorityStats[priority]) {
            priorityStats[priority].count++;
            priorityStats[priority].value += (deal.displayValue || deal.value || 0);
            priorityStats[priority].deals.push(deal);
        }
    });
    
    priorityStatsCache[year] = priorityStats;
    return priorityStats;
}

function createPriorityDashboard() {
    const priorityDashboard = document.querySelector('.priority-dashboard');
    if (!priorityDashboard) return;
    
    const priorityStats = calculatePriorityStats(activeYear);
    priorityDashboard.innerHTML = '';
    
    const priorities = [
        { key: 'Hot Priority', icon: 'fa-fire', color: 'hot' },
        { key: 'Priority', icon: 'fa-exclamation-circle', color: 'priority' },
        { key: 'Win', icon: 'fa-trophy', color: 'win' },
        { key: 'Behind', icon: 'fa-clock', color: 'behind' },
        { key: 'On Track', icon: 'fa-check-circle', color: 'ontrack' }
    ];
    
    priorities.forEach(priority => {
        const stats = priorityStats[priority.key];
        const card = document.createElement('div');
        card.className = `priority-card ${priority.color}`;
        card.dataset.priority = priority.key;
        card.innerHTML = `
            <div class="priority-header">
                <div class="priority-title">
                    <i class="fas ${priority.icon}"></i>
                    <span>${priority.key}</span>
                </div>
                <div class="priority-count">${stats.count}</div>
            </div>
            <div class="priority-value">Rp ${formatNumber(stats.value)}</div>
        `;
        priorityDashboard.appendChild(card);
    });
    
    document.querySelectorAll('.priority-card').forEach(card => {
        card.addEventListener('click', function() {
            const priority = this.dataset.priority;
            const stats = priorityStats[priority];
            openPriorityModal(priority, stats.deals);
        });
    });
}

function openPriorityModal(priority, dealsList) {
    const modal = document.getElementById('priorityModal');
    const modalTitle = document.getElementById('priorityModalTitleText');
    const modalContent = document.getElementById('priorityModalContent');
    if (!modal || !modalTitle || !modalContent) return;
    
    const yearText = activeYear === 'all' ? 'Semua Tahun' : `Tahun ${activeYear}`;
    const userText = (currentUserRole === 'admin' || currentUserRole === 'manager') ? '' : ` - ${currentSalesName || currentUserEmail}`;
    modalTitle.textContent = `${priority} Projects (${yearText})${userText}`;
    modalContent.innerHTML = '';
    
    if (dealsList.length === 0) {
        modalContent.innerHTML = `<div class="text-center text-gray-500 py-8"><i class="fas fa-inbox text-3xl mb-2"></i><p>Tidak ada project dengan priority "${priority}" untuk ${yearText}</p></div>`;
    } else {
        const sortedDeals = [...dealsList].sort((a, b) => {
            const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
            const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
            return dateB - dateA;
        });
        
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200';
        table.innerHTML = `
            <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500">No</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Nama Project</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Sales</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Nilai (IDR)</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Tahap</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Terakhir Update</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Aksi</th></tr></thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${sortedDeals.map((deal, index) => {
                    const displayValue = deal.displayValue || deal.value || 0;
                    const lastUpdateDate = deal.updatedAt ? formatDateTime(deal.updatedAt) : (deal.createdAt ? formatDateTime(deal.createdAt) : '-');
                    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
                    if (deal.hasHigherValueFromOtherPriority && !deal.isLastActiveProject) valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
                    return `<tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}"><td class="px-6 py-4 text-sm">${index+1}</td><td class="px-6 py-4 text-sm font-medium">${escapeHtml(deal.dealName||'No Name')}</td><td class="px-6 py-4 text-sm">${escapeHtml(deal.salesName||'-')}</td><td class="px-6 py-4 text-sm font-semibold">${valueDisplay}</td><td class="px-6 py-4"><span class="px-2 inline-flex text-xs font-semibold rounded-full ${deal.stage==='win'?'bg-green-100 text-green-800':deal.stage==='lost'?'bg-red-100 text-red-800':'bg-blue-100 text-blue-800'}">${deal.stage?deal.stage.replace(/-/g,' ').replace(/\b\w/g,l=>l.toUpperCase()):'-'}</span></td><td class="px-6 py-4 text-sm"><i class="fas fa-clock"></i> ${lastUpdateDate}</td><td class="px-6 py-4"><button class="text-blue-600 view-detail-btn" data-id="${deal.id}"><i class="fas fa-eye"></i></button></td></tr>`;
                }).join('')}
            </tbody>
        `;
        modalContent.appendChild(table);
        
        modalContent.querySelectorAll('.view-detail-btn, .view-detail-row').forEach(element => {
            element.addEventListener('click', function(e) {
                e.stopPropagation();
                const dealId = element.tagName === 'TR' ? element.dataset.id : element.dataset.id;
                closePriorityModal();
                openDealDetailModal(dealId);
            });
        });
    }
    modal.classList.remove('hidden');
}

function closePriorityModal() {
    const modal = document.getElementById('priorityModal');
    if (modal) modal.classList.add('hidden');
}

function getPriorityBadgeClass(priority) {
    switch(priority) {
        case 'Priority': return 'priority-badge-priority';
        case 'Hot Priority': return 'priority-badge-hot';
        case 'Win': return 'priority-badge-win';
        case 'Behind': return 'priority-badge-behind';
        case 'On Track': return 'priority-badge-ontrack';
        default: return 'priority-badge-priority';
    }
}

function formatDateTime(timestamp) {
    if (!timestamp) return '-';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '-'; }
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('id-ID');
    } catch (e) { return '-'; }
}

function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

function getDealById(dealId) {
    if (dealsByIdCache.has(dealId)) return dealsByIdCache.get(dealId);
    const deal = deals.find(d => d.id === dealId);
    if (deal) dealsByIdCache.set(dealId, deal);
    return deal;
}

// ==================== DROPDOWN OPTIONS ====================

async function loadDropdownOptions() {
    try {
        const doc = await dropdownOptionsCollection.doc('options').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.facilities) uniqueFacilities = new Set(data.facilities);
            if (data.packages) uniquePackages = new Set(data.packages);
            if (data.owners) uniqueOwners = new Set(data.owners);
            if (data.pics) uniquePICs = new Set(data.pics);
        }
    } catch (error) { console.error("Error loading dropdown options:", error); }
}

async function saveDropdownOptions() {
    try {
        await dropdownOptionsCollection.doc('options').set({
            facilities: Array.from(uniqueFacilities), packages: Array.from(uniquePackages),
            owners: Array.from(uniqueOwners), pics: Array.from(uniquePICs),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) { console.error("Error saving dropdown options:", error); }
}

async function deleteDropdownOption(field, value) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        showToast("Hanya admin dan manager yang dapat menghapus opsi dropdown", 3000);
        return;
    }
    try {
        switch(field) {
            case 'facility': uniqueFacilities.delete(value); break;
            case 'package': uniquePackages.delete(value); break;
            case 'owner': uniqueOwners.delete(value); break;
            case 'pic': uniquePICs.delete(value); break;
        }
        await saveDropdownOptions();
        updateDropdownOptions();
        showToast(`Opsi "${value}" berhasil dihapus`, 2000);
    } catch (error) { console.error("Error deleting dropdown option:", error); showToast("Gagal menghapus opsi dropdown", 3000); }
}

function updateDropdownOptions() {
    if (facilitySelect) {
        const current = facilitySelect.value;
        facilitySelect.innerHTML = `<option value="">Pilih Fasilitas</option><option value="Industrial">Industrial</option><option value="Office">Office</option><option value="Hotel">Hotel</option><option value="Data Center">Data Center</option><option value="Oil & Gas">Oil & Gas</option><option value="Warehouse">Warehouse</option><option value="Other">Other</option>`;
        Array.from(uniqueFacilities).sort().forEach(v => { if (v && !['Industrial','Office','Hotel','Data Center','Oil & Gas','Warehouse','Other'].includes(v)) { const opt = document.createElement('option'); opt.value = v; opt.textContent = v; facilitySelect.appendChild(opt); } });
        facilitySelect.value = current;
    }
    if (packageSelect) {
        const current = packageSelect.value;
        packageSelect.innerHTML = `<option value="">Pilih Paket</option><option value="Electronic Package">Electronic Package</option><option value="M&E">M&E</option><option value="Fire Fighting Cont">Fire Fighting Cont</option><option value="Main Kontraktor">Main Kontraktor</option>`;
        Array.from(uniquePackages).sort().forEach(v => { if (v && !['Electronic Package','M&E','Fire Fighting Cont','Main Kontraktor'].includes(v)) { const opt = document.createElement('option'); opt.value = v; opt.textContent = v; packageSelect.appendChild(opt); } });
        packageSelect.value = current;
    }
    populateDropdown('owner', uniqueOwners);
    populateDropdown('pic', uniquePICs);
}

// ==================== DEAL CARD RENDER FUNCTIONS ====================

function identifyMergedProjects(dealsList) {
    const groupedByProjectName = {};
    dealsList.forEach(deal => {
        const dealName = deal.dealName?.trim().toLowerCase();
        if (!dealName) return;
        if (!groupedByProjectName[dealName]) groupedByProjectName[dealName] = new Set();
        groupedByProjectName[dealName].add(deal.priority || 'Priority');
    });
    const mergedProjectsInfo = {};
    Object.keys(groupedByProjectName).forEach(projectName => {
        const priorities = Array.from(groupedByProjectName[projectName]);
        if (priorities.length > 1) mergedProjectsInfo[projectName] = { projectName, priorities, count: priorities.length };
    });
    return mergedProjectsInfo;
}

function renderMergedDealCard(dealGroup) {
    const firstDeal = dealGroup[0];
    const dealName = firstDeal.dealName;
    const dealNameLower = dealName.toLowerCase();
    const priority = firstDeal.priority || 'Priority';
    const key = `${dealNameLower}|${priority}`;
    
    let activeSales = activeSalesPerProject[key] || firstDeal.salesName;
    let activeDeal = dealGroup.find(deal => deal.salesName === activeSales);
    if (!activeDeal) {
        activeDeal = firstDeal;
        activeSales = firstDeal.salesName;
        activeSalesPerProject[key] = activeSales;
        saveStateToLocalStorage();
    }
    
    const allProjectDeals = deals.filter(deal => deal.dealName?.trim().toLowerCase() === dealNameLower);
    const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
    const isLastProject = activeProjects.length === 1;
    let displayValue = isLastProject ? (activeProjects[0]?.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
    
    const hasMultipleSales = dealGroup.length > 1;
    const salesNames = [...new Set(dealGroup.map(deal => deal.salesName))];
    
    let stageColorClass = '';
    switch(activeDeal.stage) {
        case 'identified': stageColorClass = 'bg-gray-100 text-gray-800'; break;
        case 'prospect': stageColorClass = 'bg-blue-100 text-blue-800'; break;
        case 'tender-me': stageColorClass = 'bg-orange-100 text-orange-800'; break;
        case 'tender-main-con': stageColorClass = 'bg-purple-100 text-purple-800'; break;
        case 'contract-award': stageColorClass = 'bg-indigo-100 text-indigo-800'; break;
        case 'win': stageColorClass = 'bg-green-100 text-green-800'; break;
        case 'lost': stageColorClass = 'bg-red-100 text-red-800'; break;
        case 'on-hold': stageColorClass = 'bg-yellow-100 text-yellow-800'; break;
        default: stageColorClass = 'bg-gray-100 text-gray-800';
    }
    
    const priorityBadgeClass = getPriorityBadgeClass(activeDeal.priority);
    const canEdit = canUserEditDeal(activeDeal);
    
    let salesSelectorHTML = '';
    if (hasMultipleSales && salesNames.length > 1 && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
        salesSelectorHTML = `<div class="multiple-sales-indicator relative inline-block ml-2 cursor-pointer bg-purple-500 text-white rounded-full w-6 h-6 text-center text-xs leading-6" title="${salesNames.length} sales">${salesNames.length}</div>
            <div class="sales-dropdown absolute bg-white rounded-lg shadow-lg z-20 hidden mt-1 min-w-32" id="sales-dropdown-${activeDeal.id}"><div class="py-1">${salesNames.map(salesName => `<div class="sales-dropdown-item px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${salesName === activeSales ? 'bg-purple-50 text-purple-600 font-semibold' : ''}" data-sales="${salesName}" data-deal-name="${dealNameLower}" data-priority="${priority}">${salesName}</div>`).join('')}</div></div>`;
    }
    
    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
    let valueTooltip = '';
    if (isLastProject) valueTooltip = `Nilai asli: Rp ${formatNumber(activeDeal.value || 0)} (hanya 1 project aktif)`;
    else if ((activeDeal.value || 0) < displayValue) {
        valueTooltip = `Nilai asli: Rp ${formatNumber(activeDeal.value || 0)} - Menampilkan nilai tertinggi dari project ini`;
        valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
    }
    
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card';
    dealCard.dataset.id = activeDeal.id;
    dealCard.dataset.dealName = dealNameLower;
    dealCard.dataset.priority = priority;
    dealCard.dataset.allDeals = JSON.stringify(dealGroup.map(d => d.id));
    dealCard.dataset.displayValue = displayValue;
    dealCard.dataset.isLastProject = isLastProject;
    
    dealCard.innerHTML = `
        <div class="flex justify-between items-start"><h3 class="font-bold text-gray-800">${escapeHtml(dealName)}</h3><span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">${priority}</span></div>
        <div class="mt-1 text-sm text-gray-600 deal-details"><div class="flex items-center"><i class="fas fa-user-tie mr-1"></i><span>${escapeHtml(activeSales)}</span>${salesSelectorHTML}</div><p class="font-semibold text-blue-600 mt-1" title="${valueTooltip}">${valueDisplay}</p><p class="mt-1"><span class="priority-badge px-2 py-1 rounded-full ${stageColorClass}">${activeDeal.stage ? activeDeal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage'}</span></p></div>
        <div class="mt-2 flex justify-between items-center deal-footer"><span class="text-xs text-gray-500">Dibuat: ${formatDate(activeDeal.createdAt)}${hasMultipleSales ? `<span class="ml-1 text-yellow-600"><i class="fas fa-copy"></i> ${dealGroup.length}</span>` : ''}${isLastProject ? `<span class="ml-1 text-green-600"><i class="fas fa-star"></i></span>` : ''}</span><div class="flex space-x-1 deal-actions"><button class="view-detail-btn text-blue-600"><i class="fas fa-eye"></i></button>${canEdit ? `<button class="edit-deal-btn text-green-600"><i class="fas fa-edit"></i></button><button class="delete-deal-btn text-red-600"><i class="fas fa-trash-alt"></i></button>` : ''}</div></div>
    `;
    return dealCard;
}

function renderIndividualDealCard(deal) {
    const allProjectDeals = deals.filter(d => d.dealName?.trim().toLowerCase() === deal.dealName?.trim().toLowerCase());
    const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
    const isLastProject = activeProjects.length === 1;
    let displayValue = isLastProject ? (deal.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
    
    let stageColorClass = '';
    switch(deal.stage) {
        case 'identified': stageColorClass = 'bg-gray-100 text-gray-800'; break;
        case 'prospect': stageColorClass = 'bg-blue-100 text-blue-800'; break;
        case 'tender-me': stageColorClass = 'bg-orange-100 text-orange-800'; break;
        case 'tender-main-con': stageColorClass = 'bg-purple-100 text-purple-800'; break;
        case 'contract-award': stageColorClass = 'bg-indigo-100 text-indigo-800'; break;
        case 'win': stageColorClass = 'bg-green-100 text-green-800'; break;
        case 'lost': stageColorClass = 'bg-red-100 text-red-800'; break;
        case 'on-hold': stageColorClass = 'bg-yellow-100 text-yellow-800'; break;
        default: stageColorClass = 'bg-gray-100 text-gray-800';
    }
    
    const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
    const canEdit = canUserEditDeal(deal);
    
    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
    if (!isLastProject && (deal.value || 0) < displayValue) valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
    
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card';
    dealCard.dataset.id = deal.id;
    dealCard.innerHTML = `
        <div class="flex justify-between items-start"><h3 class="font-bold text-gray-800">${escapeHtml(deal.dealName)}</h3><span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">${deal.priority || 'Priority'}</span></div>
        <div class="mt-1 text-sm text-gray-600 deal-details"><p><i class="fas fa-user-tie mr-1"></i> ${escapeHtml(deal.salesName || '-')}</p><p class="font-semibold text-blue-600 mt-1">${valueDisplay}</p><p class="mt-1"><span class="priority-badge px-2 py-1 rounded-full ${stageColorClass}">${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage'}</span></p></div>
        <div class="mt-2 flex justify-between items-center deal-footer"><span class="text-xs text-gray-500">Dibuat: ${formatDate(deal.createdAt)}${isLastProject ? `<span class="ml-1 text-green-600"><i class="fas fa-star"></i></span>` : ''}</span><div class="flex space-x-1 deal-actions"><button class="view-detail-btn text-blue-600"><i class="fas fa-eye"></i></button>${canEdit ? `<button class="edit-deal-btn text-green-600"><i class="fas fa-edit"></i></button><button class="delete-deal-btn text-red-600"><i class="fas fa-trash-alt"></i></button>` : ''}</div></div>
    `;
    return dealCard;
}

function setupMergeDealCardEvents(dealCard, dealGroup) {
    const firstDeal = dealGroup[0];
    const dealNameLower = firstDeal.dealName?.toLowerCase().trim();
    const priority = firstDeal.priority || 'Priority';
    const hasMultipleSales = dealGroup.length > 1;
    
    if (hasMultipleSales && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
        const indicator = dealCard.querySelector('.multiple-sales-indicator');
        const dropdown = dealCard.querySelector('.sales-dropdown');
        if (indicator && dropdown) {
            indicator.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); });
            dropdown.querySelectorAll('.sales-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const selectedSales = item.dataset.sales;
                    const dealName = item.dataset.dealName;
                    const priority = item.dataset.priority;
                    const key = `${dealName}|${priority}`;
                    activeSalesPerProject[key] = selectedSales;
                    saveStateToLocalStorage();
                    
                    const allDealCards = document.querySelectorAll(`.deal-card[data-deal-name="${dealName}"][data-priority="${priority}"]`);
                    allDealCards.forEach(card => {
                        const selectedDeal = dealGroup.find(deal => deal.salesName === selectedSales);
                        if (selectedDeal) {
                            const allProjectDeals = deals.filter(d => d.dealName?.trim().toLowerCase() === dealName);
                            const activeProjs = allProjectDeals.filter(d => d.stage !== 'lost');
                            const isLast = activeProjs.length === 1;
                            let displayVal = isLast ? (selectedDeal.value || 0) : Math.max(...activeProjs.map(d => d.value || 0));
                            
                            const salesNameElem = card.querySelector('.deal-details .flex span');
                            const valueElem = card.querySelector('.deal-details p.font-semibold');
                            const stageElem = card.querySelector('.deal-details .priority-badge:last-child');
                            if (salesNameElem) salesNameElem.textContent = escapeHtml(selectedSales);
                            if (valueElem) {
                                let valDisplay = `Rp ${formatNumber(displayVal)}`;
                                if (!isLast && (selectedDeal.value || 0) < displayVal) valDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
                                valueElem.innerHTML = valDisplay;
                            }
                            if (stageElem) {
                                let stageClass = '';
                                switch(selectedDeal.stage) {
                                    case 'identified': stageClass = 'bg-gray-100 text-gray-800'; break;
                                    case 'prospect': stageClass = 'bg-blue-100 text-blue-800'; break;
                                    case 'tender-me': stageClass = 'bg-orange-100 text-orange-800'; break;
                                    case 'tender-main-con': stageClass = 'bg-purple-100 text-purple-800'; break;
                                    case 'contract-award': stageClass = 'bg-indigo-100 text-indigo-800'; break;
                                    case 'win': stageClass = 'bg-green-100 text-green-800'; break;
                                    case 'lost': stageClass = 'bg-red-100 text-red-800'; break;
                                    case 'on-hold': stageClass = 'bg-yellow-100 text-yellow-800'; break;
                                    default: stageClass = 'bg-gray-100 text-gray-800';
                                }
                                stageElem.className = `priority-badge px-2 py-1 rounded-full ${stageClass}`;
                                stageElem.textContent = selectedDeal.stage ? selectedDeal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage';
                            }
                            card.dataset.id = selectedDeal.id;
                            card.dataset.displayValue = displayVal;
                            card.dataset.isLastProject = isLast;
                        }
                    });
                    dropdown.classList.remove('show');
                    showToast(`Menampilkan data untuk sales: ${selectedSales}`, 2000);
                });
            });
        }
    }
    document.addEventListener('click', (e) => { if (hasMultipleSales && dealCard && !dealCard.contains(e.target)) { const dropdown = dealCard.querySelector('.sales-dropdown'); if (dropdown) dropdown.classList.remove('show'); } });
}

function renderFilteredDeals(filteredDeals) {
    const pipelineStage = document.getElementById('pipelines-stage');
    if (!pipelineStage) return;
    pipelineStage.innerHTML = '';
    
    if (filteredDeals.length === 0) {
        const message = (currentUserRole === 'admin' || currentUserRole === 'manager') ? 'Tidak ada deals yang sesuai dengan filter.' : `Tidak ada pipeline untuk sales ${currentSalesName || currentUserEmail}. Silakan tambahkan deal baru.`;
        pipelineStage.innerHTML = `<div class="empty-stage-message text-center text-gray-400 p-4 text-sm w-full"><i class="fas fa-search text-3xl mb-2"></i><p>${message}</p></div>`;
        return;
    }
    
    if (currentView === 'card') {
        const dealsByNameAndPriority = {};
        filteredDeals.forEach(deal => {
            const dealName = deal.dealName?.toLowerCase().trim();
            const priority = deal.priority || 'Priority';
            if (!dealName) return;
            const key = `${dealName}|${priority}`;
            if (!dealsByNameAndPriority[key]) dealsByNameAndPriority[key] = [];
            dealsByNameAndPriority[key].push(deal);
        });
        
        Object.values(dealsByNameAndPriority).forEach(dealGroup => {
            if (dealGroup.length > 0) {
                if (dealGroup.length > 1) {
                    const mergedCard = renderMergedDealCard(dealGroup);
                    pipelineStage.appendChild(mergedCard);
                    setupMergeDealCardEvents(mergedCard, dealGroup);
                } else {
                    pipelineStage.appendChild(renderIndividualDealCard(dealGroup[0]));
                }
            }
        });
        initSortable();
    } else {
        const listContainer = document.createElement('div');
        listContainer.className = 'list-view-container';
        const table = document.createElement('table');
        table.className = 'list-view';
        table.innerHTML = `<thead><tr><th class="px-4 py-3">No</th><th class="px-4 py-3">Sales</th><th class="px-4 py-3">Project</th><th class="px-4 py-3">Tahap</th><th class="px-4 py-3">Konsultan</th><th class="px-4 py-3">Kontraktor</th><th class="px-4 py-3">Nilai</th><th class="px-4 py-3">Priority</th><th class="px-4 py-3">Aksi</th></tr></thead><tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        filteredDeals.forEach((deal, index) => {
            const row = document.createElement('tr');
            row.dataset.id = deal.id;
            row.className = 'hover:bg-gray-50 cursor-pointer view-detail-row';
            const canEdit = canUserEditDeal(deal);
            const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
            const allProjectDeals = deals.filter(d => d.dealName?.trim().toLowerCase() === deal.dealName?.trim().toLowerCase());
            const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
            const isLastProject = activeProjects.length === 1;
            let displayValue = isLastProject ? (deal.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
            let contractorText = Array.isArray(deal.contractor) ? deal.contractor.join(', ') : (deal.contractor || '-');
            let valueDisplay = `Rp ${formatNumber(displayValue)}`;
            if (!isLastProject && (deal.value || 0) < displayValue) valueDisplay += ` <span class="text-xs text-gray-500">(max)</span>`;
            
            row.innerHTML = `<td class="px-4 py-3 text-sm">${index+1}</td><td class="px-4 py-3 text-sm">${escapeHtml(deal.salesName||'-')}</td><td class="px-4 py-3 text-sm">${escapeHtml(deal.dealName||'No Name')}${allProjectDeals.length>1?`<span class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"><i class="fas fa-tags"></i> ${allProjectDeals.length}</span>`:''}${isLastProject?`<span class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><i class="fas fa-star"></i> Last</span>`:''}</td><td class="px-4 py-3 text-sm">${deal.stage?deal.stage.replace(/-/g,' ').replace(/\b\w/g,l=>l.toUpperCase()):'-'}</td><td class="px-4 py-3 text-sm">${escapeHtml(deal.consultant||'-')}</td><td class="px-4 py-3 text-sm">${escapeHtml(contractorText)}</td><td class="px-4 py-3 text-sm font-semibold">${valueDisplay}</td><td class="px-4 py-3"><span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">${deal.priority||'Priority'}</span></td><td class="px-4 py-3"><div class="flex space-x-2"><button class="view-detail-btn text-blue-600"><i class="fas fa-eye"></i></button>${canEdit?`<button class="edit-deal-btn text-green-600"><i class="fas fa-edit"></i></button><button class="delete-deal-btn text-red-600"><i class="fas fa-trash-alt"></i></button>`:''}</div></td>`;
            tbody.appendChild(row);
        });
        listContainer.appendChild(table);
        pipelineStage.appendChild(listContainer);
    }
}

function applyActiveFilters() {
    try {
        const filteredDeals = getFilteredDeals();
        renderFilteredDeals(filteredDeals);
    } catch (error) { console.error("Error applying filters:", error); }
}

function saveActiveFilters() {
    activeFilters.searchTerm = document.getElementById('searchDeals')?.value.toLowerCase() || '';
    activeFilters.priority = document.getElementById('filterPriority')?.value || 'all';
    activeFilters.stage = document.getElementById('filterStage')?.value || 'all';
    activeFilters.sales = document.getElementById('filterSales')?.value || 'all';
    activeFilters.consultant = document.getElementById('filterConsultant')?.value || 'all';
    activeFilters.contractor = document.getElementById('filterContractor')?.value || 'all';
    activeFilters.facility = document.getElementById('filterFacility')?.value || 'all';
    activeFilters.product = document.getElementById('filterProduct')?.value || 'all';
    activeFilters.package = document.getElementById('filterPackage')?.value || 'all';
    activeFilters.year = activeYear;
    saveStateToLocalStorage();
}

function filterDeals() { saveActiveFilters(); applyActiveFilters(); }

function switchView(viewType) {
    if (currentView === viewType) return;
    currentView = viewType;
    saveStateToLocalStorage();
    updateViewToggleUI();
    applyActiveFilters();
}

function initSortable() {
    const pipelineStage = document.getElementById('pipelines-stage');
    if (!pipelineStage) return;
    if (sortableInstances['pipelines-stage']) sortableInstances['pipelines-stage'].destroy();
    sortableInstances['pipelines-stage'] = new Sortable(pipelineStage, { animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', dragClass: 'sortable-drag', disabled: true });
}

function initViewToggle() {
    const cardViewBtn = document.getElementById('cardViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    if (cardViewBtn && listViewBtn) {
        cardViewBtn.addEventListener('click', () => switchView('card'));
        listViewBtn.addEventListener('click', () => switchView('list'));
    }
    updateViewToggleUI();
}

function canUserEditDeal(deal) {
    if (currentUserRole === 'admin' || currentUserRole === 'manager') return true;
    const allowedEmails = ['bintang@genetek.co.id', 'andy@genetek.co.id'];
    if (auth.currentUser && allowedEmails.includes(auth.currentUser.email)) return true;
    if (!auth.currentUser) return false;
    const userSalesName = emailToSalesNameMap[auth.currentUser.email];
    return deal.salesName === userSalesName;
}

function populateDropdown(selectElementId, uniqueValues, selectedValue = 'all') {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) return;
    selectElement.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    const labelText = selectElement.previousElementSibling?.textContent.replace(':', '').replace('*', '').trim() || '';
    defaultOption.textContent = `Semua ${labelText}`;
    selectElement.appendChild(defaultOption);
    Array.from(uniqueValues).sort().forEach(value => { if (value) { const option = document.createElement('option'); option.value = value; option.textContent = value; selectElement.appendChild(option); } });
    if (selectedValue) selectElement.value = selectedValue;
}

function populateFilterDropdowns() {
    populateDropdown('filterPriority', ['Priority', 'Hot Priority', 'Win', 'Behind', 'On Track'], activeFilters.priority);
    populateDropdown('filterStage', ['identified', 'prospect', 'tender-me', 'tender-main-con', 'contract-award', 'win', 'lost', 'on-hold'], activeFilters.stage);
    populateDropdown('filterSales', uniqueSales, activeFilters.sales);
    populateDropdown('filterConsultant', uniqueConsultants, activeFilters.consultant);
    populateDropdown('filterContractor', uniqueContractors, activeFilters.contractor);
    populateDropdown('filterFacility', uniqueFacilities, activeFilters.facility);
    populateDropdown('filterProduct', uniqueProducts, activeFilters.product);
    populateDropdown('filterPackage', uniquePackages, activeFilters.package);
    populateDropdown('filterYear', uniqueYears, activeFilters.year);
    document.getElementById('searchDeals').value = activeFilters.searchTerm;
}

function populateYearDropdown() {
    const filterYearSelect = document.getElementById('filterYear');
    if (!filterYearSelect) return;
    filterYearSelect.innerHTML = '<option value="all">Semua Tahun</option>';
    Array.from(uniqueYears).sort((a,b) => parseInt(b) - parseInt(a)).forEach(year => { const option = document.createElement('option'); option.value = year; option.textContent = year; filterYearSelect.appendChild(option); });
    if (activeYear && filterYearSelect.querySelector(`option[value="${activeYear}"]`)) filterYearSelect.value = activeYear;
}

async function loadConsultantsFromFirebase() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/bandeng77/pipelines.github.io/main/consultants.json
                                             if (response.ok) {
            const data = await response.json();
            data.forEach(c => { if (c) uniqueConsultants.add(c); });
        }
    } catch (error) { console.error("Error loading consultants:", error); }
}

// ==================== PROGRESS BAR ====================

function updateProgressBarFromStage(stage) {
    let progress = 0;
    switch (stage) {
        case 'identified': progress = 20; break;
        case 'prospect': progress = 40; break;
        case 'tender-me': progress = 60; break;
        case 'tender-main-con': case 'contract-award': progress = 80; break;
        case 'win': case 'lost': progress = 100; break;
        case 'on-hold': progress = 0; break;
        default: progress = 0;
    }
    const percentage = document.getElementById('progressPercentage');
    const fill = document.getElementById('progressFill');
    if (percentage) percentage.textContent = `${progress}%`;
    if (fill) fill.style.width = `${progress}%`;
}

function calculateValueFromBeforeDiscount() {
    const beforeDiscountRaw = document.getElementById('beforeDiscount').value.replace(/[^0-9]/g, '');
    const beforeDiscount = parseFloat(beforeDiscountRaw) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    let calculatedValue = beforeDiscount;
    if (discount > 0 && discount <= 100) calculatedValue = beforeDiscount * (1 - (discount / 100));
    const valueInput = document.getElementById('value');
    if (valueInput) valueInput.value = new Intl.NumberFormat('id-ID').format(Math.round(calculatedValue));
}

function formatNumberInput(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    let num = parseInt(val, 10);
    if (isNaN(num)) input.value = '';
    else input.value = new Intl.NumberFormat('id-ID').format(num);
}

function updateBeforeDiscountEventListeners() {
    const beforeDiscountInput = document.getElementById('beforeDiscount');
    const discountInput = document.getElementById('discount');
    if (beforeDiscountInput) beforeDiscountInput.addEventListener('input', function() { formatNumberInput(this); calculateValueFromBeforeDiscount(); });
    if (discountInput) discountInput.addEventListener('input', calculateValueFromBeforeDiscount);
}

// ==================== AKTIVITAS ====================

async function loadActivitiesFromFirebase(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && activitiesCache.lastFetch && (now - activitiesCache.lastFetch) < CACHE_DURATION) {
        activities = activitiesCache.data;
        updateActivityBadge();
        return;
    }
    try {
        const querySnapshot = await activitiesCollection.orderBy("timestamp", "desc").limit(100).get();
        activities = [];
        querySnapshot.forEach(doc => {
            const activityData = doc.data();
            if (activityData.timestamp && typeof activityData.timestamp.toDate !== 'function') {
                activityData.timestamp = firebase.firestore.Timestamp.fromMillis(activityData.timestamp);
            }
            activities.push({ id: doc.id, ...activityData });
        });
        activitiesCache = { data: activities, lastFetch: now };
        updateActivityBadge();
    } catch (error) { console.error("Error loading activities:", error); }
}

function updateActivityBadge() {
    const activityBadge = document.getElementById('activity-badge');
    if (!activityBadge) return;
    const unreadCount = activities.filter(act => !act.read).length;
    if (unreadCount > 0) { activityBadge.textContent = unreadCount; activityBadge.classList.remove('hidden'); }
    else activityBadge.classList.add('hidden');
}

function extractDealNameFromActivity(message) {
    if (!message) return null;
    const patterns = [/Deal "([^"]+)"/, /"([^"]+)"\s+(ditambahkan|diperbarui)/, /proyek "([^"]+)"/i, /project "([^"]+)"/i, /:\s*"([^"]+)"/];
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) return match[1].trim();
    }
    return null;
}

async function findDealByName(dealName) {
    if (!dealName) return null;
    const normalizedName = dealName.trim().toLowerCase();
    let deal = deals.find(d => d.dealName?.trim().toLowerCase() === normalizedName);
    if (deal) return deal;
    try {
        const querySnapshot = await dealsCollection.where('dealName', '==', dealName).limit(1).get();
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            deal = { id: doc.id, ...doc.data() };
            deals.push(deal);
            return deal;
        }
    } catch (error) { console.error("Error finding deal:", error); }
    return null;
}

async function openActivityModal() {
    if (isActivityModalOpening) return;
    isActivityModalOpening = true;
    try {
        const activityModal = document.getElementById('activityModal');
        const activityFeed = document.getElementById('activity-feed-modal');
        if (!activityModal || !activityFeed) throw new Error("Elements not found");
        activityModal.classList.remove('hidden');
        document.getElementById('activityModalContent').classList.remove('modal-content-leave-active');
        document.getElementById('activityModalContent').classList.add('modal-content-enter-active');
        activityFeed.innerHTML = `<div class="text-center text-gray-500 py-8"><i class="fas fa-spinner fa-spin text-3xl mb-2"></i><p>Memuat aktivitas...</p></div>`;
        activityModalState.isOpen = true;
        await loadActivitiesFromFirebase(true);
        activityFeed.innerHTML = '';
        if (activities.length === 0) {
            activityFeed.innerHTML = `<div class="text-center text-gray-500 py-8"><i class="fas fa-inbox text-3xl mb-2"></i><p>Tidak ada aktivitas terbaru</p></div>`;
        } else {
            const sortedActivities = [...activities].sort((a, b) => {
                const tsA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp || 0);
                const tsB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp || 0);
                return tsB - tsA;
            });
            for (const activity of sortedActivities) {
                const dealName = extractDealNameFromActivity(activity.message);
                if (dealName) activity.deal = await findDealByName(dealName);
            }
            sortedActivities.forEach(activity => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item p-3 border-b hover:bg-gray-50 transition';
                const timeStr = activity.timestamp ? formatDateTime(activity.timestamp) : 'Waktu tidak diketahui';
                const isUnread = !activity.read;
                activityItem.innerHTML = `<div class="flex items-start"><div class="flex-1"><p class="text-sm ${isUnread ? 'font-semibold' : ''}">${escapeHtml(activity.message || 'Aktivitas tidak tersedia')}</p><div class="flex items-center mt-1 text-xs text-gray-500"><i class="fas fa-clock mr-1"></i><span>${timeStr}</span>${isUnread ? '<span class="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">Baru</span>' : ''}</div></div>${activity.deal ? `<div class="ml-2"><button class="view-activity-deal text-blue-600 hover:text-blue-800 p-1" data-deal-id="${activity.deal.id}"><i class="fas fa-eye"></i></button></div>` : `<div class="ml-2 text-xs text-gray-400"><i class="fas fa-exclamation-triangle"></i></div>`}</div>`;
                if (activity.deal) {
                    activityItem.addEventListener('click', (e) => { if (!e.target.closest('button')) openDealDetailModal(activity.deal.id); });
                    const viewBtn = activityItem.querySelector('.view-activity-deal');
                    if (viewBtn) viewBtn.addEventListener('click', (e) => { e.stopPropagation(); openDealDetailModal(activity.deal.id); });
                }
                activityFeed.appendChild(activityItem);
            });
        }
        markActivitiesAsRead();
    } catch (error) { console.error("Error opening activity modal:", error); showToast("Gagal membuka aktivitas", 3000); }
    finally { setTimeout(() => { isActivityModalOpening = false; }, 500); }
}

function markActivitiesAsRead() {
    const batch = db.batch();
    const unreadActivities = activities.filter(act => !act.read);
    unreadActivities.forEach(activity => batch.update(activitiesCollection.doc(activity.id), { read: true }));
    if (unreadActivities.length > 0) {
        batch.commit().then(() => { unreadActivities.forEach(act => act.read = true); updateActivityBadge(); }).catch(console.error);
    }
}

function closeActivityModal() {
    const modalContent = document.getElementById('activityModalContent');
    if (!modalContent) return;
    modalContent.classList.remove('modal-content-enter-active');
    modalContent.classList.add('modal-content-leave-active');
    modalContent.addEventListener('transitionend', function handler() {
        document.getElementById('activityModal').classList.add('hidden');
        modalContent.classList.remove('modal-content-leave-active');
        modalContent.removeEventListener('transitionend', handler);
        activityModalState.isOpen = false;
    }, { once: true });
}

// ==================== MIGRASI KOMENTAR ====================

async function migrateOldComments() {
    if (commentsMigrationCompleted) return;
    console.log("Memulai migrasi data komentar lama...");
    try {
        const allCommentsSnapshot = await commentsCollection.get();
        const commentsToMigrate = [];
        const dealNameToProjectKey = new Map();
        
        for (const doc of allCommentsSnapshot.docs) {
            const commentData = doc.data();
            if (commentData.projectKey) continue;
            if (commentData.projectName) {
                commentsToMigrate.push({ id: doc.id, projectKey: getProjectKey(commentData.projectName), projectName: commentData.projectName });
                continue;
            }
            if (commentData.dealId) {
                let dealName = dealNameToProjectKey.get(commentData.dealId);
                if (!dealName) {
                    let deal = deals.find(d => d.id === commentData.dealId);
                    if (!deal) {
                        const dealDoc = await dealsCollection.doc(commentData.dealId).get();
                        if (dealDoc.exists) deal = { id: dealDoc.id, ...dealDoc.data() };
                    }
                    if (deal && deal.dealName) { dealName = deal.dealName; dealNameToProjectKey.set(commentData.dealId, dealName); }
                }
                if (dealName) commentsToMigrate.push({ id: doc.id, projectKey: getProjectKey(dealName), projectName: dealName });
            }
        }
        
        if (commentsToMigrate.length > 0) {
            const batch = db.batch();
            let batchCount = 0;
            for (const comment of commentsToMigrate) {
                batch.update(commentsCollection.doc(comment.id), { projectKey: comment.projectKey, projectName: comment.projectName });
                batchCount++;
                if (batchCount >= 450) { await batch.commit(); batchCount = 0; }
            }
            if (batchCount > 0) await batch.commit();
            console.log(`Migrasi ${commentsToMigrate.length} komentar selesai!`);
        }
        commentsMigrationCompleted = true;
        localStorage.setItem('comments_migration_completed', 'true');
    } catch (error) { console.error("Error saat migrasi komentar:", error); }
}

async function loadCommentsByProjectName(dealId) {
    try {
        let deal = getDealById(dealId);
        if (!deal) deal = deals.find(d => d.id === dealId);
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) deal = { id: dealDoc.id, ...dealDoc.data() };
        }
        if (!deal || !deal.dealName) return [];
        const projectKey = getProjectKey(deal.dealName);
        const querySnapshot = await commentsCollection.where('projectKey', '==', projectKey).orderBy('timestamp', 'asc').get();
        const comments = [];
        querySnapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));
        return comments;
    } catch (error) { console.error("Error loading comments:", error); return []; }
}

// ==================== STATISTIK ====================

function openStatsModal() {
    const modal = document.getElementById('statsModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.querySelector('#statsModal .modal-content-enter').classList.remove('modal-content-leave-active');
    document.querySelector('#statsModal .modal-content-enter').classList.add('modal-content-enter-active');
    switchStatsTab('overview');
    renderAllCharts();
    populateSalesFilter();
}

function closeStatsModal() {
    const content = document.querySelector('#statsModal .modal-content-enter');
    if (!content) return;
    content.classList.remove('modal-content-enter-active');
    content.classList.add('modal-content-leave-active');
    content.addEventListener('transitionend', function handler() {
        document.getElementById('statsModal').classList.add('hidden');
        content.classList.remove('modal-content-leave-active');
        content.removeEventListener('transitionend', handler);
    }, { once: true });
}

function switchStatsTab(tabName) {
    document.querySelectorAll('.stats-tab').forEach(t => { t.classList.remove('active', 'border-blue-600', 'text-blue-600'); t.classList.add('border-transparent'); });
    const activeTab = document.querySelector(`.stats-tab[data-tab="${tabName}"]`);
    if (activeTab) { activeTab.classList.add('active', 'border-blue-600', 'text-blue-600'); activeTab.classList.remove('border-transparent'); }
    document.querySelectorAll('.stats-tab-content').forEach(c => c.classList.add('hidden'));
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) activeContent.classList.remove('hidden');
}

function populateSalesFilter() {
    const salesFilter = document.getElementById('salesFilter');
    if (!salesFilter) return;
    const current = salesFilter.value;
    salesFilter.innerHTML = '<option value="all">Semua Sales</option>';
    Array.from(uniqueSales).sort().forEach(s => { const opt = document.createElement('option'); opt.value = s; opt.textContent = s; salesFilter.appendChild(opt); });
    if (current && Array.from(salesFilter.options).some(opt => opt.value === current)) salesFilter.value = current;
}

function processDealDataForCharts(dealsData) {
    const userDeals = filterDealsByUser(dealsData);
    const uniqueProjects = getUniqueProjectsForDashboard(userDeals);
    const dealSizes = { 'Small (< Rp 500 Juta)': 0, 'Medium (Rp 500 Juta - Rp 2 Miliar)': 0, 'Large (> Rp 2 Miliar)': 0 };
    const stageCount = {};
    const salesCount = {};
    const productCount = {};
    const pipelineByMonth = {};
    
    uniqueProjects.forEach(deal => {
        const val = deal.displayValue || deal.value || 0;
        if (val < 500000000) dealSizes['Small (< Rp 500 Juta)']++;
        else if (val <= 2000000000) dealSizes['Medium (Rp 500 Juta - Rp 2 Miliar)']++;
        else dealSizes['Large (> Rp 2 Miliar)']++;
        const stage = deal.stage || 'unknown';
        stageCount[stage] = (stageCount[stage] || 0) + 1;
        if (deal.salesName) salesCount[deal.salesName] = (salesCount[deal.salesName] || 0) + 1;
        const products = Array.isArray(deal.product) ? deal.product : (deal.product ? [deal.product] : []);
        products.forEach(p => { if (p) productCount[p] = (productCount[p] || 0) + 1; });
        if (deal.stage !== 'lost' && deal.stage !== 'win' && deal.createdAt) {
            const date = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
            const monthYear = date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
            pipelineByMonth[monthYear] = (pipelineByMonth[monthYear] || 0) + val;
        }
    });
    const sortedMonths = Object.keys(pipelineByMonth).sort((a,b) => {
        const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' ');
        const dA = new Date(parseInt(yA), new Date(Date.parse(mA + " 1, 2000")).getMonth(), 1);
        const dB = new Date(parseInt(yB), new Date(Date.parse(mB + " 1, 2000")).getMonth(), 1);
        return dA - dB;
    });
    return {
        dealSizeLabels: Object.keys(dealSizes), dealSizeData: Object.values(dealSizes),
        winRateLabels: Object.keys(stageCount), winRateData: Object.values(stageCount),
        dealsBySalesLabels: Object.keys(salesCount), dealsBySalesData: Object.values(salesCount),
        dealsByProductLabels: Object.keys(productCount), dealsByProductData: Object.values(productCount),
        pipelineValueLabels: sortedMonths, pipelineValueData: sortedMonths.map(m => pipelineByMonth[m])
    };
}

function renderAllCharts() {
    const stats = processDealDataForCharts(deals);
    const ctx = document.getElementById('dealSizeChart')?.getContext('2d');
    if (ctx) { if (charts.dealSizeChart) charts.dealSizeChart.destroy(); charts.dealSizeChart = new Chart(ctx, { type: 'bar', data: { labels: stats.dealSizeLabels, datasets: [{ label: 'Jumlah Deal', data: stats.dealSizeData, backgroundColor: ['#3B82F6', '#60A5FA', '#93C5FD'] }] }, options: { responsive: true, maintainAspectRatio: false } }); }
    const winCtx = document.getElementById('winRateChart')?.getContext('2d');
    if (winCtx) { if (charts.winRateChart) charts.winRateChart.destroy(); charts.winRateChart = new Chart(winCtx, { type: 'doughnut', data: { labels: stats.winRateLabels.map(l => l.replace(/-/g,' ')), datasets: [{ data: stats.winRateData, backgroundColor: ['#10B981','#EF4444','#F59E0B','#6B7280','#3B82F6','#06B6D4','#A855F7','#EC4899'] }] }, options: { responsive: true, maintainAspectRatio: false } }); }
    const salesCtx = document.getElementById('dealsBySalesChart')?.getContext('2d');
    if (salesCtx) { if (charts.dealsBySalesChart) charts.dealsBySalesChart.destroy(); charts.dealsBySalesChart = new Chart(salesCtx, { type: 'bar', data: { labels: stats.dealsBySalesLabels, datasets: [{ label: 'Jumlah Deal', data: stats.dealsBySalesData, backgroundColor: '#6366F1' }] }, options: { responsive: true, maintainAspectRatio: false } }); }
    const pipelineCtx = document.getElementById('pipelineValueChart')?.getContext('2d');
    if (pipelineCtx) { if (charts.pipelineValueChart) charts.pipelineValueChart.destroy(); charts.pipelineValueChart = new Chart(pipelineCtx, { type: 'line', data: { labels: stats.pipelineValueLabels, datasets: [{ label: 'Nilai Pipeline (IDR)', data: stats.pipelineValueData, borderColor: '#0EA5E9', backgroundColor: 'rgba(14,165,233,0.2)', tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => 'Rp ' + formatNumber(v) } } } } }); }
}

function processSalesData(salesName = 'all') {
    let salesDeals = salesName === 'all' ? deals : deals.filter(deal => deal.salesName === salesName);
    salesDeals = filterDealsByUser(salesDeals);
    const uniqueProjects = getUniqueProjectsForDashboard(salesDeals);
    const stats = { totalValue: 0, totalDeals: uniqueProjects.length, winCount: 0, stageDistribution: {}, priorityDistribution: {}, monthlyTimeline: {}, maxDealValue: 0, minDealValue: Infinity };
    if (uniqueProjects.length > 0) { stats.maxDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0; stats.minDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0; }
    uniqueProjects.forEach(deal => {
        const val = deal.displayValue || deal.value || 0;
        stats.totalValue += val;
        if (deal.stage === 'win') stats.winCount++;
        const stage = deal.stage || 'unknown';
        stats.stageDistribution[stage] = (stats.stageDistribution[stage] || 0) + 1;
        const priority = deal.priority || 'Priority';
        stats.priorityDistribution[priority] = (stats.priorityDistribution[priority] || 0) + 1;
        if (deal.createdAt) {
            const date = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
            const monthYear = date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
            if (!stats.monthlyTimeline[monthYear]) stats.monthlyTimeline[monthYear] = { count: 0, value: 0 };
            stats.monthlyTimeline[monthYear].count++;
            stats.monthlyTimeline[monthYear].value += val;
        }
        if (val > stats.maxDealValue) stats.maxDealValue = val;
        if (val < stats.minDealValue) stats.minDealValue = val;
    });
    stats.winRate = stats.totalDeals > 0 ? (stats.winCount / stats.totalDeals * 100).toFixed(1) : 0;
    stats.avgDealValue = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;
    return stats;
}

function renderSalesCharts() {
    const salesFilter = document.getElementById('salesFilter');
    const selectedSales = salesFilter ? salesFilter.value : 'all';
    const salesData = processSalesData(selectedSales);
    document.getElementById('salesTotalValue').textContent = `Rp ${formatNumber(salesData.totalValue)}`;
    document.getElementById('salesWinRate').textContent = `${salesData.winRate}%`;
    document.getElementById('salesTotalDeals').textContent = salesData.totalDeals;
    document.getElementById('salesAvgValue').textContent = `Rp ${formatNumber(salesData.avgDealValue)}`;
    document.getElementById('salesMaxValue').textContent = `Rp ${formatNumber(salesData.maxDealValue)}`;
    
    const stageCtx = document.getElementById('salesStageChart')?.getContext('2d');
    if (stageCtx) {
        if (salesCharts.salesStageChart) salesCharts.salesStageChart.destroy();
        salesCharts.salesStageChart = new Chart(stageCtx, { type: 'doughnut', data: { labels: Object.keys(salesData.stageDistribution).map(s => s.replace(/-/g,' ')), datasets: [{ data: Object.values(salesData.stageDistribution), backgroundColor: ['#3B82F6','#60A5FA','#93C5FD','#22D3EE','#A78BFA','#10B981','#EF4444','#F59E0B'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    }
    const priorityCtx = document.getElementById('salesPriorityChart')?.getContext('2d');
    if (priorityCtx) {
        if (salesCharts.salesPriorityChart) salesCharts.salesPriorityChart.destroy();
        const priorityLabels = Object.keys(salesData.priorityDistribution);
        salesCharts.salesPriorityChart = new Chart(priorityCtx, { type: 'bar', data: { labels: priorityLabels, datasets: [{ label: 'Jumlah Deal', data: Object.values(salesData.priorityDistribution), backgroundColor: priorityLabels.map(p => p==='Priority'?'#fef3c7':p==='Hot Priority'?'#fee2e2':p==='Win'?'#d1fae5':p==='Behind'?'#ffedd5':p==='On Track'?'#dbeafe':'#e5e7eb'), borderColor: priorityLabels.map(p => p==='Priority'?'#d97706':p==='Hot Priority'?'#dc2626':p==='Win'?'#059669':p==='Behind'?'#ea580c':p==='On Track'?'#1d4ed8':'#6b7280'), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    }
    const timelineCtx = document.getElementById('salesTimelineChart')?.getContext('2d');
    if (timelineCtx) {
        if (salesCharts.salesTimelineChart) salesCharts.salesTimelineChart.destroy();
        const sortedMonths = Object.keys(salesData.monthlyTimeline).sort((a,b) => { const [mA,yA]=a.split(' '); const [mB,yB]=b.split(' '); return new Date(parseInt(yA), new Date(Date.parse(mA+" 1,2000")).getMonth(),1) - new Date(parseInt(yB), new Date(Date.parse(mB+" 1,2000")).getMonth(),1); });
        salesCharts.salesTimelineChart = new Chart(timelineCtx, { type: 'line', data: { labels: sortedMonths, datasets: [{ label: 'Jumlah Deal', data: sortedMonths.map(m => salesData.monthlyTimeline[m].count), borderColor: '#3B82F6', yAxisID: 'y' }, { label: 'Total Nilai (IDR)', data: sortedMonths.map(m => salesData.monthlyTimeline[m].value), borderColor: '#10B981', yAxisID: 'y1' }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { title: { display: true, text: 'Jumlah Deal' }, ticks: { precision: 0 } }, y1: { position: 'right', title: { display: true, text: 'Total Nilai (IDR)' }, ticks: { callback: v => 'Rp ' + formatNumber(v) } } } } });
    }
}

// ==================== FILTER PANEL ====================

function openFilterPanel() {
    const filterPanel = document.getElementById('filterPanel');
    if (!filterPanel) return;
    populateYearDropdown();
    populateFilterDropdowns();
    filterPanel.classList.remove('hidden');
    document.getElementById('filterPanelContent').classList.remove('modal-content-leave-active');
    document.getElementById('filterPanelContent').classList.add('modal-content-enter-active');
}

function closeFilterPanel() {
    const content = document.getElementById('filterPanelContent');
    if (!content) return;
    content.classList.remove('modal-content-enter-active');
    content.classList.add('modal-content-leave-active');
    content.addEventListener('transitionend', function handler() {
        document.getElementById('filterPanel').classList.add('hidden');
        content.classList.remove('modal-content-leave-active');
        content.removeEventListener('transitionend', handler);
    }, { once: true });
}

function applyFiltersAndClosePanel() { saveActiveFilters(); applyActiveFilters(); closeFilterPanel(); }

function resetFilters() {
    document.getElementById('filterPriority').value = 'all';
    document.getElementById('filterYear').value = 'all';
    document.getElementById('filterStage').value = 'all';
    document.getElementById('filterSales').value = 'all';
    document.getElementById('filterConsultant').value = 'all';
    document.getElementById('filterContractor').value = 'all';
    document.getElementById('filterFacility').value = 'all';
    document.getElementById('filterProduct').value = 'all';
    document.getElementById('filterPackage').value = 'all';
    document.getElementById('searchDeals').value = '';
    document.querySelectorAll('.year-badge').forEach(b => { b.classList.remove('active'); if (b.dataset.year === 'all') b.classList.add('active'); });
    activeYear = 'all';
    activeFilters = { searchTerm: '', priority: 'all', year: 'all', stage: 'all', sales: 'all', consultant: 'all', contractor: 'all', facility: 'all', product: 'all', package: 'all' };
    priorityStatsCache = { 'all': null, '2025': null, '2026': null };
    dealsByYearCache = { 'all': null, '2025': null, '2026': null };
    saveStateToLocalStorage();
    applyActiveFilters();
    createPriorityDashboard();
}

// ==================== EXPORT EXCEL ====================

function initExportElements() {
    document.getElementById('exportExcelBtn')?.addEventListener('click', openExportModal);
    document.getElementById('cancelExportBtn')?.addEventListener('click', closeExportModal);
    document.getElementById('confirmExportBtn')?.addEventListener('click', exportToExcel);
    document.getElementById('exportDateRange')?.addEventListener('change', toggleCustomDateRange);
}

function toggleExportButton() {
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) exportExcelBtn.classList.toggle('hidden', currentUserRole !== 'admin');
}

function openExportModal() {
    const modal = document.getElementById('exportExcelModal');
    if (!modal) return;
    document.getElementById('exportDateRange').value = 'all';
    document.getElementById('exportFormat').value = 'detailed';
    document.getElementById('customDateRange').classList.add('hidden');
    modal.classList.remove('hidden');
    document.getElementById('exportExcelModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('exportExcelModalContent').classList.add('modal-content-enter-active');
}

function closeExportModal() {
    const content = document.getElementById('exportExcelModalContent');
    if (!content) return;
    content.classList.remove('modal-content-enter-active');
    content.classList.add('modal-content-leave-active');
    content.addEventListener('transitionend', function handler() {
        document.getElementById('exportExcelModal').classList.add('hidden');
        content.classList.remove('modal-content-leave-active');
        content.removeEventListener('transitionend', handler);
    }, { once: true });
}

function toggleCustomDateRange() {
    const range = document.getElementById('exportDateRange');
    const custom = document.getElementById('customDateRange');
    if (range && custom) custom.classList.toggle('hidden', range.value !== 'custom');
}

function getDealsByDateRange() {
    const range = document.getElementById('exportDateRange').value;
    if (range === 'all') return deals;
    const now = new Date();
    let start, end;
    if (range === 'this_month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999); }
    else if (range === 'last_month') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999); }
    else if (range === 'this_quarter') { const q = Math.floor(now.getMonth() / 3); start = new Date(now.getFullYear(), q * 3, 1); end = new Date(now.getFullYear(), (q + 1) * 3, 0, 23,59,59,999); }
    else if (range === 'this_year') { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31, 23,59,59,999); }
    else if (range === 'custom') {
        const startInput = document.getElementById('exportStartDate').value;
        const endInput = document.getElementById('exportEndDate').value;
        if (!startInput || !endInput) { showToast("Pilih tanggal mulai dan akhir", 3000); return null; }
        start = new Date(startInput); end = new Date(endInput); end.setHours(23,59,59,999);
    }
    if (!start || !end) return deals;
    return deals.filter(d => d.createdAt && ((d.createdAt.toDate?.() || new Date(d.createdAt)) >= start && (d.createdAt.toDate?.() || new Date(d.createdAt)) <= end));
}

function exportToExcel() {
    if (currentUserRole !== 'admin') { showToast("Hanya admin yang dapat mengekspor data", 3000); return; }
    const filtered = getDealsByDateRange();
    if (!filtered || filtered.length === 0) { showToast("Tidak ada data untuk diekspor", 3000); return; }
    const format = document.getElementById('exportFormat').value;
    const data = format === 'detailed' ? filtered.map(d => ({ 'Nama Proyek': d.dealName || '', 'Nama Sales': d.salesName || '', 'Tahap': d.stage?.replace(/-/g,' ') || '', 'Prioritas': d.priority || '', 'Nilai (IDR)': d.value || 0, 'Diskon (%)': d.discount || 0, 'Paket': d.package || '', 'Produk': Array.isArray(d.product) ? d.product.join(', ') : (d.product || ''), 'Fasilitas': d.facility || '', 'Konsultan': d.consultant || '', 'Kontraktor': Array.isArray(d.contractor) ? d.contractor.join(', ') : (d.contractor || ''), 'Tanggal Dibuat': formatDate(d.createdAt) })) : getUniqueProjectsForDashboard(filtered).map(d => ({ 'Nama Proyek': d.dealName || '', 'Nilai (IDR)': d.displayValue || d.value || 0, 'Tahap': d.stage?.replace(/-/g,' ') || '', 'Prioritas': d.priority || '' }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Pipeline");
    XLSX.writeFile(wb, `Sales_Pipeline_${format}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast("Data berhasil diekspor", 3000);
    closeExportModal();
}

// ==================== RECYCLE BIN ====================

async function loadRecycleBin() {
    try {
        const q = await deletedDealsCollection.orderBy("deletedAt", "desc").get();
        deletedDeals = []; q.forEach(d => deletedDeals.push({ id: d.id, ...d.data() }));
        updateRecycleBinBadge();
    } catch (error) { console.error("Error loading recycle bin:", error); }
}

function updateRecycleBinBadge() {
    const badge = document.getElementById('recycle-bin-badge');
    if (badge) { if (deletedDeals.length > 0) { badge.textContent = deletedDeals.length; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }
}

function openRecycleBinModal() {
    if (currentUserRole !== 'admin') { showToast("Hanya admin yang dapat mengakses Recycle Bin", 3000); return; }
    document.getElementById('recycleBinModal').classList.remove('hidden');
    document.getElementById('recycleBinModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('recycleBinModalContent').classList.add('modal-content-enter-active');
    renderRecycleBinContent();
}

function renderRecycleBinContent() {
    const container = document.getElementById('recycleBinContent');
    const emptyMsg = document.getElementById('emptyRecycleBinMessage');
    if (!container) return;
    if (deletedDeals.length === 0) { container.innerHTML = ''; if(emptyMsg) emptyMsg.classList.remove('hidden'); return; }
    if(emptyMsg) emptyMsg.classList.add('hidden');
    container.innerHTML = '';
    deletedDeals.forEach(d => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.innerHTML = `<td class="p-3">${escapeHtml(d.dealName||'No Name')}</td><td class="p-3">${escapeHtml(d.salesName||'-')}</td><td class="p-3">Rp ${formatNumber(d.value||0)}</td><td class="p-3">${formatDateTime(d.deletedAt)}</td><td class="p-3"><button class="restore-deal-btn text-green-600 mr-3" data-id="${d.id}"><i class="fas fa-undo"></i> Restore</button><button class="permanent-delete-btn text-red-600" data-id="${d.id}" data-name="${escapeHtml(d.dealName)}"><i class="fas fa-trash"></i> Hapus</button></td>`;
        container.appendChild(row);
    });
    container.querySelectorAll('.restore-deal-btn').forEach(btn => btn.addEventListener('click', () => restoreDeal(btn.dataset.id)));
    container.querySelectorAll('.permanent-delete-btn').forEach(btn => btn.addEventListener('click', () => confirmPermanentDelete(btn.dataset.id, btn.dataset.name)));
}

async function restoreDeal(id) {
    const deal = deletedDeals.find(d => d.id === id);
    if (!deal) return;
    const { originalId, deletedAt, deletedBy, deletedByEmail, ...data } = deal;
    await dealsCollection.add(data);
    await deletedDealsCollection.doc(id).delete();
    showToast(`Deal "${data.dealName}" dipulihkan`, 2000);
    await loadRecycleBin();
    renderRecycleBinContent();
    updateRecycleBinBadge();
}

let permanentDeleteId = null;
let permanentDeleteName = '';

function confirmPermanentDelete(id, name) {
    permanentDeleteId = id;
    permanentDeleteName = name;
    document.getElementById('permanentDeleteDealName').textContent = name;
    document.getElementById('permanentDeleteModal').classList.remove('hidden');
    document.getElementById('permanentDeleteModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('permanentDeleteModalContent').classList.add('modal-content-enter-active');
}

async function permanentDeleteDeal() {
    if (!permanentDeleteId) return;
    await deletedDealsCollection.doc(permanentDeleteId).delete();
    showToast(`Deal "${permanentDeleteName}" dihapus permanen`, 2000);
    await loadRecycleBin();
    renderRecycleBinContent();
    updateRecycleBinBadge();
    closePermanentDeleteModal();
}

function closePermanentDeleteModal() {
    const content = document.getElementById('permanentDeleteModalContent');
    if (!content) return;
    content.classList.remove('modal-content-enter-active');
    content.classList.add('modal-content-leave-active');
    content.addEventListener('transitionend', function handler() {
        document.getElementById('permanentDeleteModal').classList.add('hidden');
        content.classList.remove('modal-content-leave-active');
        content.removeEventListener('transitionend', handler);
        permanentDeleteId = null;
    }, { once: true });
}

async function emptyRecycleBin() {
    if (deletedDeals.length === 0) { showToast("Recycle Bin sudah kosong", 3000); return; }
    document.getElementById('recycleBinCount').textContent = deletedDeals.length;
    document.getElementById('emptyRecycleBinModal').classList.remove('hidden');
    document.getElementById('emptyRecycleBinModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('emptyRecycleBinModalContent').classList.add('modal-content-enter-active');
}

async function confirmEmptyRecycleBin() {
    const batch = db.batch();
    deletedDeals.forEach(deal => batch.delete(deletedDealsCollection.doc(deal.id)));
    await batch.commit();
    showToast(`Recycle Bin berhasil dikosongkan! ${deletedDeals.length} deal dihapus permanen.`, 3000);
    await loadRecycleBin();
    renderRecycleBinContent();
    updateRecycleBinBadge();
    closeEmptyRecycleBinModal();
}

function closeEmptyRecycleBinModal() {
    const content = document.getElementById('emptyRecycleBinModalContent');
    if (!content) return;
    content.classList.remove('modal-content-enter-active');
    content.classList.add('modal-content-leave-active');
    content.addEventListener('transitionend', function handler() {
        document.getElementById('emptyRecycleBinModal').classList.add('hidden');
        content.classList.remove('modal-content-leave-active');
        content.removeEventListener('transitionend', handler);
    }, { once: true });
}

function closeRecycleBinModal() {
    const content = document.getElementById('recycleBinModalContent');
    if (!content) return;
    content.classList.remove('modal-content-enter-active');
    content.classList.add('modal-content-leave-active');
    content.addEventListener('transitionend', function handler() {
        document.getElementById('recycleBinModal').classList.add('hidden');
        content.classList.remove('modal-content-leave-active');
        content.removeEventListener('transitionend', handler);
    }, { once: true });
}

// ==================== TAMBAHAN UNTUK DEAL ====================

function addContractorField(initialValue = '') {
    const contractorListDiv = document.getElementById('contractorList');
    if (!contractorListDiv) return;
    const newDiv = document.createElement('div');
    newDiv.className = 'flex items-center space-x-2 mb-2';
    const selectId = `contractor-select-${Date.now()}`;
    const inputId = `contractor-input-${Date.now()}`;
    newDiv.innerHTML = `<select id="${selectId}" class="w-full p-3 border border-gray-300 rounded-lg"><option value="">Pilih Kontraktor</option></select><input type="text" id="${inputId}" class="w-full p-3 border border-gray-300 rounded-lg" placeholder="Atau ketik nama kontraktor baru"><button type="button" class="remove-contractor-btn text-red-500"><i class="fas fa-times"></i></button>`;
    contractorListDiv.appendChild(newDiv);
    populateDropdown(selectId, uniqueContractors);
    const newSelect = document.getElementById(selectId);
    const newTextInput = document.getElementById(inputId);
    if (initialValue && uniqueContractors.has(initialValue)) { newSelect.value = initialValue; if (newTextInput) newTextInput.value = ''; }
    else if (initialValue) { if (newSelect) newSelect.value = ''; if (newTextInput) newTextInput.value = initialValue; }
    if (newSelect && newTextInput) {
        newSelect.addEventListener('change', () => { if (newSelect.value !== '') newTextInput.value = ''; });
        newTextInput.addEventListener('input', () => { if (newTextInput.value.trim() !== '') newSelect.value = ''; });
    }
}

function addProductField(initialValue = '') {
    const productListDiv = document.getElementById('productList');
    if (!productListDiv) return;
    const newDiv = document.createElement('div');
    newDiv.className = 'flex items-center space-x-2 mb-2';
    const selectId = `product-select-${Date.now()}`;
    const inputId = `product-input-${Date.now()}`;
    newDiv.innerHTML = `<select id="${selectId}" class="w-full p-3 border border-gray-300 rounded-lg"><option value="">Pilih Produk</option><option value="Fire">Fire</option><option value="Suppresion">Suppresion</option><option value="Vesda">Vesda</option><option value="Maintenance">Maintenance</option><option value="Fire - Water">Fire - Water</option><option value="Mechanical">Mechanical</option><option value="FAS-FSS-FF">FAS-FSS-FF</option><option value="FAS&FSS">FAS&FSS</option></select><input type="text" id="${inputId}" class="w-full p-3 border border-gray-300 rounded-lg" placeholder="Atau ketik nama produk baru"><button type="button" class="remove-product-btn text-red-500"><i class="fas fa-times"></i></button>`;
    productListDiv.appendChild(newDiv);
    const newSelect = document.getElementById(selectId);
    const newTextInput = document.getElementById(inputId);
    Array.from(uniqueProducts).sort().forEach(v => { if (v && !['Fire','Suppresion','Vesda','Maintenance','Fire - Water','Mechanical','FAS-FSS-FF','FAS&FSS'].includes(v)) { const opt = document.createElement('option'); opt.value = v; opt.textContent = v; newSelect.appendChild(opt); } });
    if (initialValue && Array.from(newSelect.options).some(opt => opt.value === initialValue)) { newSelect.value = initialValue; if (newTextInput) newTextInput.value = ''; }
    else if (initialValue) { if (newSelect) newSelect.value = ''; if (newTextInput) newTextInput.value = initialValue; }
    if (newSelect && newTextInput) {
        newSelect.addEventListener('change', () => { if (newSelect.value !== '') newTextInput.value = ''; });
        newTextInput.addEventListener('input', () => { if (newTextInput.value.trim() !== '') newSelect.value = ''; });
    }
}

function removeContractorField(btn) { btn.closest('.flex')?.remove(); }
function removeProductField(btn) { btn.closest('.flex')?.remove(); }

// ==================== DEAL MODAL ====================

async function openDealModal(dealId = null) {
    const dealModal = document.getElementById('dealModal');
    const modalTitle = document.getElementById('modalTitle');
    if (!dealModal || !modalTitle) return;
    document.getElementById('dealForm').reset();
    document.getElementById('dealId').value = '';
    document.getElementById('value').value = '';
    document.getElementById('beforeDiscount').value = '';
    if (consultantSearchInput) consultantSearchInput.value = '';
    if (consultantHiddenInput) consultantHiddenInput.value = '';
    if (consultantSuggestionsDiv) consultantSuggestionsDiv.innerHTML = '';
    document.getElementById('productList').innerHTML = '';
    document.getElementById('contractorList').innerHTML = '';
    populateDropdown('pic', uniquePICs);
    populateDropdown('owner', uniqueOwners);
    
    if (facilitySelect) {
        facilitySelect.innerHTML = `<option value="">Pilih Fasilitas</option><option value="Industrial">Industrial</option><option value="Office">Office</option><option value="Hotel">Hotel</option><option value="Data Center">Data Center</option><option value="Oil & Gas">Oil & Gas</option><option value="Warehouse">Warehouse</option><option value="Other">Other</option>`;
        Array.from(uniqueFacilities).sort().forEach(v => { if (v && !['Industrial','Office','Hotel','Data Center','Oil & Gas','Warehouse','Other'].includes(v)) { const opt = document.createElement('option'); opt.value = v; opt.textContent = v; facilitySelect.appendChild(opt); } });
    }
    if (packageSelect) {
        packageSelect.innerHTML = `<option value="">Pilih Paket</option><option value="Electronic Package">Electronic Package</option><option value="M&E">M&E</option><option value="Fire Fighting Cont">Fire Fighting Cont</option><option value="Main Kontraktor">Main Kontraktor</option>`;
        Array.from(uniquePackages).sort().forEach(v => { if (v && !['Electronic Package','M&E','Fire Fighting Cont','Main Kontraktor'].includes(v)) { const opt = document.createElement('option'); opt.value = v; opt.textContent = v; packageSelect.appendChild(opt); } });
    }
    
    if (dealId) {
        modalTitle.textContent = 'Edit Deal';
        const deal = deals.find(d => d.id === dealId);
        if (deal) {
            document.getElementById('dealId').value = deal.id;
            document.getElementById('salesName').value = deal.salesName || '';
            document.getElementById('dealName').value = deal.dealName || '';
            if (deal.beforeDiscount) document.getElementById('beforeDiscount').value = new Intl.NumberFormat('id-ID').format(deal.beforeDiscount);
            document.getElementById('discount').value = deal.discount || '';
            calculateValueFromBeforeDiscount();
            if (deal.package && packageSelect) {
                if (Array.from(packageSelect.options).some(opt => opt.value === deal.package)) packageSelect.value = deal.package;
                else { packageSelect.value = ''; if (newPackageInput) newPackageInput.value = deal.package || ''; }
            }
            if (deal.product) {
                if (Array.isArray(deal.product)) deal.product.forEach(p => addProductField(p));
                else addProductField(deal.product);
            } else addProductField();
            if (deal.facility && facilitySelect) {
                if (Array.from(facilitySelect.options).some(opt => opt.value === deal.facility)) facilitySelect.value = deal.facility;
                else { facilitySelect.value = ''; if (newFacilityInput) newFacilityInput.value = deal.facility || ''; }
            }
            if (deal.owner && uniqueOwners.has(deal.owner)) document.getElementById('owner').value = deal.owner;
            else { document.getElementById('owner').value = ''; if (document.getElementById('newOwner')) document.getElementById('newOwner').value = deal.owner || ''; }
            if (consultantSearchInput) consultantSearchInput.value = deal.consultant || '';
            if (consultantHiddenInput) consultantHiddenInput.value = deal.consultant || '';
            if (deal.contractor) {
                if (Array.isArray(deal.contractor)) deal.contractor.forEach(c => addContractorField(c));
                else addContractorField(deal.contractor);
            } else addContractorField();
            if (deal.pic && uniquePICs.has(deal.pic)) document.getElementById('pic').value = deal.pic;
            else { document.getElementById('pic').value = ''; if (document.getElementById('newPic')) document.getElementById('newPic').value = deal.pic || ''; }
            document.getElementById('planPO').value = deal.planPO || '';
            document.getElementById('stage').value = deal.stage || DEFAULT_STAGE;
            document.getElementById('priority').value = deal.priority || 'Priority';
            document.getElementById('remarks').value = deal.remarks || '';
            updateProgressBarFromStage(deal.stage);
            currentDealIdForComments = deal.id;
            const comments = await loadCommentsByProjectName(deal.id);
            renderComments(comments, 'commentsList');
            document.getElementById('commentsSection').style.display = 'block';
            await renderAttachments(document.getElementById('dealAttachmentsList'), deal.id);
            setupRealtimeAttachments(deal.id);
        }
    } else {
        modalTitle.textContent = 'Tambah Deal Baru';
        document.getElementById('stage').value = DEFAULT_STAGE;
        document.getElementById('priority').value = 'Priority';
        if (currentUserRole === 'user') {
            const userSalesName = getCurrentSalesName();
            if (userSalesName) { document.getElementById('salesName').value = userSalesName; document.getElementById('salesName').disabled = true; }
        } else { document.getElementById('salesName').disabled = false; }
        addContractorField();
        addProductField();
        updateProgressBarFromStage(DEFAULT_STAGE);
        document.getElementById('commentsSection').style.display = 'none';
        currentDealIdForComments = null;
        stopRealtimeAttachments();
    }
    dealModal.classList.remove('hidden');
    document.getElementById('dealModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('dealModalContent').classList.add('modal-content-enter-active');
}

function closeDealModal() {
    const modalContent = document.getElementById('dealModalContent');
    if (!modalContent) return;
    modalContent.classList.remove('modal-content-enter-active');
    modalContent.classList.add('modal-content-leave-active');
    modalContent.addEventListener('transitionend', function handler() {
        document.getElementById('dealModal').classList.add('hidden');
        modalContent.classList.remove('modal-content-leave-active');
        modalContent.removeEventListener('transitionend', handler);
        currentDealIdForComments = null;
        stopRealtimeAttachments();
        document.getElementById('salesName').disabled = false;
    }, { once: true });
}

async function saveDeal() {
    try {
        const dealId = document.getElementById('dealId').value;
        const salesName = document.getElementById('salesName').value;
        const dealName = document.getElementById('dealName').value.trim();
        const stage = document.getElementById('stage').value;
        const priority = document.getElementById('priority').value;
        if (!dealName) { showToast("Nama proyek wajib diisi", 3000); return; }
        const beforeDiscountRaw = document.getElementById('beforeDiscount').value.replace(/[^0-9]/g, '');
        const beforeDiscount = parseFloat(beforeDiscountRaw) || 0;
        if (beforeDiscount <= 0) { showToast("Nilai sebelum diskon harus lebih dari 0", 3000); return; }
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        let calculatedValue = beforeDiscount;
        if (discount > 0 && discount <= 100) calculatedValue = beforeDiscount * (1 - (discount / 100));
        
        let packageValue = '';
        if (packageSelect && packageSelect.value !== '') packageValue = packageSelect.value;
        else if (newPackageInput && newPackageInput.value.trim() !== '') packageValue = newPackageInput.value.trim();
        
        let facilityValue = '';
        if (facilitySelect && facilitySelect.value !== '') facilityValue = facilitySelect.value;
        else if (newFacilityInput && newFacilityInput.value.trim() !== '') facilityValue = newFacilityInput.value.trim();
        
        const productElements = document.querySelectorAll('#productList select, #productList input[type="text"]');
        const products = [];
        for (let i = 0; i < productElements.length; i += 2) {
            let productValue = '';
            if (productElements[i] && productElements[i].value !== '') productValue = productElements[i].value;
            else if (productElements[i+1] && productElements[i+1].value.trim() !== '') productValue = productElements[i+1].value.trim();
            if (productValue) products.push(productValue);
        }
        
        const contractorElements = document.querySelectorAll('#contractorList select, #contractorList input[type="text"]');
        const contractors = [];
        for (let i = 0; i < contractorElements.length; i += 2) {
            let contractorValue = '';
            if (contractorElements[i] && contractorElements[i].value !== '') contractorValue = contractorElements[i].value;
            else if (contractorElements[i+1] && contractorElements[i+1].value.trim() !== '') contractorValue = contractorElements[i+1].value.trim();
            if (contractorValue) contractors.push(contractorValue);
        }
        
        let ownerValue = '';
        const ownerSelect = document.getElementById('owner');
        const newOwnerInput = document.getElementById('newOwner');
        if (ownerSelect && ownerSelect.value !== '') ownerValue = ownerSelect.value;
        else if (newOwnerInput && newOwnerInput.value.trim() !== '') ownerValue = newOwnerInput.value.trim();
        
        let picValue = '';
        const picSelect = document.getElementById('pic');
        const newPicInput = document.getElementById('newPic');
        if (picSelect && picSelect.value !== '') picValue = picSelect.value;
        else if (newPicInput && newPicInput.value.trim() !== '') picValue = newPicInput.value.trim();
        
        const dealData = {
            salesName, dealName, stage, priority, value: Math.round(calculatedValue),
            beforeDiscount, discount, package: packageValue,
            product: products.length > 0 ? (products.length === 1 ? products[0] : products) : '',
            facility: facilityValue, owner: ownerValue,
            consultant: document.getElementById('consultantSearch').value.trim(),
            contractor: contractors.length > 0 ? (contractors.length === 1 ? contractors[0] : contractors) : '',
            pic: picValue, planPO: document.getElementById('planPO').value,
            remarks: document.getElementById('remarks').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.currentUser.email
        };
        if (!dealId) {
            dealData.createdBy = auth.currentUser.email;
            dealData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        if (dealId) {
            await dealsCollection.doc(dealId).update(dealData);
            await activitiesCollection.add({ message: `Deal "${dealName}" diperbarui oleh ${auth.currentUser.email}.`, timestamp: firebase.firestore.FieldValue.serverTimestamp(), userEmail: auth.currentUser.email, read: false });
            showToast(`Deal "${dealName}" berhasil diperbarui!`, 2000);
        } else {
            await dealsCollection.add(dealData);
            await activitiesCollection.add({ message: `Deal "${dealName}" ditambahkan oleh ${auth.currentUser.email}.`, timestamp: firebase.firestore.FieldValue.serverTimestamp(), userEmail: auth.currentUser.email, read: false });
            showToast(`Deal "${dealName}" berhasil ditambahkan!`, 2000);
        }
        priorityStatsCache = { 'all': null, '2025': null, '2026': null };
        dealsByYearCache = { 'all': null, '2025': null, '2026': null };
        activitiesCache.lastFetch = null;
        closeDealModal();
    } catch (error) { console.error("Error saving deal:", error); showToast("Gagal menyimpan deal", 3000); }
}

function prepareEditDeal(dealId) { openDealModal(dealId); }

async function openDealDetailModal(dealId) {
    try {
        let deal = getDealById(dealId);
        if (!deal) deal = deals.find(d => d.id === dealId);
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) deal = { id: dealDoc.id, ...dealDoc.data() };
        }
        if (!deal) { showToast("Deal tidak ditemukan", 3000); return; }
        
        const allProjectDeals = deals.filter(d => d.dealName?.trim().toLowerCase() === deal.dealName?.trim().toLowerCase());
        const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
        const isLastProject = activeProjects.length === 1;
        let displayValue = isLastProject ? (deal.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
        
        document.getElementById('dealDetailTitle').textContent = `Detail Deal: ${deal.dealName}`;
        document.getElementById('detailSalesName').textContent = deal.salesName || '-';
        const valueElem = document.getElementById('detailValue');
        let valueHtml = `Rp ${formatNumber(displayValue)}`;
        if (!isLastProject && (deal.value || 0) < displayValue) valueHtml += ` <span class="text-xs text-gray-500">(nilai asli: Rp ${formatNumber(deal.value || 0)})</span>`;
        valueElem.innerHTML = valueHtml;
        document.getElementById('detailDiscount').textContent = deal.discount ? `${deal.discount}%` : '-';
        document.getElementById('detailBeforeDiscount').textContent = `Rp ${formatNumber(deal.beforeDiscount) || '0'}`;
        document.getElementById('detailPackage').textContent = deal.package || '-';
        let productText = Array.isArray(deal.product) ? deal.product.join(', ') : (deal.product || '-');
        document.getElementById('detailProduct').textContent = productText;
        document.getElementById('detailFacility').textContent = deal.facility || '-';
        document.getElementById('detailOwner').textContent = deal.owner || '-';
        document.getElementById('detailConsultant').textContent = deal.consultant || '-';
        let contractorText = Array.isArray(deal.contractor) ? deal.contractor.join(', ') : (deal.contractor || '-');
        document.getElementById('detailContractor').textContent = contractorText;
        document.getElementById('detailPIC').textContent = deal.pic || '-';
        document.getElementById('detailPlanPO').textContent = deal.planPO || '-';
        document.getElementById('detailStage').textContent = deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-';
        document.getElementById('detailPriority').innerHTML = `<span class="priority-badge px-2 py-1 rounded-full ${getPriorityBadgeClass(deal.priority)}">${deal.priority || '-'}</span>`;
        document.getElementById('detailCreatedDate').textContent = formatDate(deal.createdAt);
        document.getElementById('detailRemarks').textContent = deal.remarks || '-';
        
        let progress = 0;
        switch(deal.stage) {
            case 'identified': progress = 20; break;
            case 'prospect': progress = 40; break;
            case 'tender-me': progress = 60; break;
            case 'tender-main-con': case 'contract-award': progress = 80; break;
            case 'win': case 'lost': progress = 100; break;
            case 'on-hold': progress = 0; break;
        }
        document.getElementById('detailProgress').textContent = `${progress}%`;
        
        currentDealIdForComments = dealId;
        const comments = await loadCommentsByProjectName(dealId);
        renderComments(comments, 'detailCommentsList');
        await renderAttachments(document.getElementById('detailAttachmentsList'), dealId);
        setupRealtimeAttachments(dealId);
        
        document.getElementById('dealDetailModal').classList.remove('hidden');
        document.getElementById('dealDetailModalContent').classList.remove('modal-content-leave-active');
        document.getElementById('dealDetailModalContent').classList.add('modal-content-enter-active');
    } catch (error) { console.error("Error opening deal detail:", error); showToast("Gagal membuka detail deal", 3000); }
}

function closeDealDetailModal() {
    const modalContent = document.getElementById('dealDetailModalContent');
    if (!modalContent) return;
    modalContent.classList.remove('modal-content-enter-active');
    modalContent.classList.add('modal-content-leave-active');
    modalContent.addEventListener('transitionend', function handler() {
        document.getElementById('dealDetailModal').classList.add('hidden');
        modalContent.classList.remove('modal-content-leave-active');
        modalContent.removeEventListener('transitionend', handler);
        currentDealIdForComments = null;
        stopRealtimeAttachments();
    }, { once: true });
}

function confirmDeleteDeal(dealId, dealName) {
    dealToDeleteId = dealId;
    dealToDeleteName = dealName;
    document.getElementById('dealToDeleteName').textContent = dealName;
    document.getElementById('deleteModal').classList.remove('hidden');
    document.getElementById('deleteModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('deleteModalContent').classList.add('modal-content-enter-active');
}

function closeDeleteModal() {
    const modalContent = document.getElementById('deleteModalContent');
    if (!modalContent) return;
    modalContent.classList.remove('modal-content-enter-active');
    modalContent.classList.add('modal-content-leave-active');
    modalContent.addEventListener('transitionend', function handler() {
        document.getElementById('deleteModal').classList.add('hidden');
        modalContent.classList.remove('modal-content-leave-active');
        modalContent.removeEventListener('transitionend', handler);
    }, { once: true });
}

async function deleteDeal() {
    if (!dealToDeleteId) return;
    try {
        const dealDoc = await dealsCollection.doc(dealToDeleteId).get();
        if (!dealDoc.exists) { showToast("Deal tidak ditemukan", 3000); return; }
        const dealData = dealDoc.data();
        await deletedDealsCollection.add({ ...dealData, originalId: dealToDeleteId, deletedAt: firebase.firestore.FieldValue.serverTimestamp(), deletedBy: auth.currentUser.email, deletedByEmail: auth.currentUser.email });
        await dealsCollection.doc(dealToDeleteId).delete();
        await activitiesCollection.add({ message: `Deal "${dealToDeleteName}" dipindahkan ke Recycle Bin oleh ${auth.currentUser.email}.`, timestamp: firebase.firestore.FieldValue.serverTimestamp(), userEmail: auth.currentUser.email, read: false });
        showToast(`Deal "${dealToDeleteName}" berhasil dipindahkan ke Recycle Bin!`, 2000);
        priorityStatsCache = { 'all': null, '2025': null, '2026': null };
        dealsByYearCache = { 'all': null, '2025': null, '2026': null };
        dealsByIdCache.delete(dealToDeleteId);
        activitiesCache.lastFetch = null;
        closeDeleteModal();
        if (currentUserRole === 'admin') loadRecycleBin();
    } catch (error) { console.error("Error deleting deal:", error); showToast("Gagal menghapus deal", 3000); }
}

// ==================== SEARCH KONSULTAN ====================

function setupConsultantSearch() {
    consultantSearchInput = document.getElementById('consultantSearch');
    consultantHiddenInput = document.getElementById('consultant');
    consultantSuggestionsDiv = document.getElementById('consultantSuggestions');
    if (!consultantSearchInput) return;
    consultantSearchInput.addEventListener('input', () => {
        const term = consultantSearchInput.value.toLowerCase();
        consultantSuggestionsDiv.innerHTML = '';
        if (term.length === 0) { consultantSuggestionsDiv.classList.add('hidden'); return; }
        const filtered = Array.from(uniqueConsultants).filter(c => c.toLowerCase().includes(term)).sort();
        if (filtered.length > 0) {
            filtered.forEach(c => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = c;
                div.addEventListener('click', () => { consultantSearchInput.value = c; consultantHiddenInput.value = c; consultantSuggestionsDiv.classList.add('hidden'); });
                consultantSuggestionsDiv.appendChild(div);
            });
            consultantSuggestionsDiv.classList.remove('hidden');
        } else consultantSuggestionsDiv.classList.add('hidden');
    });
    consultantSearchInput.addEventListener('blur', () => { setTimeout(() => { consultantHiddenInput.value = consultantSearchInput.value.trim(); consultantSuggestionsDiv.classList.add('hidden'); }, 100); });
    document.addEventListener('click', (e) => { if (!consultantSearchInput.contains(e.target) && !consultantSuggestionsDiv.contains(e.target)) consultantSuggestionsDiv.classList.add('hidden'); });
}

// ==================== PERMISSIONS ====================

function applyUserPermissions() {
    const isAdmin = currentUserRole === 'admin';
    const isManager = currentUserRole === 'manager';
    const viewStatsBtn = document.getElementById('viewStatsBtn');
    const recycleBinFab = document.getElementById('recycleBinFab');
    if (viewStatsBtn) viewStatsBtn.classList.toggle('hidden', !(isAdmin || isManager));
    if (recycleBinFab) recycleBinFab.classList.toggle('hidden', !isAdmin);
    toggleExportButton();
}

// ==================== EVENT LISTENERS ====================

function initEventListeners() {
    document.getElementById('newDealBtn')?.addEventListener('click', () => openDealModal());
    document.getElementById('viewStatsBtn')?.addEventListener('click', openStatsModal);
    document.getElementById('activityBtn')?.addEventListener('click', openActivityModal);
    document.getElementById('authButton')?.addEventListener('click', logout);
    document.getElementById('openFilterPanelBtn')?.addEventListener('click', openFilterPanel);
    document.getElementById('cancelDealBtn')?.addEventListener('click', closeDealModal);
    document.getElementById('closeDetailBtn')?.addEventListener('click', closeDealDetailModal);
    document.getElementById('closeDetailBtn')?.addEventListener('click', closeDealDetailModal);
    document.getElementById('closeActivityBtn')?.addEventListener('click', closeActivityModal);
    document.getElementById('closeActivityFooterBtn')?.addEventListener('click', closeActivityModal);
    document.getElementById('closeFilterBtn')?.addEventListener('click', closeFilterPanel);
    document.getElementById('resetFilterBtn')?.addEventListener('click', resetFilters);
    document.getElementById('applyFilterBtn')?.addEventListener('click', applyFiltersAndClosePanel);
    document.getElementById('closeStatsBtn')?.addEventListener('click', closeStatsModal);
    document.getElementById('searchDeals')?.addEventListener('keyup', filterDeals);
    document.getElementById('stage')?.addEventListener('change', function() { updateProgressBarFromStage(this.value); });
    document.getElementById('commentSubmitBtn')?.addEventListener('click', () => addComment(currentDealIdForComments, document.getElementById('commentInput')?.value));
    document.getElementById('detailCommentSubmitBtn')?.addEventListener('click', () => addComment(currentDealIdForComments, document.getElementById('detailCommentInput')?.value));
    document.getElementById('addContractorBtn')?.addEventListener('click', () => addContractorField());
    document.getElementById('addProductBtn')?.addEventListener('click', () => addProductField());
    document.getElementById('beforeDiscount')?.addEventListener('input', function() { formatNumberInput(this); calculateValueFromBeforeDiscount(); });
    document.getElementById('discount')?.addEventListener('input', calculateValueFromBeforeDiscount);
    document.getElementById('dealForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveDeal(); });
    
    const dealAttachmentFile = document.getElementById('dealAttachmentFile');
    if (dealAttachmentFile) dealAttachmentFile.addEventListener('change', async (e) => { if (e.target.files[0] && currentDealIdForComments) await uploadAttachmentForDeal(currentDealIdForComments, e.target.files[0]); });
    const detailAttachmentFile = document.getElementById('detailAttachmentFile');
    if (detailAttachmentFile) detailAttachmentFile.addEventListener('change', async (e) => { if (e.target.files[0] && currentDealIdForComments) await uploadAttachmentForDeal(currentDealIdForComments, e.target.files[0]); });
    
    facilitySelect = document.getElementById('facility');
    newFacilityInput = document.getElementById('newFacility');
    packageSelect = document.getElementById('package');
    newPackageInput = document.getElementById('newPackage');
    
    if (facilitySelect && newFacilityInput) {
        facilitySelect.addEventListener('change', () => { if (facilitySelect.value !== '') newFacilityInput.value = ''; });
        newFacilityInput.addEventListener('input', () => { if (newFacilityInput.value.trim() !== '') facilitySelect.value = ''; });
    }
    if (packageSelect && newPackageInput) {
        packageSelect.addEventListener('change', () => { if (packageSelect.value !== '') newPackageInput.value = ''; });
        newPackageInput.addEventListener('input', () => { if (newPackageInput.value.trim() !== '') packageSelect.value = ''; });
    }
    
    setupConsultantSearch();
    setupCommentAttachmentInput();
    setupDetailCommentAttachmentInput();
}

function logout() {
    auth.signOut().then(() => { window.location.href = 'login.html'; }).catch((error) => { console.error("Error logging out:", error); showToast("Gagal logout", 5000); });
}

// ==================== LOAD DEALS FROM FIREBASE ====================

async function loadDealsFromFirebase(forceRefresh = false) {
    if (forceRefresh) dealsByIdCache.clear();
    try {
        const querySnapshot = await dealsCollection.orderBy("createdAt", "desc").get();
        deals = [];
        uniqueContractors.clear();
        uniquePICs.clear();
        uniqueOwners.clear();
        uniqueProducts.clear();
        uniqueFacilities.clear();
        uniquePackages.clear();
        uniqueYears.clear();
        uniqueSales.clear();

        querySnapshot.forEach((doc) => {
            const dealData = doc.data();
            if (dealData.createdAt && !dealData.createdAt.toDate) {
                try { dealData.createdAt = firebase.firestore.Timestamp.fromDate(new Date(dealData.createdAt)); }
                catch(e) { console.warn("Could not convert createdAt for deal:", doc.id); }
            }
            if (!dealData.updatedAt) dealData.updatedAt = dealData.createdAt;
            const deal = { id: doc.id, ...dealData };
            deals.push(deal);
            dealsByIdCache.set(doc.id, deal);

            if (dealData.contractor) {
                if (Array.isArray(dealData.contractor)) dealData.contractor.forEach(c => { if (c) uniqueContractors.add(c); });
                else uniqueContractors.add(dealData.contractor);
            }
            if (dealData.pic) uniquePICs.add(dealData.pic);
            if (dealData.owner) uniqueOwners.add(dealData.owner);
            if (dealData.product) {
                if (Array.isArray(dealData.product)) dealData.product.forEach(p => { if (p) uniqueProducts.add(p); });
                else uniqueProducts.add(dealData.product);
            }
            if (dealData.facility) uniqueFacilities.add(dealData.facility);
            if (dealData.package) uniquePackages.add(dealData.package);
            if (dealData.salesName) uniqueSales.add(dealData.salesName);
            if (dealData.createdAt) {
                try {
                    let year;
                    if (dealData.createdAt.toDate) year = dealData.createdAt.toDate().getFullYear().toString();
                    else if (dealData.createdAt.seconds) year = new Date(dealData.createdAt.seconds * 1000).getFullYear().toString();
                    else year = new Date(dealData.createdAt).getFullYear().toString();
                    uniqueYears.add(year);
                } catch(e) {}
            }
        });
        
        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            const currentSales = getCurrentSalesName();
            if (currentSales) uniqueSales = new Set([currentSales]);
        }
        
        priorityStatsCache = { 'all': null, '2025': null, '2026': null };
        dealsByYearCache = { 'all': null, '2025': null, '2026': null };
        
        populateYearDropdown();
        populateFilterDropdowns();
        createPriorityDashboard();
        applyActiveFilters();
        await migrateOldComments();
    } catch (error) { console.error("Error loading deals:", error); showToast("Gagal memuat data deals", 3000); }
}

// ==================== AUTH STATE CHANGE ====================

auth.onAuthStateChanged(async (user) => {
    if (authInitialized) return;
    authInitialized = true;
    
    if (!user && window.location.pathname.includes('app.html')) { window.location.href = 'login.html'; return; }
    if (user && window.location.pathname.includes('login.html')) { window.location.href = 'app.html'; return; }

    if (user && window.location.pathname.includes('app.html')) {
        try {
            currentUserEmail = user.email;
            const migrationFlag = localStorage.getItem('comments_migration_completed');
            if (migrationFlag === 'true') commentsMigrationCompleted = true;
            
            const userWelcome = document.getElementById('userWelcome');
            if (userWelcome) userWelcome.textContent = user.email;

            if (managerEmails.includes(user.email)) {
                currentUserRole = (user.email === 'admin@genetek.co.id' || user.email === 'david@genetek.co.id') ? 'admin' : 'manager';
                await usersCollection.doc(user.uid).set({ role: currentUserRole, email: user.email }, { merge: true });
            } else {
                currentUserRole = 'user';
                const userDoc = await usersCollection.doc(user.uid).get();
                if (!userDoc.exists) await usersCollection.doc(user.uid).set({ role: 'user', email: user.email }, { merge: true });
                else currentUserRole = userDoc.data().role || 'user';
            }
            
            currentSalesName = getCurrentSalesName();
            
            loadStateFromLocalStorage();
            applyUserPermissions();
            await loadConsultantsFromFirebase();
            await loadDropdownOptions();
            setupRealtimeDeals();
            await loadActivitiesFromFirebase();
            initEventListeners();
            initViewToggle();
            initExportElements();
            initYearFilter();
            updateViewToggleUI();
            updateYearBadgeUI();
            
            if (currentUserRole === 'admin') loadRecycleBin();
        } catch (error) { console.error("Error in auth state:", error); showToast("Gagal memuat data pengguna", 5000); }
    }
});

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing application...");
    facilitySelect = document.getElementById('facility');
    newFacilityInput = document.getElementById('newFacility');
    packageSelect = document.getElementById('package');
    newPackageInput = document.getElementById('newPackage');
    consultantSearchInput = document.getElementById('consultantSearch');
    consultantHiddenInput = document.getElementById('consultant');
    consultantSuggestionsDiv = document.getElementById('consultantSuggestions');
});

// ==================== EKSPOR FUNGSI GLOBAL ====================
window.openDealDetailModal = openDealDetailModal;
window.closeActivityModal = closeActivityModal;
window.closeDealDetailModal = closeDealDetailModal;
window.closeDealModal = closeDealModal;
window.closeDeleteModal = closeDeleteModal;
window.closeFilterPanel = closeFilterPanel;
window.closeStatsModal = closeStatsModal;
window.closeRecycleBinModal = closeRecycleBinModal;
window.closePermanentDeleteModal = closePermanentDeleteModal;
window.closeEmptyRecycleBinModal = closeEmptyRecycleBinModal;
window.closeExportModal = closeExportModal;
window.closePriorityModal = closePriorityModal;
window.refreshCommentsForCurrentDeal = refreshCommentAttachments;
window.uploadAttachmentForDeal = uploadAttachmentForDeal;
window.uploadAttachmentForComment = uploadAttachmentForComment;

// ==================== AKHIR SCRIPT ====================
