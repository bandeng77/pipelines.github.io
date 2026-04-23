// ==================== FULL SCRIPT DENGAN UPLOAD FILE KE DROPBOX (VERSION 2) ====================
// File: app.js
// Sistem Komentar + Upload File (PDF/Foto) ke Dropbox
// Mengadaptasi pola upload yang berhasil dari SpeakUp

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

// Konfigurasi Dropbox (menggunakan token baru yang berfungsi seperti di SpeakUp)
const DROPBOX_CONFIG = {
    appKey: '9nb74swzwdyqo5r',
    accessToken: 'sl.u.AGat4kePnTDmanB1vxmDz07xJDsQPcmeFdRvdC7z22MIBpukRgtu6CxYPHB4ve0yUWp6xw0Jk3qiXFo31n1ia_WUkaSdMxY4fTXxu7CmyDEszB7BcZHZFYhcDpKcdKtTLTs7UWR3lCTaRZnDZD253gEHolWWNI0WzeugnP0qvMhUBBVeQOOJqw-ERSquFjqvOD8bam2Es-mUPfsvOOn1jgVff5YhKcJSs7HOZv0Ktd2uBAOQ-U2ITjoQ5sbsareZMSfzNHUWVykEk1jXQrKrZ7yZd1EqmMplcq9hMBiSOVeDPQAyZbcwa2d_zZnel5QMB6S8cFPMRrmb7knAN2ZPLVztH5O1aspiMzifYGrUKgPTS0Dd63DNqNHn40vvjdRvigtztVwbMEPiMxrzJufOPsgSAwq0DigsdNsI5LWZBKWCKGGgg83dA9xEbM9T4_GjgtLb8w3CjkB9n6nWbuTV4sCtoEktxtDppfW1RDoJBCV3gemcg99pHzf7--qHDMzYKG4ZbNxh-74DGmIQPAYSB0ue61aJFOAxYrSuhNmhKgo1Kg6MDaNPNoJ4eKq-EgPodTVyXxkuaf4rYLRnoQoUeXxyRe8Sarj416rz13CjDpuJoK4rzPbAbFC0ott43a9GyNJ6_dMXILNz1IMtqmWCblOxSZhQYednyl6OPXC9CnmARbjsv6yODMkyn9OGCrC0VWWt2uATgIGvoErfiWf-TZXdT-KoCV9eLjwgvBeRt6Dekyii291PfqKDyCKk2IUJvf0eH8J_3wHh2R0nqGL3f_04y1B74kvvxr5me6Fkts8YXRN6iVzIXy_y7WpS1SDgl3UaG6OyiZhn6J06lYfQyD_-5h5GkjCsYMjSOOnXSaHoCdnrTXmoVbaeX8H1WFJUsFIevfsvinTqls9XUpsFhTXouGg0DQUPHOJDgjGxbbzMJlFLFRxGfhtaA14YCu281dyCSZxlz5Y3gk50H87Dyy6YlsDw1CJU9Keq7bSk1v9ggYBM60W9E9fcBaReKnkuLGXAe6N3VokYRA2jSR0A15u4Yy97RiGzfmN0IdOWhWElwdr_kwMKC4KmSFRK9Az_fcOdANttZ8rCPL2z-FmwG3kJJL3qkQNX1XYWCkyQP_nIOHir96wIEhlPPoZcj_79WL9Gh0vzZYJUDVlyqrDM5BdoIktvaTbAhO2c10-XDnMFEAXyaeWdRMQpB9Tx7hzqj3Xe4H3-s9IY5Bhv0SDEgil9Q5gz6Bh_dNVqBXSzqrbpjWzGu0lnWH9GklxnC5NLDSf9k90Hsxmou2X9CDW9SWws3QHRXXnix8RtE8-64nkhZkZdqtFcM85-RXKFoJCWTPk',
    appFolderName: 'owncloud-efk'
};

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

// Variabel untuk menyimpan daftar unik
let uniqueConsultants = new Set();
let uniqueContractors = new Set();
let uniquePICs = new Set();
let uniqueOwners = new Set();
let uniqueProducts = new Set();
let uniqueFacilities = new Set();
let uniquePackages = new Set();
let uniqueYears = new Set();
let uniqueSales = new Set();

// FILTER TAHUN AKTIF
let activeYear = 'all';

// Cache untuk priority stats per tahun
let priorityStatsCache = {
    'all': null,
    '2025': null,
    '2026': null
};

// Cache untuk data per tahun
let dealsByYearCache = {
    'all': null,
    '2025': null,
    '2026': null
};

// Cache untuk aktivitas
let activitiesCache = {
    data: [],
    lastFetch: null
};

// Flag untuk migrasi komentar
let commentsMigrationCompleted = false;

const CACHE_DURATION = 5 * 60 * 1000; // 5 menit

// Deklarasi variabel elemen DOM
let facilitySelect, newFacilityInput;
let packageSelect, newPackageInput;
let consultantSearchInput, consultantHiddenInput, consultantSuggestionsDiv;

// Variabel untuk menyimpan preferensi tampilan
let currentView = 'card';

// Variabel untuk menyimpan filter yang sedang aktif
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

// Mapping email ke nama sales
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

// Reverse mapping dari nama sales ke email
const salesNameToEmailMap = {};
Object.entries(emailToSalesNameMap).forEach(([email, name]) => {
    salesNameToEmailMap[name] = email;
});

// Daftar email manager
const managerEmails = [
    'hadi@genetek.co.id',
    'david@genetek.co.id',
    'crenata@genetek.co.id',
    'agoesdh@genetek.co.id',
    'yib_wahyu@genetek.co.id',
    'satriopk@genetek.co.id',
    'admin@genetek.co.id'
];

// Variabel untuk chart tambahan
let salesCharts = {
    salesStageChart: null,
    salesPriorityChart: null,
    salesTimelineChart: null,
    priorityStageChart: null,
    prioritySalesChart: null,
    priorityTimelineChart: null
};

// Variabel untuk menyimpan deal yang sedang dilihat komentarnya
let currentDealIdForComments = null;
let currentProjectNameForComments = null;

// Variabel untuk menyimpan pilihan sales aktif per project name
let activeSalesPerProject = {};

// Variabel untuk menyimpan state activity modal
let activityModalState = {
    isOpen: false,
    scrollPosition: 0
};

// Cache untuk data deal berdasarkan ID
let dealsByIdCache = new Map();

// Variabel untuk deal yang akan dihapus
let dealToDeleteId = null;
let dealToDeleteName = '';

// Flag untuk mencegah multiple click
let isActivityModalOpening = false;

// ==================== FUNGSI DROPBOX UPLOAD (DARI SPEAKUP) ====================

/**
 * Upload file ke Dropbox - Mengadaptasi pola dari SpeakUp yang berhasil
 * @param {File} file - File yang akan diupload
 * @param {string} reportId - ID unik untuk folder
 * @returns {Promise<Object>} - Hasil upload dengan link download
 */
async function uploadToDropbox(file, reportId) {
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const dropboxPath = `/${DROPBOX_CONFIG.appFolderName}/deals/${reportId}/${timestamp}_${safeFileName}`;
    
    try {
        // Baca file sebagai ArrayBuffer (sama seperti SpeakUp)
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Upload ke Dropbox
        const uploadResp = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DROPBOX_CONFIG.accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({ 
                    path: dropboxPath, 
                    mode: 'add', 
                    autorename: true 
                })
            },
            body: uint8Array
        });
        
        if (!uploadResp.ok) {
            const errorText = await uploadResp.text();
            console.error('Upload error:', errorText);
            throw new Error('Upload Dropbox gagal');
        }
        
        await uploadResp.json();
        
        // Dapatkan shared link
        let shareLink = null;
        try {
            const shareResp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${DROPBOX_CONFIG.accessToken}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    path: dropboxPath, 
                    settings: { 
                        requested_visibility: "viewer_only", 
                        audience: "public" 
                    } 
                })
            });
            
            if (shareResp.ok) {
                const shareData = await shareResp.json();
                shareLink = shareData.url.replace('?dl=0', '?dl=1');
            } else {
                // Coba list shared links yang sudah ada
                const listResp = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${DROPBOX_CONFIG.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ path: dropboxPath })
                });
                if (listResp.ok) {
                    const listData = await listResp.json();
                    if (listData.links && listData.links.length > 0) {
                        shareLink = listData.links[0].url.replace('?dl=0', '?dl=1');
                    }
                }
            }
        } catch(e) { 
            console.warn('Could not create shared link:', e); 
        }
        
        return { 
            success: true, 
            name: file.name, 
            size: file.size, 
            type: file.type,
            downloadUrl: shareLink || `Dropbox: ${dropboxPath}`,
            path: dropboxPath
        };
        
    } catch (error) {
        console.error('Error uploading to Dropbox:', error);
        return { success: false, name: file.name, error: error.message };
    }
}

/**
 * Hapus file dari Dropbox
 * @param {string} path - Path file di Dropbox
 */
async function deleteFromDropbox(path) {
    try {
        const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DROPBOX_CONFIG.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ path: path })
        });
        
        if (!response.ok) {
            console.warn('Failed to delete file from Dropbox:', await response.json());
        }
        return response.ok;
    } catch (error) {
        console.error('Error deleting from Dropbox:', error);
        return false;
    }
}

/**
 * Simpan attachment ke Firestore
 * @param {Object} attachmentData - Data attachment
 */
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

/**
 * Hapus attachment dari Firestore dan Dropbox
 * @param {string} attachmentId - ID attachment
 * @param {string} dropboxPath - Path di Dropbox
 */
async function deleteAttachment(attachmentId, dropboxPath) {
    try {
        if (dropboxPath) {
            await deleteFromDropbox(dropboxPath);
        }
        await attachmentsCollection.doc(attachmentId).delete();
        showToast('Attachment berhasil dihapus', 2000);
        
        if (currentDealIdForComments) {
            await loadAttachmentsForDeal(currentDealIdForComments);
            renderAttachments(document.getElementById('dealAttachmentsList'), currentDealIdForComments);
            renderAttachments(document.getElementById('detailAttachmentsList'), currentDealIdForComments);
        }
        await refreshCommentAttachments();
    } catch (error) {
        console.error('Error deleting attachment:', error);
        showToast('Gagal menghapus attachment', 3000);
    }
}

/**
 * Load attachments untuk sebuah deal
 * @param {string} dealId - ID deal
 */
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

/**
 * Render attachment ke container dengan preview
 * @param {HTMLElement} container - Container untuk menampilkan attachment
 * @param {string} dealId - ID deal
 */
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
        const fileIcon = isImage ? 'fa-image' : 
                        isPdf ? 'fa-file-pdf' : 'fa-file';
        const fileColor = isImage ? 'text-blue-500' : 
                         isPdf ? 'text-red-500' : 'text-gray-500';
        
        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'attachment-item bg-gray-50 rounded-lg p-2 mb-2 flex items-center justify-between hover:bg-gray-100 transition';
        
        let previewHtml = '';
        if (attachment.downloadUrl && (isImage || isPdf)) {
            previewHtml = `
                <button class="preview-attachment-btn text-blue-500 hover:text-blue-700 p-1" data-url="${attachment.downloadUrl}" data-name="${escapeHtml(attachment.name)}" data-type="${isImage ? 'image' : 'pdf'}">
                    <i class="fas fa-eye"></i>
                </button>
            `;
        }
        
        attachmentDiv.innerHTML = `
            <div class="flex items-center space-x-3 flex-1 min-w-0">
                <i class="fas ${fileIcon} ${fileColor} text-lg"></i>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate" title="${escapeHtml(attachment.name)}">${escapeHtml(attachment.name)}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(attachment.size)} • ${formatDateTime(attachment.createdAt)}</p>
                    <p class="text-xs text-gray-400">Upload oleh: ${escapeHtml(attachment.uploadedBy || '-')}</p>
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

/**
 * Preview attachment dalam modal
 */
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

/**
 * Upload attachment untuk deal
 * @param {string} dealId - ID deal
 * @param {File} file - File yang akan diupload
 */
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
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) {
                deal = { id: dealDoc.id, ...dealDoc.data() };
            }
        }
        
        const projectName = deal?.dealName || 'unknown';
        const reportId = `${dealId}_${Date.now()}`;
        
        const uploadResult = await uploadToDropbox(file, reportId);
        
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
            
            await renderAttachments(document.getElementById('dealAttachmentsList'), dealId);
            await renderAttachments(document.getElementById('detailAttachmentsList'), dealId);
            await refreshCommentAttachments();
            
            return true;
        } else {
            throw new Error(uploadResult.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Error uploading attachment:', error);
        showToast('Gagal mengupload file: ' + error.message, 3000);
        return false;
    }
}

/**
 * Format ukuran file
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== FUNGSI UPLOAD ATTACHMENT UNTUK KOMENTAR ====================

let currentCommentAttachmentFile = null;

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
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) {
                deal = { id: dealDoc.id, ...dealDoc.data() };
            }
        }
        
        const projectName = deal?.dealName || 'unknown';
        const reportId = `comment_${dealId}_${Date.now()}`;
        
        const uploadResult = await uploadToDropbox(file, reportId);
        
        if (uploadResult.success) {
            const attachmentData = {
                dealId: dealId,
                projectName: projectName,
                fileName: file.name,
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
            throw new Error(uploadResult.error || 'Upload failed');
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
                                <div class="relative inline-block">
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
                            <div class="relative inline-block">
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
                                <div class="relative inline-block">
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
                            <div class="relative inline-block">
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
                if (comment.timestamp.toDate) timeStr = formatDateTime(comment.timestamp);
                else if (comment.timestamp.seconds) timeStr = formatDateTime(new Date(comment.timestamp.seconds * 1000));
                else timeStr = formatDateTime(comment.timestamp);
            } catch(e) { timeStr = '-'; }
        }
        
        let attachmentHtml = '';
        if (comment.attachmentInfo && comment.attachmentInfo.downloadUrl) {
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
        
        let attachmentUrl = null, attachmentInfo = null;
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
        const matchesSearch = activeFilters.searchTerm === '' || 
            (deal.dealName && deal.dealName.toLowerCase().includes(activeFilters.searchTerm)) ||
            (deal.salesName && deal.salesName.toLowerCase().includes(activeFilters.searchTerm)) ||
            (deal.consultant && deal.consultant.toLowerCase().includes(activeFilters.searchTerm));
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
        
        return matchesSearch && matchesPriority && matchesStage && matchesSales && matchesConsultant && matchesContractor && matchesProduct && matchesFacility && matchesPackage;
    });
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
            maxValueByProjectName.set(projectName, Math.max(...activeProjects.map(d => d.value || 0)));
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
            let displayValue, hasHigherValueFromOtherPriority = false;
            if (isLastProject) {
                displayValue = deal.value || 0;
            } else {
                const highestValue = maxValueByProjectName.get(projectName) || 0;
                displayValue = highestValue;
                hasHigherValueFromOtherPriority = (deal.value || 0) < highestValue;
            }
            const newDeal = { ...deal, hasMultipleEntries: duplicateDeals.length > 1, totalEntries: duplicateDeals.length, allEntries: duplicateDeals, displayValue, hasHigherValueFromOtherPriority, isLastActiveProject: isLastProject, activeProjectsCount };
            uniqueProjects.push(newDeal);
        });
    });
    
    const seenIds = new Set();
    return uniqueProjects.filter(project => {
        if (seenIds.has(project.id)) return false;
        seenIds.add(project.id);
        return true;
    });
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
        activeFilters.year = year;
        applyActiveFilters();
        createPriorityDashboard();
        showToast(`Menampilkan data tahun ${year === 'all' ? 'semua tahun' : year}`, 2000);
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
            let dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : (deal.createdAt.seconds ? new Date(deal.createdAt.seconds * 1000) : new Date(deal.createdAt));
            if (isNaN(dealDate.getTime())) return false;
            return dealDate.getFullYear().toString() === year;
        } catch (e) { return false; }
    });
    if (baseDeals === null) dealsByYearCache[year] = filtered;
    return filtered;
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
                    if (deal && deal.dealName) {
                        dealName = deal.dealName;
                        dealNameToProjectKey.set(commentData.dealId, dealName);
                    }
                } else {
                    dealName = dealNameToProjectKey.get(commentData.dealId);
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
        }
        commentsMigrationCompleted = true;
        localStorage.setItem('comments_migration_completed', 'true');
    } catch (error) { console.error("Error saat migrasi komentar:", error); }
}

async function loadCommentsByProjectName(dealId) {
    try {
        let deal = getDealById(dealId) || deals.find(d => d.id === dealId);
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) deal = { id: dealDoc.id, ...dealDoc.data() };
        }
        if (!deal || !deal.dealName) return [];
        
        const projectKey = getProjectKey(deal.dealName);
        const querySnapshot = await commentsCollection.where('projectKey', '==', projectKey).orderBy('timestamp', 'asc').get();
        const comments = [];
        querySnapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp }));
        
        if (comments.length === 0) {
            const oldCommentsSnapshot = await commentsCollection.where('dealId', '==', dealId).orderBy('timestamp', 'asc').get();
            const oldComments = [];
            oldCommentsSnapshot.forEach(doc => oldComments.push({ id: doc.id, ...doc.data(), timestamp: doc.data().timestamp }));
            if (oldComments.length > 0) {
                const batch = db.batch();
                for (const comment of oldComments) batch.update(commentsCollection.doc(comment.id), { projectKey: projectKey, projectName: deal.dealName });
                await batch.commit();
                return oldComments;
            }
        }
        return comments;
    } catch (error) { console.error("Error loading comments:", error); return []; }
}

async function deleteComment(commentId) {
    if (!commentId) return showToast("Komentar tidak ditemukan", 3000);
    try {
        await commentsCollection.doc(commentId).delete();
        showToast("Komentar berhasil dihapus", 2000);
        if (currentDealIdForComments) {
            const comments = await loadCommentsByProjectName(currentDealIdForComments);
            renderComments(comments, 'detailCommentsList');
            if (document.getElementById('commentsList')) renderComments(comments, 'commentsList');
        }
    } catch (error) { console.error("Error deleting comment:", error); showToast("Gagal menghapus komentar", 3000); }
}

async function refreshCommentsForCurrentDeal() {
    if (currentDealIdForComments) {
        const comments = await loadCommentsByProjectName(currentDealIdForComments);
        renderComments(comments, 'detailCommentsList');
        if (document.getElementById('commentsList')) renderComments(comments, 'commentsList');
    }
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
        await dropdownOptionsCollection.doc('options').set({ facilities: Array.from(uniqueFacilities), packages: Array.from(uniquePackages), owners: Array.from(uniqueOwners), pics: Array.from(uniquePICs), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (error) { console.error("Error saving dropdown options:", error); }
}

async function deleteDropdownOption(field, value) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') return showToast("Hanya admin dan manager yang dapat menghapus opsi dropdown", 3000);
    try {
        switch (field) {
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
        const currentValue = facilitySelect.value;
        facilitySelect.innerHTML = `<option value="">Pilih Fasilitas</option><option value="Industrial">Industrial</option><option value="Office">Office</option><option value="Hotel">Hotel</option><option value="Data Center">Data Center</option><option value="Oil & Gas">Oil & Gas</option><option value="Warehouse">Warehouse</option><option value="Other">Other</option>`;
        Array.from(uniqueFacilities).sort().forEach(value => {
            if (value && !['Industrial', 'Office', 'Hotel', 'Data Center', 'Oil & Gas', 'Warehouse', 'Other'].includes(value)) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                facilitySelect.appendChild(option);
            }
        });
        facilitySelect.value = currentValue;
    }
    if (packageSelect) {
        const currentValue = packageSelect.value;
        packageSelect.innerHTML = `<option value="">Pilih Paket</option><option value="Electronic Package">Electronic Package</option><option value="M&E">M&E</option><option value="Fire Fighting Cont">Fire Fighting Cont</option><option value="Main Kontraktor">Main Kontraktor</option>`;
        Array.from(uniquePackages).sort().forEach(value => {
            if (value && !['Electronic Package', 'M&E', 'Fire Fighting Cont', 'Main Kontraktor'].includes(value)) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                packageSelect.appendChild(option);
            }
        });
        packageSelect.value = currentValue;
    }
    populateDropdown('owner', uniqueOwners);
    populateDropdown('pic', uniquePICs);
}

// ==================== PRIORITY DASHBOARD ====================

function calculatePriorityStats(year) {
    if (priorityStatsCache[year]) return priorityStatsCache[year];
    const yearDeals = getDealsByYear(year);
    const uniqueProjects = getUniqueProjectsForDashboard(filterDealsByUser(yearDeals));
    const priorityStats = { 'Hot Priority': { count: 0, value: 0, deals: [] }, 'Priority': { count: 0, value: 0, deals: [] }, 'Win': { count: 0, value: 0, deals: [] }, 'Behind': { count: 0, value: 0, deals: [] }, 'On Track': { count: 0, value: 0, deals: [] } };
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
        card.innerHTML = `<div class="priority-header"><div class="priority-title"><i class="fas ${priority.icon}"></i><span>${priority.key}</span></div><div class="priority-count">${stats.count}</div></div><div class="priority-value">Rp ${formatNumber(stats.value)}</div>`;
        priorityDashboard.appendChild(card);
    });
    document.querySelectorAll('.priority-card').forEach(card => {
        card.addEventListener('click', function() { openPriorityModal(this.dataset.priority, priorityStats[this.dataset.priority].deals); });
    });
}

function openPriorityModal(priority, deals) {
    const modal = document.getElementById('priorityModal');
    const modalTitle = document.getElementById('priorityModalTitleText');
    const modalContent = document.getElementById('priorityModalContent');
    if (!modal || !modalTitle || !modalContent) return;
    const yearText = activeYear === 'all' ? 'Semua Tahun' : `Tahun ${activeYear}`;
    const userText = (currentUserRole === 'admin' || currentUserRole === 'manager') ? '' : ` - ${currentSalesName || currentUserEmail}`;
    modalTitle.textContent = `${priority} Projects (${yearText})${userText}`;
    modalContent.innerHTML = '';
    if (deals.length === 0) {
        modalContent.innerHTML = `<div class="text-center text-gray-500 py-8"><i class="fas fa-inbox text-3xl mb-2"></i><p>Tidak ada project dengan priority "${priority}" untuk ${yearText}</p></div>`;
    } else {
        const sortedDeals = [...deals].sort((a, b) => {
            const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
            const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
            return dateB - dateA;
        });
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200';
        table.innerHTML = `<thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Project</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahap</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">${sortedDeals.map((deal, index) => {
            const displayValue = deal.displayValue || deal.value || 0;
            const originalValue = deal.value || 0;
            const hasHigherValue = deal.hasHigherValueFromOtherPriority;
            const isLastProject = deal.isLastActiveProject;
            const lastUpdateDate = deal.updatedAt ? formatDateTime(deal.updatedAt) : (deal.createdAt ? formatDateTime(deal.createdAt) : '-');
            let valueDisplay = `Rp ${formatNumber(displayValue)}`;
            let valueTooltip = '';
            if (isLastProject) valueTooltip = `Nilai asli: Rp ${formatNumber(originalValue)} (hanya 1 project aktif)`;
            else if (hasHigherValue) { valueTooltip = `Nilai asli: Rp ${formatNumber(originalValue)} - Menampilkan nilai tertinggi dari project ini`; valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`; }
            return `<tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}"><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(deal.dealName || 'No Name')}${hasHigherValue && !isLastProject ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"><i class="fas fa-arrow-up mr-1"></i>Nilai Tertinggi</span>` : ''}${isLastProject ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><i class="fas fa-star mr-1"></i>Project Terakhir</span>` : ''}${deal.hasMultipleEntries ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title="${deal.totalEntries} entries untuk kombinasi ini"><i class="fas fa-copy mr-1"></i>${deal.totalEntries}x</span>` : ''}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(deal.salesName || '-')}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold" title="${valueTooltip}">${valueDisplay}</td><td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${deal.stage === 'win' ? 'bg-green-100 text-green-800' : deal.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><i class="fas fa-clock text-gray-400 mr-1"></i>${lastUpdateDate}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium"><button class="text-blue-600 hover:text-blue-900 mr-3 view-detail-btn" data-id="${deal.id}"><i class="fas fa-eye"></i></button>${deal.hasMultipleEntries ? `<button class="text-purple-600 hover:text-purple-900 view-all-entries-btn" data-deal-name="${escapeHtml(deal.dealName)}" data-priority="${deal.priority}" title="Lihat semua entries untuk priority ini"><i class="fas fa-list"></i></button>` : ''}</td></tr>`;
        }).join('')}</tbody></table>`;
        modalContent.appendChild(table);
        modalContent.querySelectorAll('.view-detail-btn, .view-detail-row').forEach(element => {
            element.addEventListener('click', function(e) { e.stopPropagation(); const dealId = element.tagName === 'TR' ? element.dataset.id : element.dataset.id; closePriorityModal(); openDealDetailModal(dealId); });
        });
        modalContent.querySelectorAll('.view-all-entries-btn').forEach(btn => {
            btn.addEventListener('click', function(e) { e.stopPropagation(); closePriorityModal(); showAllEntriesForProject(this.dataset.dealName, this.dataset.priority); });
        });
    }
    modal.classList.remove('hidden');
}

function closePriorityModal() { const modal = document.getElementById('priorityModal'); if (modal) modal.classList.add('hidden'); }

function showAllEntriesForProject(dealName, priority) {
    const allEntries = deals.filter(deal => deal.dealName?.trim() === dealName && deal.priority === priority);
    if (allEntries.length === 0) return showToast("Tidak ada entries ditemukan", 3000);
    const sortedEntries = [...allEntries].sort((a, b) => {
        const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
        const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
        return dateB - dateA;
    });
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.id = 'allEntriesModal';
    modal.innerHTML = `<div class="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden"><div class="flex justify-between items-center p-4 border-b"><h2 class="text-xl font-semibold text-gray-800">Semua Entries untuk Project: ${escapeHtml(dealName)} (Priority: ${priority})</h2><button class="close-all-entries text-gray-500 hover:text-gray-700"><i class="fas fa-times text-2xl"></i></button></div><div class="p-4 overflow-y-auto max-h-[calc(90vh-80px)]"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahap</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">${sortedEntries.map((entry, index) => `<tr class="hover:bg-gray-50"><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(entry.salesName || '-')}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">Rp ${formatNumber(entry.value) || '0'}</td><td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${entry.stage === 'win' ? 'bg-green-100 text-green-800' : entry.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">${entry.stage ? entry.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(entry.createdAt)}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><i class="fas fa-clock text-gray-400 mr-1"></i>${entry.updatedAt ? formatDateTime(entry.updatedAt) : formatDateTime(entry.createdAt)}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium"><button class="text-blue-600 hover:text-blue-900 view-detail-btn" data-id="${entry.id}"><i class="fas fa-eye"></i></button></td></tr>`).join('')}</tbody></table></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.close-all-entries').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelectorAll('.view-detail-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const dealId = btn.dataset.id; modal.remove(); openDealDetailModal(dealId); }); });
}

// ==================== PROGRESS BAR ====================

function updateProgressBarFromStage(stage) {
    let progress = 0, isOnHold = false;
    switch (stage) {
        case 'identified': progress = 20; break;
        case 'prospect': progress = 40; break;
        case 'tender-me': progress = 60; break;
        case 'tender-main-con': case 'contract-award': progress = 80; break;
        case 'win': case 'lost': progress = 100; break;
        case 'on-hold': progress = 0; isOnHold = true; break;
        default: progress = 0;
    }
    updateProgressBarUI(progress, isOnHold);
}

function updateProgressBarUI(progress, isOnHold = false) {
    const progressPercentage = document.getElementById('progressPercentage');
    const progressFill = document.getElementById('progressFill');
    if (!progressPercentage || !progressFill) return;
    progressPercentage.textContent = `${progress}%`;
    progressFill.style.width = `${progress}%`;
    if (isOnHold) { progressFill.classList.add('onhold'); progressPercentage.style.color = '#ef4444'; }
    else { progressFill.classList.remove('onhold'); progressPercentage.style.color = '#3b82f6'; }
    updateCheckpoints(progress, isOnHold);
}

function updateCheckpoints(progress, isOnHold = false) {
    const checkpoints = document.querySelectorAll('.checkpoint');
    checkpoints.forEach(checkpoint => {
        const checkpointValue = parseInt(checkpoint.dataset.percentage);
        const stepDot = checkpoint.querySelector('.step-dot');
        const stepLabel = checkpoint.querySelector('.checkpoint-value');
        if (progress >= checkpointValue) {
            if (isOnHold) { stepDot.classList.add('onhold'); stepLabel.classList.add('onhold'); checkpoint.classList.add('onhold'); }
            else { stepDot.classList.add('completed'); stepLabel.classList.add('active'); checkpoint.classList.add('active'); }
        } else {
            stepDot.classList.remove('completed', 'active', 'onhold');
            stepLabel.classList.remove('active', 'onhold');
            checkpoint.classList.remove('active', 'onhold');
        }
    });
}

// ==================== MERGE PROJECT DALAM DEAL CARD ====================

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
    if (!activeDeal) { activeDeal = firstDeal; activeSales = firstDeal.salesName; activeSalesPerProject[key] = activeSales; }
    const allProjectDeals = deals.filter(deal => deal.dealName?.trim().toLowerCase() === dealNameLower);
    const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
    const isLastProject = activeProjects.length === 1;
    let displayValue = isLastProject ? (activeProjects[0]?.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
    const hasMultipleSales = dealGroup.length > 1;
    const salesNames = [...new Set(dealGroup.map(deal => deal.salesName))];
    const mergedProjectsInfo = identifyMergedProjects(deals);
    const hasDifferentPriorities = mergedProjectsInfo[dealNameLower] && mergedProjectsInfo[dealNameLower].count > 1;
    const otherPriorities = hasDifferentPriorities ? mergedProjectsInfo[dealNameLower].priorities.filter(p => p !== priority) : [];
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card';
    dealCard.dataset.id = activeDeal.id;
    dealCard.dataset.dealName = dealNameLower;
    dealCard.dataset.priority = priority;
    dealCard.dataset.allDeals = JSON.stringify(dealGroup.map(d => d.id));
    dealCard.dataset.displayValue = displayValue;
    dealCard.dataset.isLastProject = isLastProject;
    let stageColorClass = '';
    switch (activeDeal.stage) {
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
    const valueIsFromOtherPriority = (!isLastProject && (activeDeal.value || 0) < displayValue);
    let salesSelectorHTML = '';
    if (hasMultipleSales && salesNames.length > 1 && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
        salesSelectorHTML = `<div class="multiple-sales-indicator" title="${salesNames.length} sales bekerja pada project ini">${salesNames.length}</div><div class="sales-dropdown" id="sales-dropdown-${activeDeal.id}">${salesNames.map(salesName => `<div class="sales-dropdown-item ${salesName === activeSales ? 'active' : ''}" data-sales="${salesName}" data-deal-name="${dealNameLower}" data-priority="${priority}">${salesName}</div>`).join('')}</div>`;
    }
    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
    let valueTooltip = '';
    if (isLastProject) valueTooltip = `Nilai asli: Rp ${formatNumber(activeDeal.value || 0)} (hanya 1 project aktif)`;
    else if (valueIsFromOtherPriority) { valueTooltip = `Nilai asli: Rp ${formatNumber(activeDeal.value || 0)} - Menampilkan nilai tertinggi dari project ini`; valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`; }
    dealCard.innerHTML = `<div class="flex justify-between items-start"><h3 class="font-bold text-gray-800">${escapeHtml(dealName || 'No Name')}</h3><span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">${priority}</span></div>${salesSelectorHTML}<div class="mt-1 text-sm text-gray-600 deal-details"><p><i class="fas fa-user-tie mr-1"></i> ${escapeHtml(activeSales)}</p><p class="font-semibold text-blue-600" title="${valueTooltip}">${valueDisplay}</p><p class="mt-1"><span class="priority-badge px-2 py-1 rounded-full ${stageColorClass}">${activeDeal.stage ? activeDeal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage'}</span></p></div><div class="mt-2 flex justify-between items-center deal-footer"><span class="text-xs text-gray-500">Dibuat: ${formatDate(activeDeal.createdAt)}${hasMultipleSales ? `<span class="ml-1 text-yellow-600" title="${dealGroup.length} entries untuk priority ini"><i class="fas fa-copy"></i> ${dealGroup.length}</span>` : ''}${hasDifferentPriorities ? `<span class="ml-1 text-purple-600" title="Project juga tersedia di priority: ${otherPriorities.join(', ')}"><i class="fas fa-tags"></i> ${otherPriorities.length}+</span>` : ''}${isLastProject ? `<span class="ml-1 text-green-600" title="Hanya 1 project aktif yang tersisa"><i class="fas fa-star"></i></span>` : ''}</span><div class="flex space-x-1 deal-actions"><button class="view-detail-btn text-blue-600 hover:text-blue-800"><i class="fas fa-eye"></i></button>${canEdit ? `<button class="edit-deal-btn text-green-600 hover:text-green-800"><i class="fas fa-edit"></i></button><button class="delete-deal-btn text-red-600 hover:text-red-800"><i class="fas fa-trash-alt"></i></button>` : ''}</div></div>`;
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
            indicator.addEventListener('click', function(e) { e.stopPropagation(); dropdown.classList.toggle('show'); });
            dropdown.querySelectorAll('.sales-dropdown-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const selectedSales = this.dataset.sales;
                    const dealName = this.dataset.dealName;
                    const priority = this.dataset.priority;
                    const key = `${dealName}|${priority}`;
                    activeSalesPerProject[key] = selectedSales;
                    const allDealCards = document.querySelectorAll(`.deal-card[data-deal-name="${dealName}"][data-priority="${priority}"]`);
                    allDealCards.forEach(card => {
                        const selectedDeal = dealGroup.find(deal => deal.salesName === selectedSales);
                        if (selectedDeal) {
                            const allProjectDeals = deals.filter(d => d.dealName?.trim().toLowerCase() === dealName);
                            const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
                            const isLastProject = activeProjects.length === 1;
                            let displayValue = isLastProject ? (selectedDeal.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
                            const salesNameElement = card.querySelector('.deal-details p:first-child');
                            const valueElement = card.querySelector('.deal-details p.font-semibold');
                            const stageElement = card.querySelector('.priority-badge:last-child');
                            const priorityElement = card.querySelector('.priority-badge:first-child');
                            const dateElement = card.querySelector('.text-xs');
                            if (salesNameElement) salesNameElement.innerHTML = `<i class="fas fa-user-tie mr-1"></i> ${escapeHtml(selectedSales)}`;
                            if (valueElement) {
                                let valueDisplay = `Rp ${formatNumber(displayValue)}`;
                                if (!isLastProject && (selectedDeal.value || 0) < displayValue) valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
                                valueElement.innerHTML = valueDisplay;
                                let tooltip = '';
                                if (isLastProject) tooltip = `Nilai asli: Rp ${formatNumber(selectedDeal.value || 0)} (hanya 1 project aktif)`;
                                else if ((selectedDeal.value || 0) < displayValue) tooltip = `Nilai asli: Rp ${formatNumber(selectedDeal.value || 0)} - Menampilkan nilai tertinggi dari project ini`;
                                valueElement.title = tooltip;
                            }
                            if (stageElement) {
                                let stageColorClass = '';
                                switch (selectedDeal.stage) {
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
                                stageElement.className = `priority-badge px-2 py-1 rounded-full ${stageColorClass}`;
                                stageElement.textContent = selectedDeal.stage ? selectedDeal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage';
                            }
                            if (priorityElement) { priorityElement.className = `priority-badge px-2 py-1 rounded-full ${getPriorityBadgeClass(selectedDeal.priority)}`; priorityElement.textContent = selectedDeal.priority || 'Priority'; }
                            if (dateElement) {
                                let dateHTML = `Dibuat: ${formatDate(selectedDeal.createdAt)}`;
                                if (dealGroup.length > 1) dateHTML += `<span class="ml-1 text-yellow-600"><i class="fas fa-copy"></i> ${dealGroup.length}</span>`;
                                if (isLastProject) dateHTML += `<span class="ml-1 text-green-600"><i class="fas fa-star"></i></span>`;
                                dateElement.innerHTML = dateHTML;
                            }
                            card.dataset.id = selectedDeal.id;
                            card.dataset.displayValue = displayValue;
                            card.dataset.isLastProject = isLastProject;
                        }
                    });
                    dropdown.querySelectorAll('.sales-dropdown-item').forEach(i => i.classList.remove('active'));
                    this.classList.add('active');
                    dropdown.classList.remove('show');
                    showToast(`Menampilkan data untuk sales: ${selectedSales}`, 2000);
                });
            });
        }
    }
    document.addEventListener('click', function(e) { if (hasMultipleSales && dealCard && !dealCard.contains(e.target)) { const dropdown = dealCard.querySelector('.sales-dropdown'); if (dropdown) dropdown.classList.remove('show'); } });
}

function renderIndividualDealCard(deal) {
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card';
    dealCard.dataset.id = deal.id;
    dealCard.dataset.dealName = deal.dealName?.toLowerCase();
    dealCard.dataset.priority = deal.priority || 'Priority';
    const allProjectDeals = deals.filter(d => d.dealName?.trim().toLowerCase() === deal.dealName?.trim().toLowerCase());
    const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
    const isLastProject = activeProjects.length === 1;
    let displayValue = isLastProject ? (deal.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
    const mergedProjectsInfo = identifyMergedProjects(deals);
    const dealNameLower = deal.dealName?.toLowerCase().trim();
    const hasDifferentPriorities = mergedProjectsInfo[dealNameLower] && mergedProjectsInfo[dealNameLower].count > 1;
    const otherPriorities = hasDifferentPriorities ? mergedProjectsInfo[dealNameLower].priorities.filter(p => p !== (deal.priority || 'Priority')) : [];
    let stageColorClass = '';
    switch (deal.stage) {
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
    const valueIsFromOtherPriority = (!isLastProject && (deal.value || 0) < displayValue);
    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
    let valueTooltip = '';
    if (isLastProject) valueTooltip = `Nilai asli: Rp ${formatNumber(deal.value || 0)} (hanya 1 project aktif)`;
    else if (valueIsFromOtherPriority) { valueTooltip = `Nilai asli: Rp ${formatNumber(deal.value || 0)} - Menampilkan nilai tertinggi dari project ini`; valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`; }
    dealCard.innerHTML = `<div class="flex justify-between items-start"><h3 class="font-bold text-gray-800">${escapeHtml(deal.dealName || 'No Name')}</h3><span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">${deal.priority || 'Priority'}</span></div><div class="mt-1 text-sm text-gray-600 deal-details"><p><i class="fas fa-user-tie mr-1"></i> ${escapeHtml(deal.salesName || '-')}</p><p class="font-semibold text-blue-600" title="${valueTooltip}">${valueDisplay}</p><p class="mt-1"><span class="priority-badge px-2 py-1 rounded-full ${stageColorClass}">${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage'}</span></p></div><div class="mt-2 flex justify-between items-center deal-footer"><span class="text-xs text-gray-500">Dibuat: ${formatDate(deal.createdAt)}${hasDifferentPriorities ? `<span class="ml-1 text-purple-600" title="Project juga tersedia di priority: ${otherPriorities.join(', ')}"><i class="fas fa-tags"></i> ${otherPriorities.length}+</span>` : ''}${isLastProject ? `<span class="ml-1 text-green-600" title="Hanya 1 project aktif yang tersisa"><i class="fas fa-star"></i></span>` : ''}</span><div class="flex space-x-1 deal-actions"><button class="view-detail-btn text-blue-600 hover:text-blue-800"><i class="fas fa-eye"></i></button>${canEdit ? `<button class="edit-deal-btn text-green-600 hover:text-green-800"><i class="fas fa-edit"></i></button><button class="delete-deal-btn text-red-600 hover:text-red-800"><i class="fas fa-trash-alt"></i></button>` : ''}</div></div>`;
    return dealCard;
}

function renderDealList(deal, index) {
    const row = document.createElement('tr');
    row.dataset.id = deal.id;
    row.className = 'hover:bg-gray-50 cursor-pointer view-detail-row';
    const canEdit = canUserEditDeal(deal);
    const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
    const winDate = getWinDate(deal);
    const allProjectDeals = deals.filter(d => d.dealName?.trim().toLowerCase() === deal.dealName?.trim().toLowerCase());
    const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
    const isLastProject = activeProjects.length === 1;
    let displayValue = isLastProject ? (deal.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
    let contractorText = '-';
    if (deal.contractor) contractorText = Array.isArray(deal.contractor) ? deal.contractor.join(', ') : deal.contractor;
    const maxLength = 100;
    let dealNameDisplay = (deal.dealName || 'No Name');
    if (dealNameDisplay.length > maxLength) dealNameDisplay = dealNameDisplay.substring(0, maxLength) + '...';
    let consultantDisplay = (deal.consultant || '-');
    if (consultantDisplay.length > maxLength) consultantDisplay = consultantDisplay.substring(0, maxLength) + '...';
    let contractorDisplay = contractorText;
    if (contractorDisplay.length > maxLength) contractorDisplay = contractorDisplay.substring(0, maxLength) + '...';
    const valueIsFromOtherPriority = (!isLastProject && (deal.value || 0) < displayValue);
    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
    let valueTooltip = '';
    if (isLastProject) valueTooltip = `Nilai asli: Rp ${formatNumber(deal.value || 0)} (hanya 1 project aktif)`;
    else if (valueIsFromOtherPriority) { valueTooltip = `Nilai asli: Rp ${formatNumber(deal.value || 0)} - Menampilkan nilai tertinggi dari project ini`; valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`; }
    row.innerHTML = `<td class="px-4 py-3 align-top text-sm">${index + 1}</td><td class="px-4 py-3 align-top text-sm">${escapeHtml(deal.salesName || '-')}</td><td class="px-4 py-3 align-top text-sm">${escapeHtml(dealNameDisplay)}${allProjectDeals.length > 1 ? `<span class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="Project ini memiliki ${allProjectDeals.length} entries dengan berbagai priority"><i class="fas fa-tags mr-1"></i>${allProjectDeals.length}</span>` : ''}${isLastProject ? `<span class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Hanya 1 project aktif yang tersisa"><i class="fas fa-star mr-1"></i>Last</span>` : ''}</td><td class="px-4 py-3 align-top text-sm">${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}${winDate ? `<div class="win-date-container"><i class="fas fa-calendar-check mr-1"></i>${formatDate(winDate)}</div>` : ''}</td><td class="px-4 py-3 align-top text-sm">${escapeHtml(consultantDisplay)}</td><td class="px-4 py-3 align-top text-sm">${escapeHtml(contractorDisplay)}</td><td class="px-4 py-3 align-top text-sm font-semibold" title="${valueTooltip}">${valueDisplay}</td><td class="px-4 py-3 align-top"><span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">${deal.priority || 'Priority'}</span></td><td class="px-4 py-3 align-top text-sm deal-actions"><div class="flex space-x-2"><button class="view-detail-btn text-blue-600 hover:text-blue-800"><i class="fas fa-eye"></i></button>${canEdit ? `<button class="edit-deal-btn text-green-600 hover:text-green-800"><i class="fas fa-edit"></i></button><button class="delete-deal-btn text-red-600 hover:text-red-800"><i class="fas fa-trash-alt"></i></button>` : ''}${allProjectDeals.length > 1 ? `<button class="text-purple-600 hover:text-purple-900 view-all-priorities-btn" data-deal-name="${escapeHtml(deal.dealName)}" title="Lihat semua priority untuk project ini"><i class="fas fa-list"></i></button>` : ''}</div></td>`;
    return row;
}

function showAllPrioritiesForProject(dealName) {
    const allEntries = deals.filter(deal => deal.dealName?.trim() === dealName);
    if (allEntries.length === 0) return showToast("Tidak ada entries ditemukan", 3000);
    const activeEntries = allEntries.filter(deal => deal.stage !== 'lost');
    const isLastProject = activeEntries.length === 1;
    const byPriority = {};
    allEntries.forEach(deal => { const priority = deal.priority || 'Priority'; if (!byPriority[priority]) byPriority[priority] = []; byPriority[priority].push(deal); });
    Object.keys(byPriority).forEach(priority => { byPriority[priority].sort((a, b) => { const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0); const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0); return dateB - dateA; }); });
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.id = 'allPrioritiesModal';
    const highestValue = isLastProject ? (activeEntries[0]?.value || 0) : Math.max(...allEntries.map(d => d.value || 0));
    modal.innerHTML = `<div class="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden"><div class="flex justify-between items-center p-4 border-b"><h2 class="text-xl font-semibold text-gray-800">Semua Priority untuk Project: ${escapeHtml(dealName)}</h2><button class="close-all-priorities text-gray-500 hover:text-gray-700"><i class="fas fa-times text-2xl"></i></button></div><div class="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">${isLastProject ? `<div class="mb-4 p-3 bg-green-50 rounded-lg border border-green-200"><i class="fas fa-info-circle text-green-600 mr-2"></i><span class="text-green-700">Hanya 1 project aktif yang tersisa. Nilai yang ditampilkan adalah nilai asli (Rp ${formatNumber(highestValue)}).</span></div>` : `<div class="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200"><i class="fas fa-info-circle text-blue-600 mr-2"></i><span class="text-blue-700">Multiple project aktif. Nilai tertinggi yang ditampilkan adalah Rp ${formatNumber(highestValue)}.</span></div>`}${Object.keys(byPriority).sort().map(priority => `<div class="mb-6"><h3 class="text-lg font-semibold mb-2 priority-title-${priority.toLowerCase().replace(' ', '-')}">Priority: ${priority}</h3><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahap</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">${byPriority[priority].map((entry, index) => { const isActive = entry.stage !== 'lost'; const rowClass = isActive ? 'hover:bg-gray-50' : 'opacity-60 bg-gray-50'; const stageClass = entry.stage === 'win' ? 'bg-green-100 text-green-800' : entry.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'; return `<tr class="${rowClass}"><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(entry.salesName || '-')}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">Rp ${formatNumber(entry.value) || '0'}${!isActive ? '<span class="ml-1 text-xs text-red-500">(Lost)</span>' : ''}${isActive && !isLastProject && entry.value < highestValue ? '<span class="ml-1 text-xs text-gray-500">(Bukan nilai tertinggi)</span>' : ''}</td><td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${stageClass}">${entry.stage ? entry.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(entry.createdAt)}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><i class="fas fa-clock text-gray-400 mr-1"></i>${entry.updatedAt ? formatDateTime(entry.updatedAt) : formatDateTime(entry.createdAt)}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium"><button class="text-blue-600 hover:text-blue-900 view-detail-btn" data-id="${entry.id}"><i class="fas fa-eye"></i></button></td></tr>`; }).join('')}</tbody></table></div>`).join('')}</div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.close-all-priorities').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelectorAll('.view-detail-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); const dealId = btn.dataset.id; modal.remove(); openDealDetailModal(dealId); }); });
}

// ==================== WIN DATE ====================

function getWinDate(deal) {
    if (deal.stage !== 'win' || !deal.updatedAt) return null;
    const winActivity = activities.find(act => act.message && act.message.includes(`"${deal.dealName}"`) && act.message.includes('diperbarui') && act.message.includes('stage: win'));
    return winActivity ? winActivity.timestamp : deal.updatedAt;
}

// ==================== RECYCLE BIN ====================

async function loadRecycleBin() {
    try {
        const querySnapshot = await deletedDealsCollection.orderBy("deletedAt", "desc").get();
        deletedDeals = [];
        querySnapshot.forEach(doc => deletedDeals.push({ id: doc.id, ...doc.data() }));
        updateRecycleBinBadge();
        return deletedDeals;
    } catch (error) { console.error("Error loading recycle bin:", error); showToast("Gagal memuat Recycle Bin", 3000); return []; }
}

function updateRecycleBinBadge() {
    const recycleBinBadge = document.getElementById('recycle-bin-badge');
    if (!recycleBinBadge) return;
    if (deletedDeals.length > 0) { recycleBinBadge.textContent = deletedDeals.length; recycleBinBadge.classList.remove('hidden'); }
    else recycleBinBadge.classList.add('hidden');
}

async function openRecycleBinModal() {
    if (currentUserRole !== 'admin') return showToast("Hanya admin yang dapat mengakses Recycle Bin", 3000);
    try {
        await loadRecycleBin();
        const recycleBinContent = document.getElementById('recycleBinContent');
        const emptyMessage = document.getElementById('emptyRecycleBinMessage');
        if (deletedDeals.length === 0) { recycleBinContent.innerHTML = ''; emptyMessage.classList.remove('hidden'); }
        else { emptyMessage.classList.add('hidden'); renderRecycleBinContent(); }
        document.getElementById('recycleBinModal').classList.remove('hidden');
        document.getElementById('recycleBinModalContent').classList.remove('modal-content-leave-active');
        document.getElementById('recycleBinModalContent').classList.add('modal-content-enter-active');
    } catch (error) { console.error("Error opening recycle bin:", error); showToast("Gagal membuka Recycle Bin", 3000); }
}

function renderRecycleBinContent() {
    const recycleBinContent = document.getElementById('recycleBinContent');
    recycleBinContent.innerHTML = '';
    deletedDeals.forEach(deal => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.innerHTML = `<td class="p-3 text-sm">${escapeHtml(deal.dealName || 'No Name')}</td><td class="p-3 text-sm">${escapeHtml(deal.salesName || '-')}</td><td class="p-3 text-sm">Rp ${formatNumber(deal.value) || '0'}</td><td class="p-3 text-sm">${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}</td><td class="p-3 text-sm">${formatDateTime(deal.deletedAt)}</td><td class="p-3 text-sm">${escapeHtml(deal.deletedByEmail || '-')}</td><td class="p-3 text-sm"><button class="restore-deal-btn text-green-600 hover:text-green-800 mr-3" data-id="${deal.id}"><i class="fas fa-undo mr-1"></i> Restore</button><button class="permanent-delete-btn text-red-600 hover:text-red-800" data-id="${deal.id}" data-name="${escapeHtml(deal.dealName || 'No Name')}"><i class="fas fa-trash mr-1"></i> Hapus Permanen</button></td>`;
        recycleBinContent.appendChild(row);
    });
}

async function restoreDeal(deletedDealId) {
    try {
        const deletedDeal = deletedDeals.find(d => d.id === deletedDealId);
        if (!deletedDeal) return showToast("Data tidak ditemukan di Recycle Bin", 3000);
        const { id, originalId, deletedAt, deletedBy, deletedByEmail, ...dealData } = deletedDeal;
        await dealsCollection.add(dealData);
        await deletedDealsCollection.doc(deletedDealId).delete();
        showToast(`Deal "${dealData.dealName}" berhasil dipulihkan!`, 2000);
        await activitiesCollection.add({ message: `Deal "${dealData.dealName}" dipulihkan dari Recycle Bin oleh ${auth.currentUser.email}.`, timestamp: firebase.firestore.FieldValue.serverTimestamp(), userEmail: auth.currentUser.email, read: false });
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        loadDealsFromFirebase();
    } catch (error) { console.error("Error restoring deal:", error); showToast("Gagal memulihkan deal", 3000); }
}

let permanentDeleteDealId = null, permanentDeleteDealName = '';

function confirmPermanentDelete(deletedDealId, dealName) {
    permanentDeleteDealId = deletedDealId;
    permanentDeleteDealName = dealName;
    document.getElementById('permanentDeleteDealName').textContent = dealName;
    document.getElementById('permanentDeleteModal').classList.remove('hidden');
    document.getElementById('permanentDeleteModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('permanentDeleteModalContent').classList.add('modal-content-enter-active');
}

async function permanentDeleteDeal() {
    if (!permanentDeleteDealId) return;
    try {
        await deletedDealsCollection.doc(permanentDeleteDealId).delete();
        showToast(`Deal "${permanentDeleteDealName}" berhasil dihapus permanen!`, 2000);
        await activitiesCollection.add({ message: `Deal "${permanentDeleteDealName}" dihapus permanen dari Recycle Bin oleh ${auth.currentUser.email}.`, timestamp: firebase.firestore.FieldValue.serverTimestamp(), userEmail: auth.currentUser.email, read: false });
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        closePermanentDeleteModal();
    } catch (error) { console.error("Error permanent deleting deal:", error); showToast("Gagal menghapus permanen deal", 3000); }
}

function closePermanentDeleteModal() {
    const modalContent = document.getElementById('permanentDeleteModalContent');
    if (!modalContent) return;
    modalContent.classList.remove('modal-content-enter-active');
    modalContent.classList.add('modal-content-leave-active');
    modalContent.addEventListener('transitionend', function handler() { document.getElementById('permanentDeleteModal').classList.add('hidden'); modalContent.classList.remove('modal-content-leave-active'); modalContent.removeEventListener('transitionend', handler); }, { once: true });
}

async function emptyRecycleBin() {
    if (deletedDeals.length === 0) return showToast("Recycle Bin sudah kosong", 3000);
    document.getElementById('recycleBinCount').textContent = deletedDeals.length;
    document.getElementById('emptyRecycleBinModal').classList.remove('hidden');
    document.getElementById('emptyRecycleBinModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('emptyRecycleBinModalContent').classList.add('modal-content-enter-active');
}

async function confirmEmptyRecycleBin() {
    try {
        const batch = db.batch();
        deletedDeals.forEach(deal => batch.delete(deletedDealsCollection.doc(deal.id)));
        await batch.commit();
        showToast(`Recycle Bin berhasil dikosongkan! ${deletedDeals.length} deal dihapus permanen.`, 3000);
        await activitiesCollection.add({ message: `Recycle Bin dikosongkan oleh ${auth.currentUser.email}. ${deletedDeals.length} deal dihapus permanen.`, timestamp: firebase.firestore.FieldValue.serverTimestamp(), userEmail: auth.currentUser.email, read: false });
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        closeEmptyRecycleBinModal();
    } catch (error) { console.error("Error emptying recycle bin:", error); showToast("Gagal mengosongkan Recycle Bin", 3000); }
}

function closeEmptyRecycleBinModal() {
    const modalContent = document.getElementById('emptyRecycleBinModalContent');
    if (!modalContent) return;
    modalContent.classList.remove('modal-content-enter-active');
    modalContent.classList.add('modal-content-leave-active');
    modalContent.addEventListener('transitionend', function handler() { document.getElementById('emptyRecycleBinModal').classList.add('hidden'); modalContent.classList.remove('modal-content-leave-active'); modalContent.removeEventListener('transitionend', handler); }, { once: true });
}

function closeRecycleBinModal() {
    const modalContent = document.getElementById('recycleBinModalContent');
    if (!modalContent) return;
    modalContent.classList.remove('modal-content-enter-active');
    modalContent.classList.add('modal-content-leave-active');
    modalContent.addEventListener('transitionend', function handler() { document.getElementById('recycleBinModal').classList.add('hidden'); modalContent.classList.remove('modal-content-leave-active'); modalContent.removeEventListener('transitionend', handler); }, { once: true });
}

// ==================== AKTIVITAS ====================

async function loadActivitiesFromFirebase(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && activitiesCache.lastFetch && (now - activitiesCache.lastFetch) < CACHE_DURATION) { activities = activitiesCache.data; updateActivityBadge(); return; }
    try {
        const querySnapshot = await activitiesCollection.orderBy("timestamp", "desc").limit(100).get();
        activities = [];
        querySnapshot.forEach(doc => { const activityData = doc.data(); if (activityData.timestamp && typeof activityData.timestamp.toDate !== 'function') activityData.timestamp = firebase.firestore.Timestamp.fromMillis(activityData.timestamp); activities.push({ id: doc.id, ...activityData }); });
        activitiesCache = { data: activities, lastFetch: now };
        updateActivityBadge();
    } catch (error) { console.error("Error loading activities:", error); showToast("Gagal memuat aktivitas terbaru", 3000); }
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
    for (const pattern of patterns) { const match = message.match(pattern); if (match && match[1]) return match[1].trim(); }
    return null;
}

async function findDealByName(dealName) {
    if (!dealName) return null;
    const normalizedSearchName = dealName.trim().toLowerCase();
    for (const [id, deal] of dealsByIdCache.entries()) if (deal.dealName && deal.dealName.trim().toLowerCase() === normalizedSearchName) return deal;
    let deal = deals.find(deal => deal.dealName && deal.dealName.trim().toLowerCase() === normalizedSearchName);
    if (deal) { dealsByIdCache.set(deal.id, deal); return deal; }
    deal = deals.find(deal => deal.dealName && deal.dealName.trim().toLowerCase().includes(normalizedSearchName));
    if (deal) { dealsByIdCache.set(deal.id, deal); return deal; }
    try {
        const exactQuery = await dealsCollection.where('dealName', '==', dealName).limit(1).get();
        if (!exactQuery.empty) { const doc = exactQuery.docs[0]; deal = { id: doc.id, ...doc.data() }; deals.push(deal); dealsByIdCache.set(deal.id, deal); return deal; }
    } catch (error) { console.error("Error mencari deal di Firestore:", error); }
    return null;
}

function saveActivityModalState() {
    const activityModalContent = document.getElementById('activityModalContent');
    if (activityModalContent) activityModalState.scrollPosition = activityModalContent.scrollTop;
}

function restoreActivityModalState() {
    const activityModalContent = document.getElementById('activityModalContent');
    if (activityModalContent && activityModalState.isOpen) setTimeout(() => { activityModalContent.scrollTop = activityModalState.scrollPosition; }, 100);
}

async function openActivityModal() {
    if (isActivityModalOpening) return;
    isActivityModalOpening = true;
    try {
        const activityModal = document.getElementById('activityModal');
        const activityFeed = document.getElementById('activity-feed-modal');
        const activityModalContent = document.getElementById('activityModalContent');
        if (!activityModal || !activityFeed || !activityModalContent) { console.error("Elemen modal aktivitas tidak ditemukan."); showToast("Gagal membuka aktivitas: Elemen tidak lengkap.", 3000); isActivityModalOpening = false; return; }
        activityModal.classList.remove('hidden');
        activityModalContent.classList.remove('modal-content-leave-active');
        activityModalContent.classList.add('modal-content-enter-active');
        activityFeed.innerHTML = `<div class="text-center text-gray-500 py-8"><i class="fas fa-spinner fa-spin text-3xl mb-2"></i><p>Memuat aktivitas...</p></div>`;
        activityModalState.isOpen = true;
        await loadActivitiesFromFirebase(true);
        activityFeed.innerHTML = '';
        if (activities.length === 0) { activityFeed.innerHTML = `<div class="text-center text-gray-500 py-8"><i class="fas fa-inbox text-3xl mb-2"></i><p>Tidak ada aktivitas terbaru</p></div>`; }
        else {
            const sortedActivities = [...activities].sort((a, b) => { const tsA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : a.timestamp) : 0; const tsB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : b.timestamp) : 0; return tsB - tsA; });
            const activityPromises = sortedActivities.map(async (activity) => { const dealName = extractDealNameFromActivity(activity.message); if (dealName) activity.deal = await findDealByName(dealName); return activity; });
            const activitiesWithDeals = await Promise.all(activityPromises);
            activitiesWithDeals.forEach((activity) => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item p-3 border-b hover:bg-gray-50 transition duration-200';
                const timeStr = activity.timestamp ? formatDateTime(activity.timestamp) : 'Waktu tidak diketahui';
                const isUnread = !activity.read;
                activityItem.innerHTML = `<div class="flex items-start"><div class="flex-1"><p class="text-sm ${isUnread ? 'font-semibold' : ''}">${escapeHtml(activity.message || 'Aktivitas tidak tersedia')}</p><div class="flex items-center mt-1 text-xs text-gray-500"><i class="fas fa-clock mr-1"></i><span>${timeStr}</span>${isUnread ? '<span class="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">Baru</span>' : ''}${activity.deal ? '<span class="ml-2 text-green-600"><i class="fas fa-check-circle"></i> Deal tersedia</span>' : ''}</div></div>${activity.deal ? `<div class="ml-2"><button class="view-activity-deal text-blue-600 hover:text-blue-800 p-1" data-deal-id="${activity.deal.id}" data-deal-name="${escapeHtml(activity.deal.dealName)}" title="Lihat detail deal"><i class="fas fa-eye"></i></button></div>` : `<div class="ml-2 text-xs text-gray-400 italic" title="Deal mungkin sudah dihapus"><i class="fas fa-exclamation-triangle"></i></div>`}</div>`;
                if (activity.deal) {
                    activityItem.addEventListener('click', function(e) { if (e.target.closest('button')) return; const dealId = activity.deal.id; saveActivityModalState(); openDealDetailModal(dealId); });
                    const viewBtn = activityItem.querySelector('.view-activity-deal');
                    if (viewBtn) viewBtn.addEventListener('click', function(e) { e.stopPropagation(); const dealId = this.dataset.dealId; saveActivityModalState(); openDealDetailModal(dealId); });
                } else { activityItem.addEventListener('click', () => showToast("Deal sudah tidak tersedia (mungkin sudah dihapus)", 3000)); }
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
    if (unreadActivities.length > 0) { batch.commit().then(() => { unreadActivities.forEach(act => act.read = true); updateActivityBadge(); }).catch(error => console.error("Error marking activities as read:", error)); }
}

function closeActivityModal() {
    const activityModalContent = document.getElementById('activityModalContent');
    if (!activityModalContent) return;
    activityModalContent.classList.remove('modal-content-enter-active');
    activityModalContent.classList.add('modal-content-leave-active');
    activityModalContent.addEventListener('transitionend', function handler() { document.getElementById('activityModal').classList.add('hidden'); activityModalContent.classList.remove('modal-content-leave-active'); activityModalContent.removeEventListener('transitionend', handler); activityModalState.isOpen = false; activityModalState.scrollPosition = 0; }, { once: true });
}

// ==================== FUNGSI UTILITAS ====================

function formatDateTime(timestamp) {
    if (!timestamp) return '-';
    try { const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp); return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '-'; }
}

function formatNumber(num) { if (num === null || num === undefined || isNaN(num)) return '0'; return new Intl.NumberFormat('id-ID').format(num); }

function formatDate(timestamp) {
    if (!timestamp) return '-';
    try { const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp); return date.toLocaleDateString('id-ID'); }
    catch (e) { return '-'; }
}

function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove(), { once: true }); }, duration);
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

// ==================== DEALS ====================

function populateYearDropdown() {
    const filterYearSelect = document.getElementById('filterYear');
    if (!filterYearSelect) return;
    const allYearsOption = document.createElement('option');
    allYearsOption.value = 'all';
    allYearsOption.textContent = 'Semua Tahun';
    filterYearSelect.innerHTML = '';
    filterYearSelect.appendChild(allYearsOption);
    const sortedYears = Array.from(uniqueYears).sort((a, b) => parseInt(b) - parseInt(a));
    sortedYears.forEach(year => { const option = document.createElement('option'); option.value = year; option.textContent = year; filterYearSelect.appendChild(option); });
    if (activeYear && filterYearSelect.querySelector(`option[value="${activeYear}"]`)) filterYearSelect.value = activeYear;
}

async function loadConsultantsFromFirebase() {
    console.log("Loading consultants from GitHub JSON...");
    uniqueConsultants.clear();
    try {
        const response = await fetch('https://raw.githubusercontent.com/bandeng77/pipelines.github.io/main/consultants.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        data.forEach(consultantName => { if (consultantName) uniqueConsultants.add(consultantName); });
        console.log("Consultants loaded from JSON:", uniqueConsultants.size);
    } catch (error) { console.error("Error loading consultants from JSON:", error); showToast("Gagal memuat daftar konsultan dari GitHub.", 3000); }
}

async function loadDealsFromFirebase(forceRefresh = false) {
    console.log("Loading deals from Firebase...");
    if (forceRefresh) dealsByIdCache.clear();
    let query = dealsCollection.orderBy("createdAt", "desc");
    try {
        const querySnapshot = await query.get();
        deals = [];
        uniqueContractors.clear(); uniquePICs.clear(); uniqueOwners.clear(); uniqueProducts.clear(); uniqueFacilities.clear(); uniquePackages.clear(); uniqueYears.clear(); uniqueSales.clear();
        querySnapshot.forEach(doc => {
            const dealData = doc.data();
            if (dealData.createdAt && !dealData.createdAt.toDate) try { dealData.createdAt = firebase.firestore.Timestamp.fromDate(new Date(dealData.createdAt)); } catch(e) { console.warn("Could not convert createdAt for deal:", doc.id); }
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
            if (dealData.createdAt) try { let year; if (dealData.createdAt.toDate) year = dealData.createdAt.toDate().getFullYear().toString(); else if (dealData.createdAt.seconds) year = new Date(dealData.createdAt.seconds * 1000).getFullYear().toString(); else year = new Date(dealData.createdAt).getFullYear().toString(); uniqueYears.add(year); } catch(e) { console.warn("Could not extract year for deal:", doc.id, e); }
        });
        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') { const currentSales = getCurrentSalesName(); if (currentSales) uniqueSales = new Set([currentSales]); }
        priorityStatsCache = { 'all': null, '2025': null, '2026': null };
        dealsByYearCache = { 'all': null, '2025': null, '2026': null };
        populateYearDropdown();
        populateFilterDropdowns();
        createPriorityDashboard();
        applyActiveFilters();
        await migrateOldComments();
    } catch (error) { console.error("Error loading deals:", error); showToast("Gagal memuat data deals", 3000); }
}

function getDealById(dealId) {
    if (dealsByIdCache.has(dealId)) return dealsByIdCache.get(dealId);
    const deal = deals.find(d => d.id === dealId);
    if (deal) dealsByIdCache.set(dealId, deal);
    return deal;
}

function getSalesNameFromEmail(email) { return emailToSalesNameMap[email] || email.split('@')[0]; }

function canUserEditDeal(deal) {
    if (currentUserRole === 'admin' || currentUserRole === 'manager') return true;
    const currentUser = auth.currentUser;
    const allowedEmails = ['bintang@genetek.co.id', 'andy@genetek.co.id'];
    if (currentUser && allowedEmails.includes(currentUser.email)) return true;
    if (!currentUser) return false;
    const userSalesName = getSalesNameFromEmail(currentUser.email);
    return deal.salesName === userSalesName;
}

function populateDropdown(selectElementId, uniqueValues, selectedValue = 'all') {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) return;
    selectElement.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    const labelElement = selectElement.previousElementSibling;
    const labelText = labelElement ? labelElement.textContent.replace(':', '').replace('*', '').trim() : '';
    defaultOption.textContent = `Semua ${labelText}`;
    selectElement.appendChild(defaultOption);
    const sortedValues = Array.from(uniqueValues).sort();
    sortedValues.forEach(value => { if (value) { const option = document.createElement('option'); option.value = value; option.textContent = value; selectElement.appendChild(option); } });
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

function formatNumberInput(inputElement) {
    let value = inputElement.value.replace(/[^0-9]/g, '');
    let numberValue = parseInt(value, 10);
    if (isNaN(numberValue)) { inputElement.value = ''; return; }
    inputElement.value = new Intl.NumberFormat('id-ID').format(numberValue);
}

// ==================== STATISTIK MODAL ====================

function openStatsModal() {
    const statsModal = document.getElementById('statsModal');
    if (!statsModal) return;
    statsModal.classList.remove('hidden');
    document.querySelector('#statsModal .modal-content-enter').classList.remove('modal-content-leave-active');
    document.querySelector('#statsModal .modal-content-enter').classList.add('modal-content-enter-active');
    switchStatsTab('overview');
    renderAllCharts();
    populateSalesFilter();
}

function closeStatsModal() {
    const statsModalContent = document.querySelector('#statsModal .modal-content-enter');
    if (!statsModalContent) return;
    statsModalContent.classList.remove('modal-content-enter-active');
    statsModalContent.classList.add('modal-content-leave-active');
    statsModalContent.addEventListener('transitionend', function handler() { document.getElementById('statsModal').classList.add('hidden'); statsModalContent.classList.remove('modal-content-leave-active'); statsModalContent.removeEventListener('transitionend', handler); }, { once: true });
}

function switchStatsTab(tabName) {
    document.querySelectorAll('.stats-tab').forEach(tab => { tab.classList.remove('active', 'border-blue-600', 'text-blue-600'); tab.classList.add('border-transparent'); });
    const activeTab = document.querySelector(`.stats-tab[data-tab="${tabName}"]`);
    if (activeTab) { activeTab.classList.add('active', 'border-blue-600', 'text-blue-600'); activeTab.classList.remove('border-transparent'); }
    document.querySelectorAll('.stats-tab-content').forEach(content => content.classList.add('hidden'));
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) { activeContent.classList.remove('hidden'); if (tabName === 'sales') renderSalesCharts(); else if (tabName === 'priority') renderPriorityCharts(); }
}

function populateSalesFilter() {
    const salesFilter = document.getElementById('salesFilter');
    if (!salesFilter) return;
    const currentValue = salesFilter.value;
    salesFilter.innerHTML = '<option value="all">Semua Sales</option>';
    Array.from(uniqueSales).sort().forEach(salesName => { const option = document.createElement('option'); option.value = salesName; option.textContent = salesName; salesFilter.appendChild(option); });
    if (currentValue && Array.from(salesFilter.options).some(opt => opt.value === currentValue)) salesFilter.value = currentValue;
}

// ==================== STATISTIK PER SALES ====================

function processSalesData(salesName = 'all') {
    let salesDeals = salesName === 'all' ? deals : deals.filter(deal => deal.salesName === salesName);
    salesDeals = filterDealsByUser(salesDeals);
    const uniqueProjects = getUniqueProjectsForDashboard(salesDeals);
    const stats = { totalValue: 0, totalDeals: uniqueProjects.length, winCount: 0, lostCount: 0, stageDistribution: {}, priorityDistribution: {}, monthlyTimeline: {}, byProduct: {}, byFacility: {}, maxDealValue: 0, minDealValue: Infinity, dealsByPriority: {} };
    if (uniqueProjects.length > 0) { stats.maxDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0; stats.minDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0; }
    uniqueProjects.forEach(deal => {
        const dealValue = deal.displayValue || deal.value || 0;
        stats.totalValue += dealValue;
        if (deal.stage === 'win') stats.winCount++;
        else if (deal.stage === 'lost') stats.lostCount++;
        const stage = deal.stage || 'unknown';
        stats.stageDistribution[stage] = (stats.stageDistribution[stage] || 0) + 1;
        const priority = deal.priority || 'Priority';
        stats.priorityDistribution[priority] = (stats.priorityDistribution[priority] || 0) + 1;
        if (!stats.dealsByPriority[priority]) stats.dealsByPriority[priority] = [];
        stats.dealsByPriority[priority].push(deal);
        if (deal.createdAt) { const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt); const monthYear = dealDate.toLocaleString('id-ID', { month: 'short', year: 'numeric' }); if (!stats.monthlyTimeline[monthYear]) stats.monthlyTimeline[monthYear] = { count: 0, value: 0 }; stats.monthlyTimeline[monthYear].count++; stats.monthlyTimeline[monthYear].value += dealValue; }
        if (deal.product) { const products = Array.isArray(deal.product) ? deal.product : [deal.product]; products.forEach(product => stats.byProduct[product] = (stats.byProduct[product] || 0) + 1); }
        if (deal.facility) stats.byFacility[deal.facility] = (stats.byFacility[deal.facility] || 0) + 1;
        if (dealValue > stats.maxDealValue) stats.maxDealValue = dealValue;
        if (dealValue < stats.minDealValue) stats.minDealValue = dealValue;
    });
    stats.winRate = stats.totalDeals > 0 ? (stats.winCount / stats.totalDeals * 100).toFixed(1) : 0;
    stats.avgDealValue = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;
    return stats;
}

function renderSalesCharts() {
    try {
        const salesFilter = document.getElementById('salesFilter');
        const selectedSales = salesFilter ? salesFilter.value : 'all';
        const salesData = processSalesData(selectedSales);
        document.getElementById('salesTotalValue').textContent = `Rp ${formatNumber(salesData.totalValue)}`;
        document.getElementById('salesWinRate').textContent = `${salesData.winRate}%`;
        document.getElementById('salesTotalDeals').textContent = salesData.totalDeals;
        document.getElementById('salesAvgValue').textContent = `Rp ${formatNumber(salesData.avgDealValue)}`;
        document.getElementById('salesMaxValue').textContent = `Rp ${formatNumber(salesData.maxDealValue)}`;
        
        const stageCtx = document.getElementById('salesStageChart');
        if (stageCtx) {
            if (salesCharts.salesStageChart) salesCharts.salesStageChart.destroy();
            const stageLabels = Object.keys(salesData.stageDistribution).map(stage => stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
            const stageData = Object.values(salesData.stageDistribution);
            salesCharts.salesStageChart = new Chart(stageCtx.getContext('2d'), { type: 'doughnut', data: { labels: stageLabels, datasets: [{ label: 'Jumlah Deal', data: stageData, backgroundColor: ['#3B82F6', '#60A5FA', '#93C5FD', '#22D3EE', '#A78BFA', '#10B981', '#EF4444', '#F59E0B'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: `Distribusi Tahap - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}` } } } });
        }
        
        const priorityCtx = document.getElementById('salesPriorityChart');
        if (priorityCtx) {
            if (salesCharts.salesPriorityChart) salesCharts.salesPriorityChart.destroy();
            const priorityLabels = Object.keys(salesData.priorityDistribution);
            const priorityData = Object.values(salesData.priorityDistribution);
            salesCharts.salesPriorityChart = new Chart(priorityCtx.getContext('2d'), { type: 'bar', data: { labels: priorityLabels, datasets: [{ label: 'Jumlah Deal', data: priorityData, backgroundColor: priorityLabels.map(p => { switch(p) { case 'Priority': return '#fef3c7'; case 'Hot Priority': return '#fee2e2'; case 'Win': return '#d1fae5'; case 'Behind': return '#ffedd5'; case 'On Track': return '#dbeafe'; default: return '#e5e7eb'; } }), borderColor: priorityLabels.map(p => { switch(p) { case 'Priority': return '#d97706'; case 'Hot Priority': return '#dc2626'; case 'Win': return '#059669'; case 'Behind': return '#ea580c'; case 'On Track': return '#1d4ed8'; default: return '#6b7280'; } }), borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: `Distribusi Priority - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}` }, tooltip: { callbacks: { label: (ctx) => `Klik untuk melihat detail project (${ctx.raw} deal)` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, onClick: (evt, elements) => { if (elements.length > 0) { const index = elements[0].index; const priority = priorityLabels[index]; showDealsByPriority(salesFilter, priority); } } } });
        }
        
        const timelineCtx = document.getElementById('salesTimelineChart');
        if (timelineCtx) {
            if (salesCharts.salesTimelineChart) salesCharts.salesTimelineChart.destroy();
            const sortedMonths = Object.keys(salesData.monthlyTimeline).sort((a, b) => { const [monthStrA, yearStrA] = a.split(' '); const [monthStrB, yearStrB] = b.split(' '); const monthIndexA = new Date(Date.parse(monthStrA + " 1, 2000")).getMonth(); const monthIndexB = new Date(Date.parse(monthStrB + " 1, 2000")).getMonth(); return new Date(parseInt(yearStrA), monthIndexA, 1) - new Date(parseInt(yearStrB), monthIndexB, 1); });
            const timelineCountData = sortedMonths.map(month => salesData.monthlyTimeline[month].count);
            const timelineValueData = sortedMonths.map(month => salesData.monthlyTimeline[month].value);
            salesCharts.salesTimelineChart = new Chart(timelineCtx.getContext('2d'), { type: 'line', data: { labels: sortedMonths, datasets: [{ label: 'Jumlah Deal', data: timelineCountData, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', yAxisID: 'y', tension: 0.3 }, { label: 'Total Nilai (IDR)', data: timelineValueData, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', yAxisID: 'y1', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, stacked: false, plugins: { title: { display: true, text: `Timeline Deal - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}` } }, scales: { y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Jumlah Deal' }, ticks: { precision: 0 } }, y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Total Nilai (IDR)' }, ticks: { callback: (value) => 'Rp ' + formatNumber(value) } } } } });
        }
    } catch (error) { console.error("Error rendering sales charts:", error); showToast("Gagal merender chart statistik sales", 3000); }
}

// ==================== STATISTIK PER PRIORITY ====================

function processPriorityData(priority = 'all') {
    let priorityDeals = priority === 'all' ? deals : deals.filter(deal => deal.priority === priority);
    priorityDeals = filterDealsByUser(priorityDeals);
    const uniqueProjects = getUniqueProjectsForDashboard(priorityDeals);
    const stats = { totalValue: 0, totalDeals: uniqueProjects.length, winCount: 0, stageDistribution: {}, salesDistribution: {}, valueByStage: {}, monthlyTimeline: {}, avgDealValue: 0, maxDealValue: 0, minDealValue: Infinity, dealsByStage: {} };
    if (uniqueProjects.length > 0) { stats.maxDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0; stats.minDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0; }
    uniqueProjects.forEach(deal => {
        const dealValue = deal.displayValue || deal.value || 0;
        stats.totalValue += dealValue;
        if (deal.stage === 'win') stats.winCount++;
        const stage = deal.stage || 'unknown';
        stats.stageDistribution[stage] = (stats.stageDistribution[stage] || 0) + 1;
        stats.valueByStage[stage] = (stats.valueByStage[stage] || 0) + dealValue;
        if (!stats.dealsByStage[stage]) stats.dealsByStage[stage] = [];
        stats.dealsByStage[stage].push(deal);
        if (deal.salesName) stats.salesDistribution[deal.salesName] = (stats.salesDistribution[deal.salesName] || 0) + 1;
        if (deal.createdAt) { const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt); const monthYear = dealDate.toLocaleString('id-ID', { month: 'short', year: 'numeric' }); if (!stats.monthlyTimeline[monthYear]) stats.monthlyTimeline[monthYear] = { count: 0, value: 0 }; stats.monthlyTimeline[monthYear].count++; stats.monthlyTimeline[monthYear].value += dealValue; }
        if (dealValue > stats.maxDealValue) stats.maxDealValue = dealValue;
        if (dealValue < stats.minDealValue) stats.minDealValue = dealValue;
    });
    stats.avgDealValue = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;
    stats.winRate = stats.totalDeals > 0 ? (stats.winCount / stats.totalDeals * 100).toFixed(1) : 0;
    return stats;
}

function renderPriorityCharts() {
    try {
        const priorityFilter = document.getElementById('priorityFilter');
        const selectedPriority = priorityFilter ? priorityFilter.value : 'all';
        const priorityData = processPriorityData(selectedPriority);
        document.getElementById('priorityTotalValue').textContent = `Rp ${formatNumber(priorityData.totalValue)}`;
        document.getElementById('priorityAvgValue').textContent = `Rp ${formatNumber(priorityData.avgDealValue)}`;
        document.getElementById('priorityTotalDeals').textContent = priorityData.totalDeals;
        document.getElementById('priorityWinRate').textContent = `${priorityData.winRate}%`;
        document.getElementById('priorityMaxValue').textContent = `Rp ${formatNumber(priorityData.maxDealValue)}`;
        document.getElementById('priorityMinValue').textContent = `Rp ${formatNumber(priorityData.minDealValue === Infinity ? 0 : priorityData.minDealValue)}`;
        
        const stageCtx = document.getElementById('priorityStageChart');
        if (stageCtx) {
            if (salesCharts.priorityStageChart) salesCharts.priorityStageChart.destroy();
            const stageLabels = Object.keys(priorityData.stageDistribution).map(stage => stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
            const stageData = Object.values(priorityData.stageDistribution);
            const stageValueData = Object.keys(priorityData.valueByStage).map(stage => priorityData.valueByStage[stage]);
            const backgroundColors = stageLabels.map((_, idx) => ['#3B82F6', '#60A5FA', '#93C5FD', '#22D3EE', '#A78BFA', '#10B981', '#EF4444', '#F59E0B'][idx % 8]);
            salesCharts.priorityStageChart = new Chart(stageCtx.getContext('2d'), { type: 'bar', data: { labels: stageLabels, datasets: [{ label: 'Jumlah Deal', data: stageData, backgroundColor: backgroundColors.map(c => c + '80'), borderColor: backgroundColors, borderWidth: 1, yAxisID: 'y' }, { label: 'Total Nilai (IDR)', data: stageValueData, backgroundColor: '#10B98180', borderColor: '#10B981', borderWidth: 1, yAxisID: 'y1' }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { title: { display: true, text: `Distribusi per Tahap - ${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}` }, tooltip: { callbacks: { label: (ctx) => ctx.datasetIndex === 0 ? `Jumlah Deal: ${ctx.raw} (klik untuk melihat detail)` : `Total Nilai: Rp ${formatNumber(ctx.raw)}` } } }, scales: { y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Jumlah Deal' }, ticks: { precision: 0 } }, y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Total Nilai (IDR)' }, ticks: { callback: (value) => 'Rp ' + formatNumber(value) } } }, onClick: (evt, elements) => { if (elements.length > 0 && elements[0].datasetIndex === 0) { const index = elements[0].index; const stage = Object.keys(priorityData.stageDistribution)[index]; showDealsByStage(priorityFilter, stage); } } } });
        }
        
        const salesCtx = document.getElementById('prioritySalesChart');
        if (salesCtx) {
            if (salesCharts.prioritySalesChart) salesCharts.prioritySalesChart.destroy();
            const sortedSales = Object.entries(priorityData.salesDistribution).sort((a, b) => b[1] - a[1]).slice(0, 10);
            salesCharts.prioritySalesChart = new Chart(salesCtx.getContext('2d'), { type: 'bar', data: { labels: sortedSales.map(s => s[0]), datasets: [{ label: 'Jumlah Deal', data: sortedSales.map(s => s[1]), backgroundColor: '#8B5CF6' }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { title: { display: true, text: `Top 10 Sales - ${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}` } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } });
        }
        
        const timelineCtx = document.getElementById('priorityTimelineChart');
        if (timelineCtx) {
            if (salesCharts.priorityTimelineChart) salesCharts.priorityTimelineChart.destroy();
            const sortedMonths = Object.keys(priorityData.monthlyTimeline).sort((a, b) => { const [monthStrA, yearStrA] = a.split(' '); const [monthStrB, yearStrB] = b.split(' '); const monthIndexA = new Date(Date.parse(monthStrA + " 1, 2000")).getMonth(); const monthIndexB = new Date(Date.parse(monthStrB + " 1, 2000")).getMonth(); return new Date(parseInt(yearStrA), monthIndexA, 1) - new Date(parseInt(yearStrB), monthIndexB, 1); });
            const timelineCountData = sortedMonths.map(month => priorityData.monthlyTimeline[month].count);
            const timelineValueData = sortedMonths.map(month => priorityData.monthlyTimeline[month].value);
            salesCharts.priorityTimelineChart = new Chart(timelineCtx.getContext('2d'), { type: 'line', data: { labels: sortedMonths, datasets: [{ label: 'Jumlah Deal', data: timelineCountData, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', yAxisID: 'y', tension: 0.3 }, { label: 'Total Nilai (IDR)', data: timelineValueData, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', yAxisID: 'y1', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Jumlah Deal' }, ticks: { precision: 0 } }, y1: { beginAtZero: true, title: { display: true, text: 'Total Nilai (IDR)' }, ticks: { callback: (v) => 'Rp ' + formatNumber(v) } } } });
        }
    } catch (error) { console.error("Error rendering priority charts:", error); showToast("Gagal merender chart analisis priority", 3000); }
}

// ==================== STATISTIK OVERVIEW ====================

function processDealDataForCharts(dealsData) {
    const userDealsData = filterDealsByUser(dealsData);
    const uniqueProjects = getUniqueProjectsForDashboard(userDealsData);
    const stageSelect = document.getElementById('stage');
    const allStages = stageSelect ? Array.from(stageSelect.options).map(option => option.value).filter(v => v !== '') : ['identified', 'prospect', 'tender-me', 'tender-main-con', 'contract-award', 'win', 'lost', 'on-hold'];
    const winRateDataMap = {}; allStages.forEach(stage => winRateDataMap[stage] = 0);
    const stats = { dealSizeLabels: [], dealSizeData: [], winRateLabels: allStages, winRateData: [], dealsBySalesLabels: [], dealsBySalesData: [], dealsByProductLabels: [], dealsByProductData: [], pipelineValueLabels: [], pipelineValueData: [], topSales: { name: '', value: 0 } };
    const dealSizes = { 'Small (< Rp 500 Juta)': 0, 'Medium (Rp 500 Juta - Rp 2 Miliar)': 0, 'Large (> Rp 2 Miliar)': 0 };
    const dealsBySales = {}; let salesValue = {}, salesWinCount = {}, dealsByProduct = {}, productValue = {}, pipelineValueByMonth = {};
    uniqueProjects.forEach(deal => {
        const dealValue = deal.displayValue || deal.value || 0;
        if (dealValue < 500000000) dealSizes['Small (< Rp 500 Juta)']++;
        else if (dealValue >= 500000000 && dealValue <= 2000000000) dealSizes['Medium (Rp 500 Juta - Rp 2 Miliar)']++;
        else dealSizes['Large (> Rp 2 Miliar)']++;
        if (deal.stage && winRateDataMap.hasOwnProperty(deal.stage)) winRateDataMap[deal.stage]++;
        if (deal.salesName) { dealsBySales[deal.salesName] = (dealsBySales[deal.salesName] || 0) + 1; salesValue[deal.salesName] = (salesValue[deal.salesName] || 0) + dealValue; if (deal.stage === 'win') salesWinCount[deal.salesName] = (salesWinCount[deal.salesName] || 0) + 1; }
        const productsInDeal = Array.isArray(deal.product) ? deal.product : (deal.product ? [deal.product] : []);
        productsInDeal.forEach(product => { const productKey = product || 'Unknown Product'; dealsByProduct[productKey] = (dealsByProduct[productKey] || 0) + 1; productValue[productKey] = (productValue[productKey] || 0) + dealValue; });
        if (deal.stage !== 'lost' && deal.stage !== 'win' && deal.createdAt) { const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt); const monthYear = dealDate.toLocaleString('id-ID', { month: 'short', year: 'numeric' }); pipelineValueByMonth[monthYear] = (pipelineValueByMonth[monthYear] || 0) + dealValue; }
    });
    let maxSalesValue = 0, topSalesName = '';
    for (const salesName in salesValue) { if (salesValue[salesName] > maxSalesValue) { maxSalesValue = salesValue[salesName]; topSalesName = salesName; } }
    stats.topSales = { name: topSalesName, value: maxSalesValue };
    stats.dealSizeLabels = Object.keys(dealSizes); stats.dealSizeData = Object.values(dealSizes);
    stats.winRateData = stats.winRateLabels.map(stage => winRateDataMap[stage]);
    stats.dealsBySalesLabels = Object.keys(dealsBySales); stats.dealsBySalesData = Object.values(dealsBySales);
    stats.dealsByProductLabels = Object.keys(dealsByProduct); stats.dealsByProductData = Object.values(dealsByProduct);
    const sortedMonths = Object.keys(pipelineValueByMonth).sort((a, b) => { const [monthStrA, yearStrA] = a.split(' '); const [monthStrB, yearStrB] = b.split(' '); const monthIndexA = new Date(Date.parse(monthStrA + " 1, 2000")).getMonth(); const monthIndexB = new Date(Date.parse(monthStrB + " 1, 2000")).getMonth(); return new Date(parseInt(yearStrA), monthIndexA, 1) - new Date(parseInt(yearStrB), monthIndexB, 1); });
    stats.pipelineValueLabels = sortedMonths; stats.pipelineValueData = sortedMonths.map(month => pipelineValueByMonth[month]);
    return stats;
}

function renderAllCharts() {
    try {
        const processedStats = processDealDataForCharts(deals);
        const dealSizeCtx = document.getElementById('dealSizeChart');
        if (dealSizeCtx) { if (charts.dealSizeChart) charts.dealSizeChart.destroy(); charts.dealSizeChart = new Chart(dealSizeCtx.getContext('2d'), { type: 'bar', data: { labels: processedStats.dealSizeLabels, datasets: [{ label: 'Jumlah Deal', data: processedStats.dealSizeData, backgroundColor: ['#3B82F6', '#60A5FA', '#93C5FD'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Distribusi Ukuran Deal' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }); }
        const winRateCtx = document.getElementById('winRateChart');
        if (winRateCtx) { if (charts.winRateChart) charts.winRateChart.destroy(); charts.winRateChart = new Chart(winRateCtx.getContext('2d'), { type: 'doughnut', data: { labels: processedStats.winRateLabels.map(l => l.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())), datasets: [{ label: 'Jumlah Deal', data: processedStats.winRateData, backgroundColor: ['#10B981', '#EF4444', '#F59E0B', '#6B7280', '#3B82F6', '#06B6D4', '#A855F7', '#EC4899'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Distribusi Deal Berdasarkan Tahap' } } } }); }
        const dealsBySalesCtx = document.getElementById('dealsBySalesChart');
        if (dealsBySalesCtx) { if (charts.dealsBySalesChart) charts.dealsBySalesChart.destroy(); charts.dealsBySalesChart = new Chart(dealsBySalesCtx.getContext('2d'), { type: 'bar', data: { labels: processedStats.dealsBySalesLabels, datasets: [{ label: 'Jumlah Deal', data: processedStats.dealsBySalesData, backgroundColor: '#6366F1' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Total Deals per Sales' }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} (Total IDR: Rp ${formatNumber(salesValue[processedStats.dealsBySalesLabels[ctx.dataIndex]] || 0)} / Win: ${salesWinCount[processedStats.dealsBySalesLabels[ctx.dataIndex]] || 0})` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }); }
        const productCtx = document.getElementById('dealsByProductPackageChart');
        if (productCtx) { if (charts.dealsByProductPackageChart) charts.dealsByProductPackageChart.destroy(); const productEntries = Object.entries(processedStats.dealsByProductLabels.reduce((acc, label, idx) => { acc[label] = processedStats.dealsByProductData[idx]; return acc; }, {})); const sortedProducts = productEntries.sort((a, b) => b[1] - a[1]).slice(0, 15); charts.dealsByProductPackageChart = new Chart(productCtx.getContext('2d'), { type: 'pie', data: { labels: sortedProducts.map(p => p[0]), datasets: [{ label: 'Jumlah Deal', data: sortedProducts.map(p => p[1]), backgroundColor: ['#F97316', '#14B8A6', '#8B5CF6', '#EC4899', '#FACC15', '#3B82F6', '#EF4444', '#06B6D4', '#A855F7', '#F43F5E', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#FF5722'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Deal per Produk (Top 15)' }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} (Total IDR: Rp ${formatNumber(productValue[ctx.label] || 0)})` } } } } }); }
        const pipelineCtx = document.getElementById('pipelineValueChart');
        if (pipelineCtx) { if (charts.pipelineValueChart) charts.pipelineValueChart.destroy(); charts.pipelineValueChart = new Chart(pipelineCtx.getContext('2d'), { type: 'line', data: { labels: processedStats.pipelineValueLabels, datasets: [{ label: 'Nilai Pipeline (IDR)', data: processedStats.pipelineValueData, borderColor: '#0EA5E9', backgroundColor: 'rgba(14, 165, 233, 0.2)', tension: 0.3, fill: true, pointRadius: 5, pointBackgroundColor: '#0EA5E9', pointBorderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Nilai Pipeline Seiring Waktu' } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => 'Rp ' + formatNumber(v) } } } } }); }
    } catch (error) { console.error("Error rendering overview charts:", error); showToast("Gagal merender chart overview", 3000); }
}

// ==================== CLICKABLE CHART ====================

function showDealsByPriority(salesFilter, priority) {
    const selectedSales = salesFilter.value;
    let filteredDeals = selectedSales === 'all' ? deals.filter(deal => deal.priority === priority) : deals.filter(deal => deal.salesName === selectedSales && deal.priority === priority);
    filteredDeals = filterDealsByUser(filteredDeals);
    const uniqueFilteredDeals = getUniqueProjectsForDashboard(filteredDeals);
    const sortedDeals = [...uniqueFilteredDeals].sort((a, b) => { const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0); const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0); return dateB - dateA; });
    if (sortedDeals.length === 0) { showToast(`Tidak ada project dengan priority "${priority}" untuk sales "${selectedSales === 'all' ? 'Semua Sales' : selectedSales}"`, 3000); return; }
    document.getElementById('clickableChartModalTitle').textContent = `Project dengan Priority "${priority}" - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}`;
    const modalContent = document.getElementById('clickableChartModalContent');
    modalContent.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200 mt-4';
    table.innerHTML = `<thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Project</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahap</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">${sortedDeals.map((deal, index) => { const displayValue = deal.displayValue || deal.value || 0; const lastUpdateDate = deal.updatedAt ? formatDateTime(deal.updatedAt) : (deal.createdAt ? formatDateTime(deal.createdAt) : '-'); let valueDisplay = `Rp ${formatNumber(displayValue)}`; if (!deal.isLastActiveProject && deal.hasHigherValueFromOtherPriority) valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`; return `<tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}"><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(deal.dealName || 'No Name')}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(deal.salesName || '-')}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${valueDisplay}</td><td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${deal.stage === 'win' ? 'bg-green-100 text-green-800' : deal.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><i class="fas fa-clock text-gray-400 mr-1"></i>${lastUpdateDate}</td></tr>` }).join('')}</tbody></table>`;
    modalContent.appendChild(table);
    modalContent.querySelectorAll('.view-detail-row').forEach(row => { row.addEventListener('click', function() { const dealId = this.dataset.id; closeClickableChartModal(); openDealDetailModal(dealId); }); });
    document.getElementById('clickableChartModal').classList.remove('hidden');
}

function showDealsByStage(priorityFilter, stage) {
    const selectedPriority = priorityFilter.value;
    let filteredDeals = selectedPriority === 'all' ? deals.filter(deal => deal.stage === stage) : deals.filter(deal => deal.priority === selectedPriority && deal.stage === stage);
    filteredDeals = filterDealsByUser(filteredDeals);
    const uniqueFilteredDeals = getUniqueProjectsForDashboard(filteredDeals);
    const sortedDeals = [...uniqueFilteredDeals].sort((a, b) => { const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0); const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0); return dateB - dateA; });
    if (sortedDeals.length === 0) { showToast(`Tidak ada project dengan stage "${stage}" untuk priority "${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}"`, 3000); return; }
    document.getElementById('clickableChartModalTitle').textContent = `Project dengan Stage "${stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}" - ${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}`;
    const modalContent = document.getElementById('clickableChartModalContent');
    modalContent.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200 mt-4';
    table.innerHTML = `<thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Project</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">${sortedDeals.map((deal, index) => { const displayValue = deal.displayValue || deal.value || 0; const lastUpdateDate = deal.updatedAt ? formatDateTime(deal.updatedAt) : (deal.createdAt ? formatDateTime(deal.createdAt) : '-'); const priorityBadgeClass = getPriorityBadgeClass(deal.priority); let valueDisplay = `Rp ${formatNumber(displayValue)}`; if (!deal.isLastActiveProject && deal.hasHigherValueFromOtherPriority) valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`; return `<tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}"><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td><td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(deal.dealName || 'No Name')}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(deal.salesName || '-')}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${valueDisplay}</td><td class="px-6 py-4 whitespace-nowrap"><span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">${deal.priority || 'Priority'}</span></td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><i class="fas fa-clock text-gray-400 mr-1"></i>${lastUpdateDate}</td></tr>` }).join('')}</tbody></table>`;
    modalContent.appendChild(table);
    modalContent.querySelectorAll('.view-detail-row').forEach(row => { row.addEventListener('click', function() { const dealId = this.dataset.id; closeClickableChartModal(); openDealDetailModal(dealId); }); });
    document.getElementById('clickableChartModal').classList.remove('hidden');
}

function closeClickableChartModal() { document.getElementById('clickableChartModal').classList.add('hidden'); }

// ==================== PERBAIKAN PERHITUNGAN NILAI ====================

function calculateValueFromBeforeDiscount() {
    const beforeDiscountRaw = document.getElementById('beforeDiscount').value.replace(/[^0-9]/g, '');
    const beforeDiscount = parseFloat(beforeDiscountRaw) || 0;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    let calculatedValue = beforeDiscount;
    if (discount > 0 && discount <= 100) calculatedValue = beforeDiscount * (1 - (discount / 100));
    const valueInput = document.getElementById('value');
    if (valueInput) valueInput.value = new Intl.NumberFormat('id-ID').format(Math.round(calculatedValue));
    const beforeDiscountInput = document.getElementById('beforeDiscount');
    if (beforeDiscount > 0 && beforeDiscountInput) beforeDiscountInput.value = new Intl.NumberFormat('id-ID').format(beforeDiscount);
}

function updateBeforeDiscountEventListeners() {
    const beforeDiscountInput = document.getElementById('beforeDiscount');
    const discountInput = document.getElementById('discount');
    if (beforeDiscountInput) beforeDiscountInput.addEventListener('input', function() { formatNumberInput(this); calculateValueFromBeforeDiscount(); });
    if (discountInput) discountInput.addEventListener('input', calculateValueFromBeforeDiscount);
}

// ==================== SORTABLE ====================

function initSortable() {
    const pipelineStage = document.getElementById('pipelines-stage');
    if (!pipelineStage) return;
    if (sortableInstances['pipelines-stage']) sortableInstances['pipelines-stage'].destroy();
    sortableInstances['pipelines-stage'] = new Sortable(pipelineStage, { animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', dragClass: 'sortable-drag', disabled: true });
}

// ==================== PERMISSIONS ====================

function applyUserPermissions() {
    try {
        const isAdmin = currentUserRole === 'admin';
        const isManager = currentUserRole === 'manager';
        const viewStatsBtn = document.getElementById('viewStatsBtn');
        const activityBtn = document.getElementById('activityBtn');
        const newDealBtn = document.getElementById('newDealBtn');
        const searchInput = document.getElementById('searchDeals');
        const openFilterPanelBtn = document.getElementById('openFilterPanelBtn');
        const recycleBinFab = document.getElementById('recycleBinFab');
        if (viewStatsBtn) viewStatsBtn.classList.toggle('hidden', !(isAdmin || isManager));
        if (activityBtn) activityBtn.classList.remove('hidden');
        if (newDealBtn) newDealBtn.classList.remove('hidden');
        if (searchInput) searchInput.classList.remove('hidden');
        if (openFilterPanelBtn) openFilterPanelBtn.classList.remove('hidden');
        if (recycleBinFab) isAdmin ? recycleBinFab.classList.remove('hidden') : recycleBinFab.classList.add('hidden');
        toggleExportButton();
        loadDealsFromFirebase();
    } catch (error) { console.error("Error in applyUserPermissions:", error); showToast("Gagal menerapkan permissions", 3000); }
}

// ==================== EVENT LISTENERS ====================

function commentSubmitHandler() { const comment = document.getElementById('commentInput')?.value || ''; if (currentDealIdForComments) addComment(currentDealIdForComments, comment); }
function detailCommentSubmitHandler() { const comment = document.getElementById('detailCommentInput')?.value || ''; if (currentDealIdForComments) addComment(currentDealIdForComments, comment); }

function initEventListeners() {
    consultantSearchInput = document.getElementById('consultantSearch');
    consultantHiddenInput = document.getElementById('consultant');
    consultantSuggestionsDiv = document.getElementById('consultantSuggestions');
    facilitySelect = document.getElementById('facility');
    newFacilityInput = document.getElementById('newFacility');
    packageSelect = document.getElementById('package');
    newPackageInput = document.getElementById('newPackage');
    
    document.addEventListener('click', function(e) {
        if (e.target.closest('.view-detail-btn')) { const card = e.target.closest('.deal-card, tr'); if (card && card.dataset.id) openDealDetailModal(card.dataset.id); }
        if (e.target.closest('.view-detail-row') && !e.target.closest('button')) { const row = e.target.closest('.view-detail-row'); if (row && row.dataset.id) openDealDetailModal(row.dataset.id); }
        if (e.target.closest('.view-all-entries-btn')) { const btn = e.target.closest('.view-all-entries-btn'); showAllEntriesForProject(btn.dataset.dealName, btn.dataset.priority); }
        if (e.target.closest('.view-all-priorities-btn')) { const btn = e.target.closest('.view-all-priorities-btn'); showAllPrioritiesForProject(btn.dataset.dealName); }
        if (e.target.closest('.edit-deal-btn')) { const card = e.target.closest('.deal-card, tr'); if (card && card.dataset.id) prepareEditDeal(card.dataset.id); }
        if (e.target.closest('.delete-deal-btn')) { const card = e.target.closest('.deal-card, tr'); if (card) { const dealId = card.dataset.id; const dealName = card.querySelector('h3')?.textContent || (card.querySelector('td:nth-child(3)')?.textContent || 'Deal'); confirmDeleteDeal(dealId, dealName); } }
        if (e.target.closest('.remove-contractor-btn')) removeContractorField(e.target.closest('.remove-contractor-btn'));
        if (e.target.closest('.remove-product-btn')) removeProductField(e.target.closest('.remove-product-btn'));
        if (e.target.closest('#recycleBinFab')) openRecycleBinModal();
        if (e.target.closest('.close-recycle-bin')) closeRecycleBinModal();
        if (e.target.closest('#emptyRecycleBinBtn')) emptyRecycleBin();
        if (e.target.closest('.restore-deal-btn')) restoreDeal(e.target.closest('.restore-deal-btn').dataset.id);
        if (e.target.closest('.permanent-delete-btn')) { const btn = e.target.closest('.permanent-delete-btn'); confirmPermanentDelete(btn.dataset.id, btn.dataset.name); }
        if (e.target.closest('.cancel-permanent-delete')) closePermanentDeleteModal();
        if (e.target.closest('#confirmPermanentDeleteBtn')) permanentDeleteDeal();
        if (e.target.closest('.cancel-empty-bin')) closeEmptyRecycleBinModal();
        if (e.target.closest('#confirmEmptyBinBtn')) confirmEmptyRecycleBin();
        if (e.target.closest('.delete-option-btn')) { const btn = e.target.closest('.delete-option-btn'); const selectEl = document.getElementById(btn.dataset.target); const val = selectEl.value; if (val && val !== '') deleteDropdownOption(btn.dataset.target, val); }
        if (e.target.closest('#clickableChartModalClose') || (e.target.closest('#clickableChartModal') && !e.target.closest('.clickable-modal-content'))) document.getElementById('clickableChartModal').classList.add('hidden');
        if (e.target.closest('#priorityModalClose') || (e.target.closest('#priorityModal') && !e.target.closest('.priority-modal-content'))) closePriorityModal();
        if (e.target.closest('.close-all-entries')) document.getElementById('allEntriesModal')?.remove();
        if (e.target.closest('.close-all-priorities')) document.getElementById('allPrioritiesModal')?.remove();
        if (e.target.closest('#dealAttachmentUpload')) document.getElementById('dealAttachmentFile')?.click();
        if (e.target.closest('#detailAttachmentUpload')) document.getElementById('detailAttachmentFile')?.click();
        if (e.target.closest('#commentAttachmentBtn')) document.getElementById('commentAttachmentInput')?.click();
        if (e.target.closest('#detailCommentAttachmentBtn')) document.getElementById('detailCommentAttachmentInput')?.click();
    });
    
    document.getElementById('dealAttachmentFile')?.addEventListener('change', async (e) => { const file = e.target.files[0]; if (file && currentDealIdForComments) { await uploadAttachmentForDeal(currentDealIdForComments, file); e.target.value = ''; } });
    document.getElementById('detailAttachmentFile')?.addEventListener('change', async (e) => { const file = e.target.files[0]; if (file && currentDealIdForComments) { await uploadAttachmentForDeal(currentDealIdForComments, file); e.target.value = ''; } });
    document.getElementById('dealForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveDeal(); });
    document.getElementById('newDealBtn')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openDealModal(); });
    document.getElementById('viewStatsBtn')?.addEventListener('click', openStatsModal);
    document.getElementById('activityBtn')?.addEventListener('click', openActivityModal);
    document.getElementById('authButton')?.addEventListener('click', logout);
    document.getElementById('openFilterPanelBtn')?.addEventListener('click', openFilterPanel);
    document.getElementById('cancelDealBtn')?.addEventListener('click', closeDealModal);
    document.getElementById('addContractorBtn')?.addEventListener('click', () => addContractorField());
    document.getElementById('addProductBtn')?.addEventListener('click', () => addProductField());
    document.getElementById('commentSubmitBtn')?.addEventListener('click', commentSubmitHandler);
    document.getElementById('stage')?.addEventListener('change', function() { updateProgressBarFromStage(this.value); });
    document.getElementById('closeDetailBtn')?.addEventListener('click', () => { closeDealDetailModal(); if (activityModalState.isOpen) restoreActivityModalState(); });
    document.getElementById('detailCommentSubmitBtn')?.addEventListener('click', detailCommentSubmitHandler);
    document.getElementById('closeActivityBtn')?.addEventListener('click', closeActivityModal);
    document.getElementById('closeActivityFooterBtn')?.addEventListener('click', closeActivityModal);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteDeal);
    document.getElementById('closeFilterBtn')?.addEventListener('click', closeFilterPanel);
    document.getElementById('resetFilterBtn')?.addEventListener('click', resetFilters);
    document.getElementById('applyFilterBtn')?.addEventListener('click', applyFiltersAndClosePanel);
    document.getElementById('closeStatsBtn')?.addEventListener('click', closeStatsModal);
    document.querySelectorAll('.stats-tab').forEach(tab => { tab.addEventListener('click', () => switchStatsTab(tab.dataset.tab)); });
    document.getElementById('salesFilter')?.addEventListener('change', renderSalesCharts);
    document.getElementById('priorityFilter')?.addEventListener('change', renderPriorityCharts);
    document.getElementById('searchDeals')?.addEventListener('keyup', filterDeals);
    updateBeforeDiscountEventListeners();
    if (facilitySelect && newFacilityInput) { facilitySelect.addEventListener('change', handleFacilitySelectChange); newFacilityInput.addEventListener('input', handleNewFacilityInput); }
    if (packageSelect && newPackageInput) { packageSelect.addEventListener('change', handlePackageSelectChange); newPackageInput.addEventListener('input', handleNewPackageInput); }
    setupConsultantSearch();
    setupCommentAttachmentInput();
    setupDetailCommentAttachmentInput();
    toggleDeleteOptionButtons();
}

function handleFacilitySelectChange() { if (facilitySelect && facilitySelect.value !== '' && newFacilityInput) newFacilityInput.value = ''; }
function handleNewFacilityInput() { if (newFacilityInput && newFacilityInput.value.trim() !== '' && facilitySelect) facilitySelect.value = ''; }
function handlePackageSelectChange() { if (packageSelect && packageSelect.value !== '' && newPackageInput) newPackageInput.value = ''; }
function handleNewPackageInput() { if (newPackageInput && newPackageInput.value.trim() !== '' && packageSelect) packageSelect.value = ''; }
function toggleDeleteOptionButtons() { const canDelete = currentUserRole === 'admin' || currentUserRole === 'manager'; document.querySelectorAll('.delete-option-btn').forEach(btn => canDelete ? btn.classList.remove('hidden') : btn.classList.add('hidden')); }

function initViewToggle() {
    const cardViewBtn = document.getElementById('cardViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    if (cardViewBtn && listViewBtn) { cardViewBtn.addEventListener('click', () => switchView('card')); listViewBtn.addEventListener('click', () => switchView('list')); }
}

function switchView(viewType) { if (currentView === viewType) return; currentView = viewType; document.getElementById('cardViewBtn')?.classList.toggle('active', viewType === 'card'); document.getElementById('listViewBtn')?.classList.toggle('active', viewType === 'list'); applyActiveFilters(); }

function applyActiveFilters() { try { renderFilteredDeals(getFilteredDeals()); } catch (error) { console.error("Error applying active filters:", error); } }

function saveActiveFilters() { try { activeFilters = { searchTerm: document.getElementById('searchDeals')?.value.toLowerCase() || '', priority: document.getElementById('filterPriority')?.value || 'all', year: activeYear, stage: document.getElementById('filterStage')?.value || 'all', sales: document.getElementById('filterSales')?.value || 'all', consultant: document.getElementById('filterConsultant')?.value || 'all', contractor: document.getElementById('filterContractor')?.value || 'all', facility: document.getElementById('filterFacility')?.value || 'all', product: document.getElementById('filterProduct')?.value || 'all', package: document.getElementById('filterPackage')?.value || 'all' }; } catch (error) { console.error("Error saving active filters:", error); } }

function filterDeals() { try { saveActiveFilters(); applyActiveFilters(); } catch (error) { console.error("Error filtering deals:", error); } }

function renderFilteredDeals(filteredDeals) {
    const pipelineStage = document.getElementById('pipelines-stage');
    if (!pipelineStage) return;
    pipelineStage.innerHTML = '';
    if (filteredDeals.length === 0) { pipelineStage.innerHTML = `<div class="empty-stage-message text-center text-gray-400 p-4 text-sm w-full"><i class="fas fa-search text-3xl mb-2"></i><p>${(currentUserRole === 'admin' || currentUserRole === 'manager') ? 'Tidak ada deals yang sesuai dengan filter.' : `Tidak ada pipeline untuk sales ${currentSalesName || currentUserEmail}. Silakan tambahkan deal baru.`}</p></div>`; return; }
    if (currentView === 'card') {
        const grouped = {};
        filteredDeals.forEach(deal => { const key = `${deal.dealName?.toLowerCase().trim()}|${deal.priority || 'Priority'}`; if (!grouped[key]) grouped[key] = []; grouped[key].push(deal); });
        Object.values(grouped).forEach(group => { if (group.length > 1) { const card = renderMergedDealCard(group); pipelineStage.appendChild(card); setupMergeDealCardEvents(card, group); } else pipelineStage.appendChild(renderIndividualDealCard(group[0])); });
        initSortable();
    } else {
        const container = document.createElement('div'); container.className = 'list-view-container';
        const table = document.createElement('table'); table.className = 'list-view';
        table.innerHTML = `<thead><tr><th class="px-4 py-3 text-left">No</th><th class="px-4 py-3 text-left">Sales</th><th class="px-4 py-3 text-left">Project</th><th class="px-4 py-3 text-left">Tahap</th><th class="px-4 py-3 text-left">Konsultan</th><th class="px-4 py-3 text-left">Kontraktor</th><th class="px-4 py-3 text-left">Nilai (IDR)</th><th class="px-4 py-3 text-left">Priority</th><th class="px-4 py-3 text-left">Aksi</th></tr></thead><tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        filteredDeals.forEach((deal, idx) => tbody.appendChild(renderDealList(deal, idx)));
        container.appendChild(table);
        pipelineStage.appendChild(container);
    }
}

function logout() { auth.signOut().then(() => { deals = []; activities = []; window.location.href = 'login.html'; }).catch((error) => { console.error("Error logging out:", error); showToast("Gagal logout. Silakan coba lagi.", 5000); }); }

function openFilterPanel() { const panel = document.getElementById('filterPanel'); const content = document.getElementById('filterPanelContent'); if (!panel || !content) return; populateYearDropdown(); populateFilterDropdowns(); panel.classList.remove('hidden'); content.classList.remove('modal-content-leave-active'); content.classList.add('modal-content-enter-active'); }

function closeFilterPanel() { const content = document.getElementById('filterPanelContent'); if (!content) return; content.classList.remove('modal-content-enter-active'); content.classList.add('modal-content-leave-active'); content.addEventListener('transitionend', function handler() { document.getElementById('filterPanel').classList.add('hidden'); content.classList.remove('modal-content-leave-active'); content.removeEventListener('transitionend', handler); }, { once: true }); }

function applyFiltersAndClosePanel() { saveActiveFilters(); applyActiveFilters(); closeFilterPanel(); }

function resetFilters() {
    ['filterPriority', 'filterYear', 'filterStage', 'filterSales', 'filterConsultant', 'filterContractor', 'filterFacility', 'filterProduct', 'filterPackage'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 'all'; });
    const searchDeals = document.getElementById('searchDeals'); if (searchDeals) searchDeals.value = '';
    document.querySelectorAll('.year-badge').forEach(badge => { badge.classList.remove('active'); if (badge.dataset.year === 'all') badge.classList.add('active'); });
    activeYear = 'all';
    activeFilters = { searchTerm: '', priority: 'all', year: 'all', stage: 'all', sales: 'all', consultant: 'all', contractor: 'all', facility: 'all', product: 'all', package: 'all' };
    priorityStatsCache = { 'all': null, '2025': null, '2026': null };
    dealsByYearCache = { 'all': null, '2025': null, '2026': null };
    applyActiveFilters();
    createPriorityDashboard();
}

// ==================== SEARCH KONSULTAN ====================

function setupConsultantSearch() { if (!consultantSearchInput || !consultantHiddenInput || !consultantSuggestionsDiv) return; consultantSearchInput.removeEventListener('input', handleConsultantSearchInput); consultantSearchInput.removeEventListener('blur', handleConsultantSearchBlur); consultantSearchInput.removeEventListener('focus', handleConsultantSearchFocus); document.removeEventListener('click', handleDocumentClick); consultantSearchInput.addEventListener('input', handleConsultantSearchInput); consultantSearchInput.addEventListener('blur', handleConsultantSearchBlur); consultantSearchInput.addEventListener('focus', handleConsultantSearchFocus); document.addEventListener('click', handleDocumentClick); }

function handleConsultantSearchInput() { const term = consultantSearchInput.value.toLowerCase(); consultantSuggestionsDiv.innerHTML = ''; if (term.length === 0) { consultantSuggestionsDiv.classList.add('hidden'); return; } const filtered = Array.from(uniqueConsultants).filter(c => c.toLowerCase().includes(term)).sort(); if (filtered.length) { filtered.forEach(c => { const item = document.createElement('div'); item.className = 'suggestion-item'; item.textContent = c; item.addEventListener('click', (e) => { e.stopPropagation(); consultantSearchInput.value = c; consultantHiddenInput.value = c; consultantSuggestionsDiv.classList.add('hidden'); }); consultantSuggestionsDiv.appendChild(item); }); consultantSuggestionsDiv.classList.remove('hidden'); } else consultantSuggestionsDiv.classList.add('hidden'); }

function handleConsultantSearchBlur() { setTimeout(() => { consultantHiddenInput.value = consultantSearchInput.value.trim() || ''; consultantSuggestionsDiv.classList.add('hidden'); }, 100); }

function handleConsultantSearchFocus() { if (consultantSearchInput.value.length) consultantSearchInput.dispatchEvent(new Event('input')); }

function handleDocumentClick(event) { if (!consultantSearchInput.contains(event.target) && !consultantSuggestionsDiv.contains(event.target)) consultantSuggestionsDiv.classList.add('hidden'); }

// ==================== EXPORT EXCEL ====================

function initExportElements() { document.getElementById('exportExcelBtn')?.addEventListener('click', openExportModal); document.getElementById('cancelExportBtn')?.addEventListener('click', closeExportModal); document.getElementById('confirmExportBtn')?.addEventListener('click', exportToExcel); document.getElementById('exportDateRange')?.addEventListener('change', toggleCustomDateRange); }

function toggleExportButton() { const btn = document.getElementById('exportExcelBtn'); if (btn) currentUserRole === 'admin' ? btn.classList.remove('hidden') : btn.classList.add('hidden'); }

function openExportModal() { const modal = document.getElementById('exportExcelModal'); const content = document.getElementById('exportExcelModalContent'); if (!modal || !content) return; document.getElementById('exportDateRange').value = 'all'; document.getElementById('exportFormat').value = 'detailed'; document.getElementById('customDateRange')?.classList.add('hidden'); modal.classList.remove('hidden'); content.classList.remove('modal-content-leave-active'); content.classList.add('modal-content-enter-active'); }

function closeExportModal() { const content = document.getElementById('exportExcelModalContent'); if (!content) return; content.classList.remove('modal-content-enter-active'); content.classList.add('modal-content-leave-active'); content.addEventListener('transitionend', function handler() { document.getElementById('exportExcelModal').classList.add('hidden'); content.classList.remove('modal-content-leave-active'); content.removeEventListener('transitionend', handler); }, { once: true }); }

function toggleCustomDateRange() { const range = document.getElementById('exportDateRange'); const custom = document.getElementById('customDateRange'); if (range && custom) range.value === 'custom' ? custom.classList.remove('hidden') : custom.classList.add('hidden'); }

function getDealsByDateRange() {
    const range = document.getElementById('exportDateRange'); if (!range) return deals;
    let startDate, endDate;
    if (range.value === 'custom') { const start = document.getElementById('exportStartDate')?.value; const end = document.getElementById('exportEndDate')?.value; if (!start || !end) { showToast("Harap pilih tanggal mulai dan tanggal akhir", 3000); return null; } startDate = new Date(start); endDate = new Date(end); endDate.setHours(23,59,59,999); }
    else { const now = new Date(); switch (range.value) { case 'this_month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999); break; case 'last_month': startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999); break; case 'this_quarter': const q = Math.floor(now.getMonth() / 3); startDate = new Date(now.getFullYear(), q * 3, 1); endDate = new Date(now.getFullYear(), (q + 1) * 3, 0, 23,59,59,999); break; case 'this_year': startDate = new Date(now.getFullYear(), 0, 1); endDate = new Date(now.getFullYear(), 11, 31, 23,59,59,999); break; default: return deals; } }
    return deals.filter(deal => { if (!deal.createdAt) return false; const d = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt); return d >= startDate && d <= endDate; });
}

function exportToExcel() { if (currentUserRole !== 'admin') return showToast("Hanya admin yang dapat mengekspor data", 3000); const filtered = getDealsByDateRange(); if (!filtered || filtered.length === 0) return showToast("Tidak ada data untuk diekspor", 3000); const format = document.getElementById('exportFormat')?.value || 'detailed'; try { const data = format === 'detailed' ? prepareDetailedExportData(filtered) : prepareSummaryExportData(filtered); const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sales Pipeline Data"); const range = document.getElementById('exportDateRange')?.value || 'all'; XLSX.writeFile(wb, `Sales_Pipeline_${format === 'detailed' ? 'Detail' : 'Ringkasan'}_${range}_${new Date().toISOString().split('T')[0]}.xlsx`); showToast("Data berhasil diekspor ke Excel", 3000); closeExportModal(); activitiesCollection.add({ message: `Data diekspor ke Excel (${format === 'detailed' ? 'Detail' : 'Ringkasan'}, ${range}) oleh ${auth.currentUser.email}.`, timestamp: firebase.firestore.FieldValue.serverTimestamp(), userEmail: auth.currentUser.email, read: false }); } catch (error) { console.error("Error exporting:", error); showToast("Gagal mengekspor data ke Excel", 3000); } }

function prepareDetailedExportData(dealsData) { return dealsData.map(deal => ({ 'Nama Proyek': deal.dealName || '', 'Nama Sales': deal.salesName || '', 'Tahap': deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '', 'Prioritas': deal.priority || '', 'Nilai (IDR)': deal.value || 0, 'Diskon (%)': deal.discount || 0, 'Sebelum Diskon (IDR)': deal.beforeDiscount || 0, 'Paket': deal.package || '', 'Produk': Array.isArray(deal.product) ? deal.product.join(', ') : (deal.product || ''), 'Fasilitas': deal.facility || '', 'Owner': deal.owner || '', 'Konsultan': deal.consultant || '', 'Kontraktor': Array.isArray(deal.contractor) ? deal.contractor.join(', ') : (deal.contractor || ''), 'PIC': deal.pic || '', 'Plan PO': deal.planPO || '', 'Remarks': deal.remarks || '', 'Tanggal Dibuat': formatDate(deal.createdAt), 'Terakhir Update': formatDateTime(deal.updatedAt), 'Dibuat Oleh': deal.createdBy || '' })); }

function prepareSummaryExportData(dealsData) { const unique = getUniqueProjectsForDashboard(dealsData); const summary = {}; unique.forEach(deal => { const stage = deal.stage || 'Unknown'; const sales = deal.salesName || 'Unknown'; const product = Array.isArray(deal.product) ? (deal.product[0] || 'Unknown') : (deal.product || 'Unknown'); if (!summary[stage]) summary[stage] = { stage, dealCount: 0, totalValue: 0, salesCount: {}, productCount: {} }; summary[stage].dealCount++; summary[stage].totalValue += (deal.displayValue || deal.value || 0); summary[stage].salesCount[sales] = (summary[stage].salesCount[sales] || 0) + 1; summary[stage].productCount[product] = (summary[stage].productCount[product] || 0) + 1; }); return Object.values(summary).map(item => ({ 'Tahap': item.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 'Jumlah Deal': item.dealCount, 'Total Nilai (IDR)': item.totalValue, 'Top 3 Sales': Object.entries(item.salesCount).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,c])=>`${n} (${c})`).join(', '), 'Top 3 Produk': Object.entries(item.productCount).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,c])=>`${n} (${c})`).join(', ') })); }

// ==================== TAMBAHAN UNTUK DEAL ====================

function addContractorField(initialValue = '') { const container = document.getElementById('contractorList'); if (!container) return; const div = document.createElement('div'); div.className = 'flex items-center space-x-2 mb-2'; const id = Date.now(); div.innerHTML = `<select id="contractor-select-${id}" class="w-full p-3 border border-gray-300 rounded-lg"><option value="">Pilih Kontraktor</option></select><input type="text" id="contractor-input-${id}" class="w-full p-3 border border-gray-300 rounded-lg" placeholder="Atau ketik nama kontraktor baru"><button type="button" class="remove-contractor-btn text-red-500 hover:text-red-700 p-1"><i class="fas fa-times"></i></button>`; container.appendChild(div); populateDropdown(`contractor-select-${id}`, uniqueContractors); if (initialValue) { const select = document.getElementById(`contractor-select-${id}`); const input = document.getElementById(`contractor-input-${id}`); if (uniqueContractors.has(initialValue)) { select.value = initialValue; if (input) input.value = ''; } else { select.value = ''; if (input) input.value = initialValue; } } const select = document.getElementById(`contractor-select-${id}`); const input = document.getElementById(`contractor-input-${id}`); if (select && input) { select.addEventListener('change', () => { if (select.value) input.value = ''; }); input.addEventListener('input', () => { if (input.value.trim()) select.value = ''; }); } }

function removeContractorField(btn) { btn.closest('.flex')?.remove(); }

function addProductField(initialValue = '') { const container = document.getElementById('productList'); if (!container) return; const div = document.createElement('div'); div.className = 'flex items-center space-x-2 mb-2'; const id = Date.now(); div.innerHTML = `<select id="product-select-${id}" class="w-full p-3 border border-gray-300 rounded-lg"><option value="">Pilih Produk</option><option value="Fire">Fire</option><option value="Suppresion">Suppresion</option><option value="Vesda">Vesda</option><option value="Maintenance">Maintenance</option><option value="Fire - Water">Fire - Water</option><option value="Mechanical">Mechanical</option><option value="FAS-FSS-FF">FAS-FSS-FF</option><option value="FAS&FSS">FAS&FSS</option></select><input type="text" id="product-input-${id}" class="w-full p-3 border border-gray-300 rounded-lg" placeholder="Atau ketik nama produk baru"><button type="button" class="remove-product-btn text-red-500 hover:text-red-700 p-1"><i class="fas fa-times"></i></button>`; container.appendChild(div); const select = document.getElementById(`product-select-${id}`); if (select) { Array.from(uniqueProducts).sort().forEach(v => { if (v && !['Fire','Suppresion','Vesda','Maintenance','Fire - Water','Mechanical','FAS-FSS-FF','FAS&FSS'].includes(v)) { const opt = document.createElement('option'); opt.value = v; opt.textContent = v; select.appendChild(opt); } }); if (initialValue) { const has = Array.from(select.options).some(o => o.value === initialValue); if (has) { select.value = initialValue; document.getElementById(`product-input-${id}`).value = ''; } else { select.value = ''; document.getElementById(`product-input-${id}`).value = initialValue; } } } const input = document.getElementById(`product-input-${id}`); if (select && input) { select.addEventListener('change', () => { if (select.value) input.value = ''; }); input.addEventListener('input', () => { if (input.value.trim()) select.value = ''; }); } }

function removeProductField(btn) { btn.closest('.flex')?.remove(); }

async function openDealModal(dealId = null) {
    const modal = document.getElementById('dealModal'), title = document.getElementById('modalTitle'), form = document.getElementById('dealForm');
    if (!modal || !title || !form) return;
    form.reset();
    document.getElementById('dealId').value = '';
    document.getElementById('value').value = '';
    document.getElementById('beforeDiscount').value = '';
    document.getElementById('newOwner').value = '';
    document.getElementById('newPic').value = '';
    document.getElementById('newPackage').value = '';
    document.getElementById('newFacility').value = '';
    if (consultantSearchInput) { consultantSearchInput.value = ''; consultantHiddenInput.value = ''; consultantSuggestionsDiv.innerHTML = ''; consultantSuggestionsDiv.classList.add('hidden'); }
    populateDropdown('pic', uniquePICs); populateDropdown('owner', uniqueOwners);
    document.getElementById('productList').innerHTML = '';
        if (facilitySelect) {
            facilitySelect.innerHTML = '<option value="">Pilih Fasilitas</option>' +
                '<option value="Industrial">Industrial</option>' +
                '<option value="Office">Office</option>' +
                '<option value="Hotel">Hotel</option>' +
                '<option value="Data Center">Data Center</option>' +
                '<option value="Oil & Gas">Oil & Gas</option>' +
                '<option value="Warehouse">Warehouse</option>' +
                '<option value="Other">Other</option>';
            Array.from(uniqueFacilities).sort().forEach(value => {
                if (value && !['Industrial', 'Office', 'Hotel', 'Data Center', 'Oil & Gas', 'Warehouse', 'Other'].includes(value)) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    facilitySelect.appendChild(option);
                }
            });
        }
        
        if (packageSelect) {
            packageSelect.innerHTML = '<option value="">Pilih Paket</option>' +
                '<option value="Electronic Package">Electronic Package</option>' +
                '<option value="M&E">M&E</option>' +
                '<option value="Fire Fighting Cont">Fire Fighting Cont</option>' +
                '<option value="Main Kontraktor">Main Kontraktor</option>';
            Array.from(uniquePackages).sort().forEach(value => {
                if (value && !['Electronic Package', 'M&E', 'Fire Fighting Cont', 'Main Kontraktor'].includes(value)) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    packageSelect.appendChild(option);
                }
            });
        }
        
        const contractorList = document.getElementById('contractorList');
        if (contractorList) contractorList.innerHTML = '';
        
        if (dealId) {
            title.textContent = 'Edit Deal';
            const deal = deals.find(d => d.id === dealId);
            if (deal) {
                document.getElementById('dealId').value = deal.id;
                document.getElementById('salesName').value = deal.salesName || '';
                document.getElementById('dealName').value = deal.dealName || '';
                document.getElementById('beforeDiscount').value = deal.beforeDiscount ? new Intl.NumberFormat('id-ID').format(deal.beforeDiscount) : '';
                document.getElementById('discount').value = deal.discount || '';
                calculateValueFromBeforeDiscount();
                
                if (deal.package && packageSelect) {
                    const hasOption = Array.from(packageSelect.options).some(opt => opt.value === deal.package);
                    if (hasOption) {
                        packageSelect.value = deal.package;
                        document.getElementById('newPackage').value = '';
                    } else {
                        packageSelect.value = '';
                        document.getElementById('newPackage').value = deal.package || '';
                    }
                }
                
                if (deal.product) {
                    if (Array.isArray(deal.product) && deal.product.length > 0) {
                        deal.product.forEach(product => addProductField(product));
                    } else if (deal.product) {
                        addProductField(deal.product);
                    } else {
                        addProductField();
                    }
                } else {
                    addProductField();
                }
                
                if (deal.facility && facilitySelect) {
                    const hasOption = Array.from(facilitySelect.options).some(opt => opt.value === deal.facility);
                    if (hasOption) {
                        facilitySelect.value = deal.facility;
                        document.getElementById('newFacility').value = '';
                    } else {
                        facilitySelect.value = '';
                        document.getElementById('newFacility').value = deal.facility || '';
                    }
                }
                
                const ownerSelect = document.getElementById('owner');
                if (deal.owner && uniqueOwners.has(deal.owner)) {
                    ownerSelect.value = deal.owner;
                    document.getElementById('newOwner').value = '';
                } else {
                    ownerSelect.value = '';
                    document.getElementById('newOwner').value = deal.owner || '';
                }
                
                if (consultantSearchInput) {
                    consultantSearchInput.value = deal.consultant || '';
                    consultantHiddenInput.value = deal.consultant || '';
                }
                
                if (deal.contractor) {
                    if (Array.isArray(deal.contractor) && deal.contractor.length > 0) {
                        deal.contractor.forEach(contractor => addContractorField(contractor));
                    } else if (deal.contractor) {
                        addContractorField(deal.contractor);
                    } else {
                        addContractorField();
                    }
                } else {
                    addContractorField();
                }
                
                const picSelect = document.getElementById('pic');
                if (deal.pic && uniquePICs.has(deal.pic)) {
                    picSelect.value = deal.pic;
                    document.getElementById('newPic').value = '';
                } else {
                    picSelect.value = '';
                    document.getElementById('newPic').value = deal.pic || '';
                }
                
                document.getElementById('planPO').value = deal.planPO || '';
                document.getElementById('stage').value = deal.stage || DEFAULT_STAGE;
                document.getElementById('priority').value = deal.priority || 'Priority';
                document.getElementById('remarks').value = deal.remarks || '';
                
                updateProgressBarFromStage(deal.stage);
                
                currentDealIdForComments = deal.id;
                const comments = await loadCommentsByProjectName(deal.id);
                renderComments(comments, 'commentsList');
                const commentsSection = document.getElementById('commentsSection');
                if (commentsSection) commentsSection.style.display = 'block';
                
                await renderAttachments(document.getElementById('dealAttachmentsList'), deal.id);
            }
        } else {
            title.textContent = 'Tambah Deal Baru';
            document.getElementById('stage').value = DEFAULT_STAGE;
            document.getElementById('priority').value = 'Priority';
            
            const currentUser = auth.currentUser;
            const salesNameSelect = document.getElementById('salesName');
            if (currentUser && currentUserRole === 'user') {
                const userSalesName = getCurrentSalesName();
                if (salesNameSelect && userSalesName) {
                    salesNameSelect.value = userSalesName;
                    salesNameSelect.disabled = true;
                }
            } else if (salesNameSelect) {
                salesNameSelect.disabled = false;
            }
            
            addContractorField();
            addProductField();
            
            updateProgressBarFromStage(DEFAULT_STAGE);
            
            const commentsSection = document.getElementById('commentsSection');
            if (commentsSection) commentsSection.style.display = 'none';
            currentDealIdForComments = null;
        }
        
        modal.classList.remove('hidden');
        const modalContent = document.getElementById('dealModalContent');
        if (modalContent) {
            modalContent.classList.remove('modal-content-leave-active');
            modalContent.classList.add('modal-content-enter-active');
        }
    } catch (error) {
        console.error("Error opening deal modal:", error);
        showToast("Gagal membuka modal deal", 3000);
    }
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
        const salesNameSelect = document.getElementById('salesName');
        if (salesNameSelect) salesNameSelect.disabled = false;
    }, { once: true });
}

async function saveDeal() {
    try {
        const dealId = document.getElementById('dealId').value;
        const salesName = document.getElementById('salesName').value;
        const dealName = document.getElementById('dealName').value.trim();
        const stage = document.getElementById('stage').value;
        const priority = document.getElementById('priority').value;
        
        if (!dealName) {
            showToast("Nama proyek wajib diisi", 3000);
            return;
        }
        if (!stage) {
            showToast("Tahap wajib dipilih", 3000);
            return;
        }
        
        const beforeDiscountRaw = document.getElementById('beforeDiscount').value.replace(/[^0-9]/g, '');
        const beforeDiscount = parseFloat(beforeDiscountRaw) || 0;
        if (beforeDiscount <= 0) {
            showToast("Nilai sebelum diskon harus lebih dari 0", 3000);
            return;
        }
        
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        let calculatedValue = beforeDiscount;
        if (discount > 0 && discount <= 100) {
            calculatedValue = beforeDiscount * (1 - (discount / 100));
        }
        
        // Package
        let packageValue = '';
        const packageSelectEl = document.getElementById('package');
        const newPackageInputEl = document.getElementById('newPackage');
        if (packageSelectEl && packageSelectEl.value !== '') {
            packageValue = packageSelectEl.value;
            if (newPackageInputEl) newPackageInputEl.value = '';
        } else if (newPackageInputEl && newPackageInputEl.value.trim() !== '') {
            packageValue = newPackageInputEl.value.trim();
            if (!uniquePackages.has(packageValue)) {
                uniquePackages.add(packageValue);
                saveDropdownOptions();
            }
        }
        
        // Facility
        let facilityValue = '';
        const facilitySelectEl = document.getElementById('facility');
        const newFacilityInputEl = document.getElementById('newFacility');
        if (facilitySelectEl && facilitySelectEl.value !== '') {
            facilityValue = facilitySelectEl.value;
            if (newFacilityInputEl) newFacilityInputEl.value = '';
        } else if (newFacilityInputEl && newFacilityInputEl.value.trim() !== '') {
            facilityValue = newFacilityInputEl.value.trim();
            if (!uniqueFacilities.has(facilityValue)) {
                uniqueFacilities.add(facilityValue);
                saveDropdownOptions();
            }
        }
        
        // Products
        const productElements = document.querySelectorAll('#productList select, #productList input[type="text"]');
        const products = [];
        for (let i = 0; i < productElements.length; i += 2) {
            const selectEl = productElements[i];
            const inputEl = productElements[i + 1];
            let productValue = '';
            if (selectEl && selectEl.value !== '') {
                productValue = selectEl.value;
            } else if (inputEl && inputEl.value.trim() !== '') {
                productValue = inputEl.value.trim();
                if (!uniqueProducts.has(productValue)) uniqueProducts.add(productValue);
            }
            if (productValue) products.push(productValue);
        }
        
        // Contractors
        const contractorElements = document.querySelectorAll('#contractorList select, #contractorList input[type="text"]');
        const contractors = [];
        for (let i = 0; i < contractorElements.length; i += 2) {
            const selectEl = contractorElements[i];
            const inputEl = contractorElements[i + 1];
            let contractorValue = '';
            if (selectEl && selectEl.value !== '') {
                contractorValue = selectEl.value;
            } else if (inputEl && inputEl.value.trim() !== '') {
                contractorValue = inputEl.value.trim();
                if (!uniqueContractors.has(contractorValue)) uniqueContractors.add(contractorValue);
            }
            if (contractorValue) contractors.push(contractorValue);
        }
        
        // Owner
        let ownerValue = '';
        const ownerSelect = document.getElementById('owner');
        const newOwnerInputEl = document.getElementById('newOwner');
        if (ownerSelect && ownerSelect.value !== '') {
            ownerValue = ownerSelect.value;
            if (newOwnerInputEl) newOwnerInputEl.value = '';
        } else if (newOwnerInputEl && newOwnerInputEl.value.trim() !== '') {
            ownerValue = newOwnerInputEl.value.trim();
            if (!uniqueOwners.has(ownerValue)) {
                uniqueOwners.add(ownerValue);
                saveDropdownOptions();
            }
        }
        
        // PIC
        let picValue = '';
        const picSelect = document.getElementById('pic');
        const newPicInputEl = document.getElementById('newPic');
        if (picSelect && picSelect.value !== '') {
            picValue = picSelect.value;
            if (newPicInputEl) newPicInputEl.value = '';
        } else if (newPicInputEl && newPicInputEl.value.trim() !== '') {
            picValue = newPicInputEl.value.trim();
            if (!uniquePICs.has(picValue)) {
                uniquePICs.add(picValue);
                saveDropdownOptions();
            }
        }
        
        const dealData = {
            salesName: salesName,
            dealName: dealName,
            stage: stage,
            priority: priority,
            value: Math.round(calculatedValue),
            beforeDiscount: beforeDiscount,
            discount: discount,
            package: packageValue,
            product: products.length > 0 ? (products.length === 1 ? products[0] : products) : '',
            facility: facilityValue,
            owner: ownerValue,
            consultant: document.getElementById('consultantSearch').value.trim(),
            contractor: contractors.length > 0 ? (contractors.length === 1 ? contractors[0] : contractors) : '',
            pic: picValue,
            planPO: document.getElementById('planPO').value,
            remarks: document.getElementById('remarks').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.currentUser.email
        };
        
        if (!dealId) {
            dealData.createdBy = auth.currentUser.email;
            dealData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        if (dealId) {
            const oldDeal = getDealById(dealId);
            await dealsCollection.doc(dealId).update(dealData);
            
            let changes = [];
            if (oldDeal) {
                if (oldDeal.stage !== stage) changes.push(`stage: ${oldDeal.stage} → ${stage}`);
                if (oldDeal.priority !== priority) changes.push(`priority: ${oldDeal.priority} → ${priority}`);
                if (oldDeal.value !== calculatedValue) changes.push(`nilai: Rp ${formatNumber(oldDeal.value)} → Rp ${formatNumber(calculatedValue)}`);
            }
            const changeMessage = changes.length > 0 ? ` (${changes.join(', ')})` : '';
            
            await activitiesCollection.add({
                message: `Deal "${dealName}" diperbarui oleh ${auth.currentUser.email}.${changeMessage}`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: auth.currentUser.email,
                read: false
            });
            
            showToast(`Deal "${dealName}" berhasil diperbarui!`, 2000);
        } else {
            await dealsCollection.add(dealData);
            
            await activitiesCollection.add({
                message: `Deal "${dealName}" ditambahkan oleh ${auth.currentUser.email}. (Nilai: Rp ${formatNumber(calculatedValue)}, Tahap: ${stage}, Priority: ${priority})`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: auth.currentUser.email,
                read: false
            });
            
            showToast(`Deal "${dealName}" berhasil ditambahkan!`, 2000);
        }
        
        priorityStatsCache = { 'all': null, '2025': null, '2026': null };
        dealsByYearCache = { 'all': null, '2025': null, '2026': null };
        activitiesCache.lastFetch = null;
        
        closeDealModal();
        await loadDealsFromFirebase(true);
        await loadActivitiesFromFirebase(true);
        
    } catch (error) {
        console.error("Error saving deal:", error);
        showToast("Gagal menyimpan deal", 3000);
    }
}

function prepareEditDeal(dealId) {
    openDealModal(dealId);
}

async function openDealDetailModal(dealId) {
    try {
        let deal = getDealById(dealId);
        if (!deal) deal = deals.find(d => d.id === dealId);
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) {
                deal = { id: dealDoc.id, ...dealDoc.data() };
                deals.push(deal);
                dealsByIdCache.set(dealId, deal);
            }
        }
        if (!deal) {
            showToast("Deal tidak ditemukan", 3000);
            return;
        }
        
        const allProjectDeals = deals.filter(d => 
            d.dealName?.trim().toLowerCase() === deal.dealName?.trim().toLowerCase()
        );
        const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
        const isLastProject = activeProjects.length === 1;
        let displayValue = isLastProject ? (deal.value || 0) : Math.max(...activeProjects.map(d => d.value || 0));
        
        const mergedProjectsInfo = identifyMergedProjects(deals);
        const dealNameLower = deal.dealName?.toLowerCase().trim();
        const hasDifferentPriorities = mergedProjectsInfo[dealNameLower] && mergedProjectsInfo[dealNameLower].count > 1;
        const allPriorities = hasDifferentPriorities ? mergedProjectsInfo[dealNameLower].priorities : [deal.priority];
        
        document.getElementById('dealDetailTitle').textContent = `Detail Deal: ${deal.dealName}`;
        document.getElementById('detailSalesName').textContent = deal.salesName || '-';
        
        const valueElement = document.getElementById('detailValue');
        let valueHtml = `Rp ${formatNumber(displayValue)}`;
        if (!isLastProject && (deal.value || 0) < displayValue) {
            valueHtml += ` <span class="text-xs text-gray-500">(nilai asli: Rp ${formatNumber(deal.value || 0)})</span>`;
        }
        valueElement.innerHTML = valueHtml;
        
        document.getElementById('detailDiscount').textContent = deal.discount ? `${deal.discount}%` : '-';
        document.getElementById('detailBeforeDiscount').textContent = `Rp ${formatNumber(deal.beforeDiscount) || '0'}`;
        document.getElementById('detailPackage').textContent = deal.package || '-';
        
        let productText = '-';
        if (deal.product) productText = Array.isArray(deal.product) ? deal.product.join(', ') : deal.product;
        document.getElementById('detailProduct').textContent = productText;
        
        document.getElementById('detailFacility').textContent = deal.facility || '-';
        document.getElementById('detailOwner').textContent = deal.owner || '-';
        document.getElementById('detailConsultant').textContent = deal.consultant || '-';
        
        let contractorText = '-';
        if (deal.contractor) contractorText = Array.isArray(deal.contractor) ? deal.contractor.join(', ') : deal.contractor;
        document.getElementById('detailContractor').textContent = contractorText;
        
        document.getElementById('detailPIC').textContent = deal.pic || '-';
        document.getElementById('detailPlanPO').textContent = deal.planPO || '-';
        document.getElementById('detailStage').textContent = deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-';
        
        const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
        const priorityElement = document.getElementById('detailPriority');
        priorityElement.innerHTML = `<span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">${deal.priority || '-'}</span>`;
        
        document.getElementById('detailCreatedDate').textContent = formatDate(deal.createdAt);
        document.getElementById('detailRemarks').textContent = deal.remarks || '-';
        
        const otherPrioritiesInfo = document.getElementById('otherPrioritiesInfo');
        if (otherPrioritiesInfo) {
            if (hasDifferentPriorities && allPriorities.length > 1) {
                const otherPriorities = allPriorities.filter(p => p !== deal.priority);
                otherPrioritiesInfo.innerHTML = `
                    <div class="mt-2 p-2 bg-purple-50 rounded-lg text-sm">
                        <i class="fas fa-info-circle text-purple-600 mr-1"></i>
                        <span class="font-medium">Project ini juga tersedia di priority:</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${otherPriorities.map(p => `<span class="px-2 py-1 rounded-full text-xs ${getPriorityBadgeClass(p)}">${p}</span>`).join('')}
                        </div>
                        <button class="view-all-priorities-btn text-purple-600 hover:text-purple-800 mt-1 text-xs" data-deal-name="${deal.dealName}">
                            <i class="fas fa-list mr-1"></i>Lihat semua priority
                        </button>
                    </div>
                `;
                otherPrioritiesInfo.classList.remove('hidden');
                const viewAllBtn = otherPrioritiesInfo.querySelector('.view-all-priorities-btn');
                if (viewAllBtn) {
                    viewAllBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        closeDealDetailModal();
                        showAllPrioritiesForProject(deal.dealName);
                    });
                }
            } else {
                otherPrioritiesInfo.classList.add('hidden');
            }
        }
        
        let progress = 0;
        switch (deal.stage) {
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
        
        document.getElementById('dealDetailModal').classList.remove('hidden');
        const modalContent = document.getElementById('dealDetailModalContent');
        if (modalContent) {
            modalContent.classList.remove('modal-content-leave-active');
            modalContent.classList.add('modal-content-enter-active');
        }
        
    } catch (error) {
        console.error("Error opening deal detail modal:", error);
        showToast("Gagal membuka detail deal", 3000);
    }
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
    }, { once: true });
}

function confirmDeleteDeal(dealId, dealName) {
    dealToDeleteId = dealId;
    dealToDeleteName = dealName;
    document.getElementById('dealToDeleteName').textContent = dealName;
    document.getElementById('deleteModal').classList.remove('hidden');
    const modalContent = document.getElementById('deleteModalContent');
    if (modalContent) {
        modalContent.classList.remove('modal-content-leave-active');
        modalContent.classList.add('modal-content-enter-active');
    }
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
    const dealId = dealToDeleteId;
    const dealName = dealToDeleteName;
    if (!dealId) return;
    
    try {
        const dealDoc = await dealsCollection.doc(dealId).get();
        if (!dealDoc.exists) {
            showToast("Deal tidak ditemukan di database", 3000);
            return;
        }
        const dealData = dealDoc.data();
        
        await deletedDealsCollection.add({
            ...dealData,
            originalId: dealId,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedBy: auth.currentUser.email,
            deletedByEmail: auth.currentUser.email
        });
        
        await dealsCollection.doc(dealId).delete();
        
        await activitiesCollection.add({
            message: `Deal "${dealName}" dipindahkan ke Recycle Bin oleh ${auth.currentUser.email}. (Nilai: Rp ${formatNumber(dealData.value || 0)})`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        showToast(`Deal "${dealName}" berhasil dipindahkan ke Recycle Bin!`, 2000);
        
        priorityStatsCache = { 'all': null, '2025': null, '2026': null };
        dealsByYearCache = { 'all': null, '2025': null, '2026': null };
        dealsByIdCache.delete(dealId);
        activitiesCache.lastFetch = null;
        
        closeDeleteModal();
        await loadDealsFromFirebase(true);
        await loadActivitiesFromFirebase(true);
        
        if (currentUserRole === 'admin') loadRecycleBin();
        
    } catch (error) {
        console.error("Error deleting deal:", error);
        showToast("Gagal menghapus deal", 3000);
    }
}

// ==================== AUTH STATE CHANGE ====================

auth.onAuthStateChanged(async (user) => {
    if (authInitialized) return;
    authInitialized = true;
    
    console.log("Auth state changed:", user ? user.email : "no user");
    
    if (!user && window.location.pathname.includes('app.html')) {
        window.location.href = 'login.html';
        return;
    }
    if (user && window.location.pathname.includes('login.html')) {
        window.location.href = 'app.html';
        return;
    }
    
    if (user && window.location.pathname.includes('app.html')) {
        try {
            currentUserEmail = user.email;
            
            const migrationFlag = localStorage.getItem('comments_migration_completed');
            if (migrationFlag === 'true') commentsMigrationCompleted = true;
            
            const userWelcome = document.getElementById('userWelcome');
            if (userWelcome) userWelcome.textContent = user.email;
            
            if (managerEmails.includes(user.email)) {
                if (user.email === 'admin@genetek.co.id' || user.email === 'david@genetek.co.id') {
                    currentUserRole = 'admin';
                } else {
                    currentUserRole = 'manager';
                }
                await usersCollection.doc(user.uid).set({ role: currentUserRole, email: user.email }, { merge: true });
            } else {
                currentUserRole = 'user';
                const userDoc = await usersCollection.doc(user.uid).get();
                if (!userDoc.exists) {
                    await usersCollection.doc(user.uid).set({ role: 'user', email: user.email }, { merge: true });
                } else {
                    currentUserRole = userDoc.data().role || 'user';
                }
            }
            
            currentSalesName = getCurrentSalesName();
            console.log("Current role:", currentUserRole);
            console.log("Current sales name:", currentSalesName);
            
            applyUserPermissions();
            await loadConsultantsFromFirebase();
            await loadDropdownOptions();
            await loadDealsFromFirebase();
            await loadActivitiesFromFirebase();
            
            initEventListeners();
            initViewToggle();
            initExportElements();
            initYearFilter();
            
            if (currentUserRole === 'admin') loadRecycleBin();
            
        } catch (error) {
            console.error("Error checking user role:", error);
            showToast("Gagal memuat data pengguna. Silakan refresh halaman.", 5000);
        }
    }
});

// ==================== INISIALISASI ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing application...");
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
window.closeClickableChartModal = closeClickableChartModal;
window.refreshCommentsForCurrentDeal = refreshCommentsForCurrentDeal;
window.uploadAttachmentForDeal = uploadAttachmentForDeal;
window.uploadAttachmentForComment = uploadAttachmentForComment;
