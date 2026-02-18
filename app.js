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

// FILTER TAHUN AKTIF - PASTIKAN SINKRON
let activeYear = 'all';

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
    'engineering@genetek.co.id': 'Engineering',
    'yib_wahyu@genetek.co.id': 'YIB Wahyu'
};

// Daftar email manager
const managerEmails = [
    'hadi@genetek.co.id',
    'david@genetek.co.id',
    'crenata@genetek.co.id',
    'agoesdh@genetek.co.id',
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

// Variabel untuk menyimpan pilihan sales aktif per deal card
let activeSalesPerDeal = {};

// ==================== FUNGSI UTAMA ====================

// Fungsi untuk menangani perubahan status autentikasi
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
            // Update welcome message
            const userWelcome = document.getElementById('userWelcome');
            if (userWelcome) {
                userWelcome.textContent = user.email;
            }

            // Cek role admin/manager
            if (managerEmails.includes(user.email)) {
                currentUserRole = user.email === 'admin@genetek.co.id' ? 'admin' : 'manager';
                await usersCollection.doc(user.uid).set({ 
                    role: currentUserRole,
                    email: user.email 
                }, { merge: true });
            } else {
                // Untuk user biasa (sales)
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

            console.log("Current role:", currentUserRole);
            applyUserPermissions();
            loadActivitiesFromFirebase();
            
            // Muat konsultan dari GitHub JSON
            await loadConsultantsFromFirebase(); 
            
            // Muat opsi dropdown dari Firebase
            await loadDropdownOptions();
            
            initEventListeners();
            initViewToggle();
            initExportElements();
            initYearFilter(); // Inisialisasi filter tahun
            
            // Load Recycle Bin data untuk admin
            if (currentUserRole === 'admin') {
                loadRecycleBin();
            }
        } catch (error) {
            console.error("Error checking user role:", error);
            showToast("Gagal memuat data pengguna. Silakan refresh halaman.", 5000);
        }
    }
});

// ==================== FILTER TAHUN - DIPERBAIKI ====================

/**
 * Inisialisasi filter tahun untuk 2025 dan 2026
 */
function initYearFilter() {
    const yearFilterContainer = document.querySelector('.year-filter-container');
    if (!yearFilterContainer) return;

    // Gunakan event delegation
    yearFilterContainer.addEventListener('click', (e) => {
        const yearBadge = e.target.closest('.year-badge');
        if (!yearBadge) return;

        const year = yearBadge.dataset.year;
        
        // Update active class
        document.querySelectorAll('.year-badge').forEach(badge => {
            badge.classList.remove('active');
        });
        yearBadge.classList.add('active');
        
        // Set active year dan reload data
        activeYear = year;
        
        // Reload deals dengan filter tahun baru
        loadDealsFromFirebase();
        
        showToast(`Menampilkan data tahun ${year === 'all' ? 'semua tahun' : year}`, 2000);
    });
}

/**
 * Filter deals berdasarkan tahun yang dipilih
 * @param {Array} dealsList - Daftar deals
 * @returns {Array} - Deals yang sudah difilter berdasarkan tahun
 */
function filterDealsByYear(dealsList) {
    if (activeYear === 'all') return dealsList;
    
    return dealsList.filter(deal => {
        if (!deal.createdAt) return false;
        try {
            // Konversi ke timestamp dengan aman
            let dealDate;
            if (deal.createdAt.toDate) {
                dealDate = deal.createdAt.toDate();
            } else if (deal.createdAt.seconds) {
                dealDate = new Date(deal.createdAt.seconds * 1000);
            } else {
                return false;
            }
            
            const dealYear = dealDate.getFullYear().toString();
            return dealYear === activeYear;
        } catch (e) {
            console.error("Error parsing date for deal:", deal.dealName, e);
            return false;
        }
    });
}

// ==================== MERGE PROJECT DENGAN NAMA SAMA ====================

/**
 * Menggabungkan deal dengan nama project yang sama
 * Untuk dashboard priority: ambil nilai tertinggi
 * Untuk card pipeline: simpan semua variant
 * @param {Array} dealsList - Daftar deals
 * @returns {Array} - Daftar deals yang sudah di-merge
 */
function mergeDuplicateProjects(dealsList) {
    const projectMap = new Map();
    
    // Kelompokkan berdasarkan nama project
    dealsList.forEach(deal => {
        const dealName = deal.dealName?.trim();
        if (!dealName) return;
        
        if (!projectMap.has(dealName)) {
            projectMap.set(dealName, []);
        }
        projectMap.get(dealName).push(deal);
    });
    
    const mergedDeals = [];
    
    projectMap.forEach((duplicateDeals, dealName) => {
        if (duplicateDeals.length > 1) {
            // Untuk dashboard: ambil deal dengan nilai tertinggi
            const highestValueDeal = duplicateDeals.reduce((max, deal) => 
                (deal.value || 0) > (max.value || 0) ? deal : max
            , duplicateDeals[0]);
            
            // Simpan semua variant untuk card pipeline
            const mergedDeal = {
                ...highestValueDeal,
                id: highestValueDeal.id,
                isMerged: true,
                allVariants: duplicateDeals
            };
            mergedDeals.push(mergedDeal);
        } else {
            // Deal unik
            mergedDeals.push(duplicateDeals[0]);
        }
    });
    
    return mergedDeals;
}

// ==================== FUNGSI DROPDOWN OPTIONS ====================

// Fungsi untuk memuat opsi dropdown dari Firebase
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
            console.log("Dropdown options loaded from Firebase");
        }
    } catch (error) {
        console.error("Error loading dropdown options:", error);
    }
}

// Fungsi untuk menyimpan opsi dropdown ke Firebase
async function saveDropdownOptions() {
    try {
        await dropdownOptionsCollection.doc('options').set({
            facilities: Array.from(uniqueFacilities),
            packages: Array.from(uniquePackages),
            owners: Array.from(uniqueOwners),
            pics: Array.from(uniquePICs),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Dropdown options saved to Firebase");
    } catch (error) {
        console.error("Error saving dropdown options:", error);
    }
}

// Fungsi untuk menghapus opsi dari dropdown
async function deleteDropdownOption(field, value) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        showToast("Hanya admin dan manager yang dapat menghapus opsi dropdown", 3000);
        return;
    }

    try {
        // Hapus dari Set yang sesuai
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

        // Simpan perubahan ke Firebase
        await saveDropdownOptions();
        
        // Perbarui dropdown yang sesuai
        updateDropdownOptions();
        
        showToast(`Opsi "${value}" berhasil dihapus`, 2000);
    } catch (error) {
        console.error("Error deleting dropdown option:", error);
        showToast("Gagal menghapus opsi dropdown", 3000);
    }
}

// Fungsi untuk memperbarui opsi dropdown di UI
function updateDropdownOptions() {
    // Update facility dropdown
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

    // Update package dropdown
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

    // Update owner dropdown
    populateDropdown('owner', uniqueOwners);
    
    // Update pic dropdown
    populateDropdown('pic', uniquePICs);
}

// ==================== FUNGSI PRIORITY DASHBOARD - DIPERBAIKI ====================

// Fungsi untuk membuat priority dashboard yang disederhanakan
function createPriorityDashboard() {
    const priorityDashboard = document.querySelector('.priority-dashboard');
    if (!priorityDashboard) return;
    
    // Filter berdasarkan tahun dan merge project dengan nama sama
    const yearFilteredDeals = filterDealsByYear(deals);
    const mergedDealsForDashboard = mergeDuplicateProjects(yearFilteredDeals);
    
    // Hitung statistik berdasarkan priority - HANYA 5 PRIORITY
    const priorityStats = {
        'Hot Priority': { count: 0, value: 0, deals: [] },
        'Priority': { count: 0, value: 0, deals: [] },
        'Win': { count: 0, value: 0, deals: [] },
        'Behind': { count: 0, value: 0, deals: [] },
        'On Track': { count: 0, value: 0, deals: [] }
    };
    
    mergedDealsForDashboard.forEach(deal => {
        const priority = deal.priority || 'Priority';
        if (priorityStats[priority]) {
            priorityStats[priority].count++;
            priorityStats[priority].value += (deal.value || 0);
            priorityStats[priority].deals.push(deal);
        }
    });
    
    priorityDashboard.innerHTML = '';
    
    // Buat card untuk setiap priority - hanya 5 priority
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
    
    // Tambahkan event listener untuk card priority
    document.querySelectorAll('.priority-card').forEach(card => {
        card.addEventListener('click', function() {
            const priority = this.dataset.priority;
            const stats = priorityStats[priority];
            openPriorityModal(priority, stats.deals);
        });
    });
}

// Fungsi untuk membuka modal priority
function openPriorityModal(priority, deals) {
    const modal = document.getElementById('priorityModal');
    const modalTitle = document.getElementById('priorityModalTitleText');
    const modalContent = document.getElementById('priorityModalContent');
    
    if (!modal || !modalTitle || !modalContent) return;
    
    modalTitle.textContent = `${priority} Projects`;
    modalContent.innerHTML = '';
    
    if (deals.length === 0) {
        modalContent.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-inbox text-3xl mb-2"></i>
                <p>Tidak ada project dengan priority "${priority}"</p>
            </div>
        `;
    } else {
        // Urutkan berdasarkan nilai tertinggi
        const sortedDeals = [...deals].sort((a, b) => (b.value || 0) - (a.value || 0));
        
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
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${sortedDeals.map((deal, index) => `
                    <tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${deal.dealName || 'No Name'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${deal.salesName || '-'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">Rp ${formatNumber(deal.value) || '0'}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${deal.stage === 'win' ? 'bg-green-100 text-green-800' : 
                                deal.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">
                                ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button class="text-blue-600 hover:text-blue-900 mr-3 view-detail-btn" data-id="${deal.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        modalContent.appendChild(table);
        
        // Tambahkan event listener untuk tombol dan baris
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

// Fungsi untuk menutup modal priority
function closePriorityModal() {
    const modal = document.getElementById('priorityModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ==================== FUNGSI PROGRESS BAR ====================

// Fungsi untuk mengupdate progress bar berdasarkan stage
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

// Fungsi untuk mengupdate UI progress bar
function updateProgressBarUI(progress, isOnHold = false) {
    const progressPercentage = document.getElementById('progressPercentage');
    const progressFill = document.getElementById('progressFill');
    
    if (!progressPercentage || !progressFill) {
        console.warn("Progress bar elements not found");
        return;
    }
    
    // Update UI elements
    progressPercentage.textContent = `${progress}%`;
    progressFill.style.width = `${progress}%`;
    
    // Update class untuk on-hold
    if (isOnHold) {
        progressFill.classList.add('onhold');
        progressPercentage.style.color = '#ef4444';
    } else {
        progressFill.classList.remove('onhold');
        progressPercentage.style.color = '#3b82f6';
    }
    
    // Update checkpoints
    updateCheckpoints(progress, isOnHold);
}

// Fungsi untuk mengupdate checkpoint
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

// ==================== FUNGSI COMMENTS ====================

// Fungsi untuk memuat komentar
async function loadComments(dealId) {
    try {
        const querySnapshot = await commentsCollection
            .where('dealId', '==', dealId)
            .orderBy('timestamp', 'asc')
            .get();
        
        const comments = [];
        querySnapshot.forEach((doc) => {
            comments.push({ id: doc.id, ...doc.data() });
        });
        
        return comments;
    } catch (error) {
        console.error("Error loading comments:", error);
        return [];
    }
}

// Fungsi untuk merender komentar
function renderComments(comments, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (comments.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <i class="fas fa-comments text-2xl mb-2"></i>
                <p>Belum ada komentar</p>
            </div>
        `;
        return;
    }
    
    comments.forEach(comment => {
        const commentItem = document.createElement('div');
        const isManager = managerEmails.includes(comment.userEmail);
        const isCurrentUser = comment.userEmail === auth.currentUser?.email;
        
        commentItem.className = `comment-item ${isManager ? 'manager' : 'sales'}`;
        
        // Cek apakah user dapat menghapus komentar (admin, manager, atau pemilik komentar)
        const canDelete = currentUserRole === 'admin' || currentUserRole === 'manager' || isCurrentUser;
        
        commentItem.innerHTML = `
            <div class="comment-header">
                <div>
                    <span class="comment-author">${comment.userEmail}</span>
                    <span class="comment-role ${isManager ? 'manager' : 'sales'} ml-2">
                        ${isManager ? 'Manager' : 'Sales'}
                    </span>
                </div>
                <div class="comment-time">${formatDateTime(comment.timestamp)}</div>
            </div>
            <div class="comment-content">${comment.content}</div>
            ${canDelete ? `
                <button class="comment-delete-btn" data-comment-id="${comment.id}" data-deal-id="${comment.dealId}">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        `;
        
        container.appendChild(commentItem);
    });
    
    // Tambahkan event listener untuk tombol hapus
    container.querySelectorAll('.comment-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const commentId = btn.dataset.commentId;
            const dealId = btn.dataset.dealId;
            await deleteComment(commentId, dealId);
        });
    });
    
    // Update comments count
    const commentsCountElement = document.getElementById(containerId === 'commentsList' ? 'commentsCount' : 'detailCommentsCount');
    if (commentsCountElement) {
        commentsCountElement.textContent = `${comments.length} komentar`;
    }
}

// Fungsi untuk menghapus komentar
async function deleteComment(commentId, dealId) {
    if (!commentId) {
        showToast("Komentar tidak ditemukan", 3000);
        return;
    }
    
    try {
        await commentsCollection.doc(commentId).delete();
        
        showToast("Komentar berhasil dihapus", 2000);
        
        // Reload comments jika masih di deal yang sama
        if (currentDealIdForComments === dealId) {
            const comments = await loadComments(dealId);
            renderComments(comments, 'detailCommentsList');
            
            // Juga update di modal edit jika terbuka
            if (document.getElementById('commentsList')) {
                renderComments(comments, 'commentsList');
            }
        }
    } catch (error) {
        console.error("Error deleting comment:", error);
        showToast("Gagal menghapus komentar", 3000);
    }
}

// Fungsi untuk menambahkan komentar
async function addComment(dealId, content) {
    if (!content.trim()) {
        showToast("Komentar tidak boleh kosong", 3000);
        return;
    }
    
    try {
        const commentData = {
            dealId: dealId,
            content: content.trim(),
            userEmail: auth.currentUser.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await commentsCollection.add(commentData);
        
        // Reload comments
        if (currentDealIdForComments === dealId) {
            const comments = await loadComments(dealId);
            renderComments(comments, 'detailCommentsList');
            
            // Juga update di modal edit jika terbuka
            if (document.getElementById('commentsList')) {
                renderComments(comments, 'commentsList');
            }
        }
        
        // Reset input
        document.getElementById('detailCommentInput').value = '';
        if (document.getElementById('commentInput')) {
            document.getElementById('commentInput').value = '';
        }
        
        showToast("Komentar berhasil ditambahkan", 2000);
        
    } catch (error) {
        console.error("Error adding comment:", error);
        showToast("Gagal menambahkan komentar", 3000);
    }
}

// ==================== FUNGSI MERGE PROJECT DALAM DEAL CARD ====================

// Fungsi untuk mengelompokkan deal dengan nama yang sama
function groupDealsByName() {
    const groupedDeals = {};
    
    deals.forEach(deal => {
        const dealName = deal.dealName?.trim().toLowerCase();
        if (!dealName) return;
        
        if (!groupedDeals[dealName]) {
            groupedDeals[dealName] = [];
        }
        
        groupedDeals[dealName].push(deal);
    });
    
    // Filter hanya yang memiliki lebih dari 1 deal
    const mergedGroups = {};
    Object.keys(groupedDeals).forEach(dealName => {
        if (groupedDeals[dealName].length > 1) {
            mergedGroups[dealName] = groupedDeals[dealName];
        }
    });
    
    return mergedGroups;
}

// Fungsi untuk mengidentifikasi deal dengan nama yang sama
function identifyMergedDeals() {
    const groupedDeals = groupDealsByName();
    const mergedDealsInfo = {};
    
    Object.keys(groupedDeals).forEach(dealName => {
        const dealsInGroup = groupedDeals[dealName];
        const salesNames = [...new Set(dealsInGroup.map(deal => deal.salesName))];
        mergedDealsInfo[dealName.toLowerCase()] = {
            count: dealsInGroup.length,
            salesNames: salesNames,
            deals: dealsInGroup
        };
    });
    
    return mergedDealsInfo;
}

// Fungsi untuk menampilkan deal card dengan fitur merge
function renderMergedDealCard(dealGroup) {
    const dealName = dealGroup[0].dealName;
    const dealNameLower = dealName.toLowerCase();
    const mergedDealsInfo = identifyMergedDeals();
    const mergedInfo = mergedDealsInfo[dealNameLower];
    
    // Ambil sales yang aktif untuk deal ini, default ke sales pertama
    let activeSales = activeSalesPerDeal[dealNameLower] || dealGroup[0].salesName;
    
    // Cari deal berdasarkan sales yang aktif
    let activeDeal = dealGroup.find(deal => deal.salesName === activeSales);
    if (!activeDeal) {
        activeDeal = dealGroup[0];
        activeSales = dealGroup[0].salesName;
        activeSalesPerDeal[dealNameLower] = activeSales;
    }
    
    const hasMultipleSales = mergedInfo && mergedInfo.count > 1;
    const salesNames = hasMultipleSales ? mergedInfo.salesNames : [activeDeal.salesName];
    
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card';
    dealCard.dataset.id = activeDeal.id;
    dealCard.dataset.dealName = dealNameLower;
    dealCard.dataset.allDeals = JSON.stringify(dealGroup.map(d => d.id));
    
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
                         data-deal-name="${dealNameLower}">
                        ${salesName}
                    </div>
                `).join('')}
            </div>
        `;
    }

    dealCard.innerHTML = `
        <div class="flex justify-between items-start">
            <h3 class="font-bold text-gray-800">${dealName || 'No Name'}</h3>
            <span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">
                ${activeDeal.priority || 'Priority'}
            </span>
        </div>
        ${salesSelectorHTML}
        <div class="mt-1 text-sm text-gray-600 deal-details">
            <p><i class="fas fa-user-tie mr-1"></i> ${activeSales}</p>
            <p class="font-semibold text-blue-600">Rp ${formatNumber(activeDeal.value) || '0'}</p>
            <p class="mt-1">
                <span class="priority-badge px-2 py-1 rounded-full ${stageColorClass}">
                    ${activeDeal.stage ? activeDeal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage'}
                </span>
            </p>
        </div>
        <div class="mt-2 flex justify-between items-center deal-footer">
            <span class="text-xs text-gray-500">Dibuat: ${formatDate(activeDeal.createdAt)}</span>
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

// Fungsi untuk setup event listener merge deal card
function setupMergeDealCardEvents(dealCard, dealGroup) {
    const mergedDealsInfo = identifyMergedDeals();
    const dealName = dealGroup[0].dealName?.toLowerCase().trim();
    const hasMultipleSales = mergedDealsInfo[dealName] && mergedDealsInfo[dealName].count > 1;
    
    if (hasMultipleSales && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
        const indicator = dealCard.querySelector('.multiple-sales-indicator');
        const dropdown = dealCard.querySelector('.sales-dropdown');
        
        if (indicator && dropdown) {
            indicator.addEventListener('click', function(e) {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });
            
            // Event listener untuk item dropdown
            dropdown.querySelectorAll('.sales-dropdown-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const selectedSales = this.dataset.sales;
                    const dealName = this.dataset.dealName;
                    
                    // Update active sales untuk deal ini
                    activeSalesPerDeal[dealName] = selectedSales;
                    
                    // Temukan semua deal card dengan nama yang sama
                    const allDealCards = document.querySelectorAll(`.deal-card[data-deal-name="${dealName}"]`);
                    
                    // Update semua deal card yang sama
                    allDealCards.forEach(card => {
                        const allDealsData = JSON.parse(card.dataset.allDeals || '[]');
                        const selectedDeal = dealGroup.find(deal => deal.salesName === selectedSales);
                        
                        if (selectedDeal) {
                            // Update data di card
                            const salesNameElement = card.querySelector('.deal-details p:first-child');
                            const valueElement = card.querySelector('.deal-details p.font-semibold');
                            const stageElement = card.querySelector('.priority-badge:last-child');
                            const priorityElement = card.querySelector('.priority-badge:first-child');
                            const dateElement = card.querySelector('.text-xs');
                            
                            if (salesNameElement) {
                                salesNameElement.innerHTML = `<i class="fas fa-user-tie mr-1"></i> ${selectedSales}`;
                            }
                            
                            if (valueElement) {
                                valueElement.textContent = `Rp ${formatNumber(selectedDeal.value) || '0'}`;
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
                                dateElement.textContent = `Dibuat: ${formatDate(selectedDeal.createdAt)}`;
                            }
                            
                            // Update dataset id
                            card.dataset.id = selectedDeal.id;
                        }
                    });
                    
                    // Update active item di dropdown
                    dropdown.querySelectorAll('.sales-dropdown-item').forEach(i => {
                        i.classList.remove('active');
                    });
                    this.classList.add('active');
                    
                    // Tutup dropdown
                    dropdown.classList.remove('show');
                    
                    // Show toast notification
                    showToast(`Menampilkan data untuk sales: ${selectedSales}`, 2000);
                });
            });
        }
    }
    
    // Tutup dropdown ketika klik di luar
    document.addEventListener('click', function(e) {
        if (hasMultipleSales && dealCard && !dealCard.contains(e.target)) {
            const dropdown = dealCard.querySelector('.sales-dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }
    });
}

// ==================== FUNGSI WIN DATE ====================

// Fungsi untuk mendapatkan tanggal win
function getWinDate(deal) {
    if (deal.stage !== 'win' || !deal.updatedAt) return null;
    
    // Cari di aktivitas kapan status berubah menjadi win
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

// Fungsi untuk memuat data Recycle Bin
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

// Fungsi untuk memperbarui badge Recycle Bin
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

// Fungsi untuk membuka modal Recycle Bin
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

// Fungsi untuk merender konten Recycle Bin
function renderRecycleBinContent() {
    const recycleBinContent = document.getElementById('recycleBinContent');
    recycleBinContent.innerHTML = '';
    
    deletedDeals.forEach(deal => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        
        row.innerHTML = `
            <td class="p-3 text-sm">${deal.dealName || 'No Name'}</td>
            <td class="p-3 text-sm">${deal.salesName || '-'}</td>
            <td class="p-3 text-sm">Rp ${formatNumber(deal.value) || '0'}</td>
            <td class="p-3 text-sm">${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}</td>
            <td class="p-3 text-sm">${formatDateTime(deal.deletedAt)}</td>
            <td class="p-3 text-sm">${deal.deletedByEmail || '-'}</td>
            <td class="p-3 text-sm">
                <button class="restore-deal-btn text-green-600 hover:text-green-800 mr-3" data-id="${deal.id}">
                    <i class="fas fa-undo mr-1"></i> Restore
                </button>
                <button class="permanent-delete-btn text-red-600 hover:text-red-800" data-id="${deal.id}" data-name="${deal.dealName || 'No Name'}">
                    <i class="fas fa-trash mr-1"></i> Hapus Permanen
                </button>
            </td>
        `;
        
        recycleBinContent.appendChild(row);
    });
}

// Fungsi untuk restore deal
async function restoreDeal(deletedDealId) {
    try {
        const deletedDeal = deletedDeals.find(d => d.id === deletedDealId);
        if (!deletedDeal) {
            showToast("Data tidak ditemukan di Recycle Bin", 3000);
            return;
        }
        
        // Hapus field yang tidak diperlukan
        const { id, originalId, deletedAt, deletedBy, deletedByEmail, ...dealData } = deletedDeal;
        
        // Simpan kembali ke collection deals
        await dealsCollection.add(dealData);
        
        // Hapus dari recycle bin
        await deletedDealsCollection.doc(deletedDealId).delete();
        
        showToast(`Deal "${dealData.dealName}" berhasil dipulihkan!`, 2000);
        
        // Log aktivitas
        await activitiesCollection.add({
            message: `Deal "${dealData.dealName}" dipulihkan dari Recycle Bin oleh ${auth.currentUser.email}.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        // Refresh tampilan dengan filter yang aktif
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        loadDealsFromFirebase();
        
    } catch (error) {
        console.error("Error restoring deal:", error);
        showToast("Gagal memulihkan deal", 3000);
    }
}

// Variabel untuk menyimpan data yang akan dihapus permanen
let permanentDeleteDealId = null;
let permanentDeleteDealName = '';

// Fungsi untuk konfirmasi hapus permanen
function confirmPermanentDelete(deletedDealId, dealName) {
    permanentDeleteDealId = deletedDealId;
    permanentDeleteDealName = dealName;
    
    document.getElementById('permanentDeleteDealName').textContent = dealName;
    document.getElementById('permanentDeleteModal').classList.remove('hidden');
    document.getElementById('permanentDeleteModalContent').classList.remove('modal-content-leave-active');
    document.getElementById('permanentDeleteModalContent').classList.add('modal-content-enter-active');
}

// Fungsi untuk menghapus permanen
async function permanentDeleteDeal() {
    if (!permanentDeleteDealId) return;

    try {
        await deletedDealsCollection.doc(permanentDeleteDealId).delete();
        
        showToast(`Deal "${permanentDeleteDealName}" berhasil dihapus permanen!`, 2000);
        
        // Log aktivitas
        await activitiesCollection.add({
            message: `Deal "${permanentDeleteDealName}" dihapus permanen dari Recycle Bin oleh ${auth.currentUser.email}.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        // Refresh tampilan
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        closePermanentDeleteModal();
        
    } catch (error) {
        console.error("Error permanent deleting deal:", error);
        showToast("Gagal menghapus permanen deal", 3000);
    }
}

// Fungsi untuk menutup modal hapus permanen
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

// Fungsi untuk mengosongkan Recycle Bin
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

// Fungsi untuk konfirmasi kosongkan Recycle Bin
async function confirmEmptyRecycleBin() {
    try {
        // Hapus semua dokumen dalam deletedDeals collection
        const batch = db.batch();
        deletedDeals.forEach(deal => {
            const docRef = deletedDealsCollection.doc(deal.id);
            batch.delete(docRef);
        });
        
        await batch.commit();
        
        showToast(`Recycle Bin berhasil dikosongkan! ${deletedDeals.length} deal dihapus permanen.`, 3000);
        
        // Log aktivitas
        await activitiesCollection.add({
            message: `Recycle Bin dikosongkan oleh ${auth.currentUser.email}. ${deletedDeals.length} deal dihapus permanen.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        // Refresh tampilan
        await loadRecycleBin();
        renderRecycleBinContent();
        updateRecycleBinBadge();
        closeEmptyRecycleBinModal();
        
    } catch (error) {
        console.error("Error emptying recycle bin:", error);
        showToast("Gagal mengosongkan Recycle Bin", 3000);
    }
}

// Fungsi untuk menutup modal kosongkan Recycle Bin
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

// Fungsi untuk menutup modal Recycle Bin
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

// ==================== FUNGSI AKTIVITAS - DIPERBAIKI DENGAN CLICKABLE ====================

// Fungsi untuk memuat aktivitas dari Firebase
function loadActivitiesFromFirebase() {
    console.log("Loading activities from Firebase...");
    
    let query = activitiesCollection.orderBy("timestamp", "desc").limit(50);
    
    query.get()
        .then((querySnapshot) => {
            activities = [];
            querySnapshot.forEach((doc) => {
                const activityData = doc.data();
                if (activityData.timestamp && typeof activityData.timestamp.toDate !== 'function') {
                    activityData.timestamp = firebase.firestore.Timestamp.fromMillis(activityData.timestamp);
                }
                activities.push({ id: doc.id, ...activityData });
            });
            console.log("Activities loaded:", activities.length, activities);
            updateActivityBadge();
        })
        .catch((error) => {
            console.error("Error loading activities:", error);
            showToast("Gagal memuat aktivitas terbaru", 3000);
        });
}

// Fungsi untuk memperbarui badge aktivitas
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

// Fungsi untuk mengekstrak nama deal dari pesan aktivitas
function extractDealNameFromActivity(message) {
    if (!message) return null;
    
    // Pattern: "Deal \"Nama Deal\" ..." atau "Deal \"Nama Deal\""
    const match = message.match(/Deal "([^"]+)"/);
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

// Fungsi untuk mencari deal berdasarkan nama
function findDealByName(dealName) {
    if (!dealName) return null;
    
    // Cari deal dengan nama yang sama (case insensitive)
    return deals.find(deal => 
        deal.dealName && deal.dealName.toLowerCase() === dealName.toLowerCase()
    );
}

// Fungsi untuk membuka modal aktivitas dengan clickable items
function openActivityModal() {
    try {
        const activityModal = document.getElementById('activityModal');
        const activityFeed = document.getElementById('activity-feed-modal');
        const activityModalContent = document.getElementById('activityModalContent');

        if (!activityModal || !activityFeed || !activityModalContent) {
            console.error("Elemen modal aktivitas tidak ditemukan.");
            showToast("Gagal membuka aktivitas: Elemen tidak lengkap.", 3000);
            return;
        }
        
        activityFeed.innerHTML = '';
        
        if (activities.length === 0) {
            activityFeed.innerHTML = `
                <div class="text-center text-gray-500 py-4">
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

            sortedActivities.forEach(activity => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item cursor-pointer hover:bg-gray-100 transition duration-200';
                
                // Ekstrak nama deal dari pesan
                const dealName = extractDealNameFromActivity(activity.message);
                const deal = findDealByName(dealName);
                
                activityItem.innerHTML = `
                    <div class="flex items-start">
                        <div class="flex-1">
                            <p>${activity.message || 'Aktivitas tidak tersedia'}</p>
                            <div class="activity-date">
                                ${formatDateTime(activity.timestamp)}
                                ${activity.read ? '' : '<span class="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Baru</span>'}
                            </div>
                        </div>
                        ${deal ? `
                            <button class="ml-2 text-blue-600 hover:text-blue-800 view-activity-detail" data-deal-id="${deal.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                        ` : ''}
                    </div>
                `;
                
                activityFeed.appendChild(activityItem);
                
                // Tambahkan event listener untuk klik pada seluruh item
                if (deal) {
                    activityItem.addEventListener('click', function(e) {
                        // Jangan buka jika yang diklik adalah tombol detail
                        if (e.target.closest('.view-activity-detail')) return;
                        
                        const dealId = deal.id;
                        openDealDetailModal(dealId);
                    });
                    
                    // Event listener khusus untuk tombol detail
                    const detailBtn = activityItem.querySelector('.view-activity-detail');
                    if (detailBtn) {
                        detailBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            const dealId = this.dataset.dealId;
                            openDealDetailModal(dealId);
                        });
                    }
                }
            });
        }
        
        activityModal.classList.remove('hidden');
        activityModalContent.classList.remove('modal-content-leave-active');
        activityModalContent.classList.add('modal-content-enter-active');
        
        markActivitiesAsRead();
    } catch (error) {
        console.error("Error opening activity modal:", error);
        showToast("Gagal membuka aktivitas", 3000);
    }
}

// Fungsi untuk menandai aktivitas sebagai telah dibaca
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
                updateActivityBadge();
            })
            .catch(error => {
                console.error("Error marking activities as read:", error);
            });
    }
}

// Fungsi untuk menutup modal aktivitas
function closeActivityModal() {
    console.log("closeActivityModal() called.");
    const activityModalContent = document.getElementById('activityModalContent');
    if (!activityModalContent) {
        console.error("Elemen activityModalContent tidak ditemukan saat menutup modal.");
        return;
    }

    activityModalContent.classList.remove('modal-content-enter-active');
    activityModalContent.classList.add('modal-content-leave-active');
    
    activityModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('activityModal').classList.add('hidden');
        activityModalContent.classList.remove('modal-content-leave-active');
        activityModalContent.removeEventListener('transitionend', handler);
        console.log("Modal aktivitas disembunyikan.");
    }, { once: true });
}

// ==================== FUNGSI UTILITAS ====================

// Fungsi helper untuk format tanggal dan waktu
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

// Fungsi helper untuk format angka
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }
    return new Intl.NumberFormat('id-ID').format(num);
}

// Fungsi helper untuk format tanggal
function formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('id-ID');
    } catch (e) {
        return '-';
    }
}

// Fungsi untuk menampilkan toast notifikasi
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

// Fungsi untuk mendapatkan class priority badge
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

// Fungsi untuk mengisi dropdown tahun
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
}

// Fungsi untuk memuat konsultan dari GitHub JSON
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

// Fungsi untuk memuat deals dari Firebase dengan error handling
async function loadDealsFromFirebase() {
    console.log("Loading deals from Firebase...");
    
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
            
            // Konversi timestamp jika perlu
            if (dealData.createdAt) {
                if (dealData.createdAt.seconds !== undefined && dealData.createdAt.nanoseconds !== undefined) {
                    // Sudah dalam format Firestore Timestamp
                } else if (typeof dealData.createdAt.toDate === 'function') {
                    // Sudah dalam format Firestore Timestamp
                } else {
                    // Coba konversi
                    try {
                        dealData.createdAt = firebase.firestore.Timestamp.fromDate(new Date(dealData.createdAt));
                    } catch (e) {
                        console.warn("Could not convert createdAt for deal:", doc.id);
                    }
                }
            }
            
            deals.push({ id: doc.id, ...dealData });

            // Kumpulkan data unik
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
            
            // Kumpulkan tahun dengan aman
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
        console.log("Unique years found:", Array.from(uniqueYears));
        
        populateYearDropdown();
        populateFilterDropdowns();
        
        // Buat priority dashboard yang disederhanakan
        createPriorityDashboard();
        
        // Terapkan filter yang aktif
        applyActiveFilters();
        
    } catch (error) {
        console.error("Error loading deals:", error);
        showToast("Gagal memuat data deals", 3000);
    }
}

// Fungsi untuk mendapatkan nama sales berdasarkan email
function getSalesNameFromEmail(email) {
    return emailToSalesNameMap[email] || email.split('@')[0];
}

// Fungsi untuk memeriksa apakah user dapat mengedit/menghapus deal
function canUserEditDeal(deal) {
    // Admin dan manager dapat mengedit semua deal
    if (currentUserRole === 'admin' || currentUserRole === 'manager') {
        return true;
    }
    
    // User Bintang dapat mengedit semua deal
    const currentUser = auth.currentUser;
    
    const allowedEmails = [
        'bintang@genetek.co.id',
        'andy@genetek.co.id'
    ];
    
    if (currentUser && allowedEmails.includes(currentUser.email)) {
        return true;
    }

    // Untuk user lain, hanya dapat mengedit deal mereka sendiri
    if (!currentUser) return false;
    
    const userSalesName = getSalesNameFromEmail(currentUser.email);
    return deal.salesName === userSalesName;
}

// Fungsi untuk render deal card individual (untuk deal non-merge)
function renderIndividualDealCard(deal) {
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card';
    dealCard.dataset.id = deal.id;
    dealCard.dataset.dealName = deal.dealName?.toLowerCase();
    
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

    dealCard.innerHTML = `
        <div class="flex justify-between items-start">
            <h3 class="font-bold text-gray-800">${deal.dealName || 'No Name'}</h3>
            <span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">
                ${deal.priority || 'Priority'}
            </span>
        </div>
        <div class="mt-1 text-sm text-gray-600 deal-details">
            <p><i class="fas fa-user-tie mr-1"></i> ${deal.salesName || '-'}</p>
            <p class="font-semibold text-blue-600">Rp ${formatNumber(deal.value) || '0'}</p>
            <p class="mt-1">
                <span class="priority-badge px-2 py-1 rounded-full ${stageColorClass}">
                    ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown Stage'}
                </span>
            </p>
        </div>
        <div class="mt-2 flex justify-between items-center deal-footer">
            <span class="text-xs text-gray-500">Dibuat: ${formatDate(deal.createdAt)}</span>
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

// Fungsi untuk render deal dalam format list - DIPERBAIKI: Tambah kontraktor di sebelah konsultan
function renderDealList(deal, index) {
    const row = document.createElement('tr');
    row.dataset.id = deal.id;
    row.className = 'hover:bg-gray-50 cursor-pointer view-detail-row';
    row.dataset.id = deal.id;
    
    const canEdit = canUserEditDeal(deal);
    const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
    const winDate = getWinDate(deal);
    
    // Format kontraktor
    let contractorText = '-';
    if (deal.contractor) {
        if (Array.isArray(deal.contractor)) {
            contractorText = deal.contractor.join(', ');
        } else {
            contractorText = deal.contractor;
        }
    }
    
    row.innerHTML = `
        <td class="px-4 py-3 whitespace-nowrap text-sm">${index + 1}</td>
        <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">${deal.salesName || '-'}</td>
        <td class="px-4 py-3 whitespace-nowrap text-sm">${deal.dealName || 'No Name'}</td>
        <td class="px-4 py-3 whitespace-nowrap text-sm">
            ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
            ${winDate ? `
            <div class="win-date-container">
                <i class="fas fa-calendar-check mr-1"></i>${formatDate(winDate)}
            </div>
            ` : ''}
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-sm">${deal.consultant || '-'}</td>
        <td class="px-4 py-3 whitespace-nowrap text-sm">${contractorText}</td>
        <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold">Rp ${formatNumber(deal.value) || '0'}</td>
        <td class="px-4 py-3 whitespace-nowrap">
            <span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">
                ${deal.priority || 'Priority'}
            </span>
        </td>
        <td class="px-4 py-3 whitespace-nowrap text-sm deal-actions">
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
            </div>
        </td>
    `;
    
    return row;
}

// Fungsi untuk mengisi dropdown dengan opsi unik
function populateDropdown(selectElementId, uniqueValues, selectedValue = 'all') {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) {
        console.warn(`Element with ID '${selectElementId}' not found.`);
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

// Fungsi untuk mengisi dropdown filter tambahan
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
    
    // Set nilai input pencarian
    document.getElementById('searchDeals').value = activeFilters.searchTerm;
}

// Fungsi helper untuk memformat input angka secara real-time
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

// Fungsi untuk membuka modal statistik
function openStatsModal() {
    const statsModal = document.getElementById('statsModal');
    if (!statsModal) return;
    
    statsModal.classList.remove('hidden');
    document.querySelector('#statsModal .modal-content-enter').classList.remove('modal-content-leave-active');
    document.querySelector('#statsModal .modal-content-enter').classList.add('modal-content-enter-active');
    
    // Set tab aktif ke overview
    switchStatsTab('overview');
    
    // Render semua chart
    renderAllCharts();
    
    // Isi dropdown sales filter
    populateSalesFilter();
}

// Fungsi untuk menutup modal statistik
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

// Fungsi untuk mengganti tab statistik
function switchStatsTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.classList.remove('active', 'border-blue-600', 'text-blue-600');
        tab.classList.add('border-transparent');
    });
    
    const activeTab = document.querySelector(`.stats-tab[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active', 'border-blue-600', 'text-blue-600');
        activeTab.classList.remove('border-transparent');
    }
    
    // Show active tab content
    document.querySelectorAll('.stats-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    const activeContent = document.getElementById(`${tabName}Tab`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        
        // Render chart sesuai tab
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

// Fungsi untuk mengisi dropdown filter sales
function populateSalesFilter() {
    const salesFilter = document.getElementById('salesFilter');
    if (!salesFilter) return;
    
    // Simpan nilai yang dipilih sebelumnya
    const currentValue = salesFilter.value;
    
    salesFilter.innerHTML = '<option value="all">Semua Sales</option>';
    
    Array.from(uniqueSales).sort().forEach(salesName => {
        const option = document.createElement('option');
        option.value = salesName;
        option.textContent = salesName;
        salesFilter.appendChild(option);
    });
    
    // Kembalikan nilai yang dipilih sebelumnya
    if (currentValue && Array.from(salesFilter.options).some(opt => opt.value === currentValue)) {
        salesFilter.value = currentValue;
    }
}

// ==================== FUNGSI STATISTIK PER SALES ====================

// Fungsi untuk memproses data per sales
function processSalesData(salesName = 'all') {
    const salesDeals = salesName === 'all' 
        ? deals 
        : deals.filter(deal => deal.salesName === salesName);
    
    const stats = {
        totalValue: 0,
        totalDeals: salesDeals.length,
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
    
    if (salesDeals.length > 0) {
        stats.maxDealValue = salesDeals[0].value || 0;
        stats.minDealValue = salesDeals[0].value || 0;
    }
    
    salesDeals.forEach(deal => {
        const dealValue = deal.value || 0;
        
        // Total nilai
        stats.totalValue += dealValue;
        
        // Win/Lost count
        if (deal.stage === 'win') {
            stats.winCount++;
        } else if (deal.stage === 'lost') {
            stats.lostCount++;
        }
        
        // Stage distribution
        const stage = deal.stage || 'unknown';
        stats.stageDistribution[stage] = (stats.stageDistribution[stage] || 0) + 1;
        
        // Priority distribution
        const priority = deal.priority || 'Priority';
        stats.priorityDistribution[priority] = (stats.priorityDistribution[priority] || 0) + 1;
        
        // Store deals by priority
        if (!stats.dealsByPriority[priority]) {
            stats.dealsByPriority[priority] = [];
        }
        stats.dealsByPriority[priority].push(deal);
        
        // Monthly timeline
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
        
        // By product
        if (deal.product) {
            const products = Array.isArray(deal.product) ? deal.product : [deal.product];
            products.forEach(product => {
                stats.byProduct[product] = (stats.byProduct[product] || 0) + 1;
            });
        }
        
        // By facility
        if (deal.facility) {
            stats.byFacility[deal.facility] = (stats.byFacility[deal.facility] || 0) + 1;
        }
        
        // Min/Max values
        if (dealValue > stats.maxDealValue) stats.maxDealValue = dealValue;
        if (dealValue < stats.minDealValue) stats.minDealValue = dealValue;
    });
    
    // Calculate win rate
    stats.winRate = stats.totalDeals > 0 ? (stats.winCount / stats.totalDeals * 100).toFixed(1) : 0;
    stats.avgDealValue = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;
    
    return stats;
}

// Fungsi untuk merender chart per sales dengan clickable features
function renderSalesCharts() {
    console.log("Rendering sales charts...");
    
    try {
        const salesFilter = document.getElementById('salesFilter');
        const selectedSales = salesFilter ? salesFilter.value : 'all';
        const salesData = processSalesData(selectedSales);
        
        // Update metric boxes
        document.getElementById('salesTotalValue').textContent = `Rp ${formatNumber(salesData.totalValue)}`;
        document.getElementById('salesWinRate').textContent = `${salesData.winRate}%`;
        document.getElementById('salesTotalDeals').textContent = salesData.totalDeals;
        document.getElementById('salesAvgValue').textContent = `Rp ${formatNumber(salesData.avgDealValue)}`;
        document.getElementById('salesMaxValue').textContent = `Rp ${formatNumber(salesData.maxDealValue)}`;
        
        // Render stage distribution chart
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
        
        console.log("Stage distribution data:", stageLabels, stageData);
        
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
        
        // Render priority distribution chart dengan click handler
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
        
        console.log("Priority distribution data:", priorityLabels, priorityData);
        
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
        
        // Render timeline chart
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
        
        console.log("Timeline data:", sortedMonths, timelineCountData, timelineValueData);
        
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

// Fungsi untuk memproses data per priority
function processPriorityData(priority = 'all') {
    const priorityDeals = priority === 'all' 
        ? deals 
        : deals.filter(deal => deal.priority === priority);
    
    const stats = {
        totalValue: 0,
        totalDeals: priorityDeals.length,
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
    
    if (priorityDeals.length > 0) {
        stats.maxDealValue = priorityDeals[0].value || 0;
        stats.minDealValue = priorityDeals[0].value || 0;
    }
    
    priorityDeals.forEach(deal => {
        const dealValue = deal.value || 0;
        
        // Total nilai
        stats.totalValue += dealValue;
        
        // Win count
        if (deal.stage === 'win') {
            stats.winCount++;
        }
        
        // Stage distribution
        const stage = deal.stage || 'unknown';
        stats.stageDistribution[stage] = (stats.stageDistribution[stage] || 0) + 1;
        stats.valueByStage[stage] = (stats.valueByStage[stage] || 0) + dealValue;
        
        // Store deals by stage
        if (!stats.dealsByStage[stage]) {
            stats.dealsByStage[stage] = [];
        }
        stats.dealsByStage[stage].push(deal);
        
        // Sales distribution
        if (deal.salesName) {
            stats.salesDistribution[deal.salesName] = (stats.salesDistribution[deal.salesName] || 0) + 1;
        }
        
        // Monthly timeline
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
        
        // Min/Max values
        if (dealValue > stats.maxDealValue) stats.maxDealValue = dealValue;
        if (dealValue < stats.minDealValue) stats.minDealValue = dealValue;
    });
    
    // Calculate statistics
    stats.avgDealValue = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;
    stats.winRate = stats.totalDeals > 0 ? (stats.winCount / stats.totalDeals * 100).toFixed(1) : 0;
    
    return stats;
}

// Fungsi untuk merender chart per priority dengan clickable features
function renderPriorityCharts() {
    console.log("Rendering priority charts...");
    
    try {
        const priorityFilter = document.getElementById('priorityFilter');
        const selectedPriority = priorityFilter ? priorityFilter.value : 'all';
        const priorityData = processPriorityData(selectedPriority);
        
        // Update metric boxes
        document.getElementById('priorityTotalValue').textContent = `Rp ${formatNumber(priorityData.totalValue)}`;
        document.getElementById('priorityAvgValue').textContent = `Rp ${formatNumber(priorityData.avgDealValue)}`;
        document.getElementById('priorityTotalDeals').textContent = priorityData.totalDeals;
        document.getElementById('priorityWinRate').textContent = `${priorityData.winRate}%`;
        document.getElementById('priorityMaxValue').textContent = `Rp ${formatNumber(priorityData.maxDealValue)}`;
        document.getElementById('priorityMinValue').textContent = `Rp ${formatNumber(priorityData.minDealValue === Infinity ? 0 : priorityData.minDealValue)}`;
        
        // Render stage distribution chart dengan click handler
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
        
        console.log("Stage distribution data:", stageLabels, stageData, stageValueData);
        
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
        
        // Render sales distribution chart
        const salesCtx = document.getElementById('prioritySalesChart');
        if (!salesCtx) {
            console.error("Canvas prioritySalesChart not found");
            return;
        }
        
        if (salesCharts.prioritySalesChart) {
            salesCharts.prioritySalesChart.destroy();
        }
        
        // Ambil top 10 sales untuk chart
        const sortedSales = Object.entries(priorityData.salesDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        const salesLabels = sortedSales.map(([name]) => name);
        const salesData = sortedSales.map(([, count]) => count);
        
        console.log("Sales distribution data:", salesLabels, salesData);
        
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
        
        // Render timeline chart
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
        
        console.log("Priority timeline data:", sortedMonths, timelineCountData, timelineValueData);
        
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

// Fungsi untuk memproses data deals menjadi format yang siap untuk chart
function processDealDataForCharts(dealsData) {
    console.log("Processing deal data for charts, total deals:", dealsData.length);
    
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
    
    // Group deals by name and take the highest value
    const dealsByName = {};
    dealsData.forEach(deal => {
        const dealName = deal.dealName?.toLowerCase().trim();
        if (!dealName) return;
        
        if (!dealsByName[dealName]) {
            dealsByName[dealName] = deal;
        } else if ((deal.value || 0) > (dealsByName[dealName].value || 0)) {
            dealsByName[dealName] = deal;
        }
    });
    
    const uniqueDeals = Object.values(dealsByName);
    console.log("Unique deals for stats:", uniqueDeals.length);
    
    uniqueDeals.forEach(deal => {
        const dealValue = deal.value || 0;
        
        // Deal size distribution
        if (dealValue < 500000000) {
            dealSizes['Small (< Rp 500 Juta)']++;
        } else if (dealValue >= 500000000 && dealValue <= 2000000000) {
            dealSizes['Medium (Rp 500 Juta - Rp 2 Miliar)']++;
        } else {
            dealSizes['Large (> Rp 2 Miliar)']++;
        }
        
        // Win rate data
        if (deal.stage && winRateDataMap.hasOwnProperty(deal.stage)) {
            winRateDataMap[deal.stage]++;
        } else {
            console.warn(`Deal with unknown stage: ${deal.stage}`);
        }
        
        // Deals by sales
        if (deal.salesName) {
            dealsBySales[deal.salesName] = (dealsBySales[deal.salesName] || 0) + 1;
            salesValue[deal.salesName] = (salesValue[deal.salesName] || 0) + dealValue;
            if (deal.stage === 'win') {
                salesWinCount[deal.salesName] = (salesWinCount[deal.salesName] || 0) + 1;
            }
        }
        
        // Deals by product
        const productsInDeal = Array.isArray(deal.product) ? deal.product : (deal.product ? [deal.product] : []);
        productsInDeal.forEach(product => {
            const productKey = product || 'Unknown Product';
            dealsByProduct[productKey] = (dealsByProduct[productKey] || 0) + 1;
            productValue[productKey] = (productValue[productKey] || 0) + dealValue;
        });
        
        // Pipeline value (excluding lost and won deals)
        if (deal.stage !== 'lost' && deal.stage !== 'win') {
            if (deal.createdAt) {
                const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
                const monthYear = dealDate.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
                pipelineValueByMonth[monthYear] = (pipelineValueByMonth[monthYear] || 0) + dealValue;
            } else {
                console.warn(`Deal ID: ${deal.id} has invalid or missing createdAt timestamp for pipeline value calculation.`);
            }
        }
    });
    
    // Find top sales
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
    
    console.log("Processed stats:", stats);
    return stats;
}

// Fungsi untuk merender semua chart overview
function renderAllCharts() {
    console.log("Rendering all overview charts...");
    
    try {
        const processedStats = processDealDataForCharts(deals);
        
        // Deal Size Chart
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
        
        // Win Rate Chart
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
        
        // Deals by Sales Chart
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
        
        // Deals by Product Chart
        const dealsByProductPackageCtx = document.getElementById('dealsByProductPackageChart');
        if (!dealsByProductPackageCtx) {
            console.error("Canvas dealsByProductPackageChart not found");
            return;
        }
        
        if (charts.dealsByProductPackageChart) {
            charts.dealsByProductPackageChart.destroy();
        }
        
        // Limit to top 15 products for better visualization
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
        
        // Pipeline Value Chart
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
        
        console.log("All overview charts rendered successfully");
        
    } catch (error) {
        console.error("Error rendering overview charts:", error);
        showToast("Gagal merender chart overview", 3000);
    }
}

// ==================== FUNGSI CLICKABLE CHART ====================

// Fungsi untuk menampilkan daftar project berdasarkan priority pada chart sales
function showDealsByPriority(salesFilter, priority) {
    const selectedSales = salesFilter.value;
    const filteredDeals = selectedSales === 'all' 
        ? deals.filter(deal => deal.priority === priority)
        : deals.filter(deal => deal.salesName === selectedSales && deal.priority === priority);
    
    if (filteredDeals.length === 0) {
        showToast(`Tidak ada project dengan priority "${priority}" untuk sales "${selectedSales === 'all' ? 'Semua Sales' : selectedSales}"`, 3000);
        return;
    }
    
    // Tampilkan modal dengan daftar project
    document.getElementById('clickableChartModalTitle').textContent = `Project dengan Priority "${priority}" - ${selectedSales === 'all' ? 'Semua Sales' : selectedSales}`;
    const modalContent = document.getElementById('clickableChartModalContent');
    modalContent.innerHTML = '';
    
    // Buat tabel untuk menampilkan project
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
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            ${filteredDeals.map((deal, index) => `
                <tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${deal.dealName || 'No Name'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${deal.salesName || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">Rp ${formatNumber(deal.value) || '0'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${deal.stage === 'win' ? 'bg-green-100 text-green-800' : 
                            deal.stage === 'lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">
                            ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
                        </span>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    modalContent.appendChild(table);
    
    // Tambahkan event listener untuk baris yang dapat diklik
    modalContent.querySelectorAll('.view-detail-row').forEach(row => {
        row.addEventListener('click', function() {
            const dealId = this.dataset.id;
            closeClickableChartModal();
            openDealDetailModal(dealId);
        });
    });
    
    document.getElementById('clickableChartModal').classList.remove('hidden');
}

// Fungsi untuk menampilkan daftar project berdasarkan stage pada chart priority
function showDealsByStage(priorityFilter, stage) {
    const selectedPriority = priorityFilter.value;
    const filteredDeals = selectedPriority === 'all' 
        ? deals.filter(deal => deal.stage === stage)
        : deals.filter(deal => deal.priority === selectedPriority && deal.stage === stage);
    
    if (filteredDeals.length === 0) {
        showToast(`Tidak ada project dengan stage "${stage}" untuk priority "${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}"`, 3000);
        return;
    }
    
    // Tampilkan modal dengan daftar project
    document.getElementById('clickableChartModalTitle').textContent = `Project dengan Stage "${stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}" - ${selectedPriority === 'all' ? 'Semua Priority' : selectedPriority}`;
    const modalContent = document.getElementById('clickableChartModalContent');
    modalContent.innerHTML = '';
    
    // Buat tabel untuk menampilkan project
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
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            ${filteredDeals.map((deal, index) => `
                <tr class="hover:bg-gray-50 cursor-pointer view-detail-row" data-id="${deal.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${index + 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${deal.dealName || 'No Name'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${deal.salesName || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">Rp ${formatNumber(deal.value) || '0'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="priority-badge px-2 py-1 rounded-full ${getPriorityBadgeClass(deal.priority)}">
                            ${deal.priority || 'Priority'}
                        </span>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    modalContent.appendChild(table);
    
    // Tambahkan event listener untuk baris yang dapat diklik
    modalContent.querySelectorAll('.view-detail-row').forEach(row => {
        row.addEventListener('click', function() {
            const dealId = this.dataset.id;
            closeClickableChartModal();
            openDealDetailModal(dealId);
        });
    });
    
    document.getElementById('clickableChartModal').classList.remove('hidden');
}

// Fungsi untuk menutup modal clickable chart
function closeClickableChartModal() {
    document.getElementById('clickableChartModal').classList.add('hidden');
}

// ==================== PERBAIKAN PERHITUNGAN NILAI ====================

// Fungsi untuk menghitung nilai berdasarkan sebelum diskon dan diskon
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
    
    // Update format input beforeDiscount
    const beforeDiscountInput = document.getElementById('beforeDiscount');
    if (beforeDiscount > 0 && beforeDiscountInput) {
        beforeDiscountInput.value = new Intl.NumberFormat('id-ID').format(beforeDiscount);
    }
}

// Update event listener untuk beforeDiscount
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

// Nonaktifkan fitur drag & drop untuk semua user
function initSortable() {
    const pipelineStage = document.getElementById('pipelines-stage');
    if (!pipelineStage) return;

    if (sortableInstances['pipelines-stage']) {
        sortableInstances['pipelines-stage'].destroy();
    }

    // Nonaktifkan Sortable untuk semua user
    sortableInstances['pipelines-stage'] = new Sortable(pipelineStage, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        disabled: true, // Nonaktifkan drag & drop untuk semua user
        onEnd: function(evt) {
            // Tidak ada aksi karena disabled
        }
    });
}

// ==================== FUNGSI PERMISSIONS ====================

// Fungsi untuk menerapkan permissions berdasarkan role
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
        
        // Tampilkan tombol Recycle Bin hanya untuk admin
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

// Event delegation untuk tombol aksi
function initEventListeners() {
    console.log("Initializing event listeners...");
    
    try {
        // Inisialisasi elemen DOM untuk search consultant
        consultantSearchInput = document.getElementById('consultantSearch');
        consultantHiddenInput = document.getElementById('consultant');
        consultantSuggestionsDiv = document.getElementById('consultantSuggestions');
        facilitySelect = document.getElementById('facility');
        newFacilityInput = document.getElementById('newFacility');
        packageSelect = document.getElementById('package');
        newPackageInput = document.getElementById('newPackage');
        
        // Event delegation untuk tombol aksi
        document.addEventListener('click', function(e) {
            // Tombol view detail
            if (e.target.closest('.view-detail-btn')) {
                const dealCard = e.target.closest('.deal-card, tr');
                if (dealCard) {
                    const dealId = dealCard.dataset.id;
                    openDealDetailModal(dealId);
                }
            }
            
            // Baris view detail (untuk list view dan tabel)
            if (e.target.closest('.view-detail-row') && !e.target.closest('button')) {
                const row = e.target.closest('.view-detail-row');
                if (row && row.dataset.id) {
                    openDealDetailModal(row.dataset.id);
                }
            }
            
            // Tombol edit deal
            if (e.target.closest('.edit-deal-btn')) {
                const dealCard = e.target.closest('.deal-card, tr');
                if (dealCard) {
                    const dealId = dealCard.dataset.id;
                    prepareEditDeal(dealId);
                }
            }
            
            // Tombol delete deal
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
            
            // Tombol remove contractor
            if (e.target.closest('.remove-contractor-btn')) {
                removeContractorField(e.target.closest('.remove-contractor-btn'));
            }
            
            // Tombol remove product
            if (e.target.closest('.remove-product-btn')) {
                removeProductField(e.target.closest('.remove-product-btn'));
            }
            
            // Tombol Recycle Bin Floating Action Button
            if (e.target.closest('#recycleBinFab')) {
                openRecycleBinModal();
            }
            
            // Tombol close Recycle Bin modal
            if (e.target.closest('.close-recycle-bin')) {
                closeRecycleBinModal();
            }
            
            // Tombol empty Recycle Bin
            if (e.target.closest('#emptyRecycleBinBtn')) {
                emptyRecycleBin();
            }
            
            // Tombol restore deal di Recycle Bin
            if (e.target.closest('.restore-deal-btn')) {
                const dealId = e.target.closest('.restore-deal-btn').dataset.id;
                restoreDeal(dealId);
            }
            
            // Tombol hapus permanen di Recycle Bin
            if (e.target.closest('.permanent-delete-btn')) {
                const button = e.target.closest('.permanent-delete-btn');
                const dealId = button.dataset.id;
                const dealName = button.dataset.name;
                confirmPermanentDelete(dealId, dealName);
            }
            
            // Tombol cancel permanent delete
            if (e.target.closest('.cancel-permanent-delete')) {
                closePermanentDeleteModal();
            }
            
            // Tombol confirm permanent delete
            if (e.target.closest('#confirmPermanentDeleteBtn')) {
                permanentDeleteDeal();
            }
            
            // Tombol cancel empty bin
            if (e.target.closest('.cancel-empty-bin')) {
                closeEmptyRecycleBinModal();
            }
            
            // Tombol confirm empty bin
            if (e.target.closest('#confirmEmptyBinBtn')) {
                confirmEmptyRecycleBin();
            }
            
            // Tombol hapus opsi dropdown
            if (e.target.closest('.delete-option-btn')) {
                const button = e.target.closest('.delete-option-btn');
                const targetField = button.dataset.target;
                const selectElement = document.getElementById(targetField);
                const selectedValue = selectElement.value;
                
                if (selectedValue && selectedValue !== '') {
                    deleteDropdownOption(targetField, selectedValue);
                }
            }
            
            // Tombol close clickable chart modal
            if (e.target.closest('#clickableChartModalClose') || e.target.closest('#clickableChartModal')) {
                if (e.target.closest('#clickableChartModal') && !e.target.closest('.clickable-modal-content')) {
                    document.getElementById('clickableChartModal').classList.add('hidden');
                } else if (e.target.closest('#clickableChartModalClose')) {
                    document.getElementById('clickableChartModal').classList.add('hidden');
                }
            }
            
            // Tombol close priority modal
            if (e.target.closest('#priorityModalClose') || e.target.closest('#priorityModal')) {
                if (e.target.closest('#priorityModal') && !e.target.closest('.priority-modal-content')) {
                    closePriorityModal();
                } else if (e.target.closest('#priorityModalClose')) {
                    closePriorityModal();
                }
            }
        });

        const dealForm = document.getElementById('dealForm');
        if (dealForm) {
            dealForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveDeal();
            });
        }

        // Tombol New Deal
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

        // Tombol di modal deal
        const cancelDealBtn = document.getElementById('cancelDealBtn');
        if (cancelDealBtn) cancelDealBtn.addEventListener('click', closeDealModal);
        
        const addContractorBtn = document.getElementById('addContractorBtn');
        if (addContractorBtn) addContractorBtn.addEventListener('click', () => addContractorField());
        
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) addProductBtn.addEventListener('click', () => addProductField());
        
        const commentSubmitBtn = document.getElementById('commentSubmitBtn');
        if (commentSubmitBtn) {
            commentSubmitBtn.addEventListener('click', function() {
                const commentInput = document.getElementById('commentInput');
                const comment = commentInput ? commentInput.value : '';
                if (currentDealIdForComments) {
                    addComment(currentDealIdForComments, comment);
                }
            });
        }
        
        // Event listener untuk stage change
        const stageSelect = document.getElementById('stage');
        if (stageSelect) {
            stageSelect.addEventListener('change', function() {
                updateProgressBarFromStage(this.value);
            });
        }
        
        // Tombol di modal detail deal
        const closeDetailBtn = document.getElementById('closeDetailBtn');
        if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeDealDetailModal);
        
        const detailCommentSubmitBtn = document.getElementById('detailCommentSubmitBtn');
        if (detailCommentSubmitBtn) {
            detailCommentSubmitBtn.addEventListener('click', function() {
                const detailCommentInput = document.getElementById('detailCommentInput');
                const comment = detailCommentInput ? detailCommentInput.value : '';
                if (currentDealIdForComments) {
                    addComment(currentDealIdForComments, comment);
                }
            });
        }
        
        // Tombol di modal aktivitas
        const closeActivityBtn = document.getElementById('closeActivityBtn');
        if (closeActivityBtn) closeActivityBtn.addEventListener('click', closeActivityModal);
        
        const closeActivityFooterBtn = document.getElementById('closeActivityFooterBtn');
        if (closeActivityFooterBtn) closeActivityFooterBtn.addEventListener('click', closeActivityModal);
        
        // Tombol di modal konfirmasi hapus
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteDeal);
        
        // Tombol di panel filter
        const closeFilterBtn = document.getElementById('closeFilterBtn');
        if (closeFilterBtn) closeFilterBtn.addEventListener('click', closeFilterPanel);
        
        const resetFilterBtn = document.getElementById('resetFilterBtn');
        if (resetFilterBtn) resetFilterBtn.addEventListener('click', resetFilters);
        
        const applyFilterBtn = document.getElementById('applyFilterBtn');
        if (applyFilterBtn) applyFilterBtn.addEventListener('click', applyFiltersAndClosePanel);
        
        // Tombol di stats modal
        const closeStatsBtn = document.getElementById('closeStatsBtn');
        if (closeStatsBtn) closeStatsBtn.addEventListener('click', closeStatsModal);

        // Tab navigation
        document.querySelectorAll('.stats-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const tabName = this.dataset.tab;
                switchStatsTab(tabName);
            });
        });
        
        // Sales filter change
        const salesFilter = document.getElementById('salesFilter');
        if (salesFilter) salesFilter.addEventListener('change', renderSalesCharts);
        
        // Priority filter change
        const priorityFilter = document.getElementById('priorityFilter');
        if (priorityFilter) priorityFilter.addEventListener('change', renderPriorityCharts);

        // Input events
        const searchDeals = document.getElementById('searchDeals');
        if (searchDeals) searchDeals.addEventListener('keyup', filterDeals);
        
        // Update event listeners untuk perhitungan nilai
        updateBeforeDiscountEventListeners();

        // Handle facility select and input
        if (facilitySelect && newFacilityInput) {
            facilitySelect.addEventListener('change', handleFacilitySelectChange);
            newFacilityInput.addEventListener('input', handleNewFacilityInput);
        }
        
        // Handle package select and input
        if (packageSelect && newPackageInput) {
            packageSelect.addEventListener('change', handlePackageSelectChange);
            newPackageInput.addEventListener('input', handleNewPackageInput);
        }

        setupConsultantSearch();
        
        // Tampilkan/sembunyikan tombol hapus pada dropdown berdasarkan role
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

// Fungsi untuk menampilkan/menyembunyikan tombol hapus pada dropdown
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

// Fungsi untuk menginisialisasi toggle view
function initViewToggle() {
    const cardViewBtn = document.getElementById('cardViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (cardViewBtn && listViewBtn) {
        cardViewBtn.addEventListener('click', () => switchView('card'));
        listViewBtn.addEventListener('click', () => switchView('list'));
    }
}

// Fungsi untuk beralih antara tampilan card dan list
function switchView(viewType) {
    if (currentView === viewType) return;
    
    currentView = viewType;
    
    const cardViewBtn = document.getElementById('cardViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    
    if (cardViewBtn) cardViewBtn.classList.toggle('active', viewType === 'card');
    if (listViewBtn) listViewBtn.classList.toggle('active', viewType === 'list');
    
    // Terapkan filter yang aktif dengan view baru
    applyActiveFilters();
}

// Fungsi untuk menerapkan filter yang aktif dengan error handling
function applyActiveFilters() {
    try {
        let baseDeals = deals;
        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            baseDeals = deals.filter(deal => deal.stage !== 'lost');
        }

        // Filter berdasarkan tahun yang dipilih
        baseDeals = filterDealsByYear(baseDeals);

        const filteredDeals = baseDeals.filter(deal => {
            const matchesSearch = 
                activeFilters.searchTerm === '' ||
                (deal.dealName && deal.dealName.toLowerCase().includes(activeFilters.searchTerm)) ||
                (deal.salesName && deal.salesName.toLowerCase().includes(activeFilters.searchTerm));
            
            const matchesPriority = 
                activeFilters.priority === 'all' || 
                (deal.priority && deal.priority === activeFilters.priority);
            
            const matchesYear = activeFilters.year === 'all' || 
                                (deal.createdAt && (() => {
                                    try {
                                        const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
                                        return dealDate.getFullYear().toString() === activeFilters.year;
                                    } catch {
                                        return false;
                                    }
                                })());

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
            
            return matchesSearch && matchesPriority && matchesYear && matchesStage && matchesSales &&
                matchesConsultant && matchesContractor && matchesFacility && matchesProduct && matchesPackage;
        });
        
        renderFilteredDeals(filteredDeals);
    } catch (error) {
        console.error("Error applying active filters:", error);
    }
}

// Fungsi untuk menyimpan filter yang aktif
function saveActiveFilters() {
    try {
        activeFilters = {
            searchTerm: document.getElementById('searchDeals') ? document.getElementById('searchDeals').value.toLowerCase() : '',
            priority: document.getElementById('filterPriority') ? document.getElementById('filterPriority').value : 'all',
            year: document.getElementById('filterYear') ? document.getElementById('filterYear').value : 'all',
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

// Fungsi untuk filter deals
function filterDeals() {
    try {
        // Simpan filter yang aktif
        saveActiveFilters();
        
        // Terapkan filter yang aktif
        applyActiveFilters();
    } catch (error) {
        console.error("Error filtering deals:", error);
    }
}

// Fungsi untuk render deals yang sudah difilter dengan merge deal card
function renderFilteredDeals(filteredDeals) {
    const pipelineStage = document.getElementById('pipelines-stage');
    if (!pipelineStage) return;
    
    pipelineStage.innerHTML = '';
    
    if (filteredDeals.length === 0) {
        pipelineStage.innerHTML = `
            <div class="empty-stage-message text-center text-gray-400 p-4 text-sm w-full">
                <i class="fas fa-search text-3xl mb-2"></i>
                <p>Tidak ada deals yang sesuai dengan filter.</p>
            </div>
        `;
        return;
    }
    
    if (currentView === 'card') {
        // Group deals by name untuk merge
        const dealsByName = {};
        filteredDeals.forEach(deal => {
            const dealName = deal.dealName?.toLowerCase().trim();
            if (!dealName) return;
            
            if (!dealsByName[dealName]) {
                dealsByName[dealName] = [];
            }
            dealsByName[dealName].push(deal);
        });
        
        // Render deal cards
        Object.values(dealsByName).forEach(dealGroup => {
            if (dealGroup.length > 0) {
                if (dealGroup.length > 1) {
                    // Multiple deals dengan nama yang sama - render merged card
                    const mergedCard = renderMergedDealCard(dealGroup);
                    pipelineStage.appendChild(mergedCard);
                    setupMergeDealCardEvents(mergedCard, dealGroup);
                } else {
                    // Single deal - render individual card
                    const dealCard = renderIndividualDealCard(dealGroup[0]);
                    pipelineStage.appendChild(dealCard);
                }
            }
        });
        
        initSortable();
    } else {
        const table = document.createElement('table');
        table.className = 'list-view min-w-full';
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th class="px-4 py-3 text-left">No</th>
                <th class="px-4 py-3 text-left">Nama Sales</th>
                <th class="px-4 py-3 text-left">Nama Project</th>
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
        
        pipelineStage.appendChild(table);
    }
}

// Fungsi logout
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

// Fungsi untuk membuka panel filter
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

// Fungsi untuk menutup panel filter
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

// Fungsi untuk menerapkan filter dan menutup panel
function applyFiltersAndClosePanel() {
    // Simpan filter yang dipilih
    saveActiveFilters();
    
    // Terapkan filter
    applyActiveFilters();
    
    // Tutup panel
    closeFilterPanel();
}

// Fungsi untuk mereset semua filter
function resetFilters() {
    // Reset filter di UI
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
    
    // Reset filter aktif
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
    
    // Reset year badge
    document.querySelectorAll('.year-badge').forEach(badge => {
        badge.classList.remove('active');
        if (badge.dataset.year === 'all') {
            badge.classList.add('active');
        }
    });
    activeYear = 'all';
    
    // Terapkan filter reset
    applyActiveFilters();
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

// Fungsi untuk menginisialisasi elemen export
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

// Fungsi untuk menampilkan/menyembunyikan export button berdasarkan role
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

// Fungsi untuk membuka modal export
function openExportModal() {
    const exportExcelModal = document.getElementById('exportExcelModal');
    const exportExcelModalContent = document.getElementById('exportExcelModalContent');
    
    if (!exportExcelModal || !exportExcelModalContent) return;
    
    // Reset form
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

// Fungsi untuk menutup modal export
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

// Fungsi untuk menampilkan/menyembunyikan input tanggal kustom
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

// Fungsi untuk mendapatkan data berdasarkan rentang tanggal
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
        endDate.setHours(23, 59, 59, 999); // Set to end of day
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
            default: // 'all'
                return deals;
        }
    }
    
    return deals.filter(deal => {
        if (!deal.createdAt) return false;
        
        const dealDate = deal.createdAt.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt);
        return dealDate >= startDate && dealDate <= endDate;
    });
}

// Fungsi untuk export data ke Excel
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
        
        // Buat worksheet
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        
        // Buat workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Pipeline Data");
        
        // Generate nama file
        const dateRange = document.getElementById('exportDateRange');
        const dateRangeValue = dateRange ? dateRange.value : 'all';
        const formatType = formatValue === 'detailed' ? 'Detail' : 'Ringkasan';
        const fileName = `Sales_Pipeline_${formatType}_${dateRangeValue}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Export ke file
        XLSX.writeFile(workbook, fileName);
        
        showToast("Data berhasil diekspor ke Excel", 3000);
        closeExportModal();
        
        // Log aktivitas
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

// Fungsi untuk menyiapkan data export detail
function prepareDetailedExportData(dealsData) {
    return dealsData.map(deal => {
        // Format kontraktor
        let contractorText = '';
        if (deal.contractor) {
            if (Array.isArray(deal.contractor)) {
                contractorText = deal.contractor.join(', ');
            } else {
                contractorText = deal.contractor;
            }
        }
        
        // Format produk
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
            'Tanggal Dibuat': deal.createdAt ? formatDate(deal.createdAt) : '',
            'Dibuat Oleh': deal.createdBy || ''
        };
    });
}

// Fungsi untuk menyiapkan data export ringkasan
function prepareSummaryExportData(dealsData) {
    const summary = {};
    
    dealsData.forEach(deal => {
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
        summary[stage].totalValue += (deal.value || 0);
        
        // Hitung per sales
        if (!summary[stage].salesCount[sales]) {
            summary[stage].salesCount[sales] = 0;
        }
        summary[stage].salesCount[sales]++;
        
        // Hitung per produk
        if (!summary[stage].productCount[product]) {
            summary[stage].productCount[product] = 0;
        }
        summary[stage].productCount[product]++;
    });
    
    // Konversi ke format array untuk Excel
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

// Fungsi untuk menambahkan field kontraktor baru
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

// Fungsi untuk menghapus field kontraktor
function removeContractorField(buttonElement) {
    if (buttonElement && buttonElement.closest('.flex')) {
        buttonElement.closest('.flex').remove();
    }
}

// Fungsi untuk menambahkan field produk baru
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

// Fungsi untuk menghapus field produk
function removeProductField(buttonElement) {
    if (buttonElement && buttonElement.closest('.flex')) {
        buttonElement.closest('.flex').remove();
    }
}

// Fungsi untuk membuka modal deal
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
        // Reset form
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
    
        // Update facility dropdown
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
    
        // Update package dropdown
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
                
                // Handle value dan beforeDiscount
                const beforeDiscountInput = document.getElementById('beforeDiscount');
                if (beforeDiscountInput) {
                    beforeDiscountInput.value = deal.beforeDiscount ? new Intl.NumberFormat('id-ID').format(deal.beforeDiscount) : '';
                }
                
                const discountInput = document.getElementById('discount');
                if (discountInput) discountInput.value = deal.discount || '';
                
                calculateValueFromBeforeDiscount();
                
                // Handle package
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
                
                // Update progress bar dengan stage yang ada
                updateProgressBarFromStage(deal.stage);
                
                // Load dan tampilkan komentar
                currentDealIdForComments = deal.id;
                const comments = await loadComments(deal.id);
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
                const userSalesName = getSalesNameFromEmail(currentUser.email);
                const salesNameSelect = document.getElementById('salesName');
                if (salesNameSelect) salesNameSelect.value = userSalesName;
            }
            
            addContractorField();
            addProductField();
            
            // Set progress bar ke default berdasarkan stage
            updateProgressBarFromStage(DEFAULT_STAGE);
            
            // Sembunyikan comments section untuk deal baru
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

// Fungsi untuk menutup modal deal
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
    }, { once: true });
}

// Fungsi untuk menyimpan deal
async function saveDeal() {
    try {
        const dealId = document.getElementById('dealId').value;
        const salesName = document.getElementById('salesName').value;
        const dealName = document.getElementById('dealName').value.trim();
        const stage = document.getElementById('stage').value;
        const priority = document.getElementById('priority').value;
        
        // Validasi input wajib
        if (!dealName) {
            showToast("Nama proyek wajib diisi", 3000);
            return;
        }
        
        if (!stage) {
            showToast("Tahap wajib dipilih", 3000);
            return;
        }
        
        // Ambil nilai sebelum diskon
        const beforeDiscountRaw = document.getElementById('beforeDiscount').value.replace(/[^0-9]/g, '');
        const beforeDiscount = parseFloat(beforeDiscountRaw) || 0;
        
        if (beforeDiscount <= 0) {
            showToast("Nilai sebelum diskon harus lebih dari 0", 3000);
            return;
        }
        
        // Hitung nilai setelah diskon
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        let calculatedValue = beforeDiscount;
        if (discount > 0 && discount <= 100) {
            calculatedValue = beforeDiscount * (1 - (discount / 100));
        }
        
        // Ambil nilai package
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
        
        // Ambil nilai facility
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
        
        // Ambil produk
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
        
        // Ambil kontraktor
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
        
        // Ambil owner
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
        
        // Ambil PIC
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
        
        // Data deal
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
        
        // Tambahkan createdBy dan createdAt untuk deal baru
        if (!dealId) {
            dealData.createdBy = auth.currentUser.email;
            dealData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // Simpan ke Firebase
        if (dealId) {
            // Update deal yang sudah ada
            await dealsCollection.doc(dealId).update(dealData);
            showToast(`Deal "${dealName}" berhasil diperbarui!`, 2000);
            
            // Log aktivitas
            await activitiesCollection.add({
                message: `Deal "${dealName}" diperbarui oleh ${auth.currentUser.email}.`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: auth.currentUser.email,
                read: false
            });
        } else {
            // Tambah deal baru
            await dealsCollection.add(dealData);
            showToast(`Deal "${dealName}" berhasil ditambahkan!`, 2000);
            
            // Log aktivitas
            await activitiesCollection.add({
                message: `Deal "${dealName}" ditambahkan oleh ${auth.currentUser.email}.`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: auth.currentUser.email,
                read: false
            });
        }
        
        // Tutup modal dan refresh data
        closeDealModal();
        loadDealsFromFirebase();
        
    } catch (error) {
        console.error("Error saving deal:", error);
        showToast("Gagal menyimpan deal", 3000);
    }
}

// Fungsi untuk mempersiapkan edit deal
function prepareEditDeal(dealId) {
    openDealModal(dealId);
}

// Fungsi untuk membuka modal detail deal
async function openDealDetailModal(dealId) {
    try {
        const deal = deals.find(d => d.id === dealId);
        if (!deal) {
            showToast("Deal tidak ditemukan", 3000);
            return;
        }
        
        // Update detail deal
        document.getElementById('dealDetailTitle').textContent = `Detail Deal: ${deal.dealName}`;
        document.getElementById('detailSalesName').textContent = deal.salesName || '-';
        document.getElementById('detailValue').textContent = `Rp ${formatNumber(deal.value) || '0'}`;
        document.getElementById('detailDiscount').textContent = deal.discount ? `${deal.discount}%` : '-';
        document.getElementById('detailBeforeDiscount').textContent = `Rp ${formatNumber(deal.beforeDiscount) || '0'}`;
        document.getElementById('detailPackage').textContent = deal.package || '-';
        
        // Handle produk
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
        
        // Handle kontraktor
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
        document.getElementById('detailPriority').textContent = deal.priority || '-';
        document.getElementById('detailCreatedDate').textContent = formatDate(deal.createdAt);
        document.getElementById('detailRemarks').textContent = deal.remarks || '-';
        
        // Update progress
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
        
        // Load dan tampilkan komentar
        currentDealIdForComments = dealId;
        const comments = await loadComments(dealId);
        renderComments(comments, 'detailCommentsList');
        
        // Tampilkan modal
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

// Fungsi untuk menutup modal detail deal
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

// Fungsi untuk konfirmasi hapus deal
function confirmDeleteDeal(dealId, dealName) {
    // Simpan deal yang akan dihapus
    window.dealToDeleteId = dealId;
    window.dealToDeleteName = dealName;
    
    // Tampilkan modal konfirmasi
    document.getElementById('dealToDeleteName').textContent = dealName;
    document.getElementById('deleteModal').classList.remove('hidden');
    const deleteModalContent = document.getElementById('deleteModalContent');
    if (deleteModalContent) {
        deleteModalContent.classList.remove('modal-content-leave-active');
        deleteModalContent.classList.add('modal-content-enter-active');
    }
}

// Fungsi untuk menutup modal konfirmasi hapus
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

// Fungsi untuk menghapus deal (pindah ke Recycle Bin)
async function deleteDeal() {
    const dealId = window.dealToDeleteId;
    const dealName = window.dealToDeleteName;
    
    if (!dealId) {
        showToast("Deal tidak ditemukan", 3000);
        return;
    }
    
    try {
        // Ambil data deal dari Firestore
        const dealDoc = await dealsCollection.doc(dealId).get();
        if (!dealDoc.exists) {
            showToast("Deal tidak ditemukan di database", 3000);
            return;
        }
        
        const dealData = dealDoc.data();
        
        // Tambahkan informasi penghapusan
        const deletedDealData = {
            ...dealData,
            originalId: dealId,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedBy: auth.currentUser.email,
            deletedByEmail: auth.currentUser.email
        };
        
        // Simpan ke Recycle Bin
        await deletedDealsCollection.add(deletedDealData);
        
        // Hapus dari collection deals
        await dealsCollection.doc(dealId).delete();
        
        showToast(`Deal "${dealName}" berhasil dipindahkan ke Recycle Bin!`, 2000);
        
        // Log aktivitas
        await activitiesCollection.add({
            message: `Deal "${dealName}" dipindahkan ke Recycle Bin oleh ${auth.currentUser.email}.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        // Tutup modal dan refresh data
        closeDeleteModal();
        loadDealsFromFirebase();
        
        // Update Recycle Bin jika admin
        if (currentUserRole === 'admin') {
            loadRecycleBin();
        }
        
    } catch (error) {
        console.error("Error deleting deal:", error);
        showToast("Gagal menghapus deal", 3000);
    }
}

// Inisialisasi aplikasi setelah halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing application...");
    // Firebase auth sudah menangani inisialisasi melalui auth.onAuthStateChanged
});

// Ekspor fungsi yang diperlukan untuk event handler HTML
window.openDealDetailModal = openDealDetailModal;
