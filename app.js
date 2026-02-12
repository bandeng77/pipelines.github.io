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
let uniqueYears = new Set(['2025', '2026']);
let uniqueSales = new Set();

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

// Variabel untuk menyimpan pilihan sales aktif per deal card
let activeSalesPerDeal = {};

// Variabel untuk menyimpan deal yang sedang dilihat komentarnya
let currentDealIdForComments = null;

// Variabel untuk hapus komentar
let currentCommentIdToDelete = null;
let currentDealIdForCommentDelete = null;

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

// ==================== FUNGSI UTAMA ====================

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
            const userWelcome = document.getElementById('userWelcome');
            if (userWelcome) {
                userWelcome.textContent = user.email;
            }

            if (managerEmails.includes(user.email)) {
                currentUserRole = user.email === 'admin@genetek.co.id' ? 'admin' : 'manager';
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

            console.log("Current role:", currentUserRole);
            applyUserPermissions();
            loadActivitiesFromFirebase();
            await loadConsultantsFromFirebase();
            await loadDropdownOptions();
            initEventListeners();
            initViewToggle();
            initExportElements();
            
            if (currentUserRole === 'admin') {
                loadRecycleBin();
            }
        } catch (error) {
            console.error("Error checking user role:", error);
            showToast("Gagal memuat data pengguna. Silakan refresh halaman.", 5000);
        }
    }
});

// ==================== FUNGSI DROPDOWN OPTIONS ====================

async function loadDropdownOptions() {
    try {
        const doc = await dropdownOptionsCollection.doc('options').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.facilities) uniqueFacilities = new Set(data.facilities);
            if (data.packages) uniquePackages = new Set(data.packages);
            if (data.owners) uniqueOwners = new Set(data.owners);
            if (data.pics) uniquePICs = new Set(data.pics);
            console.log("Dropdown options loaded from Firebase");
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
        console.log("Dropdown options saved to Firebase");
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

function createPriorityDashboard() {
    const priorityDashboard = document.querySelector('.priority-dashboard');
    if (!priorityDashboard) return;
    
    const priorityStats = {
        'Hot Priority': { count: 0, value: 0, deals: [] },
        'Priority': { count: 0, value: 0, deals: [] },
        'Win': { count: 0, value: 0, deals: [] },
        'Behind': { count: 0, value: 0, deals: [] },
        'On Track': { count: 0, value: 0, deals: [] }
    };
    
    const groupedDeals = groupDealsForStats(deals);
    
    groupedDeals.forEach(deal => {
        const priority = deal.priority || 'Priority';
        if (priorityStats[priority]) {
            priorityStats[priority].count++;
            priorityStats[priority].value += (deal.value || 0);
            priorityStats[priority].deals.push(deal);
        }
    });
    
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

function groupDealsForStats(dealsArray) {
    const groupedMap = new Map();
    
    dealsArray.forEach(deal => {
        const dealName = deal.dealName?.toLowerCase().trim();
        if (!dealName) return;
        
        if (!groupedMap.has(dealName) || (deal.value || 0) > (groupedMap.get(dealName).value || 0)) {
            groupedMap.set(dealName, deal);
        }
    });
    
    return Array.from(groupedMap.values());
}

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
                    <tr class="hover:bg-gray-50">
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
                                <i class="fas fa-eye"></i> Detail
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        modalContent.appendChild(table);
        
        modalContent.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dealId = this.dataset.id;
                closePriorityModal();
                openDealDetailModal(dealId);
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
        console.warn("Progress bar elements not found");
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

// ==================== FUNGSI COMMENTS ====================

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
        commentItem.innerHTML = `
            <div class="comment-header">
                <div>
                    <span class="comment-author">${comment.userEmail}</span>
                    <span class="comment-role ${isManager ? 'manager' : 'sales'} ml-2">
                        ${isManager ? 'Manager' : 'Sales'}
                    </span>
                </div>
                <div class="comment-actions">
                    ${isCurrentUser || currentUserRole === 'admin' || currentUserRole === 'manager' ? `
                        <button class="delete-comment-btn text-red-500 hover:text-red-700 ml-2" data-comment-id="${comment.id}" data-deal-id="${comment.dealId}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                    <span class="comment-time">${formatDateTime(comment.timestamp)}</span>
                </div>
            </div>
            <div class="comment-content">${comment.content}</div>
        `;
        
        container.appendChild(commentItem);
    });
    
    container.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const commentId = this.dataset.commentId;
            const dealId = this.dataset.dealId;
            confirmDeleteComment(commentId, dealId);
        });
    });
    
    const commentsCountElement = document.getElementById(containerId === 'commentsList' ? 'commentsCount' : 'detailCommentsCount');
    if (commentsCountElement) {
        commentsCountElement.textContent = `${comments.length} komentar`;
    }
}

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
        
        if (currentDealIdForComments === dealId) {
            const comments = await loadComments(dealId);
            renderComments(comments, 'commentsList');
            renderComments(comments, 'detailCommentsList');
        }
        
        document.getElementById('commentInput').value = '';
        document.getElementById('detailCommentInput').value = '';
        
        showToast("Komentar berhasil ditambahkan", 2000);
        
    } catch (error) {
        console.error("Error adding comment:", error);
        showToast("Gagal menambahkan komentar", 3000);
    }
}

function confirmDeleteComment(commentId, dealId) {
    currentCommentIdToDelete = commentId;
    currentDealIdForCommentDelete = dealId;
    document.getElementById('deleteCommentModal').classList.remove('hidden');
    const deleteCommentModalContent = document.getElementById('deleteCommentModalContent');
    if (deleteCommentModalContent) {
        deleteCommentModalContent.classList.remove('modal-content-leave-active');
        deleteCommentModalContent.classList.add('modal-content-enter-active');
    }
}

async function deleteComment() {
    if (!currentCommentIdToDelete || !currentDealIdForCommentDelete) {
        closeDeleteCommentModal();
        return;
    }
    
    try {
        await commentsCollection.doc(currentCommentIdToDelete).delete();
        
        const comments = await loadComments(currentDealIdForCommentDelete);
        renderComments(comments, 'commentsList');
        renderComments(comments, 'detailCommentsList');
        
        showToast("Komentar berhasil dihapus", 2000);
        
        closeDeleteCommentModal();
    } catch (error) {
        console.error("Error deleting comment:", error);
        showToast("Gagal menghapus komentar", 3000);
    }
}

function closeDeleteCommentModal() {
    const deleteCommentModalContent = document.getElementById('deleteCommentModalContent');
    if (!deleteCommentModalContent) return;

    deleteCommentModalContent.classList.remove('modal-content-enter-active');
    deleteCommentModalContent.classList.add('modal-content-leave-active');
    
    deleteCommentModalContent.addEventListener('transitionend', function handler() {
        document.getElementById('deleteCommentModal').classList.add('hidden');
        deleteCommentModalContent.classList.remove('modal-content-leave-active');
        deleteCommentModalContent.removeEventListener('transitionend', handler);
        currentCommentIdToDelete = null;
        currentDealIdForCommentDelete = null;
    }, { once: true });
}

// ==================== FUNGSI MERGE PROJECT ====================

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
    
    return groupedDeals;
}

function identifyMergedDeals() {
    const groupedDeals = groupDealsByName();
    const mergedDealsInfo = {};
    
    Object.keys(groupedDeals).forEach(dealName => {
        const dealsInGroup = groupedDeals[dealName];
        const salesNames = [...new Set(dealsInGroup.map(deal => deal.salesName))];
        
        const highestValueDeal = dealsInGroup.reduce((max, deal) => 
            (deal.value || 0) > (max.value || 0) ? deal : max, dealsInGroup[0]);
        
        mergedDealsInfo[dealName] = {
            count: dealsInGroup.length,
            salesNames: salesNames,
            deals: dealsInGroup,
            highestValueDeal: highestValueDeal
        };
    });
    
    return mergedDealsInfo;
}

function renderMergedDealCard(dealGroup) {
    const dealName = dealGroup[0].dealName;
    const dealNameLower = dealName.toLowerCase();
    const mergedDealsInfo = identifyMergedDeals();
    const mergedInfo = mergedDealsInfo[dealNameLower];
    
    let activeSales = activeSalesPerDeal[dealNameLower] || dealGroup[0].salesName;
    
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
    dealCard.dataset.hasMultiple = hasMultipleSales ? 'true' : 'false';
    
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
            
            dropdown.querySelectorAll('.sales-dropdown-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const selectedSales = this.dataset.sales;
                    const dealName = this.dataset.dealName;
                    
                    activeSalesPerDeal[dealName] = selectedSales;
                    
                    const allDealCards = document.querySelectorAll(`.deal-card[data-deal-name="${dealName}"]`);
                    
                    allDealCards.forEach(card => {
                        const selectedDeal = dealGroup.find(deal => deal.salesName === selectedSales);
                        
                        if (selectedDeal) {
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
                                    case 'identified': stageColorClass = 'bg-gray-100 text-gray-800'; break;
                                    case 'prospect': stageColorClass = 'bg-blue-100 text-blue-800'; break;
                                    case 'tender-me': stageColorClass = 'bg-orange-100 text-orange-800'; break;
                                    case 'tender-main-con': stageColorClass = 'bg-purple-100 text-purple-800'; break;
                                    case 'contract-award': stageColorClass = 'bg-indigo-100 text-indigo-800'; break;
                                    case 'win': stageColorClass = 'bg-green-100 text-green-800'; break;
                                    case 'lost': stageColorClass = 'bg-red-100 text-red-800'; break;
                                    case 'on-hold': stageColorClass = 'bg-yellow-100 text-yellow-800'; break;
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
                            
                            card.dataset.id = selectedDeal.id;
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
        permanentDeleteDealId = null;
        permanentDeleteDealName = '';
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
            console.log("Activities loaded:", activities.length);
            updateActivityBadge();
        })
        .catch((error) => {
            console.error("Error loading activities:", error);
            showToast("Gagal memuat aktivitas terbaru", 3000);
        });
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
                activityItem.className = 'activity-item';
                activityItem.innerHTML = `
                    <p>${activity.message || 'Aktivitas tidak tersedia'}</p>
                    <div class="activity-date">
                        ${formatDateTime(activity.timestamp)}
                        ${activity.read ? '' : '<span class="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Baru</span>'}
                    </div>
                `;
                activityFeed.appendChild(activityItem);
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

function formatDateTime(timestamp) {
    if (!timestamp) return '-';
    try {
        const date = timestamp.toDate();
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
        const date = timestamp.toDate();
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
        case 'Priority': return 'priority-badge-priority';
        case 'Hot Priority': return 'priority-badge-hot';
        case 'Win': return 'priority-badge-win';
        case 'Behind': return 'priority-badge-behind';
        case 'On Track': return 'priority-badge-ontrack';
        default: return 'priority-badge-priority';
    }
}

// ==================== FUNGSI DEALS ====================

function populateYearDropdown() {
    const filterYearSelect = document.getElementById('filterYear');
    if (!filterYearSelect) return;

    const allYearsOption = filterYearSelect.querySelector('option[value="all"]');
    filterYearSelect.innerHTML = '';
    filterYearSelect.appendChild(allYearsOption);
    
    filterYearSelect.appendChild(new Option('2025', '2025'));
    filterYearSelect.appendChild(new Option('2026', '2026'));

    const sortedYears = Array.from(uniqueYears).sort((a, b) => parseInt(b) - parseInt(a));
    sortedYears.forEach(year => {
        if (year !== '2025' && year !== '2026') {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            filterYearSelect.appendChild(option);
        }
    });
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
        uniqueSales.clear();

        querySnapshot.forEach((doc) => {
            const dealData = doc.data();
            if (dealData.createdAt && typeof dealData.createdAt.toDate !== 'function') {
                if (dealData.createdAt.seconds !== undefined && dealData.createdAt.nanoseconds !== undefined) {
                    dealData.createdAt = new firebase.firestore.Timestamp(dealData.createdAt.seconds, dealData.createdAt.nanoseconds);
                } else {
                    dealData.createdAt = null;
                }
            }
            deals.push({ id: doc.id, ...dealData });

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
                const year = dealData.createdAt.toDate().getFullYear().toString();
                uniqueYears.add(year);
            }
        });
        console.log("Total deals loaded:", deals.length);
        populateYearDropdown();
        populateFilterDropdowns();
        
        createPriorityDashboard();
        
        applyActiveFilters();
        
    } catch (error) {
        console.error("Error loading deals:", error);
        showToast("Gagal memuat data deals", 3000);
    }
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
        'bintang@genetek.co.id',
        'andy@genetek.co.id'
    ];
    
    if (currentUser && allowedEmails.includes(currentUser.email)) {
        return true;
    }

    if (!currentUser) return false;
    
    const userSalesName = getSalesNameFromEmail(currentUser.email);
    return deal.salesName === userSalesName;
}

function renderIndividualDealCard(deal) {
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card';
    dealCard.dataset.id = deal.id;
    dealCard.dataset.dealName = deal.dealName?.toLowerCase();
    
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

function renderDealList(deal, index) {
    const row = document.createElement('tr');
    row.dataset.id = deal.id;
    
    const canEdit = canUserEditDeal(deal);
    const priorityBadgeClass = getPriorityBadgeClass(deal.priority);
    const winDate = getWinDate(deal);
    
    row.innerHTML = `
        <td>${index + 1}</td>
        <td>${deal.salesName || '-'}</td>
        <td>${deal.dealName || 'No Name'}</td>
        <td>
            ${deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
            ${winDate ? `
            <div class="win-date-container">
                <i class="fas fa-calendar-check mr-1"></i>${formatDate(winDate)}
            </div>
            ` : ''}
        </td>
        <td>${deal.consultant || '-'}</td>
        <td>Rp ${formatNumber(deal.value) || '0'}</td>
        <td>
            <span class="priority-badge px-2 py-1 rounded-full ${priorityBadgeClass}">
                ${deal.priority || 'Priority'}
            </span>
        </td>
        <td class="deal-actions">
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
        </td>
    `;
    
    return row;
}

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

function populateFilterDropdowns() {
    populateDropdown('filterPriority', ['Priority', 'Hot Priority', 'Win', 'Behind', 'On Track'], activeFilters.priority);
    populateDropdown('filterStage', ['identified', 'prospect', 'tender-me', 'tender-main-con', 'contract-award', 'win', 'lost', 'on-hold'], activeFilters.stage);
    populateDropdown('filterSales', uniqueSales, activeFilters.sales);
    populateDropdown('filterConsultant', uniqueConsultants, activeFilters.consultant);
    populateDropdown('filterContractor', uniqueContractors, activeFilters.contractor);
    populateDropdown('filterFacility', uniqueFacilities, activeFilters.facility);
    populateDropdown('filterProduct', uniqueProducts, activeFilters.product);
    populateDropdown('filterPackage', uniquePackages, activeFilters.package);
    
    const filterYearSelect = document.getElementById('filterYear');
    if (filterYearSelect) {
        filterYearSelect.value = activeFilters.year;
    }
    
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
    const groupedDeals = groupDealsForStats(deals);
    const salesDeals = salesName === 'all' 
        ? groupedDeals 
        : groupedDeals.filter(deal => deal.salesName === salesName);
    
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
        minDealValue: 0,
        dealsByPriority: {}
    };
    
    if (salesDeals.length > 0) {
        stats.maxDealValue = salesDeals[0].value || 0;
        stats.minDealValue = salesDeals[0].value || 0;
    }
    
    salesDeals.forEach(deal => {
        const dealValue = deal.value || 0;
        
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
            const monthYear = deal.createdAt.toDate().toLocaleString('id-ID', { 
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
                                return `Klik untuk melihat detail project`;
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
    const groupedDeals = groupDealsForStats(deals);
    const priorityDeals = priority === 'all' 
        ? groupedDeals 
        : groupedDeals.filter(deal => deal.priority === priority);
    
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
        minDealValue: 0,
        dealsByStage: {}
    };
    
    if (priorityDeals.length > 0) {
        stats.maxDealValue = priorityDeals[0].value || 0;
        stats.minDealValue = priorityDeals[0].value || 0;
    }
    
    priorityDeals.forEach(deal => {
        const dealValue = deal.value || 0;
        
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
            const monthYear = deal.createdAt.toDate().toLocaleString('id-ID', { 
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
        document.getElementById('priorityMinValue').textContent = `Rp ${formatNumber(priorityData.minDealValue)}`;
        
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
                                    return `Klik untuk melihat detail project`;
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
    
    const groupedDeals = groupDealsForStats(dealsData);
    
    const stageSelect = document.getElementById('stage');
    const allStages = stageSelect ? Array.from(stageSelect.options).map(option => option.value).filter(value => value !== '') : [];
    
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
    
    groupedDeals.forEach(deal => {
        const dealValue = deal.value || 0;
        
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
            const dateSource = deal.createdAt;
            if (dateSource && typeof dateSource.toDate === 'function') {
                const date = dateSource.toDate();
                const monthYear = date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
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
    
    stats.winRateData = stats.winRateLabels.map(stage => winRateDataMap[stage] || 0);
    
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
        
        console.log("All overview charts rendered successfully");
        
    } catch (error) {
        console.error("Error rendering overview charts:", error);
        showToast("Gagal merender chart overview", 3000);
    }
}

// ==================== FUNGSI CLICKABLE CHART ====================

function showDealsByPriority(salesFilter, priority) {
    const selectedSales = salesFilter.value;
    const groupedDeals = groupDealsForStats(deals);
    const filteredDeals = selectedSales === 'all' 
        ? groupedDeals.filter(deal => deal.priority === priority)
        : groupedDeals.filter(deal => deal.salesName === selectedSales && deal.priority === priority);
    
    if (filteredDeals.length === 0) {
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
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            ${filteredDeals.map((deal, index) => `
                <tr class="hover:bg-gray-50 cursor-pointer" onclick="openDealDetailModal('${deal.id}')">
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
    document.getElementById('clickableChartModal').classList.remove('hidden');
}

function showDealsByStage(priorityFilter, stage) {
    const selectedPriority = priorityFilter.value;
    const groupedDeals = groupDealsForStats(deals);
    const filteredDeals = selectedPriority === 'all' 
        ? groupedDeals.filter(deal => deal.stage === stage)
        : groupedDeals.filter(deal => deal.priority === selectedPriority && deal.stage === stage);
    
    if (filteredDeals.length === 0) {
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
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            ${filteredDeals.map((deal, index) => `
                <tr class="hover:bg-gray-50 cursor-pointer" onclick="openDealDetailModal('${deal.id}')">
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
    document.getElementById('clickableChartModal').classList.remove('hidden');
}

// ==================== FUNGSI PERHITUNGAN NILAI ====================

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
        onEnd: function(evt) {}
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
                        dealCard.querySelector('td:nth-child(3)').textContent;
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
            commentSubmitBtn.addEventListener('click', function() {
                const commentInput = document.getElementById('commentInput');
                const comment = commentInput ? commentInput.value : '';
                if (currentDealIdForComments) {
                    addComment(currentDealIdForComments, comment);
                }
            });
        }
        
        const stageSelect = document.getElementById('stage');
        if (stageSelect) {
            stageSelect.addEventListener('change', function() {
                updateProgressBarFromStage(this.value);
            });
        }
        
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
        
        const closeActivityBtn = document.getElementById('closeActivityBtn');
        if (closeActivityBtn) closeActivityBtn.addEventListener('click', closeActivityModal);
        
        const closeActivityFooterBtn = document.getElementById('closeActivityFooterBtn');
        if (closeActivityFooterBtn) closeActivityFooterBtn.addEventListener('click', closeActivityModal);
        
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteDeal);
        
        const cancelDeleteCommentBtn = document.getElementById('cancelDeleteCommentBtn');
        if (cancelDeleteCommentBtn) cancelDeleteCommentBtn.addEventListener('click', closeDeleteCommentModal);
        
        const confirmDeleteCommentBtn = document.getElementById('confirmDeleteCommentBtn');
        if (confirmDeleteCommentBtn) confirmDeleteCommentBtn.addEventListener('click', deleteComment);
        
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
        let baseDeals = deals;
        if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            baseDeals = deals.filter(deal => deal.stage !== 'lost');
        }

        const filteredDeals = baseDeals.filter(deal => {
            const matchesSearch = 
                activeFilters.searchTerm === '' ||
                (deal.dealName && deal.dealName.toLowerCase().includes(activeFilters.searchTerm)) ||
                (deal.salesName && deal.salesName.toLowerCase().includes(activeFilters.searchTerm));
            
            const matchesPriority = 
                activeFilters.priority === 'all' || 
                (deal.priority && deal.priority === activeFilters.priority);
            
            const matchesYear = activeFilters.year === 'all' || 
                                (deal.createdAt && deal.createdAt.toDate().getFullYear().toString() === activeFilters.year);

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
        pipelineStage.innerHTML = `
            <div class="empty-stage-message text-center text-gray-400 p-4 text-sm w-full">
                <i class="fas fa-search text-3xl mb-2"></i>
                <p>Tidak ada deals yang sesuai dengan filter.</p>
            </div>
        `;
        return;
    }
    
    if (currentView === 'card') {
        const dealsByName = {};
        filteredDeals.forEach(deal => {
            const dealName = deal.dealName?.toLowerCase().trim();
            if (!dealName) return;
            
            if (!dealsByName[dealName]) {
                dealsByName[dealName] = [];
            }
            dealsByName[dealName].push(deal);
        });
        
        Object.values(dealsByName).forEach(dealGroup => {
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
        const table = document.createElement('table');
        table.className = 'list-view';
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>No</th>
                <th>Nama Sales</th>
                <th>Nama Project</th>
                <th>Tahap</th>
                <th>Konsultan</th>
                <th>Nilai (IDR)</th>
                <th>Priority</th>
                <th>Aksi</th>
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
        const dealDate = deal.createdAt.toDate();
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
        return {
            'Nama Proyek': deal.dealName || '',
            'Nama Sales': deal.salesName || '',
            'Tahap': deal.stage ? deal.stage.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '',
            'Prioritas': deal.priority || '',
            'Nilai (IDR)': deal.value || 0,
            'Diskon (%)': deal.discount || 0,
            'Sebelum Diskon (IDR)': deal.beforeDiscount || 0,
            'Paket': deal.package || '',
            'Produk': Array.isArray(deal.product) ? deal.product.join(', ') : (deal.product || ''),
            'Fasilitas': deal.facility || '',
            'Owner': deal.owner || '',
            'Konsultan': deal.consultant || '',
            'Kontraktor': Array.isArray(deal.contractor) ? deal.contractor.join(', ') : (deal.contractor || ''),
            'PIC': deal.pic || '',
            'Plan PO': deal.planPO || '',
            'Remarks': deal.remarks || '',
            'Tanggal Dibuat': deal.createdAt ? formatDate(deal.createdAt) : '',
            'Dibuat Oleh': deal.createdBy || ''
        };
    });
}

function prepareSummaryExportData(dealsData) {
    const summary = {};
    
    dealsData.forEach(deal => {
        const stage = deal.stage || 'Unknown';
        
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
        
        const sales = deal.salesName || 'Unknown';
        if (!summary[stage].salesCount[sales]) {
            summary[stage].salesCount[sales] = 0;
        }
        summary[stage].salesCount[sales]++;
        
        const product = Array.isArray(deal.product) ? deal.product[0] || 'Unknown' : (deal.product || 'Unknown');
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
            await dealsCollection.doc(dealId).update(dealData);
            showToast(`Deal "${dealName}" berhasil diperbarui!`, 2000);
            
            await activitiesCollection.add({
                message: `Deal "${dealName}" diperbarui oleh ${auth.currentUser.email}.`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: auth.currentUser.email,
                read: false
            });
        } else {
            await dealsCollection.add(dealData);
            showToast(`Deal "${dealName}" berhasil ditambahkan!`, 2000);
            
            await activitiesCollection.add({
                message: `Deal "${dealName}" ditambahkan oleh ${auth.currentUser.email}.`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userEmail: auth.currentUser.email,
                read: false
            });
        }
        
        closeDealModal();
        loadDealsFromFirebase();
        
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
        const deal = deals.find(d => d.id === dealId);
        if (!deal) {
            showToast("Deal tidak ditemukan", 3000);
            return;
        }
        
        document.getElementById('dealDetailTitle').textContent = `Detail Deal: ${deal.dealName}`;
        document.getElementById('detailSalesName').textContent = deal.salesName || '-';
        document.getElementById('detailValue').textContent = `Rp ${formatNumber(deal.value) || '0'}`;
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
        document.getElementById('detailPriority').textContent = deal.priority || '-';
        document.getElementById('detailCreatedDate').textContent = formatDate(deal.createdAt);
        document.getElementById('detailRemarks').textContent = deal.remarks || '-';
        
        let progress = 0;
        switch (deal.stage) {
            case 'identified': progress = 20; break;
            case 'prospect': progress = 40; break;
            case 'tender-me': progress = 60; break;
            case 'tender-main-con':
            case 'contract-award': progress = 80; break;
            case 'win':
            case 'lost': progress = 100; break;
            case 'on-hold': progress = 0; break;
        }
        document.getElementById('detailProgress').textContent = `${progress}%`;
        
        currentDealIdForComments = dealId;
        const comments = await loadComments(dealId);
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
    window.dealToDeleteId = dealId;
    window.dealToDeleteName = dealName;
    
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
        window.dealToDeleteId = null;
        window.dealToDeleteName = null;
    }, { once: true });
}

async function deleteDeal() {
    const dealId = window.dealToDeleteId;
    const dealName = window.dealToDeleteName;
    
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
        
        showToast(`Deal "${dealName}" berhasil dipindahkan ke Recycle Bin!`, 2000);
        
        await activitiesCollection.add({
            message: `Deal "${dealName}" dipindahkan ke Recycle Bin oleh ${auth.currentUser.email}.`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: auth.currentUser.email,
            read: false
        });
        
        closeDeleteModal();
        loadDealsFromFirebase();
        
        if (currentUserRole === 'admin') {
            loadRecycleBin();
        }
        
    } catch (error) {
        console.error("Error deleting deal:", error);
        showToast("Gagal menghapus deal", 3000);
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

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing application...");
});

window.openDealDetailModal = openDealDetailModal;
