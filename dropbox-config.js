// ==================== DROPBOX-CONFIG.JS ====================
// Konfigurasi Dropbox - Tanpa Backup Token

const dropboxConfig = {
    // Token utama Anda
    MAIN_TOKEN: "sl.u.AGfeNZn83KdNdsEuEMls135Pl-sJ2dszbTCUGytKMVDhdS2iVP57f2cqHT2lrj-jGPiQ1DAvi2Q1v9uDrma28B6Yv1U23wg11JEFC4D6ac3hmPS_aVChXamrz3pserkoGwlnk4A9EoFEPQPSAwUoahYJyOVFo-AOTPbIbVNgTe15pm_7DJqrY6OiYE4J27P4Hi601sptYycp8vhtDQd-YDaBJjlwgIH2MlSOeZcZ027v_Zi0H3wmwR2Evnd_eaiq3d4kkLyQfvHXv-z3PV14Z31BzgEHtx7ArO9H701J45OJBZQD11RHm2MNV_Zp5BxqsTFhhfbnyZEwycBsqEAsaoNLBIYNcv3GWGIF59H5xI8mENHnCPyXbVTWaXrDvS2vQ6QtsNwV3FqJZB8pnBdK7KwfcugXvmkMeNUNfR0YDuqZvOFtKEO81JchOMzVhViKBpRUvyJ1NUpFxsGfNU0aEGAkMaXeGjsNq30hyXqYYLUZr9_pAacN_tYW-vI9bZk7m1WbQWXKsC7TEztvnR2i3gWoFE6oscPrac0jmMRThKntsUII-leXPHM90pNW0Eb83hkpTMFvIzgVGFjB6vKaSI-hnu2nUAKay7BaALLBUvSSCL68LlL7a2sE99KPrKL3qHS8pd7H6xSkmkVUy6-h_NZPwXY0g0iSFwqeIryZHwovLfmzaW8Q4q9KsZnm2bb2RhIM0P2XeWaSwkGfX-3RwdJPX1jTf4kV-aWL8s_wc0rEINKbGRtBDV3e26o-eceOBknCM4h3S0N0NjmWkTy0uBNGA-hp-CPHfV0UDSQ50_5aFcCVfjUZiAf_elYMEkdqRikbQXS3FJa5RdIrq4o31eAm2cC4SKyz-J0aZ0QpC1PxtnubumaL8bEpJ9RAGxmafaud_kc22DFntt76b7qF2-y8rTLVx5VV_97g8UWYDg35nwIofAyKgFabkcPDpk1g6RAoGgFUcHLtqf05EjW4_T4N8XZItbjx7Z0shQKbNJBSFdRZcg5IADH10HHkDyP6iq446kJxeuIjsPAa0ERgkbgRu1PyzUKEMDvBnS6lUd5SDm3jNcgUOCUGKy62ELOnXovXXKzkmbVRgdIrBFtR39KQXOOExflvs79QcUJNEVaSpyteyrYfN6T8K34K_eVwNPouEKxVOQy-J4LzgzbEg9vrivy2HsDdjHryKWuyochG5MvjUSSFQFZiswQTBxPk-fvtEnkvsFq5qLv5kxHjaF2XEB_QcsGNUmKrNogCxZg0yhaEF7UDwMZgxeVo66pK7NDchU_-9C1AVlf9carufaj7loe6wN4rEgNEnUg4D9s9BMB63Ifq0ECp_RCv9r7wPjI",
    
    // App folder di Dropbox
    APP_FOLDER: "owncloud-efk",
    
    // Status token
    tokenValid: true
};

// Fungsi untuk mendapatkan token saat ini
function getCurrentDropboxToken() {
    return dropboxConfig.MAIN_TOKEN;
}

// Fungsi untuk validasi token ke Dropbox
async function validateDropboxToken() {
    try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${dropboxConfig.MAIN_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Dropbox token valid. Account: ${data.email}`);
            dropboxConfig.tokenValid = true;
            return { valid: true, account: data };
        } else {
            const error = await response.json();
            console.error(`❌ Dropbox token invalid:`, error);
            dropboxConfig.tokenValid = false;
            return { valid: false, error: error.error_summary };
        }
    } catch (error) {
        console.error("Error validating token:", error);
        dropboxConfig.tokenValid = false;
        return { valid: false, error: error.message };
    }
}

// Inisialisasi Dropbox
async function initDropbox() {
    console.log("Initializing Dropbox...");
    console.log(`App folder: ${dropboxConfig.APP_FOLDER}`);
    
    const result = await validateDropboxToken();
    
    if (result.valid) {
        console.log("✅ Dropbox initialized successfully");
    } else {
        console.error("❌ Dropbox token is invalid!");
        console.log("💡 Tips: Token tidak akan expired selama tidak dicabut dari Dropbox App Console");
        console.log("📝 Untuk membuat token baru: https://www.dropbox.com/developers/apps");
    }
    
    return result.valid;
}

// Fungsi untuk cek status token (bisa dipanggil dari console)
window.checkDropboxToken = async function() {
    return await validateDropboxToken();
};

// Export
window.dropboxConfig = dropboxConfig;
window.getCurrentDropboxToken = getCurrentDropboxToken;
window.initDropbox = initDropbox;
window.validateDropboxToken = validateDropboxToken;
