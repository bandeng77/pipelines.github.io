// ==================== FULL SCRIPT PERBAIKAN KOMENTAR ====================
// File: app.js
// Sistem Komentar: 1 Project Name = 1 Thread Komentar Bersama untuk Semua Sales
// DENGAN MIGRASI DATA KOMENTAR LAMA

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
    'bintang@genetek.co.id',
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

// ==================== FUNGSI UTILITAS DASAR (DIDEKLARASIKAN AWAL) ====================

/**
 * Mendapatkan nama sales dari email yang login
 */
function getCurrentSalesName() {
    if (currentUserEmail && emailToSalesNameMap[currentUserEmail]) {
        return emailToSalesNameMap[currentUserEmail];
    }
    return null;
}

/**
 * Escape HTML untuk keamanan
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Mendapatkan project key yang unik untuk komentar (berdasarkan nama project)
 * Semua sales yang mengerjakan project yang sama akan menggunakan key yang sama
 */
function getProjectKey(dealName) {
    if (!dealName) return null;
    // Normalisasi: lowercase, trim, dan hapus spasi berlebih
    return dealName.trim().toLowerCase();
}

/**
 * Filter deals berdasarkan user yang login
 */
function filterDealsByUser(dealsList) {
    if (currentUserRole === 'admin' || currentUserRole === 'manager') {
        console.log("Admin/Manager: menampilkan semua deals");
        return dealsList;
    }
    
    const currentSales = getCurrentSalesName();
    if (!currentSales) {
        console.log("No sales name found for current user");
        return [];
    }
    
    console.log(`Sales mode: filtering deals for sales: ${currentSales}`);
    
    const filtered = dealsList.filter(deal => {
        const dealSales = deal.salesName;
        const match = dealSales === currentSales;
        return match;
    });
    
    console.log(`Filtered ${filtered.length} deals out of ${dealsList.length} for sales ${currentSales}`);
    return filtered;
}

/**
 * MENDAPATKAN DEALS YANG SUDAH DIFILTER BERDASARKAN USER
 */
function getFilteredDeals() {
    let baseDeals = deals;
    baseDeals = filterDealsByUser(baseDeals);
    baseDeals = getDealsByYear(activeYear, baseDeals);
    
    const filteredDeals = baseDeals.filter(deal => {
        // Fungsi untuk mengecek apakah search term cocok dengan berbagai field
        const matchesSearchTerm = (searchTerm, deal) => {
            if (searchTerm === '') return true;
            
            const term = searchTerm.toLowerCase();
            
            // Cek nama project
            if (deal.dealName && deal.dealName.toLowerCase().includes(term)) return true;
            
            // Cek nama sales
            if (deal.salesName && deal.salesName.toLowerCase().includes(term)) return true;
            
            // Cek konsultan
            if (deal.consultant && deal.consultant.toLowerCase().includes(term)) return true;
            
            // Cek kontraktor (bisa string atau array)
            if (deal.contractor) {
                if (Array.isArray(deal.contractor)) {
                    for (const contractor of deal.contractor) {
                        if (contractor && contractor.toLowerCase().includes(term)) return true;
                    }
                } else {
                    if (deal.contractor.toLowerCase().includes(term)) return true;
                }
            }
            
            return false;
        };
        
        const matchesSearch = matchesSearchTerm(activeFilters.searchTerm, deal);
        const matchesPriority = 
            activeFilters.priority === 'all' || 
            (deal.priority && deal.priority === activeFilters.priority);
        
        const matchesStage = activeFilters.stage === 'all' || 
                            (deal.stage && deal.stage === activeFilters.stage);

        const matchesSales = activeFilters.sales === 'all' || 
                            (deal.salesName && deal.salesName === activeFilters.sales);

        const matchesConsultant = activeFilters.consultant === 'all' || 
                                (deal.consultant && deal.consultant === activeFilters.consultant);
        
        const matchesContractor = activeFilters.contractor === 'all' || 
                                (deal.contractor && 
                                (Array.isArray(deal.contractor) ? 
                                deal.contractor.includes(activeFilters.contractor) : 
                                deal.contractor === activeFilters.contractor));

        const matchesProduct = activeFilters.product === 'all' || 
                            (deal.product && 
                            (Array.isArray(deal.product) ? 
                            deal.product.includes(activeFilters.product) : 
                            deal.product === activeFilters.product));

        const matchesFacility = activeFilters.facility === 'all' || 
                                (deal.facility && deal.facility === activeFilters.facility);

        const matchesPackage = activeFilters.package === 'all' || 
                            (deal.package && deal.package === activeFilters.package);
        
        return matchesSearch && matchesPriority && matchesStage && matchesSales &&
            matchesConsultant && matchesContractor && matchesFacility && matchesProduct && matchesPackage;
    });
    
    return filteredDeals;
}

/**
 * Mendapatkan deals yang sudah difilter untuk dashboard
 */
function getFilteredUniqueProjectsForDashboard() {
    const userFilteredDeals = getFilteredDeals();
    
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        const currentSales = getCurrentSalesName();
        if (currentSales) {
            const salesOnlyDeals = userFilteredDeals.filter(deal => deal.salesName === currentSales);
            return getUniqueProjectsForDashboard(salesOnlyDeals);
        }
    }
    
    return getUniqueProjectsForDashboard(userFilteredDeals);
}

/**
 * Menggabungkan project dengan nama yang sama untuk dashboard
 */
function getUniqueProjectsForDashboard(dealsList) {
    const projectMap = new Map();
    const allProjectsByName = new Map();
    
    dealsList.forEach(deal => {
        const projectName = deal.dealName?.trim();
        if (!projectName) return;
        
        if (!allProjectsByName.has(projectName)) {
            allProjectsByName.set(projectName, []);
        }
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
        
        if (!projectMap.has(key)) {
            projectMap.set(key, []);
        }
        projectMap.get(key).push(deal);
    });
    
    const uniqueProjects = [];
    
    projectMap.forEach((duplicateDeals, key) => {
        const [projectName, priority] = key.split('|');
        
        const activeDeals = duplicateDeals.filter(deal => deal.stage !== 'lost');
        
        if (activeDeals.length === 0) {
            return;
        }
        
        const allDealsWithSameName = allProjectsByName.get(projectName) || [];
        const activeProjectsCount = allDealsWithSameName.filter(d => d.stage !== 'lost').length;
        const isLastProject = (activeProjectsCount === 1);
        
        activeDeals.forEach(deal => {
            let displayValue;
            let hasHigherValueFromOtherPriority = false;
            
            if (isLastProject) {
                displayValue = deal.value || 0;
                hasHigherValueFromOtherPriority = false;
            } else {
                const highestValue = maxValueByProjectName.get(projectName) || 0;
                displayValue = highestValue;
                hasHigherValueFromOtherPriority = (deal.value || 0) < highestValue;
            }
            
            const newDeal = { ...deal };
            newDeal.hasMultipleEntries = duplicateDeals.length > 1;
            newDeal.totalEntries = duplicateDeals.length;
            newDeal.allEntries = duplicateDeals;
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

// ==================== FILTER TAHUN ====================

function initYearFilter() {
    const yearFilterContainer = document.querySelector('.year-filter-container');
    if (!yearFilterContainer) return;

    yearFilterContainer.addEventListener('click', (e) => {
        const yearBadge = e.target.closest('.year-badge');
        if (!yearBadge) return;

        const year = yearBadge.dataset.year;
        
        document.querySelectorAll('.year-badge').forEach(badge => {
            badge.classList.remove('active');
        });
        yearBadge.classList.add('active');
        
        activeYear = year;
        
        if (!priorityStatsCache[year]) {
            priorityStatsCache[year] = null;
        }
        
        activeFilters.year = year;
        applyActiveFilters();
        createPriorityDashboard();
        
        showToast(`Menampilkan data tahun ${year === 'all' ? 'semua tahun' : year}`, 2000);
    });
}

function getDealsByYear(year, baseDeals = null) {
    const sourceDeals = baseDeals !== null ? baseDeals : filterDealsByUser(deals);
    
    if (dealsByYearCache[year] && baseDeals === null) {
        return dealsByYearCache[year];
    }
    
    if (year === 'all') {
        if (baseDeals === null) {
            dealsByYearCache[year] = sourceDeals;
        }
        return sourceDeals;
    }
    
    const filtered = sourceDeals.filter(deal => {
        if (!deal.createdAt) return false;
        
        try {
            let dealDate;
            if (deal.createdAt.toDate) {
                dealDate = deal.createdAt.toDate();
            } else if (deal.createdAt.seconds) {
                dealDate = new Date(deal.createdAt.seconds * 1000);
            } else {
                dealDate = new Date(deal.createdAt);
            }
            
            if (isNaN(dealDate.getTime())) return false;
            
            return dealDate.getFullYear().toString() === year;
        } catch (e) {
            return false;
        }
    });
    
    if (baseDeals === null) {
        dealsByYearCache[year] = filtered;
    }
    
    return filtered;
}

// ==================== FUNGSI MIGRASI KOMENTAR LAMA ====================

/**
 * MIGRASI DATA KOMENTAR LAMA
 * Fungsi ini akan membaca semua komentar lama (tanpa projectKey) dan menambahkan projectKey
 * berdasarkan dealId yang tersimpan
 */
async function migrateOldComments() {
    if (commentsMigrationCompleted) {
        console.log("Migrasi komentar sudah pernah dilakukan, skip...");
        return;
    }
    
    console.log("Memulai migrasi data komentar lama...");
    
    try {
        // Ambil semua komentar
        const allCommentsSnapshot = await commentsCollection.get();
        const commentsToMigrate = [];
        
        // Buat peta dealName ke projectKey
        const dealNameToProjectKey = new Map();
        
        for (const doc of allCommentsSnapshot.docs) {
            const commentData = doc.data();
            
            // Jika komentar sudah memiliki projectKey, skip
            if (commentData.projectKey) {
                continue;
            }
            
            // Jika komentar memiliki projectName, gunakan langsung
            if (commentData.projectName) {
                const projectKey = getProjectKey(commentData.projectName);
                commentsToMigrate.push({
                    id: doc.id,
                    projectKey: projectKey,
                    projectName: commentData.projectName
                });
                continue;
            }
            
            // Jika komentar memiliki dealId, cari dealName dari dealId
            if (commentData.dealId) {
                // Cek cache terlebih dahulu
                let dealName = dealNameToProjectKey.get(commentData.dealId);
                
                if (!dealName) {
                    // Cari di deals array
                    let deal = deals.find(d => d.id === commentData.dealId);
                    
                    // Jika tidak ditemukan, coba ambil dari Firestore
                    if (!deal) {
                        try {
                            const dealDoc = await dealsCollection.doc(commentData.dealId).get();
                            if (dealDoc.exists) {
                                deal = { id: dealDoc.id, ...dealDoc.data() };
                                deals.push(deal);
                                dealsByIdCache.set(deal.id, deal);
                            }
                        } catch (e) {
                            console.warn(`Tidak dapat mengambil deal dengan ID: ${commentData.dealId}`, e);
                        }
                    }
                    
                    if (deal && deal.dealName) {
                        dealName = deal.dealName;
                        dealNameToProjectKey.set(commentData.dealId, dealName);
                    }
                } else {
                    dealName = dealNameToProjectKey.get(commentData.dealId);
                }
                
                if (dealName) {
                    const projectKey = getProjectKey(dealName);
                    commentsToMigrate.push({
                        id: doc.id,
                        projectKey: projectKey,
                        projectName: dealName
                    });
                } else {
                    console.warn(`Tidak dapat menemukan dealName untuk dealId: ${commentData.dealId}`);
                }
            }
        }
        
        // Lakukan migrasi batch
        if (commentsToMigrate.length > 0) {
            console.log(`Menemukan ${commentsToMigrate.length} komentar yang perlu dimigrasi`);
            
            const batch = db.batch();
            let batchCount = 0;
            
            for (const comment of commentsToMigrate) {
                const commentRef = commentsCollection.doc(comment.id);
                batch.update(commentRef, {
                    projectKey: comment.projectKey,
                    projectName: comment.projectName
                });
                batchCount++;
                
                // Batch maksimal 500 operasi
                if (batchCount >= 450) {
                    await batch.commit();
                    console.log(`Batch migrasi ${batchCount} komentar berhasil`);
                    batchCount = 0;
                }
            }
            
            // Commit sisa batch
            if (batchCount > 0) {
                await batch.commit();
                console.log(`Batch migrasi terakhir ${batchCount} komentar berhasil`);
            }
            
            console.log(`Migrasi ${commentsToMigrate.length} komentar selesai!`);
        } else {
            console.log("Tidak ada komentar yang perlu dimigrasi");
        }
        
        commentsMigrationCompleted = true;
        
        // Simpan flag migrasi ke localStorage agar tidak migrasi ulang
        localStorage.setItem('comments_migration_completed', 'true');
        
    } catch (error) {
        console.error("Error saat migrasi komentar:", error);
    }
}

/**
 * Load komentar berdasarkan PROJECT NAME (semua sales dalam 1 project bisa lihat komentar yang sama)
 * Versi yang kompatibel dengan komentar lama dan baru
 */
async function loadCommentsByProjectName(dealId) {
    try {
        console.log(`Loading comments for deal ID: ${dealId}`);
        
        // Dapatkan deal dari ID
        let deal = getDealById(dealId);
        
        // Jika tidak ditemukan di cache, coba cari di deals array
        if (!deal) {
            deal = deals.find(d => d.id === dealId);
        }
        
        // Jika masih tidak ditemukan, coba ambil dari Firestore
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) {
                deal = { id: dealDoc.id, ...dealDoc.data() };
                deals.push(deal);
                dealsByIdCache.set(dealId, deal);
            }
        }
        
        if (!deal || !deal.dealName) {
            console.log("Deal or deal name not found for ID:", dealId);
            return [];
        }
        
        const projectKey = getProjectKey(deal.dealName);
        console.log(`Loading comments for project key: "${projectKey}"`);
        
        // Load komentar berdasarkan projectKey (semua komentar untuk project ini)
        const querySnapshot = await commentsCollection
            .where('projectKey', '==', projectKey)
            .orderBy('timestamp', 'asc')
            .get();
        
        const comments = [];
        querySnapshot.forEach((doc) => {
            const commentData = doc.data();
            comments.push({ 
                id: doc.id, 
                ...commentData,
                timestamp: commentData.timestamp 
            });
        });
        
        console.log(`Found ${comments.length} comments for project "${projectKey}"`);
        
        // Jika tidak ada komentar dengan projectKey, coba cari komentar lama berdasarkan dealId
        if (comments.length === 0) {
            console.log(`Tidak ada komentar dengan projectKey, mencoba mencari komentar lama berdasarkan dealId: ${dealId}`);
            
            const oldCommentsSnapshot = await commentsCollection
                .where('dealId', '==', dealId)
                .orderBy('timestamp', 'asc')
                .get();
            
            const oldComments = [];
            oldCommentsSnapshot.forEach((doc) => {
                const commentData = doc.data();
                oldComments.push({ 
                    id: doc.id, 
                    ...commentData,
                    timestamp: commentData.timestamp 
                });
            });
            
            if (oldComments.length > 0) {
                console.log(`Found ${oldComments.length} old comments for dealId: ${dealId}`);
                
                // Migrasi komentar lama ini secara realtime
                const batch = db.batch();
                for (const comment of oldComments) {
                    const commentRef = commentsCollection.doc(comment.id);
                    batch.update(commentRef, {
                        projectKey: projectKey,
                        projectName: deal.dealName
                    });
                }
                await batch.commit();
                console.log(`Migrated ${oldComments.length} old comments to projectKey: ${projectKey}`);
                
                return oldComments;
            }
        }
        
        return comments;
    } catch (error) {
        console.error("Error loading comments:", error);
        return [];
    }
}

/**
 * Render komentar ke container (1 thread komentar untuk semua sales)
 */
function renderComments(comments, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.log(`Container ${containerId} not found`);
        return;
    }
    
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
        if (commentsCountElement) {
            commentsCountElement.textContent = '0 komentar';
        }
        return;
    }
    
    // Urutkan komentar berdasarkan timestamp (terlama ke terbaru)
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
        
        // Tampilkan sales name jika ada
        const salesInfo = comment.salesName ? `<span class="comment-sales ml-2">(Sales: ${escapeHtml(comment.salesName)})</span>` : '';
        
        // Format timestamp dengan aman
        let timeStr = '-';
        if (comment.timestamp) {
            try {
                if (comment.timestamp.toDate) {
                    timeStr = formatDateTime(comment.timestamp);
                } else if (comment.timestamp.seconds) {
                    timeStr = formatDateTime(new Date(comment.timestamp.seconds * 1000));
                } else {
                    timeStr = formatDateTime(comment.timestamp);
                }
            } catch(e) {
                timeStr = '-';
            }
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
            ${canDelete ? `
                <button class="comment-delete-btn" data-comment-id="${comment.id}" data-project-key="${escapeHtml(comment.projectKey || '')}">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        `;
        
        container.appendChild(commentItem);
    });
    
    // Event listener untuk delete button
    container.querySelectorAll('.comment-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const commentId = btn.dataset.commentId;
            await deleteComment(commentId);
        });
    });
    
    // Update counter komentar
    const commentsCountElement = document.getElementById(containerId === 'commentsList' ? 'commentsCount' : 'detailCommentsCount');
    if (commentsCountElement) {
        commentsCountElement.textContent = `${comments.length} komentar`;
    }
}

/**
 * Hapus komentar
 */
async function deleteComment(commentId) {
    if (!commentId) {
        showToast("Komentar tidak ditemukan", 3000);
        return;
    }
    
    try {
        await commentsCollection.doc(commentId).delete();
        
        showToast("Komentar berhasil dihapus", 2000);
        
        // Refresh komentar untuk project yang sedang aktif
        if (currentDealIdForComments) {
            const comments = await loadCommentsByProjectName(currentDealIdForComments);
            renderComments(comments, 'detailCommentsList');
            
            if (document.getElementById('commentsList')) {
                renderComments(comments, 'commentsList');
            }
        }
    } catch (error) {
        console.error("Error deleting comment:", error);
        showToast("Gagal menghapus komentar", 3000);
    }
}

/**
 * Tambah komentar untuk project (berdasarkan PROJECT NAME, bukan per sales)
 * Semua sales dalam 1 project akan melihat komentar yang sama
 */
async function addComment(dealId, content) {
    if (!content || !content.trim()) {
        showToast("Komentar tidak boleh kosong", 3000);
        return;
    }
    
    try {
        // Dapatkan deal untuk mengetahui nama project
        let deal = getDealById(dealId);
        
        if (!deal) {
            deal = deals.find(d => d.id === dealId);
        }
        
        if (!deal) {
            const dealDoc = await dealsCollection.doc(dealId).get();
            if (dealDoc.exists) {
                deal = { id: dealDoc.id, ...dealDoc.data() };
            }
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
        
        console.log(`Adding comment to project key: "${projectKey}" from user: ${currentUser.email}, sales: ${currentSalesNameValue}`);
        
        const commentData = {
            projectKey: projectKey,
            projectName: projectName,
            dealId: dealId,
            content: content.trim(),
            userEmail: currentUser.email,
            salesName: currentSalesNameValue,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await commentsCollection.add(commentData);
        
        // Refresh komentar
        const comments = await loadCommentsByProjectName(dealId);
        renderComments(comments, 'detailCommentsList');
        
        if (document.getElementById('commentsList')) {
            renderComments(comments, 'commentsList');
        }
        
        // Clear input
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

/**
 * Fungsi untuk memuat ulang komentar untuk deal yang sedang aktif
 */
async function refreshCommentsForCurrentDeal() {
    if (currentDealIdForComments) {
        const comments = await loadCommentsByProjectName(currentDealIdForComments);
        renderComments(comments, 'detailCommentsList');
        if (document.getElementById('commentsList')) {
            renderComments(comments, 'commentsList');
        }
    }
}

// ==================== FUNGSI DROPDOWN OPTIONS ====================

async function loadDropdownOptions() {
    try {
        const doc = await dropdownOptionsCollection.doc('options').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.facilities) {
                uniqueFacilities = new Set(data.facilities);
            }
            if (data.packages) {
                uniquePackages = new Set(data.packages);
            }
            if (data.owners) {
                uniqueOwners = new Set(data.owners);
            }
            if (data.pics) {
                uniquePICs = new Set(data.pics);
            }
        }
    } catch (error) {
        console.error("Error loading dropdown options:", error);
    }
}

async function saveDropdownOptions() {
    try {
        await dropdownOptionsCollection.doc('options').set({
            facilities: Array.from(uniqueFacilities),
            packages: Array.from(uniquePackages),
            owners: Array.from(uniqueOwners),
            pics: Array.from(uniquePICs),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving dropdown options:", error);
    }
}

async function deleteDropdownOption(field, value) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        showToast("Hanya admin dan manager yang dapat menghapus opsi dropdown", 3000);
        return;
    }

    try {
        switch (field) {
            case 'facility':
                uniqueFacilities.delete(value);
                break;
            case 'package':
                uniquePackages.delete(value);
                break;
            case 'owner':
                uniqueOwners.delete(value);
                break;
            case 'pic':
                uniquePICs.delete(value);
                break;
        }

        await saveDropdownOptions();
        updateDropdownOptions();
        showToast(`Opsi "${value}" berhasil dihapus`, 2000);
    } catch (error) {
        console.error("Error deleting dropdown option:", error);
        showToast("Gagal menghapus opsi dropdown", 3000);
    }
}

function updateDropdownOptions() {
    if (facilitySelect) {
        const currentValue = facilitySelect.value;
        facilitySelect.innerHTML = `
            <option value="">Pilih Fasilitas</option>
            <option value="Industrial">Industrial</option>
            <option value="Office">Office</option>
            <option value="Hotel">Hotel</option>
            <option value="Data Center">Data Center</option>
            <option value="Oil & Gas">Oil & Gas</option>
            <option value="Warehouse">Warehouse</option>
            <option value="Other">Other</option>
        `;
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
        packageSelect.innerHTML = `
            <option value="">Pilih Paket</option>
            <option value="Electronic Package">Electronic Package</option>
            <option value="M&E">M&E</option>
            <option value="Fire Fighting Cont">Fire Fighting Cont</option>
            <option value="Main Kontraktor">Main Kontraktor</option>
        `;
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

// ==================== FUNGSI PRIORITY DASHBOARD ====================

function calculatePriorityStats(year) {
    if (priorityStatsCache[year]) {
        return priorityStatsCache[year];
    }
    
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
        modalContent.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-inbox text-3xl mb-2"></i>
                <p>Tidak ada project dengan priority "${priority}" untuk ${yearText}</p>
            </div>
        `;
    } else {
        const sortedDeals = [...deals].sort((a, b) => {
            const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
            const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
            return dateB - dateA;
        });
        
        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200';
        table.innerHTML = `
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Project</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahap</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${sortedDeals.map((deal, index) => {
                    const displayValue = deal.displayValue || deal.value || 0;
                    const originalValue = deal.value || 0;
                    const hasHigherValue = deal.hasHigherValueFromOtherPriority;
                    const isLastProject = deal.isLastActiveProject;
                    
                    const lastUpdateDate = deal.updatedAt ? formatDateTime(deal.updatedAt) : (deal.createdAt ? formatDateTime(deal.createdAt) : '-');
                    
                    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
                    let valueTooltip = '';
                    
                    if (isLastProject) {
                        valueTooltip = `Nilai asli: Rp ${formatNumber(originalValue)} (hanya 1 project aktif)`;
                    } else if (hasHigherValue) {
                        valueTooltip = `Nilai asli: Rp ${formatNumber(originalValue)} - Menampilkan nilai tertinggi dari project ini`;
                        valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
                    }
                    
                    return `
                    <tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ${escapeHtml(deal.dealName || 'No Name')}
                            ${hasHigherValue && !isLastProject ? `
                                <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="Project ini memiliki nilai lebih tinggi di priority lain">
                                    <i class="fas fa-arrow-up mr-1"></i>Nilai Tertinggi
                                </span>
                            ` : ''}
                            ${isLastProject ? `
                                <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Hanya 1 project aktif yang tersisa">
                                    <i class="fas fa-star mr-1"></i>Project Terakhir
                                </span>
                            ` : ''}
                            ${deal.hasMultipleEntries ? `
                                <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title="${deal.totalEntries} entries untuk kombinasi ini">
                                    <i class="fas fa-copy mr-1"></i>${deal.totalEntries}x
                                </span>
                            ` : ''}
                            </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(deal.salesName || '-')}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold" title="${valueTooltip}">
                            ${valueDisplay}
                            </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${deal.stage === 'win' ? 'bg-green-100 text-green-800' : 
                                deal.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">
                                ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
                            </span>
                           </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <i class="fas fa-clock text-gray-400 mr-1"></i>${lastUpdateDate}
                           </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button class="text-blue-600 hover:text-blue-900 mr-3 view-detail-btn" data-id="${deal.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${deal.hasMultipleEntries ? `
                                <button class="text-purple-600 hover:text-purple-900 view-all-entries-btn" data-deal-name="${escapeHtml(deal.dealName)}" data-priority="${deal.priority}" title="Lihat semua entries untuk priority ini">
                                    <i class="fas fa-list"></i>
                                </button>
                            ` : ''}
                           </td>
                    </tr>
                `}).join('')}
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
        
        modalContent.querySelectorAll('.view-all-entries-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dealName = this.dataset.dealName;
                const priority = this.dataset.priority;
                closePriorityModal();
                showAllEntriesForProject(dealName, priority);
            });
        });
    }
    
    modal.classList.remove('hidden');
}

function closePriorityModal() {
    const modal = document.getElementById('priorityModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showAllEntriesForProject(dealName, priority) {
    const allEntries = deals.filter(deal => 
        deal.dealName?.trim() === dealName && 
        deal.priority === priority
    );
    
    if (allEntries.length === 0) {
        showToast("Tidak ada entries ditemukan", 3000);
        return;
    }
    
    const sortedEntries = [...allEntries].sort((a, b) => {
        const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
        const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
        return dateB - dateA;
    });
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.id = 'allEntriesModal';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div class="flex justify-between items-center p-4 border-b">
                <h2 class="text-xl font-semibold text-gray-800">Semua Entries untuk Project: ${escapeHtml(dealName)} (Priority: ${priority})</h2>
                <button class="close-all-entries text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            <div class="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahap</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${sortedEntries.map((entry, index) => `
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(entry.salesName || '-')}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">Rp ${formatNumber(entry.value) || '0'}</td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${entry.stage === 'win' ? 'bg-green-100 text-green-800' : 
                                        entry.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">
                                        ${entry.stage ? entry.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(entry.createdAt)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <i class="fas fa-clock text-gray-400 mr-1"></i>${entry.updatedAt ? formatDateTime(entry.updatedAt) : formatDateTime(entry.createdAt)}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button class="text-blue-600 hover:text-blue-900 view-detail-btn" data-id="${entry.id}">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.close-all-entries').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    modal.querySelectorAll('.view-detail-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dealId = btn.dataset.id;
            modal.remove();
            openDealDetailModal(dealId);
        });
    });
}

// ==================== FUNGSI PROGRESS BAR ====================

function updateProgressBarFromStage(stage) {
    let progress = 0;
    let isOnHold = false;
    
    switch (stage) {
        case 'identified':
            progress = 20;
            break;
        case 'prospect':
            progress = 40;
            break;
        case 'tender-me':
            progress = 60;
            break;
        case 'tender-main-con':
        case 'contract-award':
            progress = 80;
            break;
        case 'win':
        case 'lost':
            progress = 100;
            break;
        case 'on-hold':
            progress = 0;
            isOnHold = true;
            break;
        default:
            progress = 0;
    }
    
    updateProgressBarUI(progress, isOnHold);
}

function updateProgressBarUI(progress, isOnHold = false) {
    const progressPercentage = document.getElementById('progressPercentage');
    const progressFill = document.getElementById('progressFill');
    
    if (!progressPercentage || !progressFill) {
        return;
    }
    
    progressPercentage.textContent = `${progress}%`;
    progressFill.style.width = `${progress}%`;
    
    if (isOnHold) {
        progressFill.classList.add('onhold');
        progressPercentage.style.color = '#ef4444';
    } else {
        progressFill.classList.remove('onhold');
        progressPercentage.style.color = '#3b82f6';
    }
    
    updateCheckpoints(progress, isOnHold);
}

function updateCheckpoints(progress, isOnHold = false) {
    const checkpoints = document.querySelectorAll('.checkpoint');
    
    checkpoints.forEach(checkpoint => {
        const checkpointValue = parseInt(checkpoint.dataset.percentage);
        const stepDot = checkpoint.querySelector('.step-dot');
        const stepLabel = checkpoint.querySelector('.checkpoint-value');
        
        if (progress >= checkpointValue) {
            if (isOnHold) {
                stepDot.classList.add('onhold');
                stepLabel.classList.add('onhold');
                checkpoint.classList.add('onhold');
            } else {
                stepDot.classList.add('completed');
                stepLabel.classList.add('active');
                checkpoint.classList.add('active');
            }
        } else {
            stepDot.classList.remove('completed', 'active', 'onhold');
            stepLabel.classList.remove('active', 'onhold');
            checkpoint.classList.remove('active', 'onhold');
        }
    });
}

// ==================== FUNGSI MERGE PROJECT DALAM DEAL CARD ====================

function groupDealsByNameAndPriority(dealsList) {
    const groupedDeals = {};
    
    dealsList.forEach(deal => {
        const dealName = deal.dealName?.trim().toLowerCase();
        const priority = deal.priority || 'Priority';
        if (!dealName) return;
        
        const key = `${dealName}|${priority}`;
        
        if (!groupedDeals[key]) {
            groupedDeals[key] = [];
        }
        
        groupedDeals[key].push(deal);
    });
    
    return groupedDeals;
}

function identifyMergedProjects(dealsList) {
    const groupedByProjectName = {};
    
    dealsList.forEach(deal => {
        const dealName = deal.dealName?.trim().toLowerCase();
        if (!dealName) return;
        
        if (!groupedByProjectName[dealName]) {
            groupedByProjectName[dealName] = new Set();
        }
        groupedByProjectName[dealName].add(deal.priority || 'Priority');
    });
    
    const mergedProjectsInfo = {};
    
    Object.keys(groupedByProjectName).forEach(projectName => {
        const priorities = Array.from(groupedByProjectName[projectName]);
        if (priorities.length > 1) {
            mergedProjectsInfo[projectName] = {
                projectName: projectName,
                priorities: priorities,
                count: priorities.length
            };
        }
    });
    
    return mergedProjectsInfo;
}

function getCardDisplayValue(deal, allDealsWithSameName) {
    const activeProjects = allDealsWithSameName.filter(d => d.stage !== 'lost');
    
    if (activeProjects.length === 1) {
        return deal.value || 0;
    }
    
    return Math.max(...activeProjects.map(d => d.value || 0));
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
    }
    
    const allProjectDeals = deals.filter(deal => 
        deal.dealName?.trim().toLowerCase() === dealNameLower
    );
    
    const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
    const isLastProject = activeProjects.length === 1;
    
    let displayValue;
    let highestValueOverall;
    
    if (isLastProject) {
        displayValue = activeProjects[0].value || 0;
        highestValueOverall = displayValue;
    } else {
        highestValueOverall = Math.max(...activeProjects.map(d => d.value || 0));
        displayValue = highestValueOverall;
    }
    
    const hasMultipleSales = dealGroup.length > 1;
    const salesNames = [...new Set(dealGroup.map(deal => deal.salesName))];
    
    const mergedProjectsInfo = identifyMergedProjects(deals);
    const hasDifferentPriorities = mergedProjectsInfo[dealNameLower] && mergedProjectsInfo[dealNameLower].count > 1;
    const otherPriorities = hasDifferentPriorities ? 
        mergedProjectsInfo[dealNameLower].priorities.filter(p => p !== priority) : [];
    
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
        case 'identified':
            stageColorClass = 'bg-gray-100 text-gray-800';
            break;
        case 'prospect':
            stageColorClass = 'bg-blue-100 text-blue-800';
            break;
        case 'tender-me':
            stageColorClass = 'bg-orange-100 text-orange-800';
            break;
        case 'tender-main-con':
            stageColorClass = 'bg-purple-100 text-purple-800';
            break;
        case 'contract-award':
            stageColorClass = 'bg-indigo-100 text-indigo-800';
            break;
        case 'win':
            stageColorClass = 'bg-green-100 text-green-800';
            break;
        case 'lost':
            stageColorClass = 'bg-red-100 text-red-800';
            break;
        case 'on-hold':
            stageColorClass = 'bg-yellow-100 text-yellow-800';
            break;
        default:
            stageColorClass = 'bg-gray-100 text-gray-800';
    }

    const priorityBadgeClass = getPriorityBadgeClass(activeDeal.priority);
    const canEdit = canUserEditDeal(activeDeal);
    
    const valueIsFromOtherPriority = (!isLastProject && (activeDeal.value || 0) < displayValue);

    let salesSelectorHTML = '';
    if (hasMultipleSales && salesNames.length > 1 && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
        salesSelectorHTML = `
            <div class="multiple-sales-indicator" title="${salesNames.length} sales bekerja pada project ini">
                ${salesNames.length}
            </div>
            <div class="sales-dropdown" id="sales-dropdown-${activeDeal.id}">
                ${salesNames.map(salesName => `
                    <div class="sales-dropdown-item ${salesName === activeSales ? 'active' : ''}" 
                         data-sales="${salesName}"
                         data-deal-name="${dealNameLower}"
                         data-priority="${priority}">
                        ${salesName}
                    </div>
                `).join('')}
            </div>
        `;
    }

    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
    let valueTooltip = '';
    
    if (isLastProject) {
        valueTooltip = `Nilai asli: Rp ${formatNumber(activeDeal.value || 0)} (hanya 1 project aktif)`;
    } else if (valueIsFromOtherPriority) {
        valueTooltip = `Nilai asli: Rp ${formatNumber(activeDeal.value || 0)} - Menampilkan nilai tertinggi dari project ini`;
        valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
    }

    dealCard.innerHTML = `
        <div class="flex justify-between items-start">
            <h3 class="font-bold text-gray-800">${escapeHtml(dealName || 'No Name')}</h3>
            <span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">
                ${priority}
            </span>
        </div>
        ${salesSelectorHTML}
        <div class="mt-1 text-sm text-gray-600 deal-details">
            <p><i class="fas fa-user-tie mr-1"></i> ${escapeHtml(activeSales)}</p>
            <p class="font-semibold text-blue-600" title="${valueTooltip}">
                ${valueDisplay}
            </p>
            <p class="mt-1">
                <span class="priority-badge px-2 py-1 rounded-full ${stageColorClass}">
                    ${activeDeal.stage ? activeDeal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage'}
                </span>
            </p>
        </div>
        <div class="mt-2 flex justify-between items-center deal-footer">
            <span class="text-xs text-gray-500">
                Dibuat: ${formatDate(activeDeal.createdAt)}
                ${hasMultipleSales ? `
                    <span class="ml-1 text-yellow-600" title="${dealGroup.length} entries untuk priority ini">
                        <i class="fas fa-copy"></i> ${dealGroup.length}
                    </span>
                ` : ''}
                ${hasDifferentPriorities ? `
                    <span class="ml-1 text-purple-600" title="Project juga tersedia di priority: ${otherPriorities.join(', ')}">
                        <i class="fas fa-tags"></i> ${otherPriorities.length}+
                    </span>
                ` : ''}
                ${isLastProject ? `
                    <span class="ml-1 text-green-600" title="Hanya 1 project aktif yang tersisa">
                        <i class="fas fa-star"></i>
                    </span>
                ` : ''}
            </span>
            <div class="flex space-x-1 deal-actions">
                <button class="view-detail-btn text-blue-600 hover:text-blue-800">
                    <i class="fas fa-eye"></i>
                </button>
                ${canEdit ? `
                <button class="edit-deal-btn text-green-600 hover:text-green-800">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-deal-btn text-red-600 hover:text-red-800">
                    <i class="fas fa-trash-alt"></i>
                </button>
                ` : ''}
            </div>
        </div>
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
            indicator.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });
            
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
                        const allDealsData = JSON.parse(card.dataset.allDeals || '[]');
                        const selectedDeal = dealGroup.find(deal => deal.salesName === selectedSales);
                        
                        if (selectedDeal) {
                            const allProjectDeals = deals.filter(d => 
                                d.dealName?.trim().toLowerCase() === dealName
                            );
                            const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
                            const isLastProject = activeProjects.length === 1;
                            
                            let displayValue;
                            if (isLastProject) {
                                displayValue = selectedDeal.value || 0;
                            } else {
                                displayValue = Math.max(...activeProjects.map(d => d.value || 0));
                            }
                            
                            const salesNameElement = card.querySelector('.deal-details p:first-child');
                            const valueElement = card.querySelector('.deal-details p.font-semibold');
                            const stageElement = card.querySelector('.priority-badge:last-child');
                            const priorityElement = card.querySelector('.priority-badge:first-child');
                            const dateElement = card.querySelector('.text-xs');
                            
                            if (salesNameElement) {
                                salesNameElement.innerHTML = `<i class="fas fa-user-tie mr-1"></i> ${escapeHtml(selectedSales)}`;
                            }
                            
                            if (valueElement) {
                                let valueDisplay = `Rp ${formatNumber(displayValue)}`;
                                if (!isLastProject && (selectedDeal.value || 0) < displayValue) {
                                    valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
                                }
                                valueElement.innerHTML = valueDisplay;
                                
                                let tooltip = '';
                                if (isLastProject) {
                                    tooltip = `Nilai asli: Rp ${formatNumber(selectedDeal.value || 0)} (hanya 1 project aktif)`;
                                } else if ((selectedDeal.value || 0) < displayValue) {
                                    tooltip = `Nilai asli: Rp ${formatNumber(selectedDeal.value || 0)} - Menampilkan nilai tertinggi dari project ini`;
                                }
                                valueElement.title = tooltip;
                            }
                            
                            if (stageElement) {
                                let stageColorClass = '';
                                switch (selectedDeal.stage) {
                                    case 'identified':
                                        stageColorClass = 'bg-gray-100 text-gray-800';
                                        break;
                                    case 'prospect':
                                        stageColorClass = 'bg-blue-100 text-blue-800';
                                        break;
                                    case 'tender-me':
                                        stageColorClass = 'bg-orange-100 text-orange-800';
                                        break;
                                    case 'tender-main-con':
                                        stageColorClass = 'bg-purple-100 text-purple-800';
                                        break;
                                    case 'contract-award':
                                        stageColorClass = 'bg-indigo-100 text-indigo-800';
                                        break;
                                    case 'win':
                                        stageColorClass = 'bg-green-100 text-green-800';
                                        break;
                                    case 'lost':
                                        stageColorClass = 'bg-red-100 text-red-800';
                                        break;
                                    case 'on-hold':
                                        stageColorClass = 'bg-yellow-100 text-yellow-800';
                                        break;
                                }
                                
                                stageElement.className = `priority-badge px-2 py-1 rounded-full ${stageColorClass}`;
                                stageElement.textContent = selectedDeal.stage ? 
                                    selectedDeal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                                    'Unknown Stage';
                            }
                            
                            if (priorityElement) {
                                priorityElement.className = `priority-badge px-2 py-1 rounded-full ${getPriorityBadgeClass(selectedDeal.priority)}`;
                                priorityElement.textContent = selectedDeal.priority || 'Priority';
                            }
                            
                            if (dateElement) {
                                let dateHTML = `Dibuat: ${formatDate(selectedDeal.createdAt)}`;
                                if (dealGroup.length > 1) {
                                    dateHTML += ` <span class="ml-1 text-yellow-600"><i class="fas fa-copy"></i> ${dealGroup.length}</span>`;
                                }
                                if (isLastProject) {
                                    dateHTML += ` <span class="ml-1 text-green-600"><i class="fas fa-star"></i></span>`;
                                }
                                dateElement.innerHTML = dateHTML;
                            }
                            
                            card.dataset.id = selectedDeal.id;
                            card.dataset.displayValue = displayValue;
                            card.dataset.isLastProject = isLastProject;
                        }
                    });
                    
                    dropdown.querySelectorAll('.sales-dropdown-item').forEach(i => {
                        i.classList.remove('active');
                    });
                    this.classList.add('active');
                    
                    dropdown.classList.remove('show');
                    
                    showToast(`Menampilkan data untuk sales: ${selectedSales}`, 2000);
                });
            });
        }
    }
    
    document.addEventListener('click', function(e) {
        if (hasMultipleSales && dealCard && !dealCard.contains(e.target)) {
            const dropdown = dealCard.querySelector('.sales-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }
    });
}

function renderIndividualDealCard(deal) {
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card';
    dealCard.dataset.id = deal.id;
    dealCard.dataset.dealName = deal.dealName?.toLowerCase();
    dealCard.dataset.priority = deal.priority || 'Priority';
    
    const allProjectDeals = deals.filter(d => 
        d.dealName?.trim().toLowerCase() === deal.dealName?.trim().toLowerCase()
    );
    
    const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
    const isLastProject = activeProjects.length === 1;
    
    let displayValue;
    let highestValueOverall;
    
    if (isLastProject) {
        displayValue = deal.value || 0;
        highestValueOverall = displayValue;
    } else {
        highestValueOverall = Math.max(...activeProjects.map(d => d.value || 0));
        displayValue = highestValueOverall;
    }
    
    const mergedProjectsInfo = identifyMergedProjects(deals);
    const dealNameLower = deal.dealName?.toLowerCase().trim();
    const hasDifferentPriorities = mergedProjectsInfo[dealNameLower] && mergedProjectsInfo[dealNameLower].count > 1;
    const otherPriorities = hasDifferentPriorities ? 
        mergedProjectsInfo[dealNameLower].priorities.filter(p => p !== (deal.priority || 'Priority')) : [];
    
    let stageColorClass = '';
    switch (deal.stage) {
        case 'identified':
            stageColorClass = 'bg-gray-100 text-gray-800';
            break;
        case 'prospect':
            stageColorClass = 'bg-blue-100 text-blue-800';
            break;
        case 'tender-me':
            stageColorClass = 'bg-orange-100 text-orange-800';
            break;
        case 'tender-main-con':
            stageColorClass = 'bg-purple-100 text-purple-800';
            break;
        case 'contract-award':
            stageColorClass = 'bg-indigo-100 text-indigo-800';
            break;
        case 'win':
            stageColorClass = 'bg-green-100 text-green-800';
            break;
        case 'lost':
            stageColorClass = 'bg-red-100 text-red-800';
            break;
        case 'on-hold':
            stageColorClass = 'bg-yellow-100 text-yellow-800';
            break;
        default:
            stageColorClass = 'bg-gray-100 text-gray-800';
    }

    const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
    const canEdit = canUserEditDeal(deal);
    
    const valueIsFromOtherPriority = (!isLastProject && (deal.value || 0) < displayValue);
    
    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
    let valueTooltip = '';
    
    if (isLastProject) {
        valueTooltip = `Nilai asli: Rp ${formatNumber(deal.value || 0)} (hanya 1 project aktif)`;
    } else if (valueIsFromOtherPriority) {
        valueTooltip = `Nilai asli: Rp ${formatNumber(deal.value || 0)} - Menampilkan nilai tertinggi dari project ini`;
        valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
    }

    dealCard.innerHTML = `
        <div class="flex justify-between items-start">
            <h3 class="font-bold text-gray-800">${escapeHtml(deal.dealName || 'No Name')}</h3>
            <span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">
                ${deal.priority || 'Priority'}
            </span>
        </div>
        <div class="mt-1 text-sm text-gray-600 deal-details">
            <p><i class="fas fa-user-tie mr-1"></i> ${escapeHtml(deal.salesName || '-')}</p>
            <p class="font-semibold text-blue-600" title="${valueTooltip}">
                ${valueDisplay}
            </p>
            <p class="mt-1">
                <span class="priority-badge px-2 py-1 rounded-full ${stageColorClass}">
                    ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage'}
                </span>
            </p>
        </div>
        <div class="mt-2 flex justify-between items-center deal-footer">
            <span class="text-xs text-gray-500">
                Dibuat: ${formatDate(deal.createdAt)}
                ${hasDifferentPriorities ? `
                    <span class="ml-1 text-purple-600" title="Project juga tersedia di priority: ${otherPriorities.join(', ')}">
                        <i class="fas fa-tags"></i> ${otherPriorities.length}+
                    </span>
                ` : ''}
                ${isLastProject ? `
                    <span class="ml-1 text-green-600" title="Hanya 1 project aktif yang tersisa">
                        <i class="fas fa-star"></i>
                    </span>
                ` : ''}
            </span>
            <div class="flex space-x-1 deal-actions">
                <button class="view-detail-btn text-blue-600 hover:text-blue-800">
                    <i class="fas fa-eye"></i>
                </button>
                ${canEdit ? `
                <button class="edit-deal-btn text-green-600 hover:text-green-800">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-deal-btn text-red-600 hover:text-red-800">
                    <i class="fas fa-trash-alt"></i>
                </button>
                ` : ''}
            </div>
        </div>
    `;
    
    return dealCard;
}

function renderDealList(deal, index) {
    const row = document.createElement('tr');
    row.dataset.id = deal.id;
    row.className = 'hover:bg-gray-50 cursor-pointer view-detail-row';
    
    const canEdit = canUserEditDeal(deal);
    const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
    const winDate = getWinDate(deal);
    
    const allProjectDeals = deals.filter(d => 
        d.dealName?.trim().toLowerCase() === deal.dealName?.trim().toLowerCase()
    );
    
    const activeProjects = allProjectDeals.filter(d => d.stage !== 'lost');
    const isLastProject = activeProjects.length === 1;
    
    let displayValue;
    if (isLastProject) {
        displayValue = deal.value || 0;
    } else {
        displayValue = Math.max(...activeProjects.map(d => d.value || 0));
    }
    
    let contractorText = '-';
    if (deal.contractor) {
        if (Array.isArray(deal.contractor)) {
            contractorText = deal.contractor.join(', ');
        } else {
            contractorText = deal.contractor;
        }
    }
    
    const maxLength = 100;
    let dealNameDisplay = deal.dealName || 'No Name';
    if (dealNameDisplay.length > maxLength) {
        dealNameDisplay = dealNameDisplay.substring(0, maxLength) + '...';
    }
    
    let consultantDisplay = deal.consultant || '-';
    if (consultantDisplay.length > maxLength) {
        consultantDisplay = consultantDisplay.substring(0, maxLength) + '...';
    }
    
    let contractorDisplay = contractorText;
    if (contractorDisplay.length > maxLength) {
        contractorDisplay = contractorDisplay.substring(0, maxLength) + '...';
    }
    
    const valueIsFromOtherPriority = (!isLastProject && (deal.value || 0) < displayValue);
    
    let valueDisplay = `Rp ${formatNumber(displayValue)}`;
    let valueTooltip = '';
    
    if (isLastProject) {
        valueTooltip = `Nilai asli: Rp ${formatNumber(deal.value || 0)} (hanya 1 project aktif)`;
    } else if (valueIsFromOtherPriority) {
        valueTooltip = `Nilai asli: Rp ${formatNumber(deal.value || 0)} - Menampilkan nilai tertinggi dari project ini`;
        valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
    }
    
    row.innerHTML = `
        <td class="px-4 py-3 align-top text-sm">${index + 1}</td>
        <td class="px-4 py-3 align-top text-sm">${escapeHtml(deal.salesName || '-')}</td>
        <td class="px-4 py-3 align-top text-sm">
            ${escapeHtml(dealNameDisplay)}
            ${allProjectDeals.length > 1 ? `
                <span class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="Project ini memiliki ${allProjectDeals.length} entries dengan berbagai priority">
                    <i class="fas fa-tags mr-1"></i>${allProjectDeals.length}
                </span>
            ` : ''}
            ${isLastProject ? `
                <span class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Hanya 1 project aktif yang tersisa">
                    <i class="fas fa-star mr-1"></i>Last
                </span>
            ` : ''}
            </td>
        <td class="px-4 py-3 align-top text-sm">
            ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
            ${winDate ? `
            <div class="win-date-container">
                <i class="fas fa-calendar-check mr-1"></i>${formatDate(winDate)}
            </div>
            ` : ''}
            </td>
        <td class="px-4 py-3 align-top text-sm">${escapeHtml(consultantDisplay)}</td>
        <td class="px-4 py-3 align-top text-sm">${escapeHtml(contractorDisplay)}</td>
        <td class="px-4 py-3 align-top text-sm font-semibold" title="${valueTooltip}">
            ${valueDisplay}
            </td>
        <td class="px-4 py-3 align-top">
            <span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">
                ${deal.priority || 'Priority'}
            </span>
            </td>
        <td class="px-4 py-3 align-top text-sm deal-actions">
            <div class="flex space-x-2">
                <button class="view-detail-btn text-blue-600 hover:text-blue-800">
                    <i class="fas fa-eye"></i>
                </button>
                ${canEdit ? `
                <button class="edit-deal-btn text-green-600 hover:text-green-800">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-deal-btn text-red-600 hover:text-red-800">
                    <i class="fas fa-trash-alt"></i>
                </button>
                ` : ''}
                ${allProjectDeals.length > 1 ? `
                <button class="text-purple-600 hover:text-purple-900 view-all-priorities-btn" data-deal-name="${escapeHtml(deal.dealName)}" title="Lihat semua priority untuk project ini">
                    <i class="fas fa-list"></i>
                </button>
                ` : ''}
            </div>
            </td>
    `;
    
    return row;
}

function showAllPrioritiesForProject(dealName) {
    const allEntries = deals.filter(deal => deal.dealName?.trim() === dealName);
    
    if (allEntries.length === 0) {
        showToast("Tidak ada entries ditemukan", 3000);
        return;
    }
    
    const activeEntries = allEntries.filter(deal => deal.stage !== 'lost');
    const isLastProject = activeEntries.length === 1;
    
    const byPriority = {};
    allEntries.forEach(deal => {
        const priority = deal.priority || 'Priority';
        if (!byPriority[priority]) {
            byPriority[priority] = [];
        }
        byPriority[priority].push(deal);
    });
    
    Object.keys(byPriority).forEach(priority => {
        byPriority[priority].sort((a, b) => {
            const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
            const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
            return dateB - dateA;
        });
    });
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.id = 'allPrioritiesModal';
    
    const highestValue = isLastProject ? 
        (activeEntries[0]?.value || 0) : 
        Math.max(...allEntries.map(d => d.value || 0));
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
            <div class="flex justify-between items-center p-4 border-b">
                <h2 class="text-xl font-semibold text-gray-800">Semua Priority untuk Project: ${escapeHtml(dealName)}</h2>
                <button class="close-all-priorities text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            <div class="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                ${isLastProject ? `
                    <div class="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                        <i class="fas fa-info-circle text-green-600 mr-2"></i>
                        <span class="text-green-700">Hanya 1 project aktif yang tersisa. Nilai yang ditampilkan adalah nilai asli (Rp ${formatNumber(highestValue)}).</span>
                    </div>
                ` : `
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                        <span class="text-blue-700">Multiple project aktif. Nilai tertinggi yang ditampilkan adalah Rp ${formatNumber(highestValue)}.</span>
                    </div>
                `}
                ${Object.keys(byPriority).sort().map(priority => `
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold mb-2 priority-title-${priority.toLowerCase().replace(' ', '-')}">Priority: ${priority}</h3>
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahap</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${byPriority[priority].map((entry, index) => {
                                    const isActive = entry.stage !== 'lost';
                                    const rowClass = isActive ? 'hover:bg-gray-50' : 'opacity-60 bg-gray-50';
                                    const stageClass = entry.stage === 'win' ? 'bg-green-100 text-green-800' : 
                                        entry.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
                                    
                                    return `
                                    <tr class="${rowClass}">
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(entry.salesName || '-')}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                            Rp ${formatNumber(entry.value) || '0'}
                                            ${!isActive ? '<span class="ml-1 text-xs text-red-500">(Lost)</span>' : ''}
                                            ${isActive && !isLastProject && entry.value < highestValue ? '<span class="ml-1 text-xs text-gray-500">(Bukan nilai tertinggi)</span>' : ''}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap">
                                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${stageClass}">
                                                ${entry.stage ? entry.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(entry.createdAt)}</td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <i class="fas fa-clock text-gray-400 mr-1"></i>${entry.updatedAt ? formatDateTime(entry.updatedAt) : formatDateTime(entry.createdAt)}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button class="text-blue-600 hover:text-blue-900 view-detail-btn" data-id="${entry.id}">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.close-all-priorities').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    modal.querySelectorAll('.view-detail-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dealId = btn.dataset.id;
            modal.remove();
            openDealDetailModal(dealId);
        });
    });
}

// ==================== FUNGSI WIN DATE ====================

function getWinDate(deal) {
    if (deal.stage !== 'win' || !deal.updatedAt) return null;
    
    const winActivity = activities.find(act => 
        act.message && 
        act.message.includes(`"${deal.dealName}"`) && 
        act.message.includes('diperbarui') && 
        act.message.includes('stage: win')
    );
    
    if (winActivity) {
        return winActivity.timestamp;
    }
    
    return deal.updatedAt;
}

// ==================== FUNGSI RECYCLE BIN ====================

async function loadRecycleBin() {
    try {
        const querySnapshot = await deletedDealsCollection
            .orderBy("deletedAt", "desc")
            .get();
        
        deletedDeals = [];
        querySnapshot.forEach((doc) => {
            deletedDeals.push({ id: doc.id, ...doc.data() });
        });
        
        updateRecycleBinBadge();
        return deletedDeals;
    } catch (error) {
        console.error("Error loading recycle bin:", error);
        showToast("Gagal memuat Recycle Bin", 3000);
        return [];
    }
}

function updateRecycleBinBadge() {
    const recycleBinBadge = document.getElementById('recycle-bin-badge');
    if (!recycleBinBadge) return;
    
    if (deletedDeals.length > 0) {
        recycleBinBadge.textContent = deletedDeals.length;
        recycleBinBadge.classList.remove('hidden');
    } else {
        recycleBinBadge.classList.add('hidden');
    }
}

async function openRecycleBinModal() {
    if (currentUserRole !== 'admin') {
        showToast("Hanya admin yang dapat mengakses Recycle Bin", 3000);
        return;
    }
    
    try {
        await loadRecycleBin();
        const recycleBinContent = document.getElementById('recycleBinContent');
        const emptyMessage = document.getElementById('emptyRecycleBinMessage');
        
        if (deletedDeals.length === 0) {
            recycleBinContent.innerHTML = '';
            emptyMessage.classList.remove('hidden');
        } else {
            emptyMessage.classList.add('hidden');
            renderRecycleBinContent();
        }
        
        document.getElementById('recycleBinModal').classList.remove('hidden');
        document.getElementById('recycleBinModalContent').classList.remove('modal-content-leave-active');
        document.getElementById('recycleBinModalContent').classList.add('modal-content-enter-active');
    } catch (error) {
        console.error("Error opening recycle bin:", error);
        showToast("Gagal membuka Recycle Bin", 3000);
    }
}

function renderRecycleBinContent() {
    const recycleBinContent = document.getElementById('recycleBinContent');
    recycleBinContent.innerHTML = '';
    
    deletedDeals.forEach(deal => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        
        row.innerHTML = `
            <td class="p-3 text-sm">${escapeHtml(deal.dealName || 'No Name')}</td>
            <td class="p-3 text-sm">${escapeHtml(deal.salesName || '-')}</td>
            <td class="p-3 text-sm">Rp ${formatNumber(deal.value) || '0'}</td>
            <td class="p-3 text-sm">${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}</td>
            <td class="p-3 text-sm">${formatDateTime(deal.deletedAt)}</td>
            <td class="p-3 text-sm">${escapeHtml(deal.deletedByEmail || '-')}</td>
            <td class="p-3 text-sm">
                <button class="restore-deal-btn text-green-600 hover:text-green-800 mr-3" data-id="${deal.id}">
                    <i class="fas fa-undo mr-1"></i> Restore
                </button>
                <button class="permanent-delete-btn text-red-600 hover:text-red-800" data-id="${deal.id}" data-name="${escapeHtml(deal.dealName || 'No Name')}">
                    <i class="fas fa-trash mr-1"></i> Hapus Permanen
                </button>
            </td>
        `;
        
        recycleBinContent.appendChild(row);
    });
}

async function restoreDeal(deletedDealId) {
    try {
        const deletedDeal = deletedDeals.find(d => d.id === deletedDealId);
        if (!deletedDeal) {
            showToast("Data tidak ditemukan di Recycle Bin", 3000);
            return;
        }
        
        const { id, originalId, deletedAt, deletedBy, deletedByEmail, ...dealData } = deletedDeal;
        
        await dealsCollection.add(dealData);
        
        await deletedDealsCollection.doc(deletedDealId).delete();
        
        showToast(`Deal "${dealData.dealName}" berhasil dipulihkan!`, 2000);
        
        await activitiesCollection.add({
            message: `Deal "${dealData.dealName}" dipulihkan dari Recycle Bin oleh ${auth.currentUser.email}.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        loadDealsFromFirebase();
        
    } catch (error) {
        console.error("Error restoring deal:", error);
        showToast("Gagal memulihkan deal", 3000);
    }
}

let permanentDeleteDealId = null;
let permanentDeleteDealName = '';

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
        
        await activitiesCollection.add({
            message: `Deal "${permanentDeleteDealName}" dihapus permanen dari Recycle Bin oleh ${auth.currentUser.email}.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        closePermanentDeleteModal();
        
    } catch (error) {
        console.error("Error permanent deleting deal:", error);
        showToast("Gagal menghapus permanen deal", 3000);
    }
}

function closePermanentDeleteModal() {
    const permanentDeleteModalContent = document.getElementById('permanentDeleteModalContent');
    if (!permanentDeleteModalContent) return;

    permanentDeleteModalContent.classList.remove('modal-content-enter-active');
    permanentDeleteModalContent.classList.add('modal-content-leave-active');
    
    permanentDeleteModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('permanentDeleteModal').classList.add('hidden');
        permanentDeleteModalContent.classList.remove('modal-content-leave-active');
        permanentDeleteModalContent.removeEventListener('transitionend', handler);
    }, { once: true });
}

async function emptyRecycleBin() {
    if (deletedDeals.length === 0) {
        showToast("Recycle Bin sudah kosong", 3000);
        return;
    }
    
    document.getElementById('recycleBinCount').textContent = deletedDeals.length;
    document.getElementById('emptyRecycleBinModal').classList.remove('hidden');
    document.getElementById('emptyRecycleBinModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('emptyRecycleBinModalContent').classList.add('modal-content-enter-active');
}

async function confirmEmptyRecycleBin() {
    try {
        const batch = db.batch();
        deletedDeals.forEach(deal => {
            const docRef = deletedDealsCollection.doc(deal.id);
            batch.delete(docRef);
        });
        
        await batch.commit();
        
        showToast(`Recycle Bin berhasil dikosongkan! ${deletedDeals.length} deal dihapus permanen.`, 3000);
        
        await activitiesCollection.add({
            message: `Recycle Bin dikosongkan oleh ${auth.currentUser.email}. ${deletedDeals.length} deal dihapus permanen.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        closeEmptyRecycleBinModal();
        
    } catch (error) {
        console.error("Error emptying recycle bin:", error);
        showToast("Gagal mengosongkan Recycle Bin", 3000);
    }
}

function closeEmptyRecycleBinModal() {
    const emptyRecycleBinModalContent = document.getElementById('emptyRecycleBinModalContent');
    if (!emptyRecycleBinModalContent) return;

    emptyRecycleBinModalContent.classList.remove('modal-content-enter-active');
    emptyRecycleBinModalContent.classList.add('modal-content-leave-active');
    
    emptyRecycleBinModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('emptyRecycleBinModal').classList.add('hidden');
        emptyRecycleBinModalContent.classList.remove('modal-content-leave-active');
        emptyRecycleBinModalContent.removeEventListener('transitionend', handler);
    }, { once: true });
}

function closeRecycleBinModal() {
    const recycleBinModalContent = document.getElementById('recycleBinModalContent');
    if (!recycleBinModalContent) return;

    recycleBinModalContent.classList.remove('modal-content-enter-active');
    recycleBinModalContent.classList.add('modal-content-leave-active');
    
    recycleBinModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('recycleBinModal').classList.add('hidden');
        recycleBinModalContent.classList.remove('modal-content-leave-active');
        recycleBinModalContent.removeEventListener('transitionend', handler);
    }, { once: true });
}

// ==================== FUNGSI AKTIVITAS ====================

async function loadActivitiesFromFirebase(forceRefresh = false) {
    console.log("Loading activities from Firebase...");
    
    const now = Date.now();
    if (!forceRefresh && activitiesCache.lastFetch && (now - activitiesCache.lastFetch) < CACHE_DURATION) {
        console.log("Menggunakan cache activities");
        activities = activitiesCache.data;
        updateActivityBadge();
        return;
    }
    
    try {
        let query = activitiesCollection.orderBy("timestamp", "desc").limit(100);
        
        const querySnapshot = await query.get();
        activities = [];
        
        querySnapshot.forEach((doc) => {
            const activityData = doc.data();
            if (activityData.timestamp && typeof activityData.timestamp.toDate !== 'function') {
                activityData.timestamp = firebase.firestore.Timestamp.fromMillis(activityData.timestamp);
            }
            activities.push({ id: doc.id, ...activityData });
        });
        
        console.log("Activities loaded:", activities.length);
        
        activitiesCache = {
            data: activities,
            lastFetch: now
        };
        
        updateActivityBadge();
    } catch (error) {
        console.error("Error loading activities:", error);
        showToast("Gagal memuat aktivitas terbaru", 3000);
    }
}

function updateActivityBadge() {
    const activityBadge = document.getElementById('activity-badge');
    if (!activityBadge) return;
    
    const unreadCount = activities.filter(act => !act.read).length;
    
    if (unreadCount > 0) {
        activityBadge.textContent = unreadCount;
        activityBadge.classList.remove('hidden');
    } else {
        activityBadge.classList.add('hidden');
    }
}

function extractDealNameFromActivity(message) {
    if (!message) return null;
    
    const patterns = [
        /Deal "([^"]+)"/,
        /"([^"]+)"\s+(ditambahkan|diperbarui)/,
        /proyek "([^"]+)"/i,
        /project "([^"]+)"/i,
        /:\s*"([^"]+)"/,
        /deal\s+([^"\s]+(?:\s+[^"\s]+)*)/i
    ];
    
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
            const extractedName = match[1].trim();
            return extractedName;
        }
    }
    
    const dealIndex = message.toLowerCase().indexOf('deal');
    if (dealIndex !== -1) {
        const afterDeal = message.substring(dealIndex + 4).trim();
        const words = afterDeal.split(' ');
        let name = '';
        for (const word of words) {
            if (word.includes('ditambahkan') || word.includes('diperbarui') || word.includes('oleh')) {
                break;
            }
            name += (name ? ' ' : '') + word;
        }
        if (name) {
            return name;
        }
    }
    
    return null;
}

async function findDealByName(dealName) {
    if (!dealName) return null;
    
    const normalizedSearchName = dealName.trim().toLowerCase();
    
    for (const [id, deal] of dealsByIdCache.entries()) {
        if (deal.dealName && deal.dealName.trim().toLowerCase() === normalizedSearchName) {
            return deal;
        }
    }
    
    let deal = deals.find(deal => 
        deal.dealName && deal.dealName.trim().toLowerCase() === normalizedSearchName
    );
    
    if (deal) {
        dealsByIdCache.set(deal.id, deal);
        return deal;
    }
    
    deal = deals.find(deal => 
        deal.dealName && deal.dealName.trim().toLowerCase().includes(normalizedSearchName)
    );
    
    if (deal) {
        dealsByIdCache.set(deal.id, deal);
        return deal;
    }
    
    try {
        const exactQuery = await dealsCollection
            .where('dealName', '==', dealName)
            .limit(1)
            .get();
        
        if (!exactQuery.empty) {
            const doc = exactQuery.docs[0];
            deal = { id: doc.id, ...doc.data() };
            deals.push(deal);
            dealsByIdCache.set(deal.id, deal);
            return deal;
        }
        
        const startQuery = await dealsCollection
            .where('dealName', '>=', dealName)
            .where('dealName', '<=', dealName + '\uf8ff')
            .limit(1)
            .get();
        
        if (!startQuery.empty) {
            const doc = startQuery.docs[0];
            deal = { id: doc.id, ...doc.data() };
            deals.push(deal);
            dealsByIdCache.set(deal.id, deal);
            return deal;
        }
        
        const allDeals = await dealsCollection.limit(50).get();
        for (const doc of allDeals.docs) {
            const data = doc.data();
            if (data.dealName && data.dealName.toLowerCase().includes(normalizedSearchName)) {
                deal = { id: doc.id, ...data };
                deals.push(deal);
                dealsByIdCache.set(deal.id, deal);
                return deal;
            }
        }
        
    } catch (error) {
        console.error("Error mencari deal di Firestore:", error);
    }
    
    return null;
}

function saveActivityModalState() {
    const activityModalContent = document.getElementById('activityModalContent');
    if (activityModalContent) {
        activityModalState.scrollPosition = activityModalContent.scrollTop;
    }
}

function restoreActivityModalState() {
    const activityModalContent = document.getElementById('activityModalContent');
    if (activityModalContent && activityModalState.isOpen) {
        setTimeout(() => {
            activityModalContent.scrollTop = activityModalState.scrollPosition;
        }, 100);
    }
}

async function openActivityModal() {
    if (isActivityModalOpening) {
        return;
    }
    
    isActivityModalOpening = true;
    
    try {
        const activityModal = document.getElementById('activityModal');
        const activityFeed = document.getElementById('activity-feed-modal');
        const activityModalContent = document.getElementById('activityModalContent');

        if (!activityModal || !activityFeed || !activityModalContent) {
            console.error("Elemen modal aktivitas tidak ditemukan.");
            showToast("Gagal membuka aktivitas: Elemen tidak lengkap.", 3000);
            isActivityModalOpening = false;
            return;
        }
        
        activityModal.classList.remove('hidden');
        activityModalContent.classList.remove('modal-content-leave-active');
        activityModalContent.classList.add('modal-content-enter-active');
        
        activityFeed.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
                <p>Memuat aktivitas...</p>
            </div>
        `;
        
        activityModalState.isOpen = true;
        
        await loadActivitiesFromFirebase(true);
        
        activityFeed.innerHTML = '';
        
        if (activities.length === 0) {
            activityFeed.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-inbox text-3xl mb-2"></i>
                    <p>Tidak ada aktivitas terbaru</p>
                </div>
            `;
        } else {
            const sortedActivities = [...activities].sort((a, b) => {
                const tsA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : a.timestamp) : 0;
                const tsB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : b.timestamp) : 0;
                return tsB - tsA;
            });

            const activityPromises = sortedActivities.map(async (activity) => {
                const dealName = extractDealNameFromActivity(activity.message);
                if (dealName) {
                    activity.deal = await findDealByName(dealName);
                }
                return activity;
            });
            
            const activitiesWithDeals = await Promise.all(activityPromises);

            activitiesWithDeals.forEach((activity) => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item p-3 border-b hover:bg-gray-50 transition duration-200';
                
                const timeStr = activity.timestamp ? formatDateTime(activity.timestamp) : 'Waktu tidak diketahui';
                const isUnread = !activity.read;
                
                activityItem.innerHTML = `
                    <div class="flex items-start">
                        <div class="flex-1">
                            <p class="text-sm ${isUnread ? 'font-semibold' : ''}">${escapeHtml(activity.message || 'Aktivitas tidak tersedia')}</p>
                            <div class="flex items-center mt-1 text-xs text-gray-500">
                                <i class="fas fa-clock mr-1"></i>
                                <span>${timeStr}</span>
                                ${isUnread ? '<span class="ml-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs">Baru</span>' : ''}
                                ${activity.deal ? '<span class="ml-2 text-green-600"><i class="fas fa-check-circle"></i> Deal tersedia</span>' : ''}
                            </div>
                        </div>
                        ${activity.deal ? `
                            <div class="ml-2">
                                <button class="view-activity-deal text-blue-600 hover:text-blue-800 p-1" 
                                        data-deal-id="${activity.deal.id}" 
                                        data-deal-name="${escapeHtml(activity.deal.dealName)}"
                                        title="Lihat detail deal">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        ` : `
                            <div class="ml-2 text-xs text-gray-400 italic" title="Deal mungkin sudah dihapus">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                        `}
                    </div>
                `;
                
                if (activity.deal) {
                    activityItem.addEventListener('click', function(e) {
                        if (e.target.closest('button')) return;
                        
                        const dealId = activity.deal.id;
                        saveActivityModalState();
                        openDealDetailModal(dealId);
                    });
                    
                    const viewBtn = activityItem.querySelector('.view-activity-deal');
                    if (viewBtn) {
                        viewBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            const dealId = this.dataset.dealId;
                            saveActivityModalState();
                            openDealDetailModal(dealId);
                        });
                    }
                } else {
                    activityItem.addEventListener('click', function() {
                        showToast("Deal sudah tidak tersedia (mungkin sudah dihapus)", 3000);
                    });
                }
                
                activityFeed.appendChild(activityItem);
            });
        }
        
        markActivitiesAsRead();
        
    } catch (error) {
        console.error("Error opening activity modal:", error);
        showToast("Gagal membuka aktivitas", 3000);
    } finally {
        setTimeout(() => {
            isActivityModalOpening = false;
        }, 500);
    }
}

function markActivitiesAsRead() {
    const batch = db.batch();
    const unreadActivities = activities.filter(act => !act.read);
    
    unreadActivities.forEach(activity => {
        const activityRef = activitiesCollection.doc(activity.id);
        batch.update(activityRef, { read: true });
    });
    
    if (unreadActivities.length > 0) {
        batch.commit()
            .then(() => {
                console.log("Activities marked as read");
                unreadActivities.forEach(act => act.read = true);
                updateActivityBadge();
            })
            .catch(error => {
                console.error("Error marking activities as read:", error);
            });
    }
}

function closeActivityModal() {
    const activityModalContent = document.getElementById('activityModalContent');
    if (!activityModalContent) return;

    activityModalContent.classList.remove('modal-content-enter-active');
    activityModalContent.classList.add('modal-content-leave-active');
    
    activityModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('activityModal').classList.add('hidden');
        activityModalContent.classList.remove('modal-content-leave-active');
        activityModalContent.removeEventListener('transitionend', handler);
        
        activityModalState.isOpen = false;
        activityModalState.scrollPosition = 0;
    }, { once: true });
}

// ==================== FUNGSI UTILITAS ====================

function formatDateTime(timestamp) {
    if (!timestamp) return '-';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '-';
    }
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }
    return new Intl.NumberFormat('id-ID').format(num);
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('id-ID');
    } catch (e) {
        return '-';
    }
}

function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

function getPriorityBadgeClass(priority) {
    switch(priority) {
        case 'Priority':
            return 'priority-badge-priority';
        case 'Hot Priority':
            return 'priority-badge-hot';
        case 'Win':
            return 'priority-badge-win';
        case 'Behind':
            return 'priority-badge-behind';
        case 'On Track':
            return 'priority-badge-ontrack';
        default:
            return 'priority-badge-priority';
    }
}

// ==================== FUNGSI DEALS ====================

function populateYearDropdown() {
    const filterYearSelect = document.getElementById('filterYear');
    if (!filterYearSelect) return;

    const allYearsOption = document.createElement('option');
    allYearsOption.value = 'all';
    allYearsOption.textContent = 'Semua Tahun';
    filterYearSelect.innerHTML = '';
    filterYearSelect.appendChild(allYearsOption);

    const sortedYears = Array.from(uniqueYears).sort((a, b) => parseInt(b) - parseInt(a));
    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        filterYearSelect.appendChild(option);
    });
    
    if (activeYear && filterYearSelect.querySelector(`option[value="${activeYear}"]`)) {
        filterYearSelect.value = activeYear;
    }
}

async function loadConsultantsFromFirebase() {
    console.log("Loading consultants from GitHub JSON...");
    uniqueConsultants.clear();
    try {
        const response = await fetch('https://raw.githubusercontent.com/bandeng77/pipelines.github.io/main/consultants.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        data.forEach(consultantName => {
            if (consultantName) {
                uniqueConsultants.add(consultantName);
            }
        });
        console.log("Consultants loaded from JSON:", uniqueConsultants.size);
    } catch (error) {
        console.error("Error loading consultants from JSON:", error);
        showToast("Gagal memuat daftar konsultan dari GitHub.", 3000);
    }
}

async function loadDealsFromFirebase(forceRefresh = false) {
    console.log("Loading deals from Firebase...");
    
    if (forceRefresh) {
        dealsByIdCache.clear();
    }
    
    let query = dealsCollection.orderBy("createdAt", "desc");
    
    try {
        const querySnapshot = await query.get();
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
            
            if (dealData.createdAt) {
                if (!dealData.createdAt.toDate) {
                    try {
                        dealData.createdAt = firebase.firestore.Timestamp.fromDate(new Date(dealData.createdAt));
                    } catch (e) {
                        console.warn("Could not convert createdAt for deal:", doc.id);
                    }
                }
            }
            
            if (!dealData.updatedAt) {
                dealData.updatedAt = dealData.createdAt;
            }
            
            const deal = { id: doc.id, ...dealData };
            deals.push(deal);
            dealsByIdCache.set(doc.id, deal);

            if (dealData.contractor) {
                if (Array.isArray(dealData.contractor)) {
                    dealData.contractor.forEach(c => {
                        if (c) uniqueContractors.add(c);
                    });
                } else {
                    uniqueContractors.add(dealData.contractor);
                }
            }
            if (dealData.pic) uniquePICs.add(dealData.pic);
            if (dealData.owner) uniqueOwners.add(dealData.owner);
            if (dealData.product) {
                if (Array.isArray(dealData.product)) {
                    dealData.product.forEach(p => {
                        if (p) uniqueProducts.add(p);
                    });
                } else {
                    uniqueProducts.add(dealData.product);
                }
            }
            if (dealData.facility) uniqueFacilities.add(dealData.facility);
            if (dealData.package) uniquePackages.add(dealData.package);
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
                } catch (e) {
                    console.warn("Could not extract year for deal:", doc.id, e);
                }
            }
        });
        
        console.log("Total deals loaded:", deals.length);
        
        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            const currentSales = getCurrentSalesName();
            if (currentSales) {
                uniqueSales = new Set([currentSales]);
            }
        }
        
        priorityStatsCache = {
            'all': null,
            '2025': null,
            '2026': null
        };
        
        dealsByYearCache = {
            'all': null,
            '2025': null,
            '2026': null
        };
        
        populateYearDropdown();
        populateFilterDropdowns();
        createPriorityDashboard();
        applyActiveFilters();
        
        // Jalankan migrasi komentar setelah deals dimuat
        await migrateOldComments();
        
    } catch (error) {
        console.error("Error loading deals:", error);
        showToast("Gagal memuat data deals", 3000);
    }
}

function getDealById(dealId) {
    if (dealsByIdCache.has(dealId)) {
        return dealsByIdCache.get(dealId);
    }
    
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
        dealsByIdCache.set(dealId, deal);
    }
    return deal;
}

function getSalesNameFromEmail(email) {
    return emailToSalesNameMap[email] || email.split('@')[0];
}

function canUserEditDeal(deal) {
    if (currentUserRole === 'admin' || currentUserRole === 'manager') {
        return true;
    }
    
    const currentUser = auth.currentUser;
    
    const allowedEmails = [
        'galih@genetek.co.id',
        'andy@genetek.co.id'
    ];
    
    if (currentUser && allowedEmails.includes(currentUser.email)) {
        return true;
    }

    if (!currentUser) return false;
    
    const userSalesName = getSalesNameFromEmail(currentUser.email);
    return deal.salesName === userSalesName;
}

function populateDropdown(selectElementId, uniqueValues, selectedValue = 'all') {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
        return;
    }

    selectElement.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    const labelElement = selectElement.previousElementSibling;
    const labelText = labelElement ? labelElement.textContent.replace(':', '').replace('*', '').trim() : '';
    defaultOption.textContent = `Semua ${labelText}`;
    selectElement.appendChild(defaultOption);

    const sortedValues = Array.from(uniqueValues).sort();
    sortedValues.forEach(value => {
        if (value) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            selectElement.appendChild(option);
        }
    });

    if (selectedValue) {
        selectElement.value = selectedValue;
    }
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
    if (isNaN(numberValue)) {
        inputElement.value = '';
        return;
    }
    
    inputElement.value = new Intl.NumberFormat('id-ID').format(numberValue);
}

// ==================== FUNGSI STATISTIK MODAL ====================

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
    
    statsModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('statsModal').classList.add('hidden');
        statsModalContent.classList.remove('modal-content-leave-active');
        statsModalContent.removeEventListener('transitionend', handler);
    }, { once: true });
}

function switchStatsTab(tabName) {
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.classList.remove('active', 'border-blue-600', 'text-blue-600');
        tab.classList.add('border-transparent');
    });
    
    const activeTab = document.querySelector(`.stats-tab[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active', 'border-blue-600', 'text-blue-600');
        activeTab.classList.remove('border-transparent');
    }
    
    document.querySelectorAll('.stats-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        
        switch(tabName) {
            case 'sales':
                renderSalesCharts();
                break;
            case 'priority':
                renderPriorityCharts();
                break;
        }
    }
}

function populateSalesFilter() {
    const salesFilter = document.getElementById('salesFilter');
    if (!salesFilter) return;
    
    const currentValue = salesFilter.value;
    
    salesFilter.innerHTML = '<option value="all">Semua Sales</option>';
    
    Array.from(uniqueSales).sort().forEach(salesName => {
        const option = document.createElement('option');
        option.value = salesName;
        option.textContent = salesName;
        salesFilter.appendChild(option);
    });
    
    if (currentValue && Array.from(salesFilter.options).some(opt => opt.value === currentValue)) {
        salesFilter.value = currentValue;
    }
}

// ==================== FUNGSI STATISTIK PER SALES ====================

function processSalesData(salesName = 'all') {
    let salesDeals;
    if (salesName === 'all') {
        salesDeals = deals;
    } else {
        salesDeals = deals.filter(deal => deal.salesName === salesName);
    }
    
    salesDeals = filterDealsByUser(salesDeals);
    
    const uniqueProjects = getUniqueProjectsForDashboard(salesDeals);
    
    const stats = {
        totalValue: 0,
        totalDeals: uniqueProjects.length,
        winCount: 0,
        lostCount: 0,
        stageDistribution: {},
        priorityDistribution: {},
        monthlyTimeline: {},
        byProduct: {},
        byFacility: {},
        maxDealValue: 0,
        minDealValue: Infinity,
        dealsByPriority: {}
    };
    
    if (uniqueProjects.length > 0) {
        stats.maxDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0;
        stats.minDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0;
    }
    
    uniqueProjects.forEach(deal => {
        const dealValue = deal.displayValue || deal.value || 0;
        
        stats.totalValue += dealValue;
        
        if (deal.stage === 'win') {
            stats.winCount++;
        } else if (deal.stage === 'lost') {
            stats.lostCount++;
        }
        
        const stage = deal.stage || 'unknown';
        stats.stageDistribution[stage] = (stats.stageDistribution[stage] || 0) + 1;
        
        const priority = deal.priority || 'Priority';
        stats.priorityDistribution[priority] = (stats.priorityDistribution[priority] || 0) + 1;
        
        if (!stats.dealsByPriority[priority]) {
            stats.dealsByPriority[priority] = [];
        }
        stats.dealsByPriority[priority].push(deal);
        
        if (deal.createdAt) {
            const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
            const monthYear = dealDate.toLocaleString('id-ID', { 
                month: 'short', 
                year: 'numeric' 
            });
            if (!stats.monthlyTimeline[monthYear]) {
                stats.monthlyTimeline[monthYear] = {
                    count: 0,
                    value: 0
                };
            }
            stats.monthlyTimeline[monthYear].count++;
            stats.monthlyTimeline[monthYear].value += dealValue;
        }
        
        if (deal.product) {
            const products = Array.isArray(deal.product) ? deal.product : [deal.product];
            products.forEach(product => {
                stats.byProduct[product] = (stats.byProduct[product] || 0) + 1;
            });
        }
        
        if (deal.facility) {
            stats.byFacility[deal.facility] = (stats.byFacility[deal.facility] || 0) + 1;
        }
        
        if (dealValue > stats.maxDealValue) stats.maxDealValue = dealValue;
        if (dealValue < stats.minDealValue) stats.minDealValue = dealValue;
    });
    
    stats.winRate = stats.totalDeals > 0 ? (stats.winCount / stats.totalDeals * 100).toFixed(1) : 0;
    stats.avgDealValue = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;
    
    return stats;
}

function renderSalesCharts() {
    console.log("Rendering sales charts...");
    
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
        if (!stageCtx) {
            console.error("Canvas salesStageChart not found");
            return;
        }
        
        if (salesCharts.salesStageChart) {
            salesCharts.salesStageChart.destroy();
        }
        
        const stageLabels = Object.keys(salesData.stageDistribution).map(stage => 
            stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        );
        const stageData = Object.values(salesData.stageDistribution);
        
        salesCharts.salesStageChart = new Chart(stageCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: stageLabels,
                datasets: [{
                    label: 'Jumlah Deal',
                    data: stageData,
                    backgroundColor: [
                        '#3B82F6', '#60A5FA', '#93C5FD', '#22D3EE', '#A78BFA',
                        '#10B981', '#EF4444', '#F59E0B'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Distribusi Tahap - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}`
                    }
                }
            }
        });
        
        const priorityCtx = document.getElementById('salesPriorityChart');
        if (!priorityCtx) {
            console.error("Canvas salesPriorityChart not found");
            return;
        }
        
        if (salesCharts.salesPriorityChart) {
            salesCharts.salesPriorityChart.destroy();
        }
        
        const priorityLabels = Object.keys(salesData.priorityDistribution);
        const priorityData = Object.values(salesData.priorityDistribution);
        
        salesCharts.salesPriorityChart = new Chart(priorityCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: priorityLabels,
                datasets: [{
                    label: 'Jumlah Deal',
                    data: priorityData,
                    backgroundColor: priorityLabels.map(priority => {
                        switch(priority) {
                            case 'Priority': return '#fef3c7';
                            case 'Hot Priority': return '#fee2e2';
                            case 'Win': return '#d1fae5';
                            case 'Behind': return '#ffedd5';
                            case 'On Track': return '#dbeafe';
                            default: return '#e5e7eb';
                        }
                    }),
                    borderColor: priorityLabels.map(priority => {
                        switch(priority) {
                            case 'Priority': return '#d97706';
                            case 'Hot Priority': return '#dc2626';
                            case 'Win': return '#059669';
                            case 'Behind': return '#ea580c';
                            case 'On Track': return '#1d4ed8';
                            default: return '#6b7280';
                        }
                    }),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Distribusi Priority - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}`
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Klik untuk melihat detail project (${context.raw} deal)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const priority = priorityLabels[index];
                        showDealsByPriority(salesFilter, priority);
                    }
                }
            }
        });
        
        const timelineCtx = document.getElementById('salesTimelineChart');
        if (!timelineCtx) {
            console.error("Canvas salesTimelineChart not found");
            return;
        }
        
        if (salesCharts.salesTimelineChart) {
            salesCharts.salesTimelineChart.destroy();
        }
        
        const sortedMonths = Object.keys(salesData.monthlyTimeline).sort((a, b) => {
            const [monthStrA, yearStrA] = a.split(' ');
            const [monthStrB, yearStrB] = b.split(' ');
            const monthIndexA = new Date(Date.parse(monthStrA + " 1, 2000")).getMonth();
            const monthIndexB = new Date(Date.parse(monthStrB + " 1, 2000")).getMonth();
            const dateA = new Date(parseInt(yearStrA), monthIndexA, 1);
            const dateB = new Date(parseInt(yearStrB), monthIndexB, 1);
            return dateA - dateB;
        });
        
        const timelineCountData = sortedMonths.map(month => salesData.monthlyTimeline[month].count);
        const timelineValueData = sortedMonths.map(month => salesData.monthlyTimeline[month].value);
        
        salesCharts.salesTimelineChart = new Chart(timelineCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [
                    {
                        label: 'Jumlah Deal',
                        data: timelineCountData,
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        yAxisID: 'y',
                        tension: 0.3
                    },
                    {
                        label: 'Total Nilai (IDR)',
                        data: timelineValueData,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        yAxisID: 'y1',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                stacked: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Timeline Deal - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}`
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Jumlah Deal'
                        },
                        ticks: {
                            precision: 0
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Total Nilai (IDR)'
                        },
                        ticks: {
                            callback: function(value) {
                                return 'Rp ' + formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error("Error rendering sales charts:", error);
        showToast("Gagal merender chart statistik sales", 3000);
    }
}

// ==================== FUNGSI STATISTIK PER PRIORITY ====================

function processPriorityData(priority = 'all') {
    let priorityDeals;
    if (priority === 'all') {
        priorityDeals = deals;
    } else {
        priorityDeals = deals.filter(deal => deal.priority === priority);
    }
    
    priorityDeals = filterDealsByUser(priorityDeals);
    
    const uniqueProjects = getUniqueProjectsForDashboard(priorityDeals);
    
    const stats = {
        totalValue: 0,
        totalDeals: uniqueProjects.length,
        winCount: 0,
        stageDistribution: {},
        salesDistribution: {},
        valueByStage: {},
        monthlyTimeline: {},
        avgDealValue: 0,
        maxDealValue: 0,
        minDealValue: Infinity,
        dealsByStage: {}
    };
    
    if (uniqueProjects.length > 0) {
        stats.maxDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0;
        stats.minDealValue = uniqueProjects[0].displayValue || uniqueProjects[0].value || 0;
    }
    
    uniqueProjects.forEach(deal => {
        const dealValue = deal.displayValue || deal.value || 0;
        
        stats.totalValue += dealValue;
        
        if (deal.stage === 'win') {
            stats.winCount++;
        }
        
        const stage = deal.stage || 'unknown';
        stats.stageDistribution[stage] = (stats.stageDistribution[stage] || 0) + 1;
        stats.valueByStage[stage] = (stats.valueByStage[stage] || 0) + dealValue;
        
        if (!stats.dealsByStage[stage]) {
            stats.dealsByStage[stage] = [];
        }
        stats.dealsByStage[stage].push(deal);
        
        if (deal.salesName) {
            stats.salesDistribution[deal.salesName] = (stats.salesDistribution[deal.salesName] || 0) + 1;
        }
        
        if (deal.createdAt) {
            const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
            const monthYear = dealDate.toLocaleString('id-ID', { 
                month: 'short', 
                year: 'numeric' 
            });
            if (!stats.monthlyTimeline[monthYear]) {
                stats.monthlyTimeline[monthYear] = {
                    count: 0,
                    value: 0
                };
            }
            stats.monthlyTimeline[monthYear].count++;
            stats.monthlyTimeline[monthYear].value += dealValue;
        }
        
        if (dealValue > stats.maxDealValue) stats.maxDealValue = dealValue;
        if (dealValue < stats.minDealValue) stats.minDealValue = dealValue;
    });
    
    stats.avgDealValue = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;
    stats.winRate = stats.totalDeals > 0 ? (stats.winCount / stats.totalDeals * 100).toFixed(1) : 0;
    
    return stats;
}

function renderPriorityCharts() {
    console.log("Rendering priority charts...");
    
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
        if (!stageCtx) {
            console.error("Canvas priorityStageChart not found");
            return;
        }
        
        if (salesCharts.priorityStageChart) {
            salesCharts.priorityStageChart.destroy();
        }
        
        const stageLabels = Object.keys(priorityData.stageDistribution).map(stage => 
            stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        );
        const stageData = Object.values(priorityData.stageDistribution);
        const stageValueData = Object.keys(priorityData.valueByStage).map(stage => 
            priorityData.valueByStage[stage]
        );
        
        const backgroundColors = stageLabels.map((stage, index) => {
            const colors = [
                '#3B82F6', '#60A5FA', '#93C5FD', '#22D3EE', '#A78BFA',
                '#10B981', '#EF4444', '#F59E0B'
            ];
            return colors[index % colors.length];
        });
        
        salesCharts.priorityStageChart = new Chart(stageCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: stageLabels,
                datasets: [
                    {
                        label: 'Jumlah Deal',
                        data: stageData,
                        backgroundColor: backgroundColors.map(color => color + '80'),
                        borderColor: backgroundColors,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Total Nilai (IDR)',
                        data: stageValueData,
                        backgroundColor: '#10B98180',
                        borderColor: '#10B981',
                        borderWidth: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: `Distribusi per Tahap - ${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}`
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Jumlah Deal: ${context.raw} (klik untuk melihat detail)`;
                                }
                                return `Total Nilai: Rp ${formatNumber(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Jumlah Deal'
                        },
                        ticks: {
                            precision: 0
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Total Nilai (IDR)'
                        },
                        ticks: {
                            callback: function(value) {
                                return 'Rp ' + formatNumber(value);
                            }
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0 && elements[0].datasetIndex === 0) {
                        const index = elements[0].index;
                        const stage = Object.keys(priorityData.stageDistribution)[index];
                        showDealsByStage(priorityFilter, stage);
                    }
                }
            }
        });
        
        const salesCtx = document.getElementById('prioritySalesChart');
        if (!salesCtx) {
            console.error("Canvas prioritySalesChart not found");
            return;
        }
        
        if (salesCharts.prioritySalesChart) {
            salesCharts.prioritySalesChart.destroy();
        }
        
        const sortedSales = Object.entries(priorityData.salesDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        const salesLabels = sortedSales.map(([name]) => name);
        const salesData = sortedSales.map(([, count]) => count);
        
        salesCharts.prioritySalesChart = new Chart(salesCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: salesLabels,
                datasets: [{
                    label: 'Jumlah Deal',
                    data: salesData,
                    backgroundColor: '#8B5CF6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    title: {
                        display: true,
                        text: `Top 10 Sales - ${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}`
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
        
        const timelineCtx = document.getElementById('priorityTimelineChart');
        if (!timelineCtx) {
            console.error("Canvas priorityTimelineChart not found");
            return;
        }
        
        if (salesCharts.priorityTimelineChart) {
            salesCharts.priorityTimelineChart.destroy();
        }
        
        const sortedMonths = Object.keys(priorityData.monthlyTimeline).sort((a, b) => {
            const [monthStrA, yearStrA] = a.split(' ');
            const [monthStrB, yearStrB] = b.split(' ');
            const monthIndexA = new Date(Date.parse(monthStrA + " 1, 2000")).getMonth();
            const monthIndexB = new Date(Date.parse(monthStrB + " 1, 2000")).getMonth();
            const dateA = new Date(parseInt(yearStrA), monthIndexA, 1);
            const dateB = new Date(parseInt(yearStrB), monthIndexB, 1);
            return dateA - dateB;
        });
        
        const timelineCountData = sortedMonths.map(month => priorityData.monthlyTimeline[month].count);
        const timelineValueData = sortedMonths.map(month => priorityData.monthlyTimeline[month].value);
        
        salesCharts.priorityTimelineChart = new Chart(timelineCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [
                    {
                        label: 'Jumlah Deal',
                        data: timelineCountData,
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        yAxisID: 'y',
                        tension: 0.3
                    },
                    {
                        label: 'Total Nilai (IDR)',
                        data: timelineValueData,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        yAxisID: 'y1',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                stacked: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Timeline - ${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}`
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Jumlah Deal'
                        },
                        ticks: {
                            precision: 0
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Total Nilai (IDR)'
                        },
                        ticks: {
                            callback: function(value) {
                                return 'Rp ' + formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error("Error rendering priority charts:", error);
        showToast("Gagal merender chart analisis priority", 3000);
    }
}

// ==================== FUNGSI STATISTIK OVERVIEW ====================

function processDealDataForCharts(dealsData) {
    console.log("Processing deal data for charts, total deals:", dealsData.length);
    
    const userDealsData = filterDealsByUser(dealsData);
    
    const uniqueProjects = getUniqueProjectsForDashboard(userDealsData);
    
    const stageSelect = document.getElementById('stage');
    const allStages = stageSelect ? Array.from(stageSelect.options).map(option => option.value).filter(value => value !== '') : 
        ['identified', 'prospect', 'tender-me', 'tender-main-con', 'contract-award', 'win', 'lost', 'on-hold'];
    
    const winRateDataMap = {};
    allStages.forEach(stage => {
        winRateDataMap[stage] = 0;
    });
    
    const stats = {
        dealSizeLabels: [],
        dealSizeData: [],
        winRateLabels: allStages,
        winRateData: [],
        dealsBySalesLabels: [],
        dealsBySalesData: [],
        dealsByProductLabels: [],
        dealsByProductData: [],
        pipelineValueLabels: [],
        pipelineValueData: [],
        topSales: { name: '', value: 0 }
    };
    
    const dealSizes = {
        'Small (< Rp 500 Juta)': 0,
        'Medium (Rp 500 Juta - Rp 2 Miliar)': 0,
        'Large (> Rp 2 Miliar)': 0
    };
    const dealsBySales = {};
    let salesValue = {};
    let salesWinCount = {};
    const dealsByProduct = {};
    let productValue = {};
    const pipelineValueByMonth = {};
    
    uniqueProjects.forEach(deal => {
        const dealValue = deal.displayValue || deal.value || 0;
        
        if (dealValue < 500000000) {
            dealSizes['Small (< Rp 500 Juta)']++;
        } else if (dealValue >= 500000000 && dealValue <= 2000000000) {
            dealSizes['Medium (Rp 500 Juta - Rp 2 Miliar)']++;
        } else {
            dealSizes['Large (> Rp 2 Miliar)']++;
        }
        
        if (deal.stage && winRateDataMap.hasOwnProperty(deal.stage)) {
            winRateDataMap[deal.stage]++;
        }
        
        if (deal.salesName) {
            dealsBySales[deal.salesName] = (dealsBySales[deal.salesName] || 0) + 1;
            salesValue[deal.salesName] = (salesValue[deal.salesName] || 0) + dealValue;
            if (deal.stage === 'win') {
                salesWinCount[deal.salesName] = (salesWinCount[deal.salesName] || 0) + 1;
            }
        }
        
        const productsInDeal = Array.isArray(deal.product) ? deal.product : (deal.product ? [deal.product] : []);
        productsInDeal.forEach(product => {
            const productKey = product || 'Unknown Product';
            dealsByProduct[productKey] = (dealsByProduct[productKey] || 0) + 1;
            productValue[productKey] = (productValue[productKey] || 0) + dealValue;
        });
        
        if (deal.stage !== 'lost' && deal.stage !== 'win') {
            if (deal.createdAt) {
                const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
                const monthYear = dealDate.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
                pipelineValueByMonth[monthYear] = (pipelineValueByMonth[monthYear] || 0) + dealValue;
            }
        }
    });
    
    let maxSalesValue = 0;
    let topSalesName = '';
    for (const salesName in salesValue) {
        if (salesValue[salesName] > maxSalesValue) {
            maxSalesValue = salesValue[salesName];
            topSalesName = salesName;
        }
    }
    stats.topSales = { name: topSalesName, value: maxSalesValue };
    
    stats.dealSizeLabels = Object.keys(dealSizes);
    stats.dealSizeData = Object.values(dealSizes);
    
    stats.winRateData = stats.winRateLabels.map(stage => winRateDataMap[stage]);
    
    stats.dealsBySalesLabels = Object.keys(dealsBySales);
    stats.dealsBySalesData = Object.values(dealsBySales);
    
    stats.dealsByProductLabels = Object.keys(dealsByProduct);
    stats.dealsByProductData = Object.values(dealsByProduct);
    
    const sortedMonths = Object.keys(pipelineValueByMonth).sort((a, b) => {
        const [monthStrA, yearStrA] = a.split(' ');
        const [monthStrB, yearStrB] = b.split(' ');
        const monthIndexA = new Date(Date.parse(monthStrA + " 1, 2000")).getMonth();
        const monthIndexB = new Date(Date.parse(monthStrB + " 1, 2000")).getMonth();
        const dateA = new Date(parseInt(yearStrA), monthIndexA, 1);
        const dateB = new Date(parseInt(yearStrB), monthIndexB, 1);
        return dateA - dateB;
    });
    stats.pipelineValueLabels = sortedMonths;
    stats.pipelineValueData = sortedMonths.map(month => pipelineValueByMonth[month]);
    
    return stats;
}

function renderAllCharts() {
    console.log("Rendering all overview charts...");
    
    try {
        const processedStats = processDealDataForCharts(deals);
        
        const dealSizeCtx = document.getElementById('dealSizeChart');
        if (!dealSizeCtx) {
            console.error("Canvas dealSizeChart not found");
            return;
        }
        
        if (charts.dealSizeChart) {
            charts.dealSizeChart.destroy();
        }
        
        charts.dealSizeChart = new Chart(dealSizeCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: processedStats.dealSizeLabels,
                datasets: [{
                    label: 'Jumlah Deal',
                    data: processedStats.dealSizeData,
                    backgroundColor: ['#3B82F6', '#60A5FA', '#93C5FD']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribusi Ukuran Deal'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
        
        const winRateCtx = document.getElementById('winRateChart');
        if (!winRateCtx) {
            console.error("Canvas winRateChart not found");
            return;
        }
        
        if (charts.winRateChart) {
            charts.winRateChart.destroy();
        }
        
        charts.winRateChart = new Chart(winRateCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: processedStats.winRateLabels.map(label => 
                    label.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                ),
                datasets: [{
                    label: 'Jumlah Deal',
                    data: processedStats.winRateData,
                    backgroundColor: [
                        '#10B981',
                        '#EF4444',
                        '#F59E0B',
                        '#6B7280',
                        '#3B82F6',
                        '#06B6D4',
                        '#A855F7',
                        '#EC4899'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribusi Deal Berdasarkan Tahap'
                    }
                }
            }
        });
        
        const dealsBySalesCtx = document.getElementById('dealsBySalesChart');
        if (!dealsBySalesCtx) {
            console.error("Canvas dealsBySalesChart not found");
            return;
        }
        
        if (charts.dealsBySalesChart) {
            charts.dealsBySalesChart.destroy();
        }
        
        charts.dealsBySalesChart = new Chart(dealsBySalesCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: processedStats.dealsBySalesLabels,
                datasets: [{
                    label: 'Jumlah Deal',
                    data: processedStats.dealsBySalesData,
                    backgroundColor: '#6366F1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Total Deals per Sales'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const salesName = processedStats.dealsBySalesLabels[context.dataIndex];
                                const totalValue = salesValue[salesName] || 0;
                                const winCount = salesWinCount[salesName] || 0;
                                return `${label}${context.raw} (Total IDR: Rp ${formatNumber(totalValue)} / Win: ${winCount})`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
        
        const dealsByProductPackageCtx = document.getElementById('dealsByProductPackageChart');
        if (!dealsByProductPackageCtx) {
            console.error("Canvas dealsByProductPackageChart not found");
            return;
        }
        
        if (charts.dealsByProductPackageChart) {
            charts.dealsByProductPackageChart.destroy();
        }
        
        const productEntries = Object.entries(
            processedStats.dealsByProductLabels.reduce((acc, label, index) => {
                acc[label] = processedStats.dealsByProductData[index];
                return acc;
            }, {})
        );
        
        const sortedProducts = productEntries.sort((a, b) => b[1] - a[1]).slice(0, 15);
        const topProductLabels = sortedProducts.map(([label]) => label);
        const topProductData = sortedProducts.map(([, count]) => count);
        
        charts.dealsByProductPackageChart = new Chart(dealsByProductPackageCtx.getContext('2d'), {
            type: 'pie',
            data: {
                labels: topProductLabels,
                datasets: [{
                    label: 'Jumlah Deal',
                    data: topProductData,
                    backgroundColor: [
                        '#F97316', '#14B8A6', '#8B5CF6', '#EC4899', '#FACC15',
                        '#3B82F6', '#EF4444', '#06B6D4', '#A855F7', '#F43F5E',
                        '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#FF5722'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Deal per Produk (Top 15)'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const product = topProductLabels[context.dataIndex];
                                const totalValue = productValue[product] || 0;
                                return `${label}${context.raw} (Total IDR: Rp ${formatNumber(totalValue)})`;
                            }
                        }
                    }
                }
            }
        });
        
        const pipelineValueCtx = document.getElementById('pipelineValueChart');
        if (!pipelineValueCtx) {
            console.error("Canvas pipelineValueChart not found");
            return;
        }
        
        if (charts.pipelineValueChart) {
            charts.pipelineValueChart.destroy();
        }
        
        charts.pipelineValueChart = new Chart(pipelineValueCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: processedStats.pipelineValueLabels,
                datasets: [{
                    label: 'Nilai Pipeline (IDR)',
                    data: processedStats.pipelineValueData,
                    borderColor: '#0EA5E9',
                    backgroundColor: 'rgba(14, 165, 233, 0.2)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 5,
                    pointBackgroundColor: '#0EA5E9',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#0EA5E9',
                    pointHoverBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Nilai Pipeline Seiring Waktu'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Rp ' + formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error("Error rendering overview charts:", error);
        showToast("Gagal merender chart overview", 3000);
    }
}

// ==================== FUNGSI CLICKABLE CHART ====================

function showDealsByPriority(salesFilter, priority) {
    const selectedSales = salesFilter.value;
    let filteredDeals;
    if (selectedSales === 'all') {
        filteredDeals = deals.filter(deal => deal.priority === priority);
    } else {
        filteredDeals = deals.filter(deal => deal.salesName === selectedSales && deal.priority === priority);
    }
    
    filteredDeals = filterDealsByUser(filteredDeals);
    
    const uniqueFilteredDeals = getUniqueProjectsForDashboard(filteredDeals);
    
    const sortedDeals = [...uniqueFilteredDeals].sort((a, b) => {
        const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
        const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
        return dateB - dateA;
    });
    
    if (sortedDeals.length === 0) {
        showToast(`Tidak ada project dengan priority "${priority}" untuk sales "${selectedSales === 'all' ? 'Semua Sales' : selectedSales}"`, 3000);
        return;
    }
    
    document.getElementById('clickableChartModalTitle').textContent = `Project dengan Priority "${priority}" - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}`;
    const modalContent = document.getElementById('clickableChartModalContent');
    modalContent.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200 mt-4';
    table.innerHTML = `
        <thead class="bg-gray-50">
            <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Project</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tahap</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th>
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            ${sortedDeals.map((deal, index) => {
                const displayValue = deal.displayValue || deal.value || 0;
                const lastUpdateDate = deal.updatedAt ? formatDateTime(deal.updatedAt) : (deal.createdAt ? formatDateTime(deal.createdAt) : '-');
                const isLastProject = deal.isLastActiveProject;
                
                let valueDisplay = `Rp ${formatNumber(displayValue)}`;
                if (!isLastProject && deal.hasHigherValueFromOtherPriority) {
                    valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
                }
                
                return `
                <tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(deal.dealName || 'No Name')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(deal.salesName || '-')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${valueDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${deal.stage === 'win' ? 'bg-green-100 text-green-800' : 
                            deal.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">
                            ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <i class="fas fa-clock text-gray-400 mr-1"></i>${lastUpdateDate}
                    </td>
                </tr>
            `}).join('')}
        </tbody>
    `;
    
    modalContent.appendChild(table);
    
    modalContent.querySelectorAll('.view-detail-row').forEach(row => {
        row.addEventListener('click', function() {
            const dealId = this.dataset.id;
            closeClickableChartModal();
            openDealDetailModal(dealId);
        });
    });
    
    document.getElementById('clickableChartModal').classList.remove('hidden');
}

function showDealsByStage(priorityFilter, stage) {
    const selectedPriority = priorityFilter.value;
    let filteredDeals;
    if (selectedPriority === 'all') {
        filteredDeals = deals.filter(deal => deal.stage === stage);
    } else {
        filteredDeals = deals.filter(deal => deal.priority === selectedPriority && deal.stage === stage);
    }
    
    filteredDeals = filterDealsByUser(filteredDeals);
    
    const uniqueFilteredDeals = getUniqueProjectsForDashboard(filteredDeals);
    
    const sortedDeals = [...uniqueFilteredDeals].sort((a, b) => {
        const dateA = a.updatedAt ? (a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt)) : new Date(0);
        const dateB = b.updatedAt ? (b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt)) : new Date(0);
        return dateB - dateA;
    });
    
    if (sortedDeals.length === 0) {
        showToast(`Tidak ada project dengan stage "${stage}" untuk priority "${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}"`, 3000);
        return;
    }
    
    document.getElementById('clickableChartModalTitle').textContent = `Project dengan Stage "${stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}" - ${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}`;
    const modalContent = document.getElementById('clickableChartModalContent');
    modalContent.innerHTML = '';
    
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200 mt-4';
    table.innerHTML = `
        <thead class="bg-gray-50">
            <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Project</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nilai (IDR)</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terakhir Update</th>
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            ${sortedDeals.map((deal, index) => {
                const displayValue = deal.displayValue || deal.value || 0;
                const lastUpdateDate = deal.updatedAt ? formatDateTime(deal.updatedAt) : (deal.createdAt ? formatDateTime(deal.createdAt) : '-');
                const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
                const isLastProject = deal.isLastActiveProject;
                
                let valueDisplay = `Rp ${formatNumber(displayValue)}`;
                if (!isLastProject && deal.hasHigherValueFromOtherPriority) {
                    valueDisplay += ` <span class="text-xs text-gray-500 ml-1">(max)</span>`;
                }
                
                return `
                <tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(deal.dealName || 'No Name')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(deal.salesName || '-')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${valueDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">
                            ${deal.priority || 'Priority'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <i class="fas fa-clock text-gray-400 mr-1"></i>${lastUpdateDate}
                    </td>
                </tr>
            `}).join('')}
        </tbody>
    `;
    
    modalContent.appendChild(table);
    
    modalContent.querySelectorAll('.view-detail-row').forEach(row => {
        row.addEventListener('click', function() {
            const dealId = this.dataset.id;
            closeClickableChartModal();
            openDealDetailModal(dealId);
        });
    });
    
    document.getElementById('clickableChartModal').classList.remove('hidden');
}

function closeClickableChartModal() {
    document.getElementById('clickableChartModal').classList.add('hidden');
}

// ==================== PERBAIKAN PERHITUNGAN NILAI ====================

function calculateValueFromBeforeDiscount() {
    const beforeDiscountRaw = document.getElementById('beforeDiscount').value.replace(/[^0-9]/g, '');
    const beforeDiscount = parseFloat(beforeDiscountRaw) || 0;
    
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    
    let calculatedValue = beforeDiscount;
    if (discount > 0 && discount <= 100) {
        calculatedValue = beforeDiscount * (1 - (discount / 100));
    }
    
    const valueInput = document.getElementById('value');
    if (valueInput) {
        valueInput.value = new Intl.NumberFormat('id-ID').format(Math.round(calculatedValue));
    }
    
    const beforeDiscountInput = document.getElementById('beforeDiscount');
    if (beforeDiscount > 0 && beforeDiscountInput) {
        beforeDiscountInput.value = new Intl.NumberFormat('id-ID').format(beforeDiscount);
    }
}

function updateBeforeDiscountEventListeners() {
    const beforeDiscountInput = document.getElementById('beforeDiscount');
    const discountInput = document.getElementById('discount');
    
    if (beforeDiscountInput) {
        beforeDiscountInput.addEventListener('input', function() {
            formatNumberInput(this);
            calculateValueFromBeforeDiscount();
        });
    }
    
    if (discountInput) {
        discountInput.addEventListener('input', calculateValueFromBeforeDiscount);
    }
}

// ==================== FUNGSI SORTABLE ====================

function initSortable() {
    const pipelineStage = document.getElementById('pipelines-stage');
    if (!pipelineStage) return;

    if (sortableInstances['pipelines-stage']) {
        sortableInstances['pipelines-stage'].destroy();
    }

    sortableInstances['pipelines-stage'] = new Sortable(pipelineStage, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        disabled: true,
        onEnd: function(evt) {
            // Tidak ada aksi karena disabled
        }
    });
}

// ==================== FUNGSI PERMISSIONS ====================

function applyUserPermissions() {
    try {
        const isAdmin = currentUserRole === 'admin';
        const isManager = currentUserRole === 'manager';
        
        console.log("Applying permissions for Role:", currentUserRole);
        
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
        
        if (recycleBinFab) {
            if (isAdmin) {
                recycleBinFab.classList.remove('hidden');
            } else {
                recycleBinFab.classList.add('hidden');
            }
        }

        toggleExportButton();
        loadDealsFromFirebase(); 
        
    } catch (error) {
        console.error("Error in applyUserPermissions:", error);
        showToast("Gagal menerapkan permissions", 3000);
    }
}

// ==================== FUNGSI EVENT LISTENERS ====================

// Handler untuk submit komentar dari modal utama
function commentSubmitHandler() {
    const commentInput = document.getElementById('commentInput');
    const comment = commentInput ? commentInput.value : '';
    if (currentDealIdForComments) {
        addComment(currentDealIdForComments, comment);
    }
}

// Handler untuk submit komentar dari detail modal
function detailCommentSubmitHandler() {
    const detailCommentInput = document.getElementById('detailCommentInput');
    const comment = detailCommentInput ? detailCommentInput.value : '';
    if (currentDealIdForComments) {
        addComment(currentDealIdForComments, comment);
    }
}

function initEventListeners() {
    console.log("Initializing event listeners...");
    
    try {
        consultantSearchInput = document.getElementById('consultantSearch');
        consultantHiddenInput = document.getElementById('consultant');
        consultantSuggestionsDiv = document.getElementById('consultantSuggestions');
        facilitySelect = document.getElementById('facility');
        newFacilityInput = document.getElementById('newFacility');
        packageSelect = document.getElementById('package');
        newPackageInput = document.getElementById('newPackage');
        
        document.addEventListener('click', function(e) {
            if (e.target.closest('.view-detail-btn')) {
                const dealCard = e.target.closest('.deal-card, tr');
                if (dealCard) {
                    const dealId = dealCard.dataset.id;
                    openDealDetailModal(dealId);
                }
            }
            
            if (e.target.closest('.view-detail-row') && !e.target.closest('button')) {
                const row = e.target.closest('.view-detail-row');
                if (row && row.dataset.id) {
                    openDealDetailModal(row.dataset.id);
                }
            }
            
            if (e.target.closest('.view-all-entries-btn')) {
                const btn = e.target.closest('.view-all-entries-btn');
                const dealName = btn.dataset.dealName;
                const priority = btn.dataset.priority;
                showAllEntriesForProject(dealName, priority);
            }
            
            if (e.target.closest('.view-all-priorities-btn')) {
                const btn = e.target.closest('.view-all-priorities-btn');
                const dealName = btn.dataset.dealName;
                showAllPrioritiesForProject(dealName);
            }
            
            if (e.target.closest('.edit-deal-btn')) {
                const dealCard = e.target.closest('.deal-card, tr');
                if (dealCard) {
                    const dealId = dealCard.dataset.id;
                    prepareEditDeal(dealId);
                }
            }
            
            if (e.target.closest('.delete-deal-btn')) {
                const dealCard = e.target.closest('.deal-card, tr');
                if (dealCard) {
                    const dealId = dealCard.dataset.id;
                    const dealName = dealCard.querySelector('h3') ? 
                        dealCard.querySelector('h3').textContent : 
                        (dealCard.querySelector('td:nth-child(3)') ? dealCard.querySelector('td:nth-child(3)').textContent : 'Deal');
                    confirmDeleteDeal(dealId, dealName);
                }
            }
            
            if (e.target.closest('.remove-contractor-btn')) {
                removeContractorField(e.target.closest('.remove-contractor-btn'));
            }
            
            if (e.target.closest('.remove-product-btn')) {
                removeProductField(e.target.closest('.remove-product-btn'));
            }
            
            if (e.target.closest('#recycleBinFab')) {
                openRecycleBinModal();
            }
            
            if (e.target.closest('.close-recycle-bin')) {
                closeRecycleBinModal();
            }
            
            if (e.target.closest('#emptyRecycleBinBtn')) {
                emptyRecycleBin();
            }
            
            if (e.target.closest('.restore-deal-btn')) {
                const dealId = e.target.closest('.restore-deal-btn').dataset.id;
                restoreDeal(dealId);
            }
            
            if (e.target.closest('.permanent-delete-btn')) {
                const button = e.target.closest('.permanent-delete-btn');
                const dealId = button.dataset.id;
                const dealName = button.dataset.name;
                confirmPermanentDelete(dealId, dealName);
            }
            
            if (e.target.closest('.cancel-permanent-delete')) {
                closePermanentDeleteModal();
            }
            
            if (e.target.closest('#confirmPermanentDeleteBtn')) {
                permanentDeleteDeal();
            }
            
            if (e.target.closest('.cancel-empty-bin')) {
                closeEmptyRecycleBinModal();
            }
            
            if (e.target.closest('#confirmEmptyBinBtn')) {
                confirmEmptyRecycleBin();
            }
            
            if (e.target.closest('.delete-option-btn')) {
                const button = e.target.closest('.delete-option-btn');
                const targetField = button.dataset.target;
                const selectElement = document.getElementById(targetField);
                const selectedValue = selectElement.value;
                
                if (selectedValue && selectedValue !== '') {
                    deleteDropdownOption(targetField, selectedValue);
                }
            }
            
            if (e.target.closest('#clickableChartModalClose') || e.target.closest('#clickableChartModal')) {
                if (e.target.closest('#clickableChartModal') && !e.target.closest('.clickable-modal-content')) {
                    document.getElementById('clickableChartModal').classList.add('hidden');
                } else if (e.target.closest('#clickableChartModalClose')) {
                    document.getElementById('clickableChartModal').classList.add('hidden');
                }
            }
            
            if (e.target.closest('#priorityModalClose') || e.target.closest('#priorityModal')) {
                if (e.target.closest('#priorityModal') && !e.target.closest('.priority-modal-content')) {
                    closePriorityModal();
                } else if (e.target.closest('#priorityModalClose')) {
                    closePriorityModal();
                }
            }
            
            if (e.target.closest('.close-all-entries')) {
                const modal = document.getElementById('allEntriesModal');
                if (modal) modal.remove();
            }
            
            if (e.target.closest('.close-all-priorities')) {
                const modal = document.getElementById('allPrioritiesModal');
                if (modal) modal.remove();
            }
        });

        const dealForm = document.getElementById('dealForm');
        if (dealForm) {
            dealForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveDeal();
            });
        }

        const newDealBtn = document.getElementById('newDealBtn');
        if (newDealBtn) {
            newDealBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log("New Deal button clicked");
                openDealModal();
            });
        } else {
            console.error("New Deal button not found!");
        }
        
        const viewStatsBtn = document.getElementById('viewStatsBtn');
        if (viewStatsBtn) viewStatsBtn.addEventListener('click', openStatsModal);
        
        const activityBtn = document.getElementById('activityBtn');
        if (activityBtn) activityBtn.addEventListener('click', openActivityModal);
        
        const authButton = document.getElementById('authButton');
        if (authButton) authButton.addEventListener('click', logout);
        
        const openFilterPanelBtn = document.getElementById('openFilterPanelBtn');
        if (openFilterPanelBtn) openFilterPanelBtn.addEventListener('click', openFilterPanel);

        const cancelDealBtn = document.getElementById('cancelDealBtn');
        if (cancelDealBtn) cancelDealBtn.addEventListener('click', closeDealModal);
        
        const addContractorBtn = document.getElementById('addContractorBtn');
        if (addContractorBtn) addContractorBtn.addEventListener('click', () => addContractorField());
        
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) addProductBtn.addEventListener('click', () => addProductField());
        
        const commentSubmitBtn = document.getElementById('commentSubmitBtn');
        if (commentSubmitBtn) {
            commentSubmitBtn.removeEventListener('click', commentSubmitHandler);
            commentSubmitBtn.addEventListener('click', commentSubmitHandler);
        }
        
        const stageSelect = document.getElementById('stage');
        if (stageSelect) {
            stageSelect.addEventListener('change', function() {
                updateProgressBarFromStage(this.value);
            });
        }
        
        const closeDetailBtn = document.getElementById('closeDetailBtn');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', function() {
                closeDealDetailModal();
                if (activityModalState.isOpen) {
                    restoreActivityModalState();
                }
            });
        }
        
        const detailCommentSubmitBtn = document.getElementById('detailCommentSubmitBtn');
        if (detailCommentSubmitBtn) {
            detailCommentSubmitBtn.removeEventListener('click', detailCommentSubmitHandler);
            detailCommentSubmitBtn.addEventListener('click', detailCommentSubmitHandler);
        }
        
        const closeActivityBtn = document.getElementById('closeActivityBtn');
        if (closeActivityBtn) closeActivityBtn.addEventListener('click', closeActivityModal);
        
        const closeActivityFooterBtn = document.getElementById('closeActivityFooterBtn');
        if (closeActivityFooterBtn) closeActivityFooterBtn.addEventListener('click', closeActivityModal);
        
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteDeal);
        
        const closeFilterBtn = document.getElementById('closeFilterBtn');
        if (closeFilterBtn) closeFilterBtn.addEventListener('click', closeFilterPanel);
        
        const resetFilterBtn = document.getElementById('resetFilterBtn');
        if (resetFilterBtn) resetFilterBtn.addEventListener('click', resetFilters);
        
        const applyFilterBtn = document.getElementById('applyFilterBtn');
        if (applyFilterBtn) applyFilterBtn.addEventListener('click', applyFiltersAndClosePanel);
        
        const closeStatsBtn = document.getElementById('closeStatsBtn');
        if (closeStatsBtn) closeStatsBtn.addEventListener('click', closeStatsModal);

        document.querySelectorAll('.stats-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                switchStatsTab(tabName);
            });
        });
        
        const salesFilter = document.getElementById('salesFilter');
        if (salesFilter) salesFilter.addEventListener('change', renderSalesCharts);
        
        const priorityFilter = document.getElementById('priorityFilter');
        if (priorityFilter) priorityFilter.addEventListener('change', renderPriorityCharts);

        const searchDeals = document.getElementById('searchDeals');
        if (searchDeals) searchDeals.addEventListener('keyup', filterDeals);
        
        updateBeforeDiscountEventListeners();

        if (facilitySelect && newFacilityInput) {
            facilitySelect.addEventListener('change', handleFacilitySelectChange);
            newFacilityInput.addEventListener('input', handleNewFacilityInput);
        }
        
        if (packageSelect && newPackageInput) {
            packageSelect.addEventListener('change', handlePackageSelectChange);
            newPackageInput.addEventListener('input', handleNewPackageInput);
        }

        setupConsultantSearch();
        
        toggleDeleteOptionButtons();
        
    } catch (error) {
        console.error("Error initializing event listeners:", error);
        showToast("Gagal memuat beberapa fungsi", 3000);
    }
}

function handleFacilitySelectChange() {
    if (facilitySelect && facilitySelect.value !== '') {
        if (newFacilityInput) newFacilityInput.value = '';
    }
}

function handleNewFacilityInput() {
    if (newFacilityInput && newFacilityInput.value.trim() !== '') {
        if (facilitySelect) facilitySelect.value = '';
    }
}

function handlePackageSelectChange() {
    if (packageSelect && packageSelect.value !== '') {
        if (newPackageInput) newPackageInput.value = '';
    }
}

function handleNewPackageInput() {
    if (newPackageInput && newPackageInput.value.trim() !== '') {
        if (packageSelect) packageSelect.value = '';
    }
}

function toggleDeleteOptionButtons() {
    const deleteButtons = document.querySelectorAll('.delete-option-btn');
    const canDelete = currentUserRole === 'admin' || currentUserRole === 'manager';
    
    deleteButtons.forEach(button => {
        if (canDelete) {
            button.classList.remove('hidden');
        } else {
            button.classList.add('hidden');
        }
    });
}

// ==================== FUNGSI LAINNYA ====================

function initViewToggle() {
    const cardViewBtn = document.getElementById('cardViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (cardViewBtn && listViewBtn) {
        cardViewBtn.addEventListener('click', () => switchView('card'));
        listViewBtn.addEventListener('click', () => switchView('list'));
    }
}

function switchView(viewType) {
    if (currentView === viewType) return;
    
    currentView = viewType;
    
    const cardViewBtn = document.getElementById('cardViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (cardViewBtn) cardViewBtn.classList.toggle('active', viewType === 'card');
    if (listViewBtn) listViewBtn.classList.toggle('active', viewType === 'list');
    
    applyActiveFilters();
}

function applyActiveFilters() {
    try {
        const filteredDeals = getFilteredDeals();
        renderFilteredDeals(filteredDeals);
    } catch (error) {
        console.error("Error applying active filters:", error);
    }
}

function saveActiveFilters() {
    try {
        activeFilters = {
            searchTerm: document.getElementById('searchDeals') ? document.getElementById('searchDeals').value.toLowerCase() : '',
            priority: document.getElementById('filterPriority') ? document.getElementById('filterPriority').value : 'all',
            year: activeYear,
            stage: document.getElementById('filterStage') ? document.getElementById('filterStage').value : 'all',
            sales: document.getElementById('filterSales') ? document.getElementById('filterSales').value : 'all',
            consultant: document.getElementById('filterConsultant') ? document.getElementById('filterConsultant').value : 'all',
            contractor: document.getElementById('filterContractor') ? document.getElementById('filterContractor').value : 'all',
            facility: document.getElementById('filterFacility') ? document.getElementById('filterFacility').value : 'all',
            product: document.getElementById('filterProduct') ? document.getElementById('filterProduct').value : 'all',
            package: document.getElementById('filterPackage') ? document.getElementById('filterPackage').value : 'all'
        };
    } catch (error) {
        console.error("Error saving active filters:", error);
    }
}

function filterDeals() {
    try {
        saveActiveFilters();
        applyActiveFilters();
    } catch (error) {
        console.error("Error filtering deals:", error);
    }
}

function renderFilteredDeals(filteredDeals) {
    const pipelineStage = document.getElementById('pipelines-stage');
    if (!pipelineStage) return;
    
    pipelineStage.innerHTML = '';
    
    if (filteredDeals.length === 0) {
        const message = (currentUserRole === 'admin' || currentUserRole === 'manager') 
            ? 'Tidak ada deals yang sesuai dengan filter.'
            : `Tidak ada pipeline untuk sales ${currentSalesName || currentUserEmail}. Silakan tambahkan deal baru.`;
        
        pipelineStage.innerHTML = `
            <div class="empty-stage-message text-center text-gray-400 p-4 text-sm w-full">
                <i class="fas fa-search text-3xl mb-2"></i>
                <p>${message}</p>
            </div>
        `;
        return;
    }
    
    if (currentView === 'card') {
        const dealsByNameAndPriority = {};
        filteredDeals.forEach(deal => {
            const dealName = deal.dealName?.toLowerCase().trim();
            const priority = deal.priority || 'Priority';
            if (!dealName) return;
            
            const key = `${dealName}|${priority}`;
            
            if (!dealsByNameAndPriority[key]) {
                dealsByNameAndPriority[key] = [];
            }
            dealsByNameAndPriority[key].push(deal);
        });
        
        Object.values(dealsByNameAndPriority).forEach(dealGroup => {
            if (dealGroup.length > 0) {
                if (dealGroup.length > 1) {
                    const mergedCard = renderMergedDealCard(dealGroup);
                    pipelineStage.appendChild(mergedCard);
                    setupMergeDealCardEvents(mergedCard, dealGroup);
                } else {
                    const dealCard = renderIndividualDealCard(dealGroup[0]);
                    pipelineStage.appendChild(dealCard);
                }
            }
        });
        
        initSortable();
    } else {
        const listContainer = document.createElement('div');
        listContainer.className = 'list-view-container';
        
        const table = document.createElement('table');
        table.className = 'list-view';
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th class="px-4 py-3 text-left">No</th>
                <th class="px-4 py-3 text-left">Sales</th>
                <th class="px-4 py-3 text-left">Project</th>
                <th class="px-4 py-3 text-left">Tahap</th>
                <th class="px-4 py-3 text-left">Konsultan</th>
                <th class="px-4 py-3 text-left">Kontraktor</th>
                <th class="px-4 py-3 text-left">Nilai (IDR)</th>
                <th class="px-4 py-3 text-left">Priority</th>
                <th class="px-4 py-3 text-left">Aksi</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        filteredDeals.forEach((deal, index) => {
            const row = renderDealList(deal, index);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        listContainer.appendChild(table);
        pipelineStage.appendChild(listContainer);
    }
}

function logout() {
    auth.signOut()
        .then(() => {
            console.log("User logged out successfully");
            deals = [];
            activities = [];
            window.location.href = 'login.html';
        })
        .catch((error) => {
            console.error("Error logging out:", error);
            showToast("Gagal logout. Silakan coba lagi.", 5000);
        });
}

function openFilterPanel() {
    const filterPanel = document.getElementById('filterPanel');
    const filterPanelContent = document.getElementById('filterPanelContent');

    if (!filterPanel || !filterPanelContent) {
        console.error("Elemen panel filter tidak ditemukan.");
        showToast("Gagal membuka filter: Elemen tidak lengkap.", 3000);
        return;
    }

    populateYearDropdown();
    populateFilterDropdowns();

    filterPanel.classList.remove('hidden');
    filterPanelContent.classList.remove('modal-content-leave-active');
    filterPanelContent.classList.add('modal-content-enter-active');
}

function closeFilterPanel() {
    const filterPanelContent = document.getElementById('filterPanelContent');
    if (!filterPanelContent) {
        console.error("Elemen filterPanelContent tidak ditemukan saat menutup modal.");
        return;
    }

    filterPanelContent.classList.remove('modal-content-enter-active');
    filterPanelContent.classList.add('modal-content-leave-active');
    
    filterPanelContent.addEventListener('transitionend', function handler() {
        document.getElementById('filterPanel').classList.add('hidden');
        filterPanelContent.classList.remove('modal-content-leave-active');
        filterPanelContent.removeEventListener('transitionend', handler);
    }, { once: true });
}

function applyFiltersAndClosePanel() {
    saveActiveFilters();
    applyActiveFilters();
    closeFilterPanel();
}

function resetFilters() {
    const filterPriority = document.getElementById('filterPriority');
    const filterYear = document.getElementById('filterYear');
    const filterStage = document.getElementById('filterStage');
    const filterSales = document.getElementById('filterSales');
    const filterConsultant = document.getElementById('filterConsultant');
    const filterContractor = document.getElementById('filterContractor');
    const filterFacility = document.getElementById('filterFacility');
    const filterProduct = document.getElementById('filterProduct');
    const filterPackage = document.getElementById('filterPackage');
    const searchDeals = document.getElementById('searchDeals');
    
    if (filterPriority) filterPriority.value = 'all';
    if (filterYear) filterYear.value = 'all';
    if (filterStage) filterStage.value = 'all';
    if (filterSales) filterSales.value = 'all';
    if (filterConsultant) filterConsultant.value = 'all';
    if (filterContractor) filterContractor.value = 'all';
    if (filterFacility) filterFacility.value = 'all';
    if (filterProduct) filterProduct.value = 'all';
    if (filterPackage) filterPackage.value = 'all';
    if (searchDeals) searchDeals.value = '';
    
    document.querySelectorAll('.year-badge').forEach(badge => {
        badge.classList.remove('active');
        if (badge.dataset.year === 'all') {
            badge.classList.add('active');
        }
    });
    activeYear = 'all';
    
    activeFilters = {
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
    
    priorityStatsCache = {
        'all': null,
        '2025': null,
        '2026': null
    };
    
    dealsByYearCache = {
        'all': null,
        '2025': null,
        '2026': null
    };
    
    applyActiveFilters();
    createPriorityDashboard();
}

// ==================== FUNGSI SEARCH KONSULTAN ====================

function setupConsultantSearch() {
    if (!consultantSearchInput || !consultantHiddenInput || !consultantSuggestionsDiv) {
        console.warn("Consultant search elements not found. Skipping setup.");
        return;
    }

    consultantSearchInput.removeEventListener('input', handleConsultantSearchInput);
    consultantSearchInput.removeEventListener('blur', handleConsultantSearchBlur);
    consultantSearchInput.removeEventListener('focus', handleConsultantSearchFocus);
    document.removeEventListener('click', handleDocumentClick);

    consultantSearchInput.addEventListener('input', handleConsultantSearchInput);
    consultantSearchInput.addEventListener('blur', handleConsultantSearchBlur);
    consultantSearchInput.addEventListener('focus', handleConsultantSearchFocus);
    document.addEventListener('click', handleDocumentClick);
}

function handleConsultantSearchInput() {
    const searchTerm = consultantSearchInput.value.toLowerCase();
    consultantSuggestionsDiv.innerHTML = '';

    if (searchTerm.length === 0) {
        consultantSuggestionsDiv.classList.add('hidden');
        return;
    }

    const filteredSuggestions = Array.from(uniqueConsultants)
        .filter(consultant => consultant.toLowerCase().includes(searchTerm))
        .sort();

    if (filteredSuggestions.length > 0) {
        filteredSuggestions.forEach(consultant => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = consultant;
            suggestionItem.addEventListener('click', (e) => {
                e.stopPropagation();
                consultantSearchInput.value = consultant;
                consultantHiddenInput.value = consultant;
                consultantSuggestionsDiv.classList.add('hidden');
            });
            consultantSuggestionsDiv.appendChild(suggestionItem);
        });
        consultantSuggestionsDiv.classList.remove('hidden');
    } else {
        consultantSuggestionsDiv.classList.add('hidden');
    }
}

function handleConsultantSearchBlur() {
    setTimeout(() => {
        const currentInputValue = consultantSearchInput.value.trim();
        if (currentInputValue !== '') {
            consultantHiddenInput.value = currentInputValue;
        } else {
            consultantHiddenInput.value = '';
        }
        consultantSuggestionsDiv.classList.add('hidden');
    }, 100);
}

function handleConsultantSearchFocus() {
    if (consultantSearchInput.value.length > 0) {
        const event = new Event('input');
        consultantSearchInput.dispatchEvent(event);
    }
}

function handleDocumentClick(event) {
    if (!consultantSearchInput.contains(event.target) && !consultantSuggestionsDiv.contains(event.target)) {
        consultantSuggestionsDiv.classList.add('hidden');
    }
}

// ==================== FUNGSI EXPORT EXCEL ====================

function initExportElements() {
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const exportExcelModal = document.getElementById('exportExcelModal');
    const exportExcelModalContent = document.getElementById('exportExcelModalContent');
    
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', openExportModal);
    }
    
    const cancelExportBtn = document.getElementById('cancelExportBtn');
    if (cancelExportBtn) cancelExportBtn.addEventListener('click', closeExportModal);
    
    const confirmExportBtn = document.getElementById('confirmExportBtn');
    if (confirmExportBtn) confirmExportBtn.addEventListener('click', exportToExcel);
    
    const exportDateRange = document.getElementById('exportDateRange');
    if (exportDateRange) exportDateRange.addEventListener('change', toggleCustomDateRange);
}

function toggleExportButton() {
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        if (currentUserRole === 'admin') {
            exportExcelBtn.classList.remove('hidden');
        } else {
            exportExcelBtn.classList.add('hidden');
        }
    }
}

function openExportModal() {
    const exportExcelModal = document.getElementById('exportExcelModal');
    const exportExcelModalContent = document.getElementById('exportExcelModalContent');
    
    if (!exportExcelModal || !exportExcelModalContent) return;
    
    const exportDateRange = document.getElementById('exportDateRange');
    const exportFormat = document.getElementById('exportFormat');
    const customDateRange = document.getElementById('customDateRange');
    
    if (exportDateRange) exportDateRange.value = 'all';
    if (exportFormat) exportFormat.value = 'detailed';
    if (customDateRange) customDateRange.classList.add('hidden');
    
    exportExcelModal.classList.remove('hidden');
    exportExcelModalContent.classList.remove('modal-content-leave-active');
    exportExcelModalContent.classList.add('modal-content-enter-active');
}

function closeExportModal() {
    const exportExcelModalContent = document.getElementById('exportExcelModalContent');
    if (!exportExcelModalContent) return;

    exportExcelModalContent.classList.remove('modal-content-enter-active');
    exportExcelModalContent.classList.add('modal-content-leave-active');
    
    exportExcelModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('exportExcelModal').classList.add('hidden');
        exportExcelModalContent.classList.remove('modal-content-leave-active');
        exportExcelModalContent.removeEventListener('transitionend', handler);
    }, { once: true });
}

function toggleCustomDateRange() {
    const dateRange = document.getElementById('exportDateRange');
    const customDateRange = document.getElementById('customDateRange');
    
    if (!dateRange || !customDateRange) return;
    
    if (dateRange.value === 'custom') {
        customDateRange.classList.remove('hidden');
    } else {
        customDateRange.classList.add('hidden');
    }
}

function getDealsByDateRange() {
    const dateRange = document.getElementById('exportDateRange');
    const startDateInput = document.getElementById('exportStartDate');
    const endDateInput = document.getElementById('exportEndDate');
    
    if (!dateRange) return deals;
    
    let startDate, endDate;
    
    if (dateRange.value === 'custom') {
        if (!startDateInput || !endDateInput || !startDateInput.value || !endDateInput.value) {
            showToast("Harap pilih tanggal mulai dan tanggal akhir", 3000);
            return null;
        }
        startDate = new Date(startDateInput.value);
        endDate = new Date(endDateInput.value);
        endDate.setHours(23, 59, 59, 999);
    } else {
        const now = new Date();
        
        switch (dateRange.value) {
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                break;
            case 'this_quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
                break;
            case 'this_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
            default:
                return deals;
        }
    }
    
    return deals.filter(deal => {
        if (!deal.createdAt) return false;
        
        const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
        return dealDate >= startDate && dealDate <= endDate;
    });
}

function exportToExcel() {
    if (currentUserRole !== 'admin') {
        showToast("Hanya admin yang dapat mengekspor data", 3000);
        return;
    }
    
    const filteredDeals = getDealsByDateRange();
    if (!filteredDeals || filteredDeals.length === 0) {
        showToast("Tidak ada data untuk diekspor", 3000);
        return;
    }
    
    const exportFormat = document.getElementById('exportFormat');
    const formatValue = exportFormat ? exportFormat.value : 'detailed';
    
    try {
        let worksheetData;
        
        if (formatValue === 'detailed') {
            worksheetData = prepareDetailedExportData(filteredDeals);
        } else {
            worksheetData = prepareSummaryExportData(filteredDeals);
        }
        
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Pipeline Data");
        
        const dateRange = document.getElementById('exportDateRange');
        const dateRangeValue = dateRange ? dateRange.value : 'all';
        const formatType = formatValue === 'detailed' ? 'Detail' : 'Ringkasan';
        const fileName = `Sales_Pipeline_${formatType}_${dateRangeValue}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        XLSX.writeFile(workbook, fileName);
        
        showToast("Data berhasil diekspor ke Excel", 3000);
        closeExportModal();
        
        activitiesCollection.add({
            message: `Data diekspor ke Excel (${formatType}, ${dateRangeValue}) oleh ${auth.currentUser.email}.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
    } catch (error) {
        console.error("Error exporting to Excel:", error);
        showToast("Gagal mengekspor data ke Excel", 3000);
    }
}

function prepareDetailedExportData(dealsData) {
    return dealsData.map(deal => {
        let contractorText = '';
        if (deal.contractor) {
            if (Array.isArray(deal.contractor)) {
                contractorText = deal.contractor.join(', ');
            } else {
                contractorText = deal.contractor;
            }
        }
        
        let productText = '';
        if (deal.product) {
            if (Array.isArray(deal.product)) {
                productText = deal.product.join(', ');
            } else {
                productText = deal.product;
            }
        }
        
        return {
            'Nama Proyek': deal.dealName || '',
            'Nama Sales': deal.salesName || '',
            'Tahap': deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '',
            'Prioritas': deal.priority || '',
            'Nilai (IDR)': deal.value || 0,
            'Diskon (%)': deal.discount || 0,
            'Sebelum Diskon (IDR)': deal.beforeDiscount || 0,
            'Paket': deal.package || '',
            'Produk': productText,
            'Fasilitas': deal.facility || '',
            'Owner': deal.owner || '',
            'Konsultan': deal.consultant || '',
            'Kontraktor': contractorText,
            'PIC': deal.pic || '',
            'Plan PO': deal.planPO || '',
            'Remarks': deal.remarks || '',
            'Tanggal Dibuat': formatDate(deal.createdAt),
            'Terakhir Update': formatDateTime(deal.updatedAt),
            'Dibuat Oleh': deal.createdBy || ''
        };
    });
}

function prepareSummaryExportData(dealsData) {
    const uniqueProjects = getUniqueProjectsForDashboard(dealsData);
    
    const summary = {};
    
    uniqueProjects.forEach(deal => {
        const stage = deal.stage || 'Unknown';
        const sales = deal.salesName || 'Unknown';
        const product = Array.isArray(deal.product) ? deal.product[0] || 'Unknown' : (deal.product || 'Unknown');
        
        if (!summary[stage]) {
            summary[stage] = {
                stage: stage,
                dealCount: 0,
                totalValue: 0,
                salesCount: {},
                productCount: {}
            };
        }
        
        summary[stage].dealCount++;
        summary[stage].totalValue += (deal.displayValue || deal.value || 0);
        
        if (!summary[stage].salesCount[sales]) {
            summary[stage].salesCount[sales] = 0;
        }
        summary[stage].salesCount[sales]++;
        
        if (!summary[stage].productCount[product]) {
            summary[stage].productCount[product] = 0;
        }
        summary[stage].productCount[product]++;
    });
    
    return Object.values(summary).map(item => {
        const topSales = Object.entries(item.salesCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => `${name} (${count})`)
            .join(', ');
            
        const topProducts = Object.entries(item.productCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => `${name} (${count})`)
            .join(', ');
        
        return {
            'Tahap': item.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            'Jumlah Deal': item.dealCount,
            'Total Nilai (IDR)': item.totalValue,
            'Top 3 Sales': topSales,
            'Top 3 Produk': topProducts
        };
    });
}

// ==================== FUNGSI TAMBAHAN UNTUK DEAL ====================

function addContractorField(initialValue = '') {
    const contractorListDiv = document.getElementById('contractorList');
    if (!contractorListDiv) return;
    
    const newContractorDiv = document.createElement('div');
    newContractorDiv.className = 'flex items-center space-x-2 mb-2';

    const selectId = `contractor-select-${Date.now()}`;
    const inputId = `contractor-input-${Date.now()}`;

    newContractorDiv.innerHTML = `
        <select id="${selectId}" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-sm">
            <option value="">Pilih Kontraktor</option>
        </select>
        <input type="text" id="${inputId}" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-sm" placeholder="Atau ketik nama kontraktor baru">
        <button type="button" class="remove-contractor-btn text-red-500 hover:text-red-700 p-1">
            <i class="fas fa-times"></i>
        </button>
    `;
    contractorListDiv.appendChild(newContractorDiv);

    populateDropdown(selectId, uniqueContractors);

    if (initialValue) {
        const newSelect = document.getElementById(selectId);
        const newTextInput = document.getElementById(inputId);
        if (uniqueContractors.has(initialValue)) {
            newSelect.value = initialValue;
            if (newTextInput) newTextInput.value = '';
        } else {
            if (newSelect) newSelect.value = '';
            if (newTextInput) newTextInput.value = initialValue;
        }
    }

    const newSelect = document.getElementById(selectId);
    const newTextInput = document.getElementById(inputId);

    if (newSelect && newTextInput) {
        newSelect.addEventListener('change', () => {
            if (newSelect.value !== '') {
                newTextInput.value = '';
            }
        });

        newTextInput.addEventListener('input', () => {
            if (newTextInput.value.trim() !== '') {
                newSelect.value = '';
            }
        });
    }
}

function removeContractorField(buttonElement) {
    if (buttonElement && buttonElement.closest('.flex')) {
        buttonElement.closest('.flex').remove();
    }
}

function addProductField(initialValue = '') {
    const productListDiv = document.getElementById('productList');
    if (!productListDiv) return;
    
    const newProductDiv = document.createElement('div');
    newProductDiv.className = 'flex items-center space-x-2 mb-2';

    const selectId = `product-select-${Date.now()}`;
    const inputId = `product-input-${Date.now()}`;

    newProductDiv.innerHTML = `
        <select id="${selectId}" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-sm">
            <option value="">Pilih Produk</option>
            <option value="Fire">Fire</option>
            <option value="Suppresion">Suppresion</option>
            <option value="Vesda">Vesda</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Fire - Water">Fire - Water</option>
            <option value="Mechanical">Mechanical</option>
            <option value="FAS-FSS-FF">FAS-FSS-FF</option>
            <option value="FAS&FSS">FAS&FSS</option>
        </select>
        <input type="text" id="${inputId}" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-sm" placeholder="Atau ketik nama produk baru">
        <button type="button" class="remove-product-btn text-red-500 hover:text-red-700 p-1">
            <i class="fas fa-times"></i>
        </button>
    `;
    productListDiv.appendChild(newProductDiv);

    const newSelect = document.getElementById(selectId);
    const newTextInput = document.getElementById(inputId);

    if (newSelect) {
        Array.from(uniqueProducts).sort().forEach(value => {
            if (value && !['Fire', 'Suppresion', 'Vesda', 'Maintenance', 'Fire - Water', 'Mechanical', 'FAS-FSS-FF', 'FAS&FSS'].includes(value)) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                newSelect.appendChild(option);
            }
        });

        if (initialValue) {
            const options = Array.from(newSelect.options);
            const hasOption = options.some(option => option.value === initialValue);
            if (hasOption) {
                newSelect.value = initialValue;
                if (newTextInput) newTextInput.value = '';
            } else {
                newSelect.value = '';
                if (newTextInput) newTextInput.value = initialValue;
            }
        }

        if (newTextInput) {
            newSelect.addEventListener('change', () => {
                if (newSelect.value !== '') {
                    newTextInput.value = '';
                }
            });

            newTextInput.addEventListener('input', () => {
                if (newTextInput.value.trim() !== '') {
                    newSelect.value = '';
                }
            });
        }
    }
}

function removeProductField(buttonElement) {
    if (buttonElement && buttonElement.closest('.flex')) {
        buttonElement.closest('.flex').remove();
    }
}

async function openDealModal(dealId = null) {
    const dealModal = document.getElementById('dealModal');
    const modalTitle = document.getElementById('modalTitle');
    const dealForm = document.getElementById('dealForm');
    const commentsSection = document.getElementById('commentsSection');
    
    if (!dealModal || !modalTitle || !dealForm) {
        console.error("Modal elements not found");
        showToast("Gagal membuka modal deal", 3000);
        return;
    }
    
    try {
        if (dealForm) dealForm.reset();
        
        const dealIdInput = document.getElementById('dealId');
        const valueInput = document.getElementById('value');
        const beforeDiscountInput = document.getElementById('beforeDiscount');
        
        if (dealIdInput) dealIdInput.value = '';
        if (valueInput) valueInput.value = '';
        if (beforeDiscountInput) beforeDiscountInput.value = '';
    
        const newOwnerInput = document.getElementById('newOwner');
        const newPicInput = document.getElementById('newPic');
        const newPackageInput = document.getElementById('newPackage');
        const newFacilityInput = document.getElementById('newFacility');
        
        if (newOwnerInput) newOwnerInput.value = '';
        if (newPicInput) newPicInput.value = '';
        if (newPackageInput) newPackageInput.value = '';
        if (newFacilityInput) newFacilityInput.value = '';
        
        if (consultantSearchInput) {
            consultantSearchInput.value = '';
        }
        if (consultantHiddenInput) {
            consultantHiddenInput.value = '';
        }
        if (consultantSuggestionsDiv) {
            consultantSuggestionsDiv.innerHTML = '';
            consultantSuggestionsDiv.classList.add('hidden');
        }
    
        populateDropdown('pic', uniquePICs);
        populateDropdown('owner', uniqueOwners);
    
        const productList = document.getElementById('productList');
        if (productList) productList.innerHTML = '';
    
        if (facilitySelect) {
            facilitySelect.innerHTML = `
                <option value="">Pilih Fasilitas</option>
                <option value="Industrial">Industrial</option>
                <option value="Office">Office</option>
                <option value="Hotel">Hotel</option>
                <option value="Data Center">Data Center</option>
                <option value="Oil & Gas">Oil & Gas</option>
                <option value="Warehouse">Warehouse</option>
                <option value="Other">Other</option>
            `;
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
            packageSelect.innerHTML = `
                <option value="">Pilih Paket</option>
                <option value="Electronic Package">Electronic Package</option>
                <option value="M&E">M&E</option>
                <option value="Fire Fighting Cont">Fire Fighting Cont</option>
                <option value="Main Kontraktor">Main Kontraktor</option>
            `;
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
            modalTitle.textContent = 'Edit Deal';
            const deal = deals.find(d => d.id === dealId);
            if (deal) {
                const dealIdElement = document.getElementById('dealId');
                if (dealIdElement) dealIdElement.value = deal.id;
                
                const salesNameSelect = document.getElementById('salesName');
                if (salesNameSelect) salesNameSelect.value = deal.salesName || '';
                
                const dealNameInput = document.getElementById('dealName');
                if (dealNameInput) dealNameInput.value = deal.dealName || '';
                
                const beforeDiscountInput = document.getElementById('beforeDiscount');
                if (beforeDiscountInput) {
                    beforeDiscountInput.value = deal.beforeDiscount ? new Intl.NumberFormat('id-ID').format(deal.beforeDiscount) : '';
                }
                
                const discountInput = document.getElementById('discount');
                if (discountInput) discountInput.value = deal.discount || '';
                
                calculateValueFromBeforeDiscount();
                
                if (deal.package && packageSelect) {
                    const options = Array.from(packageSelect.options);
                    const hasOption = options.some(option => option.value === deal.package);
                    if (hasOption) {
                        packageSelect.value = deal.package;
                        if (newPackageInput) newPackageInput.value = '';
                    } else {
                        packageSelect.value = '';
                        if (newPackageInput) newPackageInput.value = deal.package || '';
                    }
                }
    
                if (deal.product) {
                    if (Array.isArray(deal.product) && deal.product.length > 0) {
                        deal.product.forEach(product => {
                            addProductField(product);
                        });
                    } else {
                        addProductField(deal.product);
                    }
                } else {
                    addProductField(); 
                }
    
                if (deal.facility && facilitySelect) {
                    const options = Array.from(facilitySelect.options);
                    const hasOption = options.some(option => option.value === deal.facility);
                    if (hasOption) {
                        facilitySelect.value = deal.facility;
                        if (newFacilityInput) newFacilityInput.value = '';
                    } else {
                        facilitySelect.value = '';
                        if (newFacilityInput) newFacilityInput.value = deal.facility || '';
                    }
                }
                
                const ownerSelect = document.getElementById('owner');
                if (deal.owner && uniqueOwners.has(deal.owner)) {
                    if (ownerSelect) ownerSelect.value = deal.owner;
                } else {
                    if (ownerSelect) ownerSelect.value = '';
                    if (newOwnerInput) newOwnerInput.value = deal.owner || '';
                }
    
                if (consultantSearchInput) {
                    consultantSearchInput.value = deal.consultant || '';
                }
                if (consultantHiddenInput) {
                    consultantHiddenInput.value = deal.consultant || '';
                }
    
                if (deal.contractor) {
                    if (Array.isArray(deal.contractor) && deal.contractor.length > 0) {
                        deal.contractor.forEach(contractor => {
                            addContractorField(contractor);
                        });
                    } else if (deal.contractor) {
                        addContractorField(deal.contractor);
                    } else {
                        addContractorField(); 
                    }
                }
    
                const picSelect = document.getElementById('pic');
                if (deal.pic && uniquePICs.has(deal.pic)) {
                    if (picSelect) picSelect.value = deal.pic;
                } else {
                    if (picSelect) picSelect.value = '';
                    if (newPicInput) newPicInput.value = deal.pic || '';
                }
    
                const planPOSelect = document.getElementById('planPO');
                if (planPOSelect) planPOSelect.value = deal.planPO || '';
                
                const stageSelect = document.getElementById('stage');
                if (stageSelect) stageSelect.value = deal.stage || DEFAULT_STAGE;
                
                const prioritySelect = document.getElementById('priority');
                if (prioritySelect) prioritySelect.value = deal.priority || 'Priority';
                
                const remarksTextarea = document.getElementById('remarks');
                if (remarksTextarea) remarksTextarea.value = deal.remarks || '';
                
                updateProgressBarFromStage(deal.stage);
                
                currentDealIdForComments = deal.id;
                const comments = await loadCommentsByProjectName(deal.id);
                renderComments(comments, 'commentsList');
                if (commentsSection) {
                    commentsSection.style.display = 'block';
                }
            }
        } else {
            modalTitle.textContent = 'Tambah Deal Baru';
            
            const stageSelect = document.getElementById('stage');
            if (stageSelect) stageSelect.value = DEFAULT_STAGE;
            
            const prioritySelect = document.getElementById('priority');
            if (prioritySelect) prioritySelect.value = 'Priority';
            
            const currentUser = auth.currentUser;
            if (currentUser && currentUserRole === 'user') {
                const userSalesName = getCurrentSalesName();
                const salesNameSelect = document.getElementById('salesName');
                if (salesNameSelect && userSalesName) {
                    salesNameSelect.value = userSalesName;
                    salesNameSelect.disabled = true;
                }
            } else {
                const salesNameSelect = document.getElementById('salesName');
                if (salesNameSelect) {
                    salesNameSelect.disabled = false;
                }
            }
            
            addContractorField();
            addProductField();
            
            updateProgressBarFromStage(DEFAULT_STAGE);
            
            if (commentsSection) {
                commentsSection.style.display = 'none';
            }
            currentDealIdForComments = null;
        }
        
        dealModal.classList.remove('hidden');
        const dealModalContent = document.getElementById('dealModalContent');
        if (dealModalContent) {
            dealModalContent.classList.remove('modal-content-leave-active');
            dealModalContent.classList.add('modal-content-enter-active');
        }
    } catch (error) {
        console.error("Error opening deal modal:", error);
        showToast("Gagal membuka modal deal", 3000);
    }
}

function closeDealModal() {
    const dealModalContent = document.getElementById('dealModalContent');
    if (!dealModalContent) return;

    dealModalContent.classList.remove('modal-content-enter-active');
    dealModalContent.classList.add('modal-content-leave-active');
    
    dealModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('dealModal').classList.add('hidden');
        dealModalContent.classList.remove('modal-content-leave-active');
        dealModalContent.removeEventListener('transitionend', handler);
        currentDealIdForComments = null;
        
        const salesNameSelect = document.getElementById('salesName');
        if (salesNameSelect) {
            salesNameSelect.disabled = false;
        }
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
        
        let packageValue = '';
        const packageSelect = document.getElementById('package');
        const newPackageInput = document.getElementById('newPackage');
        if (packageSelect && packageSelect.value !== '') {
            packageValue = packageSelect.value;
            if (newPackageInput) newPackageInput.value = '';
        } else if (newPackageInput && newPackageInput.value.trim() !== '') {
            packageValue = newPackageInput.value.trim();
            if (!uniquePackages.has(packageValue)) {
                uniquePackages.add(packageValue);
                saveDropdownOptions();
            }
        }
        
        let facilityValue = '';
        const facilitySelect = document.getElementById('facility');
        const newFacilityInput = document.getElementById('newFacility');
        if (facilitySelect && facilitySelect.value !== '') {
            facilityValue = facilitySelect.value;
            if (newFacilityInput) newFacilityInput.value = '';
        } else if (newFacilityInput && newFacilityInput.value.trim() !== '') {
            facilityValue = newFacilityInput.value.trim();
            if (!uniqueFacilities.has(facilityValue)) {
                uniqueFacilities.add(facilityValue);
                saveDropdownOptions();
            }
        }
        
        const productElements = document.querySelectorAll('#productList select, #productList input[type="text"]');
        const products = [];
        for (let i = 0; i < productElements.length; i += 2) {
            const selectElement = productElements[i];
            const inputElement = productElements[i + 1];
            let productValue = '';
            
            if (selectElement && selectElement.value !== '') {
                productValue = selectElement.value;
            } else if (inputElement && inputElement.value.trim() !== '') {
                productValue = inputElement.value.trim();
                if (!uniqueProducts.has(productValue)) {
                    uniqueProducts.add(productValue);
                }
            }
            
            if (productValue) {
                products.push(productValue);
            }
        }
        
        const contractorElements = document.querySelectorAll('#contractorList select, #contractorList input[type="text"]');
        const contractors = [];
        for (let i = 0; i < contractorElements.length; i += 2) {
            const selectElement = contractorElements[i];
            const inputElement = contractorElements[i + 1];
            let contractorValue = '';
            
            if (selectElement && selectElement.value !== '') {
                contractorValue = selectElement.value;
            } else if (inputElement && inputElement.value.trim() !== '') {
                contractorValue = inputElement.value.trim();
                if (!uniqueContractors.has(contractorValue)) {
                    uniqueContractors.add(contractorValue);
                }
            }
            
            if (contractorValue) {
                contractors.push(contractorValue);
            }
        }
        
        let ownerValue = '';
        const ownerSelect = document.getElementById('owner');
        const newOwnerInput = document.getElementById('newOwner');
        if (ownerSelect && ownerSelect.value !== '') {
            ownerValue = ownerSelect.value;
            if (newOwnerInput) newOwnerInput.value = '';
        } else if (newOwnerInput && newOwnerInput.value.trim() !== '') {
            ownerValue = newOwnerInput.value.trim();
            if (!uniqueOwners.has(ownerValue)) {
                uniqueOwners.add(ownerValue);
                saveDropdownOptions();
            }
        }
        
        let picValue = '';
        const picSelect = document.getElementById('pic');
        const newPicInput = document.getElementById('newPic');
        if (picSelect && picSelect.value !== '') {
            picValue = picSelect.value;
            if (newPicInput) newPicInput.value = '';
        } else if (newPicInput && newPicInput.value.trim() !== '') {
            picValue = newPicInput.value.trim();
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
            const docRef = await dealsCollection.add(dealData);
            
            await activitiesCollection.add({
                message: `Deal "${dealName}" ditambahkan oleh ${auth.currentUser.email}. (Nilai: Rp ${formatNumber(calculatedValue)}, Tahap: ${stage}, Priority: ${priority})`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: auth.currentUser.email,
                read: false
            });
            
            showToast(`Deal "${dealName}" berhasil ditambahkan!`, 2000);
        }
        
        priorityStatsCache = {
            'all': null,
            '2025': null,
            '2026': null
        };
        
        dealsByYearCache = {
            'all': null,
            '2025': null,
            '2026': null
        };
        
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
        
        if (!deal) {
            deal = deals.find(d => d.id === dealId);
        }
        
        if (!deal) {
            console.log("Deal tidak ditemukan di cache, mengambil dari Firestore...");
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
        
        let displayValue;
        if (isLastProject) {
            displayValue = deal.value || 0;
        } else {
            displayValue = Math.max(...activeProjects.map(d => d.value || 0));
        }
        
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
        if (deal.product) {
            if (Array.isArray(deal.product)) {
                productText = deal.product.join(', ');
            } else {
                productText = deal.product;
            }
        }
        document.getElementById('detailProduct').textContent = productText;
        
        document.getElementById('detailFacility').textContent = deal.facility || '-';
        document.getElementById('detailOwner').textContent = deal.owner || '-';
        document.getElementById('detailConsultant').textContent = deal.consultant || '-';
        
        let contractorText = '-';
        if (deal.contractor) {
            if (Array.isArray(deal.contractor)) {
                contractorText = deal.contractor.join(', ');
            } else {
                contractorText = deal.contractor;
            }
        }
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
                            ${otherPriorities.map(p => `
                                <span class="px-2 py-1 rounded-full text-xs ${getPriorityBadgeClass(p)}">
                                    ${p}
                                </span>
                            `).join('')}
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
            case 'identified':
                progress = 20;
                break;
            case 'prospect':
                progress = 40;
                break;
            case 'tender-me':
                progress = 60;
                break;
            case 'tender-main-con':
            case 'contract-award':
                progress = 80;
                break;
            case 'win':
            case 'lost':
                progress = 100;
                break;
            case 'on-hold':
                progress = 0;
                break;
        }
        document.getElementById('detailProgress').textContent = `${progress}%`;
        
        currentDealIdForComments = dealId;
        const comments = await loadCommentsByProjectName(dealId);
        renderComments(comments, 'detailCommentsList');
        
        document.getElementById('dealDetailModal').classList.remove('hidden');
        const dealDetailModalContent = document.getElementById('dealDetailModalContent');
        if (dealDetailModalContent) {
            dealDetailModalContent.classList.remove('modal-content-leave-active');
            dealDetailModalContent.classList.add('modal-content-enter-active');
        }
        
    } catch (error) {
        console.error("Error opening deal detail modal:", error);
        showToast("Gagal membuka detail deal", 3000);
    }
}

function closeDealDetailModal() {
    const dealDetailModalContent = document.getElementById('dealDetailModalContent');
    if (!dealDetailModalContent) return;

    dealDetailModalContent.classList.remove('modal-content-enter-active');
    dealDetailModalContent.classList.add('modal-content-leave-active');
    
    dealDetailModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('dealDetailModal').classList.add('hidden');
        dealDetailModalContent.classList.remove('modal-content-leave-active');
        dealDetailModalContent.removeEventListener('transitionend', handler);
        currentDealIdForComments = null;
    }, { once: true });
}

function confirmDeleteDeal(dealId, dealName) {
    dealToDeleteId = dealId;
    dealToDeleteName = dealName;
    
    document.getElementById('dealToDeleteName').textContent = dealName;
    document.getElementById('deleteModal').classList.remove('hidden');
    const deleteModalContent = document.getElementById('deleteModalContent');
    if (deleteModalContent) {
        deleteModalContent.classList.remove('modal-content-leave-active');
        deleteModalContent.classList.add('modal-content-enter-active');
    }
}

function closeDeleteModal() {
    const deleteModalContent = document.getElementById('deleteModalContent');
    if (!deleteModalContent) return;

    deleteModalContent.classList.remove('modal-content-enter-active');
    deleteModalContent.classList.add('modal-content-leave-active');
    
    deleteModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('deleteModal').classList.add('hidden');
        deleteModalContent.classList.remove('modal-content-leave-active');
        deleteModalContent.removeEventListener('transitionend', handler);
    }, { once: true });
}

async function deleteDeal() {
    const dealId = dealToDeleteId;
    const dealName = dealToDeleteName;
    
    if (!dealId) {
        showToast("Deal tidak ditemukan", 3000);
        return;
    }
    
    try {
        const dealDoc = await dealsCollection.doc(dealId).get();
        if (!dealDoc.exists) {
            showToast("Deal tidak ditemukan di database", 3000);
            return;
        }
        
        const dealData = dealDoc.data();
        
        const deletedDealData = {
            ...dealData,
            originalId: dealId,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedBy: auth.currentUser.email,
            deletedByEmail: auth.currentUser.email
        };
        
        await deletedDealsCollection.add(deletedDealData);
        
        await dealsCollection.doc(dealId).delete();
        
        await activitiesCollection.add({
            message: `Deal "${dealName}" dipindahkan ke Recycle Bin oleh ${auth.currentUser.email}. (Nilai: Rp ${formatNumber(dealData.value || 0)})`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        showToast(`Deal "${dealName}" berhasil dipindahkan ke Recycle Bin!`, 2000);
        
        priorityStatsCache = {
            'all': null,
            '2025': null,
            '2026': null
        };
        
        dealsByYearCache = {
            'all': null,
            '2025': null,
            '2026': null
        };
        
        dealsByIdCache.delete(dealId);
        activitiesCache.lastFetch = null;
        
        closeDeleteModal();
        await loadDealsFromFirebase(true);
        await loadActivitiesFromFirebase(true);
        
        if (currentUserRole === 'admin') {
            loadRecycleBin();
        }
        
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
        console.log("No user, redirecting to login");
        window.location.href = 'login.html';
        return;
    }
    
    if (user && window.location.pathname.includes('login.html')) {
        console.log("User already logged in, redirecting to app");
        window.location.href = 'app.html';
        return;
    }

    if (user && window.location.pathname.includes('app.html')) {
        try {
            currentUserEmail = user.email;
            
            // Cek apakah migrasi sudah pernah dilakukan
            const migrationFlag = localStorage.getItem('comments_migration_completed');
            if (migrationFlag === 'true') {
                commentsMigrationCompleted = true;
            }
            
            const userWelcome = document.getElementById('userWelcome');
            if (userWelcome) {
                userWelcome.textContent = user.email;
            }

            if (managerEmails.includes(user.email)) {
                if (user.email === 'admin@genetek.co.id' || user.email === 'david@genetek.co.id') {
                    currentUserRole = 'admin';
                } else {
                    currentUserRole = 'manager';
                }
                await usersCollection.doc(user.uid).set({ 
                    role: currentUserRole,
                    email: user.email 
                }, { merge: true });
            } else {
                currentUserRole = 'user';
                const userDoc = await usersCollection.doc(user.uid).get();
                if (!userDoc.exists) {
                    await usersCollection.doc(user.uid).set({ 
                        role: 'user',
                        email: user.email 
                    }, { merge: true });
                } else {
                    currentUserRole = userDoc.data().role || 'user';
                }
            }
            
            currentSalesName = getCurrentSalesName();
            
            console.log("Current role:", currentUserRole);
            console.log("Current sales name:", currentSalesName);
            console.log("Current user email:", currentUserEmail);
            
            applyUserPermissions();
            
            await loadConsultantsFromFirebase();
            await loadDropdownOptions();
            await loadDealsFromFirebase();
            await loadActivitiesFromFirebase();
            
            initEventListeners();
            initViewToggle();
            initExportElements();
            initYearFilter();
            
            if (currentUserRole === 'admin') {
                loadRecycleBin();
            }
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
