        // ============ STATE ============
        let currentSection = null;
        let report = null;
        let currentReportId = null; // Supabase report ID
        let permissionsChecked = false;
        let activeProject = null;
        let projectContractors = [];
        let userSettings = null;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOSSafari = isIOS && isSafari;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // ============ STATE PROTECTION ============
        /**
         * Check if report is already refined - redirect if so
         * This prevents users from editing after AI refinement
         * v6: Uses canReturnToNotes() from report-rules.js
         */
        async function checkReportState() {
            const activeProjectId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
            if (!activeProjectId) {
                return true; // No project selected, allow page to load (will show project picker)
            }

            const today = getTodayDateString();

            try {
                const { data: reportData, error } = await supabaseClient
                    .from('reports')
                    .select('id, status')
                    .eq('project_id', activeProjectId)
                    .eq('report_date', today)
                    .maybeSingle();

                if (error) {
                    console.error('[STATE CHECK] Error checking report state:', error);
                    return true; // Allow page to load on error, let normal flow handle it
                }

                if (reportData) {
                    // v6: Use canReturnToNotes() from report-rules.js to check if editing is allowed
                    // Note: canReturnToNotes expects a reportId, but we check status directly here
                    // since we already have the status from Supabase
                    const canEdit = reportData.status === REPORT_STATUS.DRAFT;
                    if (!canEdit) {
                        console.log('[STATE CHECK] Cannot edit - status:', reportData.status);
                        window.location.href = `report.html?date=${today}`;
                        return false;
                    }
                }

                return true;
            } catch (e) {
                console.error('[STATE CHECK] Failed to check report state:', e);
                return true; // Allow page to load on error
            }
        }

        // ============ LOCALSTORAGE DRAFT MANAGEMENT ============
        // v6: Use STORAGE_KEYS from storage-keys.js for all localStorage operations
        // Draft storage uses STORAGE_KEYS.CURRENT_REPORTS via getCurrentReport()/saveCurrentReport()
        // Sync queue uses STORAGE_KEYS.SYNC_QUEUE via getSyncQueue()/addToSyncQueue()

        /**
         * Save all form data to localStorage
         * This is called during editing - data only goes to Supabase on FINISH
         */
        function saveToLocalStorage() {
            const activeProjectId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
            const todayStr = getTodayDateString();

            const data = {
                projectId: activeProjectId,
                reportDate: todayStr,
                captureMode: report.meta?.captureMode || null,
                lastSaved: new Date().toISOString(),

                // Meta
                meta: {
                    createdAt: report.meta?.createdAt,
                    version: report.meta?.version || 2,
                    naMarked: report.meta?.naMarked || {},
                    captureMode: report.meta?.captureMode,
                    status: 'draft'
                },

                // Weather data
                weather: report.overview?.weather || {},

                // Minimal mode - freeform notes
                freeformNotes: report.fieldNotes?.freeformNotes || '',

                // Guided mode sections
                workSummary: report.guidedNotes?.workSummary || '',
                siteConditions: report.overview?.weather?.jobSiteCondition || '',
                issuesNotes: report.generalIssues || [],
                safetyNoIncidents: report.safety?.noIncidents || false,
                safetyHasIncidents: report.safety?.hasIncidents || false,
                safetyNotes: report.safety?.notes || [],
                qaqcNotes: report.qaqcNotes || [],
                communications: report.contractorCommunications || '',
                visitorsRemarks: report.visitorsRemarks || '',
                additionalNotes: report.additionalNotes || '',

                // Contractor work (activities)
                activities: report.activities || [],

                // Personnel/operations
                operations: report.operations || [],

                // Equipment usage
                equipment: report.equipment || [],

                // Photos (metadata only - actual files uploaded separately)
                photos: (report.photos || []).map(p => ({
                    id: p.id,
                    storagePath: p.storagePath || '',
                    url: p.url || '',
                    caption: p.caption || '',
                    timestamp: p.timestamp,
                    date: p.date,
                    time: p.time,
                    gps: p.gps,
                    fileName: p.fileName
                })),

                // Reporter info
                reporter: report.reporter || {},

                // Overview
                overview: {
                    date: report.overview?.date,
                    startTime: report.overview?.startTime,
                    completedBy: report.overview?.completedBy,
                    projectName: report.overview?.projectName
                }
            };

            try {
                // v6: Use saveCurrentReport for draft storage
                const reportData = {
                    id: currentReportId || `draft_${activeProjectId}_${todayStr}`,
                    project_id: activeProjectId,
                    date: todayStr,
                    status: 'draft',
                    capture_mode: data.captureMode,
                    created_at: report.meta?.createdAt || Date.now(),
                    // Store the full draft data in a nested object for compatibility
                    _draft_data: data
                };
                saveCurrentReport(reportData);
                console.log('[LOCAL] Draft saved to localStorage via saveCurrentReport');
            } catch (e) {
                console.error('[LOCAL] Failed to save to localStorage:', e);
                // If localStorage is full, try to continue without local save
            }
        }

        /**
         * Load form data from localStorage
         * Returns null if no valid draft exists for current project/date
         */
        function loadFromLocalStorage() {
            const activeProjectId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
            const today = getTodayDateString();
            const draftId = currentReportId || `draft_${activeProjectId}_${today}`;

            try {
                // v6: Use getCurrentReport to load draft
                const storedReport = getCurrentReport(draftId);
                if (!storedReport) return null;

                // Extract draft data from stored report
                const data = storedReport._draft_data;
                if (!data) return null;

                // Verify it's for the same project and date
                if (data.projectId !== activeProjectId || data.reportDate !== today) {
                    // Different project or date - clear old draft
                    console.log('[LOCAL] Draft is for different project/date, clearing');
                    deleteCurrentReport(draftId);
                    return null;
                }

                console.log('[LOCAL] Found valid draft from', data.lastSaved);
                return data;
            } catch (e) {
                console.error('[LOCAL] Failed to parse stored draft:', e);
                deleteCurrentReport(draftId);
                return null;
            }
        }

        /**
         * Restore report object from localStorage data
         */
        function restoreFromLocalStorage(localData) {
            if (!localData) return false;

            console.log('[LOCAL] Restoring draft from localStorage');

            // Restore meta
            if (localData.meta) {
                report.meta = { ...report.meta, ...localData.meta };
            }
            if (localData.captureMode) {
                report.meta.captureMode = localData.captureMode;
            }

            // Restore weather
            if (localData.weather) {
                report.overview.weather = localData.weather;
            }

            // Restore freeform notes (minimal mode)
            if (localData.freeformNotes) {
                report.fieldNotes.freeformNotes = localData.freeformNotes;
            }

            // Restore guided sections
            if (localData.workSummary) {
                report.guidedNotes.workSummary = localData.workSummary;
            }
            if (localData.siteConditions) {
                report.overview.weather.jobSiteCondition = localData.siteConditions;
            }
            if (localData.issuesNotes && Array.isArray(localData.issuesNotes)) {
                report.generalIssues = localData.issuesNotes;
            }
            if (localData.safetyNoIncidents !== undefined) {
                report.safety.noIncidents = localData.safetyNoIncidents;
            }
            if (localData.safetyHasIncidents !== undefined) {
                report.safety.hasIncidents = localData.safetyHasIncidents;
            }
            if (localData.safetyNotes && Array.isArray(localData.safetyNotes)) {
                report.safety.notes = localData.safetyNotes;
            }
            if (localData.qaqcNotes && Array.isArray(localData.qaqcNotes)) {
                report.qaqcNotes = localData.qaqcNotes;
            }
            if (localData.communications) {
                report.contractorCommunications = localData.communications;
            }
            if (localData.visitorsRemarks) {
                report.visitorsRemarks = localData.visitorsRemarks;
            }
            if (localData.additionalNotes) {
                report.additionalNotes = localData.additionalNotes;
            }

            // Restore contractor work
            if (localData.activities && Array.isArray(localData.activities)) {
                report.activities = localData.activities;
            }

            // Restore operations/personnel
            if (localData.operations && Array.isArray(localData.operations)) {
                report.operations = localData.operations;
            }

            // Restore equipment
            if (localData.equipment && Array.isArray(localData.equipment)) {
                report.equipment = localData.equipment;
            }

            // Restore photos
            if (localData.photos && Array.isArray(localData.photos)) {
                report.photos = localData.photos;
            }

            // Restore reporter
            if (localData.reporter) {
                report.reporter = { ...report.reporter, ...localData.reporter };
            }

            // Restore overview
            if (localData.overview) {
                report.overview = { ...report.overview, ...localData.overview };
            }

            return true;
        }

        /**
         * Clear localStorage draft (called after successful FINISH)
         * Also removes from offline queue if present
         */
        function clearLocalStorageDraft() {
            const activeProjectId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
            const todayStr = getTodayDateString();
            const draftId = currentReportId || `draft_${activeProjectId}_${todayStr}`;

            // v6: Use deleteCurrentReport to clear draft
            deleteCurrentReport(draftId);

            // v6: Sync queue is now managed by sync-manager.js
            // The processOfflineQueue() function handles cleanup automatically
            console.log('[LOCAL] Draft cleared from localStorage');
        }

        // autoExpand(), initAutoExpand(), initAllAutoExpandTextareas() moved to /js/ui-utils.js

        // ============ CAPTURE MODE HANDLING ============
        /**
         * Check if we should show mode selection screen
         * Show if: no captureMode set AND report is essentially empty
         */
        function shouldShowModeSelection() {
            if (!report) return true;
            if (report.meta?.captureMode) return false;

            // Check if report has any meaningful data (besides default values)
            const hasPhotos = report.photos?.length > 0;
            const hasActivities = report.activities?.length > 0;
            const hasIssues = report.generalIssues?.length > 0;
            const hasNotes = report.additionalNotes?.trim().length > 0;
            const hasFieldNotes = report.fieldNotes?.freeformNotes?.trim().length > 0;
            const hasReporterName = report.reporter?.name?.trim().length > 0;

            // If any data exists, don't show mode selection
            return !(hasPhotos || hasActivities || hasIssues || hasNotes || hasFieldNotes || hasReporterName);
        }

        /**
         * Select a capture mode and show the appropriate UI
         */
        function selectCaptureMode(mode) {
            report.meta.captureMode = mode;
            saveReport();
            showModeUI(mode);
        }

        /**
         * Show the appropriate UI for the selected mode
         */
        function showModeUI(mode) {
            const modeSelectionScreen = document.getElementById('modeSelectionScreen');
            const minimalModeApp = document.getElementById('minimalModeApp');
            const guidedModeApp = document.getElementById('app');

            modeSelectionScreen.classList.add('hidden');

            if (mode === 'minimal') {
                minimalModeApp.classList.remove('hidden');
                guidedModeApp.classList.add('hidden');
                initMinimalModeUI();
            } else {
                minimalModeApp.classList.add('hidden');
                guidedModeApp.classList.remove('hidden');
                initGuidedModeUI();
            }
        }

        /**
         * Show the mode selection screen
         */
        function showModeSelectionScreen() {
            const modeSelectionScreen = document.getElementById('modeSelectionScreen');
            const minimalModeApp = document.getElementById('minimalModeApp');
            const guidedModeApp = document.getElementById('app');

            modeSelectionScreen.classList.remove('hidden');
            minimalModeApp.classList.add('hidden');
            guidedModeApp.classList.add('hidden');

            // Update mode selection header
            const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            document.getElementById('modeSelectionDate').textContent = dateStr;

            if (activeProject) {
                document.getElementById('modeSelectionProjectName').textContent = activeProject.name;
            }
        }

        /**
         * Show confirmation modal for switching modes
         */
        function showSwitchModeConfirm() {
            const modal = document.getElementById('switchModeModal');
            const warning = document.getElementById('switchModeWarning');
            const targetSpan = document.getElementById('switchModeTarget');
            const currentMode = report.meta?.captureMode;

            // Set target mode text
            if (currentMode === 'minimal') {
                targetSpan.textContent = 'Guided Sections';
                // Show warning if there are field notes
                if (report.fieldNotes?.freeformNotes?.trim()) {
                    warning.classList.remove('hidden');
                } else {
                    warning.classList.add('hidden');
                }
            } else {
                targetSpan.textContent = 'Quick Notes';
                warning.classList.add('hidden');
            }

            modal.classList.remove('hidden');
        }

        /**
         * Close the switch mode confirmation modal
         */
        function closeSwitchModeModal() {
            document.getElementById('switchModeModal').classList.add('hidden');
        }

        /**
         * Confirm switching modes
         */
        function confirmSwitchMode() {
            const currentMode = report.meta?.captureMode;
            const newMode = currentMode === 'minimal' ? 'guided' : 'minimal';

            // Preserve data when switching
            if (currentMode === 'minimal' && newMode === 'guided') {
                // Move field notes to additionalNotes if not empty
                if (report.fieldNotes?.freeformNotes?.trim()) {
                    const existingNotes = report.additionalNotes?.trim() || '';
                    const fieldNotes = report.fieldNotes.freeformNotes.trim();
                    report.additionalNotes = existingNotes
                        ? `${existingNotes}\n\n--- Field Notes ---\n${fieldNotes}`
                        : fieldNotes;
                }
            }

            // Photos and weather are always preserved (shared between modes)

            report.meta.captureMode = newMode;
            saveReport();
            closeSwitchModeModal();
            showModeUI(newMode);
        }

        // ============ MINIMAL MODE UI ============
        /**
         * Initialize the minimal mode UI
         */
        function initMinimalModeUI() {
            // Set date
            const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            document.getElementById('minimalCurrentDate').textContent = dateStr;

            // Load field notes
            const notesInput = document.getElementById('freeform-notes-input');
            if (notesInput) {
                notesInput.value = report.fieldNotes?.freeformNotes || '';
                autoExpandFieldNotes(notesInput);
                updateFieldNotesCharCount();
            }

            // Update weather display
            updateMinimalWeatherDisplay();

            // Render photos
            renderMinimalPhotos();

            // Setup photo input handler
            const photoInput = document.getElementById('minimalPhotoInput');
            if (photoInput) {
                photoInput.addEventListener('change', handleMinimalPhotoInput);
            }
        }

        /**
         * Initialize the guided mode UI (existing functionality)
         */
        function initGuidedModeUI() {
            // Set date
            const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            document.getElementById('currentDate').textContent = dateStr;

            renderAllSections();
            updateAllPreviews();
            updateProgress();
            updateNAButtons();

            // Populate simplified guided mode fields
            const workSummaryInput = document.getElementById('work-summary-input');
            if (workSummaryInput) {
                workSummaryInput.value = report.guidedNotes?.workSummary || '';
            }

            // Safety checkboxes
            document.getElementById('no-incidents').checked = report.safety?.noIncidents || false;
            document.getElementById('has-incidents').checked = report.safety?.hasIncidents || false;

            // Initialize auto-expand for all textareas
            initAllAutoExpandTextareas();
        }

        /**
         * Auto-expand the field notes textarea (uses shared autoExpand with page-specific dimensions)
         */
        function autoExpandFieldNotes(textarea) {
            autoExpand(textarea, 200, Math.round(window.innerHeight * 0.6));
        }

        /**
         * Update field notes in the report
         */
        function updateFieldNotes(value) {
            if (!report.fieldNotes) report.fieldNotes = { freeformNotes: "" };
            report.fieldNotes.freeformNotes = value;
            saveReport();
            updateFieldNotesCharCount();
        }

        /**
         * Update the character count display for field notes
         */
        function updateFieldNotesCharCount() {
            const charCount = document.getElementById('fieldNotesCharCount');
            const notes = report.fieldNotes?.freeformNotes || '';
            const len = notes.length;
            if (len > 0) {
                charCount.textContent = `${len.toLocaleString()} characters`;
            } else {
                charCount.textContent = '';
            }
        }

        /**
         * Update work summary in guided mode (simplified single textarea)
         */
        function updateWorkSummary(value) {
            if (!report.guidedNotes) report.guidedNotes = { workSummary: "" };
            report.guidedNotes.workSummary = value;
            saveReport();
            updateActivitiesPreview();
        }

        /**
         * Update the activities section preview based on work summary
         */
        function updateActivitiesPreview() {
            const preview = document.getElementById('activities-preview');
            const status = document.getElementById('activities-status');
            const workSummary = report.guidedNotes?.workSummary || '';

            if (workSummary.trim()) {
                // Truncate for preview
                const truncated = workSummary.length > 40 ? workSummary.substring(0, 40) + '...' : workSummary;
                preview.textContent = truncated;
                status.innerHTML = '<i class="fas fa-check text-safety-green text-xs"></i>';
            } else {
                preview.textContent = 'Tap to add';
                status.innerHTML = '<i class="fas fa-chevron-down text-slate-400 text-xs"></i>';
            }
        }

        /**
         * Update the weather display in minimal mode
         */
        function updateMinimalWeatherDisplay() {
            const weather = report.overview?.weather;
            if (!weather) return;

            const conditionEl = document.getElementById('minimalWeatherCondition');
            const tempEl = document.getElementById('minimalWeatherTemp');
            const precipEl = document.getElementById('minimalWeatherPrecip');
            const iconEl = document.getElementById('minimalWeatherIcon');

            if (conditionEl) conditionEl.textContent = weather.generalCondition || '--';
            if (tempEl) {
                const high = weather.highTemp || '--';
                const low = weather.lowTemp || '--';
                tempEl.textContent = `${high}° / ${low}°`;
            }
            if (precipEl) precipEl.textContent = `Precip: ${weather.precipitation || '--'}`;

            // Update icon based on condition
            if (iconEl) {
                const condition = (weather.generalCondition || '').toLowerCase();
                let iconClass = 'fa-cloud-sun';
                if (condition.includes('rain') || condition.includes('shower')) iconClass = 'fa-cloud-rain';
                else if (condition.includes('cloud')) iconClass = 'fa-cloud';
                else if (condition.includes('sun') || condition.includes('clear')) iconClass = 'fa-sun';
                else if (condition.includes('snow')) iconClass = 'fa-snowflake';
                else if (condition.includes('storm') || condition.includes('thunder')) iconClass = 'fa-bolt';
                iconEl.className = `fas ${iconClass} text-white`;
            }
        }

        /**
         * Render photos in minimal mode
         */
        function renderMinimalPhotos() {
            const grid = document.getElementById('minimalPhotosGrid');
            const countEl = document.getElementById('minimalPhotosCount');

            if (!grid) return;

            const photos = report.photos || [];
            countEl.textContent = photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'No photos yet';

            if (photos.length === 0) {
                grid.innerHTML = '';
                return;
            }

            grid.innerHTML = photos.map((p, idx) => `
                <div class="relative aspect-square bg-slate-200 overflow-hidden">
                    <img src="${p.url}" class="w-full h-full object-cover">
                    <button onclick="deleteMinimalPhoto(${idx})" class="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white flex items-center justify-center hover:bg-red-700">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            `).join('');
        }

        /**
         * Handle photo input in minimal mode
         */
        async function handleMinimalPhotoInput(e) {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            for (const file of files) {
                try {
                    showToast('Processing photo...', 'info');

                    // Get GPS if available (using multi-reading high accuracy)
                    let gps = null;
                    try {
                        gps = await getHighAccuracyGPS(true);
                    } catch (e) {
                        console.warn('[PHOTO] GPS failed:', e);
                    }

                    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const now = new Date();

                    // Compress image before uploading
                    const rawDataUrl = await readFileAsDataURL(file);
                    const compressedDataUrl = await compressImage(rawDataUrl, 1200, 0.7);
                    const compressedBlob = await dataURLtoBlob(compressedDataUrl);

                    // Upload to Supabase Storage
                    showToast('Uploading photo...', 'info');
                    const { storagePath, publicUrl } = await uploadPhotoToSupabase(compressedBlob, photoId);

                    const photoObj = {
                        id: photoId,
                        url: publicUrl,
                        storagePath: storagePath,
                        caption: '',
                        timestamp: now.toISOString(),
                        date: now.toLocaleDateString(),
                        time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                        gps: gps,
                        fileName: file.name
                    };

                    report.photos.push(photoObj);

                    // Save photo metadata to Supabase
                    await savePhotoMetadata(photoObj);

                    renderMinimalPhotos();
                    showToast('Photo uploaded', 'success');
                } catch (err) {
                    console.error('Error adding photo:', err);
                    showToast('Failed to add photo', 'error');
                }
            }

            // Reset input
            e.target.value = '';
        }

        // readFileAsDataURL() and dataURLtoBlob() moved to /js/media-utils.js

        /**
         * Delete a photo in minimal mode
         */
        async function deleteMinimalPhoto(idx) {
            if (!confirm('Delete this photo?')) return;

            const photo = report.photos[idx];
            if (photo) {
                await deletePhotoFromSupabase(photo.id, photo.storagePath);
            }

            report.photos.splice(idx, 1);
            saveReport();
            renderMinimalPhotos();
        }

        // ============ AI PROCESSING WEBHOOK ============
        const N8N_PROCESS_WEBHOOK = 'https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6';

        /**
         * Build the payload for AI processing
         */
        function buildProcessPayload() {
            const todayStr = new Date().toISOString().split('T')[0];
            const reportKey = getReportKey(activeProject?.id, todayStr);

            return {
                reportId: reportKey,
                captureMode: report.meta.captureMode || 'guided',

                projectContext: {
                    projectId: activeProject?.id || null,
                    projectName: activeProject?.name || report.project?.name || '',
                    noabProjectNo: activeProject?.noabProjectNo || '',
                    location: activeProject?.location || '',
                    engineer: activeProject?.engineer || '',
                    primeContractor: activeProject?.primeContractor || '',
                    contractors: activeProject?.contractors || [],
                    equipment: activeProject?.equipment || []
                },

                fieldNotes: report.meta.captureMode === 'minimal'
                    ? { freeformNotes: report.fieldNotes?.freeformNotes || '' }
                    : {
                        workSummary: report.guidedNotes?.workSummary || '',
                        issues: report.guidedNotes?.issues || '',
                        safety: report.guidedNotes?.safety || ''
                      },

                weather: report.overview?.weather || {},

                photos: (report.photos || []).map(p => ({
                    id: p.id,
                    caption: p.caption || '',
                    timestamp: p.timestamp,
                    date: p.date,
                    time: p.time,
                    gps: p.gps
                })),

                reportDate: report.overview?.date || new Date().toLocaleDateString(),
                inspectorName: report.overview?.completedBy || ''
            };
        }

        /**
         * Call the AI processing webhook
         */
        async function callProcessWebhook(payload) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            try {
                const response = await fetch(N8N_PROCESS_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Webhook failed: ${response.status}`);
                }

                const data = await response.json();

                // Validate response structure
                if (!data.success && !data.aiGenerated) {
                    console.error('Invalid webhook response:', data);
                    throw new Error('Invalid response from AI processing');
                }

                // If aiGenerated is a string, try to parse it
                if (typeof data.aiGenerated === 'string') {
                    try {
                        data.aiGenerated = JSON.parse(data.aiGenerated);
                    } catch (e) {
                        console.error('Failed to parse aiGenerated string:', e);
                    }
                }

                // Validate required fields in AI response
                const ai = data.aiGenerated;
                if (ai) {
                    // Ensure arrays exist
                    ai.activities = ai.activities || [];
                    ai.operations = ai.operations || [];
                    ai.equipment = ai.equipment || [];
                    ai.generalIssues = ai.generalIssues || [];
                    ai.qaqcNotes = ai.qaqcNotes || [];
                    ai.safety = ai.safety || { hasIncidents: false, noIncidents: true, notes: '' };
                }

                // Log the AI response for debugging
                console.log('[AI] Received response:', JSON.stringify(data.aiGenerated, null, 2));

                return data;
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }

        /**
         * Save AI request to Supabase
         */
        async function saveAIRequest(payload) {
            if (!currentReportId) return;

            try {
                const requestData = {
                    report_id: currentReportId,
                    request_payload: payload,
                    sent_at: new Date().toISOString()
                };

                const { error } = await supabaseClient
                    .from('report_ai_request')
                    .insert(requestData);

                if (error) {
                    console.error('Error saving AI request:', error);
                }
            } catch (err) {
                console.error('Failed to save AI request:', err);
            }
        }

        /**
         * Save AI response to Supabase
         */
        async function saveAIResponse(response, processingTimeMs) {
            if (!currentReportId) return;

            try {
                const responseData = {
                    report_id: currentReportId,
                    response_payload: response,
                    model_used: 'n8n-fieldvoice-refine',
                    processing_time_ms: processingTimeMs,
                    received_at: new Date().toISOString()
                };

                // Use upsert to handle retries/reprocessing - prevents duplicate rows
                const { error } = await supabaseClient
                    .from('report_ai_response')
                    .upsert(responseData, { onConflict: 'report_id' });

                if (error) {
                    console.error('Error saving AI response:', error);
                }
            } catch (err) {
                console.error('Failed to save AI response:', err);
            }
        }

        /**
         * Handle offline/error scenario for AI processing
         * v6: Uses addToSyncQueue() from storage-keys.js for offline queue
         */
        function handleOfflineProcessing(payload, redirectToDrafts = false) {
            const activeProjectId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
            const todayStr = getTodayDateString();

            // v6: Use addToSyncQueue for offline operations
            const syncOperation = {
                type: 'report',
                action: 'upsert',
                data: {
                    projectId: activeProjectId,
                    projectName: report.overview?.projectName || activeProject?.name || 'Unknown Project',
                    reportDate: todayStr,
                    captureMode: report.meta?.captureMode || 'guided',
                    payload: payload,
                    reportData: {
                        meta: report.meta,
                        overview: report.overview,
                        weather: report.overview?.weather,
                        guidedNotes: report.guidedNotes,
                        fieldNotes: report.fieldNotes,
                        activities: report.activities,
                        operations: report.operations,
                        equipment: report.equipment,
                        photos: report.photos,
                        safety: report.safety,
                        generalIssues: report.generalIssues,
                        qaqcNotes: report.qaqcNotes,
                        contractorCommunications: report.contractorCommunications,
                        visitorsRemarks: report.visitorsRemarks,
                        additionalNotes: report.additionalNotes,
                        reporter: report.reporter
                    }
                },
                timestamp: Date.now()
            };

            // v6: Add to sync queue using storage-keys.js helper
            addToSyncQueue(syncOperation);
            console.log('[OFFLINE] Report added to sync queue');

            // Also update local meta status
            report.meta.status = 'pending_refine';
            saveReport();

            showToast("You're offline. Report saved to drafts.", 'warning');

            // Redirect to drafts page if requested
            if (redirectToDrafts) {
                window.location.href = 'drafts.html';
            }
        }

        /**
         * Finish the minimal mode report with AI processing
         */
        async function finishMinimalReport() {
            // Validate
            const freeformNotes = report.fieldNotes?.freeformNotes?.trim();
            if (!freeformNotes) {
                showToast('Field notes are required', 'error');
                document.getElementById('minimalNotesInput')?.focus();
                return;
            }

            // Get button reference for loading state
            const finishBtn = document.querySelector('#minimalModeScreen button[onclick="finishMinimalReport()"]');
            const originalBtnHtml = finishBtn ? finishBtn.innerHTML : '';

            // Show loading state
            if (finishBtn) {
                finishBtn.disabled = true;
                finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing with AI...';
            }
            showToast('Processing with AI...', 'info');

            // Mark as interview completed
            report.meta.interviewCompleted = true;
            report.overview.endTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            // Ensure report is saved to Supabase first
            await saveReportToSupabase();

            // Build payload
            const payload = buildProcessPayload();

            // Check if online
            if (!navigator.onLine) {
                handleOfflineProcessing(payload, true);
                return;
            }

            // Save AI request to Supabase
            await saveAIRequest(payload);

            const startTime = Date.now();

            // Call webhook
            try {
                const result = await callProcessWebhook(payload);
                const processingTime = Date.now() - startTime;

                // Save AI response to Supabase
                await saveAIResponse(result.aiGenerated, processingTime);

                // Save AI response to local report
                if (result.aiGenerated) {
                    report.aiGenerated = result.aiGenerated;

                    // Cache AI response to localStorage for immediate availability on report.html
                    const todayStr = new Date().toISOString().split('T')[0];
                    try {
                        localStorage.setItem(`fvp_ai_response_${currentReportId}`, JSON.stringify({
                            reportId: currentReportId,
                            reportDate: todayStr,
                            aiGenerated: result.aiGenerated,
                            cachedAt: new Date().toISOString()
                        }));
                        console.log('[CACHE] AI response cached to localStorage');
                    } catch (e) {
                        console.warn('[CACHE] Failed to cache AI response:', e);
                    }
                }
                report.meta.status = 'refined';
                await saveReportToSupabase();

                // Clear localStorage draft - report is now saved and refined
                clearLocalStorageDraft();

                // Navigate to report with date and reportId parameters
                const todayStr = new Date().toISOString().split('T')[0];
                window.location.href = `report.html?date=${todayStr}&reportId=${currentReportId}`;
            } catch (error) {
                console.error('AI processing failed:', error);

                // Restore button state
                if (finishBtn) {
                    finishBtn.disabled = false;
                    finishBtn.innerHTML = originalBtnHtml;
                }

                // Handle as offline - save to drafts queue and redirect
                handleOfflineProcessing(payload, true);
            }
        }

        // ============ PROJECT & CONTRACTOR LOADING ============
        async function loadActiveProject() {
            // v6: Use getStorageItem with STORAGE_KEYS.ACTIVE_PROJECT_ID
            const activeId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
            if (!activeId) {
                activeProject = null;
                projectContractors = [];
                return null;
            }

            try {
                // Fetch project from Supabase
                const { data: projectRow, error: projectError } = await supabaseClient
                    .from('projects')
                    .select('*')
                    .eq('id', activeId)
                    .single();

                if (projectError || !projectRow) {
                    console.error('Failed to load project from Supabase:', projectError);
                    activeProject = null;
                    projectContractors = [];
                    return null;
                }

                activeProject = fromSupabaseProject(projectRow);

                // Fetch contractors for this project
                const { data: contractorRows, error: contractorError } = await supabaseClient
                    .from('contractors')
                    .select('*')
                    .eq('project_id', activeId);

                if (!contractorError && contractorRows) {
                    activeProject.contractors = contractorRows.map(fromSupabaseContractor);
                    // Sort: prime contractors first, then subcontractors
                    projectContractors = [...activeProject.contractors].sort((a, b) => {
                        if (a.type === 'prime' && b.type !== 'prime') return -1;
                        if (a.type !== 'prime' && b.type === 'prime') return 1;
                        return 0;
                    });
                } else {
                    projectContractors = [];
                }

                // v6: Equipment is now entered per-report, not loaded from project
                // Equipment functions removed - see renderEquipmentInput() for per-report entry
                activeProject.equipment = [];

                return activeProject;
            } catch (e) {
                console.error('Failed to load project:', e);
                activeProject = null;
                projectContractors = [];
                return null;
            }
        }

        async function loadUserSettings() {
            try {
                const { data, error } = await supabaseClient
                    .from('user_profiles')
                    .select('*')
                    .limit(1)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Failed to load user settings:', error);
                    return null;
                }

                if (data) {
                    userSettings = {
                        id: data.id,
                        full_name: data.full_name || '',
                        title: data.title || '',
                        company: data.company || '',
                        email: data.email || '',
                        phone: data.phone || ''
                    };
                    return userSettings;
                }
                return null;
            } catch (e) {
                console.error('Failed to load user settings:', e);
                return null;
            }
        }

        function getTodayDateFormatted() {
            return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }

        function getContractorActivity(contractorId) {
            if (!report || !report.activities) return null;
            return report.activities.find(a => a.contractorId === contractorId);
        }

        function initializeContractorActivities() {
            if (!report.activities) report.activities = [];

            // Ensure each contractor has an activity entry
            projectContractors.forEach(contractor => {
                const existing = report.activities.find(a => a.contractorId === contractor.id);
                if (!existing) {
                    report.activities.push({
                        contractorId: contractor.id,
                        noWork: true,
                        narrative: '',
                        equipmentUsed: '',
                        crew: ''
                    });
                }
            });
        }

        function renderContractorWorkCards() {
            const container = document.getElementById('contractor-work-list');
            const warningEl = document.getElementById('no-project-warning');

            if (!activeProject || projectContractors.length === 0) {
                warningEl.classList.remove('hidden');
                container.innerHTML = '';
                return;
            }

            warningEl.classList.add('hidden');
            initializeContractorActivities();

            const todayDate = getTodayDateFormatted();

            container.innerHTML = projectContractors.map((contractor, index) => {
                const activity = getContractorActivity(contractor.id) || { noWork: true, narrative: '', equipmentUsed: '', crew: '' };
                const isExpanded = !activity.noWork || activity.narrative;
                const typeLabel = contractor.type === 'prime' ? 'PRIME' : 'SUBCONTRACTOR';
                const tradesText = contractor.trades ? ` (${contractor.trades.toUpperCase()})` : '';
                const headerText = `${contractor.name.toUpperCase()} – ${typeLabel}${tradesText}`;
                const borderColor = contractor.type === 'prime' ? 'border-safety-green' : 'border-dot-blue';
                const bgColor = contractor.type === 'prime' ? 'bg-safety-green' : 'bg-dot-blue';

                return `
                    <div class="contractor-work-card border-2 ${activity.noWork && !activity.narrative ? 'border-slate-200' : borderColor}" data-contractor-id="${contractor.id}">
                        <!-- Header -->
                        <button onclick="toggleContractorCard('${contractor.id}')" class="w-full p-3 flex items-center gap-3 text-left ${activity.noWork && !activity.narrative ? 'bg-slate-50' : bgColor + '/10'}">
                            <div class="w-8 h-8 ${activity.noWork && !activity.narrative ? 'bg-slate-300' : bgColor} flex items-center justify-center shrink-0">
                                <i class="fas ${activity.noWork && !activity.narrative ? 'fa-minus' : 'fa-hard-hat'} text-white text-sm"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold ${activity.noWork && !activity.narrative ? 'text-slate-500' : (contractor.type === 'prime' ? 'text-safety-green' : 'text-dot-blue')} uppercase leading-tight truncate">${escapeHtml(headerText)}</p>
                                <p class="text-[10px] text-slate-500 mt-0.5">
                                    ${activity.noWork && !activity.narrative ? 'No work performed' : (activity.narrative ? 'Work logged' : 'Tap to add work')}
                                </p>
                            </div>
                            <i id="contractor-chevron-${contractor.id}" class="fas fa-chevron-down text-slate-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}"></i>
                        </button>

                        <!-- Expandable Content -->
                        <div id="contractor-content-${contractor.id}" class="contractor-content ${isExpanded ? '' : 'hidden'} border-t border-slate-200 p-3 space-y-3">
                            <!-- No Work Toggle -->
                            <label class="flex items-center gap-3 p-3 bg-slate-100 border border-slate-300 cursor-pointer hover:bg-slate-200 transition-colors">
                                <input type="checkbox"
                                    id="no-work-${contractor.id}"
                                    ${activity.noWork ? 'checked' : ''}
                                    onchange="toggleNoWork('${contractor.id}', this.checked)"
                                    class="w-5 h-5 accent-slate-600">
                                <span class="text-sm font-medium text-slate-600">No work performed on ${todayDate}</span>
                            </label>

                            <!-- Work Entry Fields (hidden when no work checked) -->
                            <div id="work-fields-${contractor.id}" class="${activity.noWork ? 'hidden' : ''}">
                                <!-- Narrative -->
                                <div class="mb-3">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Work Narrative</label>
                                    <textarea
                                        id="narrative-${contractor.id}"
                                        class="w-full mt-2 bg-white border-2 border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-dot-blue auto-expand"
                                        rows="3"
                                        placeholder="Describe work performed by ${contractor.name}..."
                                        onchange="updateContractorWork('${contractor.id}')"
                                    >${escapeHtml(activity.narrative)}</textarea>
                                </div>

                                <!-- Equipment Used -->
                                <div class="mb-3">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Equipment Used</label>
                                    <input
                                        type="text"
                                        id="equipment-${contractor.id}"
                                        class="w-full mt-2 bg-white border-2 border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-dot-blue"
                                        placeholder="e.g., JOHN DEERE 550K GP BULLDOZER (1)"
                                        value="${escapeHtml(activity.equipmentUsed)}"
                                        onchange="updateContractorWork('${contractor.id}')"
                                    >
                                    <p class="text-xs text-slate-400 mt-1">Format: EQUIPMENT TYPE (QTY)</p>
                                </div>

                                <!-- Crew -->
                                <div>
                                    <label class="text-xs font-bold text-slate-500 uppercase">Crew</label>
                                    <input
                                        type="text"
                                        id="crew-${contractor.id}"
                                        class="w-full mt-2 bg-white border-2 border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-dot-blue"
                                        placeholder="e.g., SUPERINTENDENT (1); FOREMAN (3); OPERATORS (4)"
                                        value="${escapeHtml(activity.crew)}"
                                        onchange="updateContractorWork('${contractor.id}')"
                                    >
                                    <p class="text-xs text-slate-400 mt-1">Format: ROLE (QTY); separated by semicolons</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Initialize auto-expand for dynamically created textareas
            initAllAutoExpandTextareas();
        }

        function toggleContractorCard(contractorId) {
            const content = document.getElementById(`contractor-content-${contractorId}`);
            const chevron = document.getElementById(`contractor-chevron-${contractorId}`);

            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
                chevron.classList.add('rotate-180');
            } else {
                content.classList.add('hidden');
                chevron.classList.remove('rotate-180');
            }
        }

        function toggleNoWork(contractorId, isNoWork) {
            const activity = report.activities.find(a => a.contractorId === contractorId);
            if (!activity) return;

            activity.noWork = isNoWork;

            const workFields = document.getElementById(`work-fields-${contractorId}`);
            if (isNoWork) {
                workFields.classList.add('hidden');
                // Clear work fields when marking no work
                activity.narrative = '';
                activity.equipmentUsed = '';
                activity.crew = '';
            } else {
                workFields.classList.remove('hidden');
                // Focus the narrative field
                setTimeout(() => {
                    document.getElementById(`narrative-${contractorId}`)?.focus();
                }, 100);
            }

            saveReport();
            updateContractorCardStyle(contractorId);
            updateAllPreviews();
        }

        function updateContractorWork(contractorId) {
            const activity = report.activities.find(a => a.contractorId === contractorId);
            if (!activity) return;

            const narrative = document.getElementById(`narrative-${contractorId}`)?.value.trim() || '';
            const equipment = document.getElementById(`equipment-${contractorId}`)?.value.trim() || '';
            const crew = document.getElementById(`crew-${contractorId}`)?.value.trim() || '';

            activity.narrative = narrative;
            activity.equipmentUsed = equipment;
            activity.crew = crew;

            // If user entered work, uncheck "no work"
            if (narrative || equipment || crew) {
                activity.noWork = false;
                const checkbox = document.getElementById(`no-work-${contractorId}`);
                if (checkbox) checkbox.checked = false;
            }

            saveReport();
            updateContractorCardStyle(contractorId);
            updateAllPreviews();
        }

        function updateContractorCardStyle(contractorId) {
            const activity = report.activities.find(a => a.contractorId === contractorId);
            const contractor = projectContractors.find(c => c.id === contractorId);
            if (!activity || !contractor) return;

            const card = document.querySelector(`[data-contractor-id="${contractorId}"]`);
            if (!card) return;

            const hasWork = !activity.noWork || activity.narrative;
            const borderColor = contractor.type === 'prime' ? 'border-safety-green' : 'border-dot-blue';
            const bgColor = contractor.type === 'prime' ? 'bg-safety-green' : 'bg-dot-blue';

            // Update border
            card.classList.remove('border-slate-200', 'border-safety-green', 'border-dot-blue');
            card.classList.add(hasWork ? borderColor : 'border-slate-200');

            // Update header background
            const header = card.querySelector('button');
            header.classList.remove('bg-slate-50', 'bg-safety-green/10', 'bg-dot-blue/10');
            header.classList.add(hasWork ? bgColor + '/10' : 'bg-slate-50');

            // Update icon
            const iconDiv = header.querySelector('div');
            iconDiv.classList.remove('bg-slate-300', 'bg-safety-green', 'bg-dot-blue');
            iconDiv.classList.add(hasWork ? bgColor : 'bg-slate-300');

            const icon = iconDiv.querySelector('i');
            icon.classList.remove('fa-minus', 'fa-hard-hat');
            icon.classList.add(hasWork ? 'fa-hard-hat' : 'fa-minus');

            // Update text color
            const titleP = header.querySelectorAll('p')[0];
            titleP.classList.remove('text-slate-500', 'text-safety-green', 'text-dot-blue');
            titleP.classList.add(hasWork ? (contractor.type === 'prime' ? 'text-safety-green' : 'text-dot-blue') : 'text-slate-500');

            // Update subtitle
            const subtitleP = header.querySelectorAll('p')[1];
            subtitleP.textContent = activity.noWork && !activity.narrative ? 'No work performed' : (activity.narrative ? 'Work logged' : 'Tap to add work');
        }

        function getWorkSummaryPreview() {
            if (!report || !report.activities || !projectContractors.length) {
                return 'Tap to add';
            }

            const withWork = report.activities.filter(a => !a.noWork || a.narrative);
            const noWork = report.activities.filter(a => a.noWork && !a.narrative);

            if (withWork.length === 0) {
                return noWork.length > 0 ? `${noWork.length} contractors - no work` : 'Tap to add';
            }

            return `${withWork.length} working, ${noWork.length} idle`;
        }

        // ============ PERSONNEL / OPERATIONS ============
        function getTradeAbbreviation(trades) {
            if (!trades) return '';
            // Common trade abbreviations
            const abbreviations = {
                'pile driving': 'PLE',
                'piling': 'PLE',
                'concrete': 'CONC',
                'concrete pvmt': 'CONC',
                'asphalt': 'ASP',
                'utilities': 'UTL',
                'earthwork': 'ERTHWRK',
                'grading': 'GRAD',
                'demolition': 'DEMO',
                'demo': 'DEMO',
                'electrical': 'ELEC',
                'plumbing': 'PLMB',
                'mechanical': 'MECH',
                'structural': 'STRUC',
                'steel': 'STL',
                'masonry': 'MASN',
                'roofing': 'ROOF',
                'painting': 'PAINT',
                'landscaping': 'LNDSCP',
                'survey': 'SURV',
                'surveying': 'SURV',
                'traffic': 'TRAF',
                'signage': 'SIGN',
                'drainage': 'DRAIN',
                'cm/pm': 'CM/PM',
                'general': 'GEN'
            };

            // Split by semicolon and abbreviate each trade
            return trades.split(';').map(trade => {
                const trimmed = trade.trim().toLowerCase();
                // Check if we have a known abbreviation
                for (const [key, abbr] of Object.entries(abbreviations)) {
                    if (trimmed.includes(key)) {
                        return abbr;
                    }
                }
                // If no match, use first 4 chars uppercase
                return trimmed.substring(0, 4).toUpperCase();
            }).join('; ');
        }

        function getContractorOperations(contractorId) {
            if (!report || !report.operations) return null;
            return report.operations.find(o => o.contractorId === contractorId);
        }

        function initializeOperations() {
            if (!report.operations) report.operations = [];

            // Ensure each contractor has an operations entry
            projectContractors.forEach(contractor => {
                const existing = report.operations.find(o => o.contractorId === contractor.id);
                if (!existing) {
                    report.operations.push({
                        contractorId: contractor.id,
                        superintendents: null,
                        foremen: null,
                        operators: null,
                        laborers: null,
                        surveyors: null,
                        others: null
                    });
                }
            });
        }

        function renderPersonnelCards() {
            const container = document.getElementById('personnel-list');
            const warningEl = document.getElementById('no-project-warning-ops');
            const totalsEl = document.getElementById('personnel-totals');

            if (!activeProject || projectContractors.length === 0) {
                warningEl.classList.remove('hidden');
                totalsEl.classList.add('hidden');
                container.innerHTML = '';
                return;
            }

            warningEl.classList.add('hidden');
            totalsEl.classList.remove('hidden');
            initializeOperations();

            container.innerHTML = projectContractors.map((contractor) => {
                const ops = getContractorOperations(contractor.id) || {
                    superintendents: null, foremen: null, operators: null,
                    laborers: null, surveyors: null, others: null
                };
                const typeLabel = contractor.type === 'prime' ? 'PRIME' : 'SUB';
                const borderColor = contractor.type === 'prime' ? 'border-l-safety-green' : 'border-l-dot-blue';
                const headerBg = contractor.type === 'prime' ? 'bg-safety-green/10' : 'bg-dot-blue/10';
                const titleColor = contractor.type === 'prime' ? 'text-safety-green' : 'text-dot-blue';

                // Check if contractor has any personnel data
                const hasData = (ops.superintendents > 0) || (ops.foremen > 0) || (ops.operators > 0) ||
                               (ops.laborers > 0) || (ops.surveyors > 0) || (ops.others > 0);
                const totalPersonnel = (ops.superintendents || 0) + (ops.foremen || 0) + (ops.operators || 0) +
                                      (ops.laborers || 0) + (ops.surveyors || 0) + (ops.others || 0);
                const summaryText = hasData ? `${totalPersonnel} personnel` : 'Tap to add';

                return `
                    <div class="personnel-card bg-white border-2 ${hasData ? borderColor.replace('border-l-', 'border-') : 'border-slate-200'} ${borderColor} border-l-4" data-ops-contractor-id="${contractor.id}">
                        <!-- Card Header - Tap to expand -->
                        <button onclick="togglePersonnelCard('${contractor.id}')" class="w-full p-3 flex items-center gap-3 text-left ${hasData ? headerBg : 'bg-slate-50'}">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg font-bold ${hasData ? titleColor : 'text-slate-600'}">${escapeHtml(contractor.abbreviation)}</span>
                                    <span class="text-[10px] font-medium text-slate-400 uppercase">${typeLabel}</span>
                                </div>
                                <p class="text-xs text-slate-500 truncate">${escapeHtml(contractor.name)}${contractor.trades ? ' • ' + escapeHtml(contractor.trades) : ''}</p>
                                <p class="text-[10px] ${hasData ? titleColor : 'text-slate-400'} mt-1">${summaryText}</p>
                            </div>
                            <i id="personnel-chevron-${contractor.id}" class="fas fa-chevron-down personnel-card-chevron text-slate-400 text-xs"></i>
                        </button>

                        <!-- Expandable Content -->
                        <div class="personnel-card-content">
                            <div class="p-3 border-t border-slate-200 bg-slate-50/50">
                                <!-- 2-column, 3-row grid for role inputs -->
                                <div class="grid grid-cols-2 gap-3">
                                    <!-- Row 1: Superintendent, Foreman -->
                                    <div>
                                        <label class="text-xs font-bold text-slate-500 uppercase block mb-1">Superintendent</label>
                                        <input type="number" min="0" max="99"
                                            id="ops-supt-${contractor.id}"
                                            value="${ops.superintendents || ''}"
                                            onchange="updateOperations('${contractor.id}')"
                                            class="w-full h-10 text-center text-base font-medium border-2 border-slate-300 focus:border-dot-blue focus:outline-none bg-white"
                                            placeholder="0">
                                    </div>
                                    <div>
                                        <label class="text-xs font-bold text-slate-500 uppercase block mb-1">Foreman</label>
                                        <input type="number" min="0" max="99"
                                            id="ops-frmn-${contractor.id}"
                                            value="${ops.foremen || ''}"
                                            onchange="updateOperations('${contractor.id}')"
                                            class="w-full h-10 text-center text-base font-medium border-2 border-slate-300 focus:border-dot-blue focus:outline-none bg-white"
                                            placeholder="0">
                                    </div>
                                    <!-- Row 2: Operator, Laborer -->
                                    <div>
                                        <label class="text-xs font-bold text-slate-500 uppercase block mb-1">Operator</label>
                                        <input type="number" min="0" max="99"
                                            id="ops-oper-${contractor.id}"
                                            value="${ops.operators || ''}"
                                            onchange="updateOperations('${contractor.id}')"
                                            class="w-full h-10 text-center text-base font-medium border-2 border-slate-300 focus:border-dot-blue focus:outline-none bg-white"
                                            placeholder="0">
                                    </div>
                                    <div>
                                        <label class="text-xs font-bold text-slate-500 uppercase block mb-1">Laborer</label>
                                        <input type="number" min="0" max="99"
                                            id="ops-labr-${contractor.id}"
                                            value="${ops.laborers || ''}"
                                            onchange="updateOperations('${contractor.id}')"
                                            class="w-full h-10 text-center text-base font-medium border-2 border-slate-300 focus:border-dot-blue focus:outline-none bg-white"
                                            placeholder="0">
                                    </div>
                                    <!-- Row 3: Surveyor, Other -->
                                    <div>
                                        <label class="text-xs font-bold text-slate-500 uppercase block mb-1">Surveyor</label>
                                        <input type="number" min="0" max="99"
                                            id="ops-surv-${contractor.id}"
                                            value="${ops.surveyors || ''}"
                                            onchange="updateOperations('${contractor.id}')"
                                            class="w-full h-10 text-center text-base font-medium border-2 border-slate-300 focus:border-dot-blue focus:outline-none bg-white"
                                            placeholder="0">
                                    </div>
                                    <div>
                                        <label class="text-xs font-bold text-slate-500 uppercase block mb-1">Other</label>
                                        <input type="number" min="0" max="99"
                                            id="ops-othr-${contractor.id}"
                                            value="${ops.others || ''}"
                                            onchange="updateOperations('${contractor.id}')"
                                            class="w-full h-10 text-center text-base font-medium border-2 border-slate-300 focus:border-dot-blue focus:outline-none bg-white"
                                            placeholder="0">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            updatePersonnelTotals();
        }

        function togglePersonnelCard(contractorId) {
            const card = document.querySelector(`[data-ops-contractor-id="${contractorId}"]`);
            if (!card) return;

            card.classList.toggle('expanded');
        }

        function updateOperations(contractorId) {
            const ops = report.operations.find(o => o.contractorId === contractorId);
            if (!ops) return;

            const getValue = (id) => {
                const input = document.getElementById(id);
                if (!input) return null;
                const val = parseInt(input.value);
                return isNaN(val) ? null : val;
            };

            ops.superintendents = getValue(`ops-supt-${contractorId}`);
            ops.foremen = getValue(`ops-frmn-${contractorId}`);
            ops.operators = getValue(`ops-oper-${contractorId}`);
            ops.laborers = getValue(`ops-labr-${contractorId}`);
            ops.surveyors = getValue(`ops-surv-${contractorId}`);
            ops.others = getValue(`ops-othr-${contractorId}`);

            saveReport();
            updatePersonnelTotals();
            updatePersonnelCardStyle(contractorId);
            updateAllPreviews();
        }

        function updatePersonnelCardStyle(contractorId) {
            const ops = report.operations.find(o => o.contractorId === contractorId);
            const contractor = projectContractors.find(c => c.id === contractorId);
            if (!ops || !contractor) return;

            const card = document.querySelector(`[data-ops-contractor-id="${contractorId}"]`);
            if (!card) return;

            const hasData = (ops.superintendents > 0) || (ops.foremen > 0) || (ops.operators > 0) ||
                           (ops.laborers > 0) || (ops.surveyors > 0) || (ops.others > 0);
            const totalPersonnel = (ops.superintendents || 0) + (ops.foremen || 0) + (ops.operators || 0) +
                                  (ops.laborers || 0) + (ops.surveyors || 0) + (ops.others || 0);

            const borderColor = contractor.type === 'prime' ? 'border-safety-green' : 'border-dot-blue';
            const headerBg = contractor.type === 'prime' ? 'bg-safety-green/10' : 'bg-dot-blue/10';
            const titleColor = contractor.type === 'prime' ? 'text-safety-green' : 'text-dot-blue';

            // Update card border
            card.classList.remove('border-slate-200', 'border-safety-green', 'border-dot-blue');
            card.classList.add(hasData ? borderColor : 'border-slate-200');

            // Update header
            const header = card.querySelector('button');
            header.classList.remove('bg-slate-50', 'bg-safety-green/10', 'bg-dot-blue/10');
            header.classList.add(hasData ? headerBg : 'bg-slate-50');

            // Update abbreviation color
            const abbr = header.querySelector('span.text-lg');
            if (abbr) {
                abbr.classList.remove('text-slate-600', 'text-safety-green', 'text-dot-blue');
                abbr.classList.add(hasData ? titleColor : 'text-slate-600');
            }

            // Update summary text
            const summaryP = header.querySelector('p.text-\\[10px\\]');
            if (summaryP) {
                summaryP.textContent = hasData ? `${totalPersonnel} personnel` : 'Tap to add';
                summaryP.classList.remove('text-slate-400', 'text-safety-green', 'text-dot-blue');
                summaryP.classList.add(hasData ? titleColor : 'text-slate-400');
            }
        }

        function updatePersonnelTotals() {
            if (!report || !report.operations) return;

            let totals = {
                superintendents: 0,
                foremen: 0,
                operators: 0,
                laborers: 0,
                surveyors: 0,
                others: 0
            };

            report.operations.forEach(ops => {
                totals.superintendents += ops.superintendents || 0;
                totals.foremen += ops.foremen || 0;
                totals.operators += ops.operators || 0;
                totals.laborers += ops.laborers || 0;
                totals.surveyors += ops.surveyors || 0;
                totals.others += ops.others || 0;
            });

            const grandTotal = totals.superintendents + totals.foremen + totals.operators +
                              totals.laborers + totals.surveyors + totals.others;

            document.getElementById('total-supt').textContent = totals.superintendents || '-';
            document.getElementById('total-frmn').textContent = totals.foremen || '-';
            document.getElementById('total-oper').textContent = totals.operators || '-';
            document.getElementById('total-labr').textContent = totals.laborers || '-';
            document.getElementById('total-surv').textContent = totals.surveyors || '-';
            document.getElementById('total-othr').textContent = totals.others || '-';

            const grandTotalEl = document.getElementById('total-personnel');
            if (grandTotalEl) {
                grandTotalEl.textContent = grandTotal || '-';
            }
        }

        function getOperationsPreview() {
            if (!report || !report.operations || !projectContractors.length) {
                return 'Tap to add';
            }

            let totalPersonnel = 0;
            let contractorsWithPersonnel = 0;

            report.operations.forEach(ops => {
                const count = (ops.superintendents || 0) + (ops.foremen || 0) +
                              (ops.operators || 0) + (ops.laborers || 0) +
                              (ops.surveyors || 0) + (ops.others || 0);
                totalPersonnel += count;
                if (count > 0) contractorsWithPersonnel++;
            });

            if (totalPersonnel === 0) {
                return 'Tap to add';
            }

            return `${totalPersonnel} personnel from ${contractorsWithPersonnel} contractor${contractorsWithPersonnel !== 1 ? 's' : ''}`;
        }

        function hasOperationsData() {
            if (!report || !report.operations) return false;
            return report.operations.some(ops =>
                (ops.superintendents !== null && ops.superintendents > 0) ||
                (ops.foremen !== null && ops.foremen > 0) ||
                (ops.operators !== null && ops.operators > 0) ||
                (ops.laborers !== null && ops.laborers > 0) ||
                (ops.surveyors !== null && ops.surveyors > 0) ||
                (ops.others !== null && ops.others > 0)
            );
        }

        // ============ EQUIPMENT ============
        // v6: Equipment is now entered as text per-report, not loaded from project config
        // Old functions removed: getProjectEquipment, getEquipmentEntry, initializeEquipment,
        // updateEquipmentQuantity, updateEquipmentStatus, markAllEquipmentIdle, updateEquipmentTotals

        /**
         * v6: Render simple text-based equipment input
         * Equipment is entered fresh per-report instead of selecting from project config
         */
        function renderEquipmentCards() {
            const container = document.getElementById('equipment-list');
            if (!container) return;

            // v6: Equipment is entered fresh per-report
            container.innerHTML = `
                <div class="bg-white border-2 border-slate-200 p-4">
                    <label class="text-xs font-bold text-slate-500 uppercase">Equipment Used Today</label>
                    <textarea
                        id="equipment-input"
                        class="w-full mt-2 bg-white border-2 border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-dot-blue auto-expand"
                        rows="3"
                        placeholder="List equipment used today, e.g.:
- CAT 320 Excavator (2) - 8 hrs
- John Deere Dozer (1) - 6 hrs
- Concrete pump truck - 4 hrs"
                        oninput="updateEquipmentNotes(this.value)"
                    >${report.equipmentNotes || ''}</textarea>
                    <p class="text-xs text-slate-400 mt-1"><i class="fas fa-microphone mr-1"></i>Dictate or type</p>
                </div>
            `;

            // Hide v5 UI elements that are no longer used
            const warningEl = document.getElementById('no-project-warning-equip');
            const noEquipWarningEl = document.getElementById('no-equipment-warning');
            const totalsEl = document.getElementById('equipment-totals');
            const markAllBtn = document.getElementById('mark-all-idle-btn');

            if (warningEl) warningEl.classList.add('hidden');
            if (noEquipWarningEl) noEquipWarningEl.classList.add('hidden');
            if (totalsEl) totalsEl.classList.add('hidden');
            if (markAllBtn) markAllBtn.classList.add('hidden');
        }

        /**
         * v6: Update equipment notes from text input
         */
        function updateEquipmentNotes(value) {
            report.equipmentNotes = value;
            saveReport();
            updateEquipmentPreview();
        }

        /**
         * v6: Update equipment preview text
         */
        function updateEquipmentPreview() {
            const preview = document.getElementById('equipment-preview');
            if (!preview) return;
            const notes = report.equipmentNotes || '';
            preview.textContent = notes.trim() ? 'Equipment logged' : 'Tap to add';
        }

        /**
         * v6: Get equipment preview text for section card
         */
        function getEquipmentPreview() {
            const notes = report.equipmentNotes || '';
            return notes.trim() ? 'Equipment logged' : 'Tap to add';
        }

        /**
         * v6: Check if equipment data exists
         */
        function hasEquipmentData() {
            const notes = report.equipmentNotes || '';
            return notes.trim().length > 0;
        }

        // ============ STORAGE (SUPABASE) ============
        let saveReportTimeout = null;
        let isSaving = false;

        /**
         * Generate a report storage key (kept for legacy/reference)
         */
        function getReportKey(projectId, dateStr) {
            const date = dateStr || new Date().toISOString().split('T')[0];
            return projectId
                ? `fieldvoice_report_${projectId}_${date}`
                : `fieldvoice_report_${date}`;
        }

        function getTodayKey() {
            return getReportKey(activeProject?.id, null);
        }

        /**
         * Load report from Supabase
         */
        async function getReport() {
            // Clear any stale report ID before loading
            currentReportId = null;

            const todayStr = new Date().toISOString().split('T')[0];

            if (!activeProject) {
                return createFreshReport();
            }

            try {
                // Query for existing report for this project and date
                const { data: reportRow, error: reportError } = await supabaseClient
                    .from('reports')
                    .select('*')
                    .eq('project_id', activeProject.id)
                    .eq('report_date', todayStr)
                    .maybeSingle();

                if (reportError) {
                    console.error('Error fetching report:', reportError);
                    return createFreshReport();
                }

                if (!reportRow) {
                    return createFreshReport();
                }

                // If report was already submitted, create fresh
                if (reportRow.status === 'submitted') {
                    return createFreshReport();
                }

                // Store the report ID for updates
                currentReportId = reportRow.id;

                // Load raw capture data
                const { data: rawCapture } = await supabaseClient
                    .from('report_raw_capture')
                    .select('*')
                    .eq('report_id', reportRow.id)
                    .maybeSingle();

                // Load contractor work
                const { data: contractorWork } = await supabaseClient
                    .from('report_contractor_work')
                    .select('*')
                    .eq('report_id', reportRow.id);

                // Load personnel
                const { data: personnel } = await supabaseClient
                    .from('report_personnel')
                    .select('*')
                    .eq('report_id', reportRow.id);

                // Load equipment usage
                const { data: equipmentUsage } = await supabaseClient
                    .from('report_equipment_usage')
                    .select('*')
                    .eq('report_id', reportRow.id);

                // Load photos
                const { data: photos } = await supabaseClient
                    .from('report_photos')
                    .select('*')
                    .eq('report_id', reportRow.id)
                    .order('taken_at', { ascending: true });

                // Reconstruct the report object
                const reconstructedReport = reconstructReportFromSupabase(
                    reportRow, rawCapture, contractorWork, personnel, equipmentUsage, photos
                );

                return reconstructedReport;
            } catch (e) {
                console.error('Failed to load report from Supabase:', e);
                return createFreshReport();
            }
        }

        /**
         * Reconstruct report object from Supabase data
         */
        function reconstructReportFromSupabase(reportRow, rawCapture, contractorWork, personnel, equipmentUsage, photos) {
            const report = createFreshReport();

            // Set meta information
            report.meta.createdAt = reportRow.created_at;
            report.meta.status = reportRow.status;
            report.meta.interviewCompleted = reportRow.status === 'refined' || reportRow.status === 'submitted';

            // Set raw capture data
            if (rawCapture) {
                report.meta.captureMode = rawCapture.capture_mode;
                report.fieldNotes.freeformNotes = rawCapture.freeform_notes || '';
                report.guidedNotes.workSummary = rawCapture.work_summary || '';
                report.generalIssues = rawCapture.issues_notes ? rawCapture.issues_notes.split('\n').filter(s => s.trim()) : [];
                if (rawCapture.safety_notes) {
                    report.safety.notes = rawCapture.safety_notes.split('\n').filter(s => s.trim());
                    report.safety.noIncidents = rawCapture.safety_notes.toLowerCase().includes('no incident');
                    report.safety.hasIncidents = !report.safety.noIncidents && report.safety.notes.length > 0;
                }
                if (rawCapture.weather_data) {
                    report.overview.weather = rawCapture.weather_data;
                }
            }

            // Set overview
            report.overview.date = new Date(reportRow.report_date).toLocaleDateString();
            report.overview.completedBy = reportRow.inspector_name || '';

            // Set contractor work/activities
            if (contractorWork && contractorWork.length > 0) {
                report.activities = contractorWork.map(cw => ({
                    contractorId: cw.contractor_id,
                    noWork: cw.no_work_performed,
                    narrative: cw.narrative || '',
                    equipmentUsed: cw.equipment_used || '',
                    crew: cw.crew || ''
                }));
            }

            // Set personnel/operations
            if (personnel && personnel.length > 0) {
                report.operations = personnel.map(p => ({
                    contractorId: p.contractor_id,
                    superintendents: p.superintendents || null,
                    foremen: p.foremen || null,
                    operators: p.operators || null,
                    laborers: p.laborers || null,
                    surveyors: p.surveyors || null,
                    others: p.others || null
                }));
            }

            // Set equipment usage
            if (equipmentUsage && equipmentUsage.length > 0) {
                report.equipment = equipmentUsage.map(eu => ({
                    equipmentId: eu.equipment_id,
                    hoursUtilized: eu.status === 'idle' ? null : (eu.hours_used || 0),
                    quantity: 1
                }));
            }

            // Set photos with public URLs
            if (photos && photos.length > 0) {
                report.photos = photos.map(p => {
                    let url = '';
                    if (p.storage_path) {
                        const { data } = supabaseClient.storage
                            .from('report-photos')
                            .getPublicUrl(p.storage_path);
                        url = data?.publicUrl || '';
                    }
                    return {
                        id: p.id,
                        url: url,
                        storagePath: p.storage_path,
                        caption: p.caption || '',
                        timestamp: p.taken_at,
                        date: new Date(p.taken_at).toLocaleDateString(),
                        time: new Date(p.taken_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                        gps: p.gps_lat && p.gps_lng ? { lat: p.gps_lat, lng: p.gps_lng } : null,
                        fileName: p.filename
                    };
                });
            }

            return report;
        }

        function createFreshReport() {
            return {
                meta: {
                    createdAt: new Date().toISOString(),
                    interviewCompleted: false,
                    version: 2,
                    naMarked: {},
                    captureMode: null,
                    status: 'draft'
                },
                reporter: {
                    name: userSettings?.full_name || ""
                },
                project: {
                    name: activeProject?.name || "",
                    dayNumber: null
                },
                overview: {
                    projectName: activeProject?.name || "",
                    date: new Date().toLocaleDateString(),
                    startTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                    completedBy: userSettings?.full_name || "",
                    weather: { highTemp: "--", lowTemp: "--", precipitation: "0.00\"", generalCondition: "Syncing...", jobSiteCondition: "", adverseConditions: "N/A" }
                },
                contractors: [], activities: [], operations: [], equipment: [], generalIssues: [], qaqcNotes: [],
                safety: { hasIncidents: false, noIncidents: false, notes: [] },
                contractorCommunications: "",
                visitorsRemarks: "",
                photos: [],
                additionalNotes: "",
                fieldNotes: { freeformNotes: "" },
                guidedNotes: { workSummary: "" }
            };
        }

        /**
         * Save report to localStorage (debounced to prevent excessive writes)
         * Data only goes to Supabase when FINISH is clicked
         * v6: Also queues entry backup via sync-manager.js
         */
        let localSaveTimeout = null;

        function saveReport() {
            // Update local UI immediately
            updateAllPreviews();
            updateProgress();

            // Debounce save to localStorage
            if (localSaveTimeout) {
                clearTimeout(localSaveTimeout);
            }
            localSaveTimeout = setTimeout(() => {
                saveToLocalStorage();

                // v6: Queue for real-time backup if online
                if (currentReportId && navigator.onLine) {
                    // Build entry data from current report state
                    const entryData = {
                        id: generateId(),
                        section: report.meta?.captureMode || 'guided',
                        content: report.meta?.captureMode === 'minimal'
                            ? report.fieldNotes?.freeformNotes
                            : report.guidedNotes?.workSummary,
                        timestamp: new Date().toISOString()
                    };
                    queueEntryBackup(currentReportId, entryData);
                }
            }, 500); // 500ms debounce for localStorage
        }

        /**
         * Actually save report to Supabase
         */
        async function saveReportToSupabase() {
            if (isSaving || !activeProject) return;
            isSaving = true;

            try {
                const todayStr = new Date().toISOString().split('T')[0];

                // 1. Upsert the main report record
                let reportId = currentReportId;
                if (!reportId) {
                    // Check if a report already exists for this project+date before generating new ID
                    const { data: existingReport } = await supabaseClient
                        .from('reports')
                        .select('id')
                        .eq('project_id', activeProject.id)
                        .eq('report_date', todayStr)
                        .maybeSingle();

                    reportId = existingReport?.id || generateId();
                }

                const reportData = {
                    id: reportId,
                    project_id: activeProject.id,
                    report_date: todayStr,
                    inspector_name: report.overview?.completedBy || userSettings?.full_name || '',
                    status: report.meta?.status || 'draft',
                    updated_at: new Date().toISOString()
                };

                const { error: reportError } = await supabaseClient
                    .from('reports')
                    .upsert(reportData, { onConflict: 'id' });

                if (reportError) {
                    console.error('Error saving report:', reportError);
                    showToast('Failed to save report', 'error');
                    isSaving = false;
                    return;
                }

                currentReportId = reportId;

                // 2. Upsert raw capture data
                const rawCaptureData = {
                    report_id: reportId,
                    capture_mode: report.meta?.captureMode || 'guided',
                    freeform_notes: report.fieldNotes?.freeformNotes || '',
                    work_summary: report.guidedNotes?.workSummary || '',
                    issues_notes: report.generalIssues?.join('\n') || '',
                    safety_notes: report.safety?.notes?.join('\n') || '',
                    weather_data: report.overview?.weather || {},
                    captured_at: new Date().toISOString()
                };

                // Delete existing and insert new (simpler than upsert for child tables)
                await supabaseClient
                    .from('report_raw_capture')
                    .delete()
                    .eq('report_id', reportId);

                await supabaseClient
                    .from('report_raw_capture')
                    .insert(rawCaptureData);

                // 3. Save contractor work
                if (report.activities && report.activities.length > 0) {
                    await supabaseClient
                        .from('report_contractor_work')
                        .delete()
                        .eq('report_id', reportId);

                    const contractorWorkData = report.activities.map(a => ({
                        report_id: reportId,
                        contractor_id: a.contractorId,
                        no_work_performed: a.noWork || false,
                        narrative: a.narrative || '',
                        equipment_used: a.equipmentUsed || '',
                        crew: a.crew || ''
                    }));

                    await supabaseClient
                        .from('report_contractor_work')
                        .insert(contractorWorkData);
                }

                // 4. Save personnel
                if (report.operations && report.operations.length > 0) {
                    await supabaseClient
                        .from('report_personnel')
                        .delete()
                        .eq('report_id', reportId);

                    const personnelData = report.operations.map(o => ({
                        report_id: reportId,
                        contractor_id: o.contractorId,
                        superintendents: o.superintendents || 0,
                        foremen: o.foremen || 0,
                        operators: o.operators || 0,
                        laborers: o.laborers || 0,
                        surveyors: o.surveyors || 0,
                        others: o.others || 0
                    }));

                    await supabaseClient
                        .from('report_personnel')
                        .insert(personnelData);
                }

                // 5. Save equipment usage
                if (report.equipment && report.equipment.length > 0) {
                    await supabaseClient
                        .from('report_equipment_usage')
                        .delete()
                        .eq('report_id', reportId);

                    const equipmentData = report.equipment.map(e => ({
                        report_id: reportId,
                        equipment_id: e.equipmentId,
                        status: e.hoursUtilized === null ? 'idle' : 'active',
                        hours_used: e.hoursUtilized || 0,
                        notes: ''
                    }));

                    await supabaseClient
                        .from('report_equipment_usage')
                        .insert(equipmentData);
                }

                // Note: Photos are saved separately when uploaded via uploadPhotoToSupabase

                console.log('[SUPABASE] Report saved successfully');
            } catch (err) {
                console.error('[SUPABASE] Save failed:', err);
                showToast('Failed to save report', 'error');
            } finally {
                isSaving = false;
            }
        }

        /**
         * Upload photo to Supabase Storage
         */
        async function uploadPhotoToSupabase(file, photoId) {
            if (!currentReportId) {
                // Create report first if it doesn't exist
                await saveReportToSupabase();
            }

            const fileName = `${currentReportId}/${photoId}_${file.name}`;

            try {
                const { data, error } = await supabaseClient.storage
                    .from('report-photos')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) {
                    console.error('Error uploading photo:', error);
                    throw error;
                }

                // Get public URL
                const { data: urlData } = supabaseClient.storage
                    .from('report-photos')
                    .getPublicUrl(fileName);

                return {
                    storagePath: fileName,
                    publicUrl: urlData?.publicUrl || ''
                };
            } catch (err) {
                console.error('Photo upload failed:', err);
                throw err;
            }
        }

        /**
         * Save photo metadata to Supabase
         */
        async function savePhotoMetadata(photo) {
            if (!currentReportId) return;

            try {
                const photoData = {
                    id: photo.id,
                    report_id: currentReportId,
                    storage_path: photo.storagePath || '',
                    filename: photo.fileName || photo.id,
                    caption: photo.caption || '',
                    gps_lat: photo.gps?.lat || null,
                    gps_lng: photo.gps?.lng || null,
                    taken_at: photo.timestamp || new Date().toISOString(),
                    created_at: new Date().toISOString()
                };

                const { error } = await supabaseClient
                    .from('report_photos')
                    .upsert(photoData, { onConflict: 'id' });

                if (error) {
                    console.error('Error saving photo metadata:', error);
                }
            } catch (err) {
                console.error('Failed to save photo metadata:', err);
            }
        }

        /**
         * Delete photo from Supabase
         */
        async function deletePhotoFromSupabase(photoId, storagePath) {
            try {
                // Delete from storage
                if (storagePath) {
                    await supabaseClient.storage
                        .from('report-photos')
                        .remove([storagePath]);
                }

                // Delete metadata
                await supabaseClient
                    .from('report_photos')
                    .delete()
                    .eq('id', photoId);
            } catch (err) {
                console.error('Failed to delete photo:', err);
            }
        }

        // compressImage() moved to /js/media-utils.js

        function getStorageUsage() {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
                }
            }
            return total;
        }

        // ============ WEATHER ============
        async function fetchWeather() {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 0
                    });
                });
                const { latitude, longitude } = position.coords;
                localStorage.setItem('fvp_loc_granted', 'true');
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch`);
                const data = await response.json();
                const weatherCodes = { 0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle', 61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 80: 'Showers', 95: 'Thunderstorm' };
                const precip = data.daily.precipitation_sum[0];
                report.overview.weather = {
                    highTemp: `${Math.round(data.daily.temperature_2m_max[0])}°F`,
                    lowTemp: `${Math.round(data.daily.temperature_2m_min[0])}°F`,
                    precipitation: `${precip.toFixed(2)}"`,
                    generalCondition: weatherCodes[data.current_weather.weathercode] || 'Cloudy',
                    jobSiteCondition: report.overview.weather.jobSiteCondition || (precip > 0.1 ? 'Wet' : 'Dry'),
                    adverseConditions: precip > 0.25 ? 'Rain impact possible' : 'N/A'
                };
                saveReport();
                updateWeatherDisplay();
                updateMinimalWeatherDisplay(); // Also update minimal mode weather
            } catch (error) {
                console.error('Weather fetch failed:', error);
            }
        }

        function updateWeatherDisplay() {
            const w = report.overview.weather;
            const conditionEl = document.getElementById('weather-condition');
            const tempEl = document.getElementById('weather-temp');
            const precipEl = document.getElementById('weather-precip');
            const siteCondEl = document.getElementById('site-conditions-input');

            if (conditionEl) conditionEl.textContent = w.generalCondition;
            if (tempEl) tempEl.textContent = `${w.highTemp} / ${w.lowTemp}`;
            if (precipEl) precipEl.textContent = w.precipitation;
            if (siteCondEl) siteCondEl.value = w.jobSiteCondition || '';
        }

        // ============ SECTION TOGGLE ============
        function toggleSection(sectionId) {
            const cards = document.querySelectorAll('.section-card');
            cards.forEach(card => {
                if (card.dataset.section === sectionId) {
                    card.classList.toggle('expanded');
                    const icon = card.querySelector('[id$="-status"] i');
                    if (card.classList.contains('expanded')) {
                        icon.className = 'fas fa-chevron-up text-dot-blue text-xs';
                    } else {
                        icon.className = 'fas fa-chevron-down text-slate-400 text-xs';
                    }
                } else {
                    card.classList.remove('expanded');
                    const icon = card.querySelector('[id$="-status"] i');
                    if (icon) icon.className = 'fas fa-chevron-down text-slate-400 text-xs';
                }
            });
        }

        // ============ DICTATION HINT BANNER ============
        function dismissDictationHint() {
            localStorage.setItem('fvp_dictation_hint_dismissed', 'true');
            const banner = document.getElementById('dictationHintBanner');
            if (banner) banner.classList.add('hidden');
        }

        function checkDictationHintBanner() {
            const dismissed = localStorage.getItem('fvp_dictation_hint_dismissed') === 'true';
            const banner = document.getElementById('dictationHintBanner');
            if (banner && dismissed) {
                banner.classList.add('hidden');
            }
        }

        // ============ MANUAL ADD FUNCTIONS ============
        // Note: addActivity() is replaced by contractor-based work entry system
        // Legacy activities are migrated in initializeContractorActivities()

        function addIssue() {
            const input = document.getElementById('issue-input');
            const text = input.value.trim();
            if (text) { report.generalIssues.push(text); saveReport(); renderSection('issues'); input.value = ''; }
        }

        function removeIssue(index) { report.generalIssues.splice(index, 1); saveReport(); renderSection('issues'); }

        function addInspection() {
            const input = document.getElementById('inspection-input');
            const text = input.value.trim();
            if (text) { report.qaqcNotes.push(text); saveReport(); renderSection('inspections'); input.value = ''; }
        }

        function removeInspection(index) { report.qaqcNotes.splice(index, 1); saveReport(); renderSection('inspections'); }

        function addSafetyNote() {
            const input = document.getElementById('safety-input');
            const text = input.value.trim();
            if (text) { report.safety.notes.push(text); saveReport(); renderSection('safety'); input.value = ''; }
        }

        function removeSafetyNote(index) { report.safety.notes.splice(index, 1); saveReport(); renderSection('safety'); }

        // Note: addVisitor() and removeVisitor() are replaced by text area inputs
        // contractorCommunications and visitorsRemarks are now strings, not arrays

        // ============ PHOTOS ============
        async function handlePhotoInput(e) {
            console.log('[PHOTO] handlePhotoInput triggered');

            const files = e.target.files;
            if (!files || files.length === 0) {
                console.warn('[PHOTO] No files selected');
                showToast('No photo selected', 'warning');
                return;
            }

            console.log(`[PHOTO] Processing ${files.length} file(s)`);

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`[PHOTO] File ${i + 1}: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

                // Validate file type
                if (!file.type.startsWith('image/')) {
                    console.error(`[PHOTO] Invalid file type: ${file.type}`);
                    showToast(`Invalid file type: ${file.type}`, 'error');
                    continue;
                }

                // Validate file size (max 20MB)
                if (file.size > 20 * 1024 * 1024) {
                    console.error(`[PHOTO] File too large: ${file.size} bytes`);
                    showToast('Photo too large (max 20MB)', 'error');
                    continue;
                }

                // Show processing indicator
                showToast('Uploading photo...', 'info');

                // Get GPS coordinates (using multi-reading high accuracy)
                let gps = null;
                try {
                    console.log('[PHOTO] Requesting GPS coordinates (multi-reading)...');
                    gps = await getHighAccuracyGPS(true);
                    if (gps) {
                        console.log(`[PHOTO] GPS acquired: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} (±${gps.accuracy}m)`);
                    }
                } catch (err) {
                    console.warn('[PHOTO] GPS failed:', err);
                    // Continue without GPS - don't block the photo
                }

                try {
                    // Create timestamp
                    const now = new Date();
                    const timestamp = now.toISOString();
                    const date = now.toLocaleDateString();
                    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

                    const photoId = `photo_${Date.now()}_${i}`;

                    // Compress image before uploading
                    showToast('Compressing photo...', 'info');
                    console.log('[PHOTO] Reading file for compression...');
                    const rawDataUrl = await readFileAsDataURL(file);
                    const compressedDataUrl = await compressImage(rawDataUrl, 1200, 0.7);

                    // Convert compressed data URL to Blob for upload
                    const compressedBlob = await dataURLtoBlob(compressedDataUrl);
                    console.log(`[PHOTO] Compressed: ${Math.round(file.size/1024)}KB -> ${Math.round(compressedBlob.size/1024)}KB`);

                    // Upload to Supabase Storage
                    showToast('Uploading photo...', 'info');
                    console.log('[PHOTO] Uploading to Supabase Storage...');
                    const { storagePath, publicUrl } = await uploadPhotoToSupabase(compressedBlob, photoId);

                    // Create photo object
                    const photoObj = {
                        id: photoId,
                        url: publicUrl,
                        storagePath: storagePath,
                        caption: '',
                        timestamp: timestamp,
                        date: date,
                        time: time,
                        gps: gps,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type
                    };

                    console.log('[PHOTO] Adding photo to report:', {
                        id: photoObj.id,
                        timestamp: photoObj.timestamp,
                        gps: photoObj.gps,
                        storagePath: storagePath
                    });

                    // Add to local report
                    report.photos.push(photoObj);

                    // Save photo metadata to Supabase
                    await savePhotoMetadata(photoObj);

                    // Update UI
                    renderSection('photos');
                    showToast('Photo uploaded', 'success');

                    console.log(`[PHOTO] Success! Total photos: ${report.photos.length}`);

                } catch (err) {
                    console.error('[PHOTO] Failed to upload photo:', err);
                    showToast(`Photo error: ${err.message}`, 'error');
                }
            }

            // Reset the input so the same file can be selected again
            e.target.value = '';
        }

        async function removePhoto(index) {
            console.log(`[PHOTO] Removing photo at index ${index}`);
            const photo = report.photos[index];

            // Delete from Supabase
            if (photo) {
                await deletePhotoFromSupabase(photo.id, photo.storagePath);
            }

            report.photos.splice(index, 1);
            saveReport();
            renderSection('photos');
            showToast('Photo removed', 'info');
        }

        // Update photo caption and save to Supabase
        async function updatePhotoCaption(index, value) {
            const maxLength = 500;
            const caption = value.slice(0, maxLength);
            if (report.photos[index]) {
                report.photos[index].caption = caption;
                saveReport();

                // Also update in Supabase directly
                if (report.photos[index].id && currentReportId) {
                    await supabaseClient
                        .from('report_photos')
                        .update({ caption: caption })
                        .eq('id', report.photos[index].id);
                }

                // Update character counter
                const counter = document.getElementById(`caption-counter-${index}`);
                if (counter) {
                    const len = caption.length;
                    if (len > 400) {
                        counter.textContent = `${len}/${maxLength}`;
                        counter.classList.remove('hidden');
                        counter.classList.toggle('warning', len <= 480);
                        counter.classList.toggle('limit', len > 480);
                    } else {
                        counter.classList.add('hidden');
                    }
                }
            }
        }

        // Auto-expand caption textarea
        // Auto-expand caption uses shared autoExpand with smaller max height
        function autoExpandCaption(textarea) {
            autoExpand(textarea, 40, 128);
        }

        // ============ RENDER SECTIONS ============
        function renderSection(section) {
            switch (section) {
                case 'activities':
                    // Contractor-based work cards are rendered by renderContractorWorkCards()
                    renderContractorWorkCards();
                    break;
                case 'operations':
                    // Personnel cards are rendered by renderPersonnelCards()
                    renderPersonnelCards();
                    break;
                case 'issues':
                    document.getElementById('issues-list').innerHTML = report.generalIssues.map((issue, i) => `
                        <div class="bg-red-50 border border-red-200 p-3 flex items-start gap-3">
                            <i class="fas fa-exclamation-circle text-red-500 mt-0.5"></i>
                            <p class="flex-1 text-sm text-slate-700">${issue}</p>
                            <button onclick="removeIssue(${i})" class="text-red-400 hover:text-red-600"><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    `).join('') || '';
                    break;
                case 'inspections':
                    document.getElementById('inspections-list').innerHTML = report.qaqcNotes.map((note, i) => `
                        <div class="bg-violet-50 border border-violet-200 p-3 flex items-start gap-3">
                            <i class="fas fa-check-circle text-violet-500 mt-0.5"></i>
                            <p class="flex-1 text-sm text-slate-700">${note}</p>
                            <button onclick="removeInspection(${i})" class="text-red-400 hover:text-red-600"><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    `).join('') || '';
                    break;
                case 'safety':
                    document.getElementById('safety-list').innerHTML = report.safety.notes.map((note, i) => `
                        <div class="bg-green-50 border border-green-200 p-3 flex items-start gap-3">
                            <i class="fas fa-shield-alt text-safety-green mt-0.5"></i>
                            <p class="flex-1 text-sm text-slate-700">${note}</p>
                            <button onclick="removeSafetyNote(${i})" class="text-red-400 hover:text-red-600"><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    `).join('') || '';
                    document.getElementById('has-incidents').checked = report.safety.hasIncidents;
                    break;
                case 'communications':
                    // Communications text area - value set via event listener
                    break;
                case 'visitors':
                    // Visitors/remarks text area - value set via event listener
                    break;
                case 'photos':
                    document.getElementById('photos-grid').innerHTML = report.photos.map((p, i) => `
                        <div class="border-2 border-slate-300 overflow-hidden bg-slate-100">
                            <div class="relative">
                                <img src="${p.url}" class="w-full aspect-square object-cover" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23cbd5e1%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2364748b%22 font-size=%2212%22>Error</text></svg>';">
                                <button onclick="removePhoto(${i})" class="absolute top-2 right-2 w-7 h-7 bg-red-600 text-white text-xs flex items-center justify-center shadow-lg"><i class="fas fa-times"></i></button>
                                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6">
                                    <div class="flex items-center gap-1 text-white/90 mb-1">
                                        <i class="fas fa-clock text-[8px]"></i>
                                        <p class="text-[10px] font-medium">${p.date} ${p.time}</p>
                                    </div>
                                    ${p.gps ? `
                                        <div class="flex items-center gap-1 text-safety-green">
                                            <i class="fas fa-map-marker-alt text-[8px]"></i>
                                            <p class="text-[9px] font-mono">${p.gps.lat.toFixed(5)}, ${p.gps.lng.toFixed(5)}</p>
                                            <span class="text-[8px] text-white/60">(±${p.gps.accuracy}m)</span>
                                        </div>
                                    ` : `
                                        <div class="flex items-center gap-1 text-dot-orange">
                                            <i class="fas fa-location-crosshairs text-[8px]"></i>
                                            <p class="text-[9px]">No GPS</p>
                                        </div>
                                    `}
                                </div>
                            </div>
                            <div class="p-2 bg-white">
                                <textarea
                                    id="caption-input-${i}"
                                    class="caption-textarea w-full text-xs border border-slate-200 rounded p-2 bg-slate-50 focus:bg-white focus:border-dot-blue focus:outline-none"
                                    placeholder="Add caption..."
                                    maxlength="500"
                                    oninput="updatePhotoCaption(${i}, this.value); autoExpandCaption(this);"
                                    onblur="updatePhotoCaption(${i}, this.value)"
                                >${p.caption || ''}</textarea>
                                <div id="caption-counter-${i}" class="caption-counter hidden mt-1"></div>
                            </div>
                        </div>
                    `).join('') || '<p class="col-span-2 text-center text-slate-400 text-sm py-4">No photos yet</p>';
                    break;
            }
        }

        function renderAllSections() {
            // Simplified guided mode sections + contractor work + equipment
            ['contractor-work', 'equipment', 'issues', 'safety', 'photos'].forEach(renderSection);
            updateWeatherDisplay();
        }

        // ============ PREVIEWS & PROGRESS ============
        function updateAllPreviews() {
            // Simplified guided mode - only 5 sections: Weather, Work Summary, Issues, Safety, Photos
            const w = report.overview.weather;
            document.getElementById('weather-preview').textContent = w.jobSiteCondition || `${w.generalCondition}, ${w.highTemp}`;

            // Work Summary preview (simplified single textarea)
            const workSummary = report.guidedNotes?.workSummary || '';
            if (workSummary.trim()) {
                const truncated = workSummary.length > 40 ? workSummary.substring(0, 40) + '...' : workSummary;
                document.getElementById('activities-preview').textContent = truncated;
            } else {
                document.getElementById('activities-preview').textContent = 'Tap to add';
            }

            const naMarked = report.meta.naMarked || {};
            document.getElementById('issues-preview').textContent = naMarked.issues ? 'N/A - No issues' : report.generalIssues.length > 0 ? `${report.generalIssues.length} issues` : 'None reported';
            document.getElementById('safety-preview').textContent = report.safety.hasIncidents ? 'INCIDENT REPORTED' : report.safety.noIncidents ? 'No incidents (confirmed)' : report.safety.notes.length > 0 ? 'Notes added' : 'Tap to confirm';
            document.getElementById('photos-preview').textContent = naMarked.photos ? 'N/A - No photos' : report.photos.length > 0 ? `${report.photos.length} photos` : 'No photos';

            updateStatusIcons();
        }

        function updateStatusIcons() {
            const naMarked = report.meta.naMarked || {};
            // Check if any contractor has work logged
            const hasContractorWork = report.activities?.some(a => !a.noWork || a.narrative) || false;
            // Check if equipment has any active items
            const hasEquipmentData = report.equipment?.some(e => e.hoursUtilized !== null && e.hoursUtilized > 0) || false;
            // Sections with status icons
            const sections = {
                'weather': report.overview.weather.jobSiteCondition,
                'activities': report.guidedNotes?.workSummary?.trim(),
                'contractor-work': hasContractorWork,
                'equipment': hasEquipmentData,
                'issues': report.generalIssues.length > 0 || naMarked.issues,
                'safety': report.safety.noIncidents || report.safety.hasIncidents || report.safety.notes.length > 0,
                'photos': report.photos.length > 0 || naMarked.photos
            };
            Object.entries(sections).forEach(([section, hasData]) => {
                const statusEl = document.getElementById(`${section}-status`);
                if (!statusEl) return;
                const card = document.querySelector(`[data-section="${section}"]`);
                const isExpanded = card?.classList.contains('expanded');
                if (hasData && !isExpanded) {
                    statusEl.innerHTML = '<i class="fas fa-check text-safety-green text-xs"></i>';
                    statusEl.className = 'w-8 h-8 bg-safety-green/20 border-2 border-safety-green flex items-center justify-center';
                } else if (!isExpanded) {
                    statusEl.innerHTML = '<i class="fas fa-chevron-down text-slate-400 text-xs"></i>';
                    statusEl.className = 'w-8 h-8 border border-slate-300 flex items-center justify-center';
                }
            });
        }

        function updateProgress() {
            const naMarked = report.meta.naMarked || {};
            let filled = 0;
            let total = 5; // weather, work summary, issues, safety, photos (simplified guided mode)

            // Weather - has site condition text
            if (report.overview.weather.jobSiteCondition) filled++;

            // Work Summary - has work summary text (simplified single textarea)
            if (report.guidedNotes?.workSummary?.trim()) filled++;

            // Issues - has issues OR marked N/A
            if (report.generalIssues.length > 0 || naMarked.issues) filled++;

            // Safety - confirmed no incidents OR has incidents OR has notes
            if (report.safety.noIncidents === true || report.safety.hasIncidents === true || report.safety.notes.length > 0) filled++;

            // Photos - has photos OR marked N/A
            if (report.photos.length > 0 || naMarked.photos) filled++;

            const percent = Math.round((filled / total) * 100);
            document.getElementById('progressBar').style.width = `${percent}%`;
            document.getElementById('progressText').textContent = `${percent}%`;
        }

        // ============ N/A MARKING ============
        function markNA(section) {
            if (!report.meta.naMarked) report.meta.naMarked = {};
            report.meta.naMarked[section] = true;
            const btn = document.getElementById(`${section}-na-btn`);
            if (btn) {
                btn.innerHTML = '<i class="fas fa-check mr-2"></i>Marked as N/A';
                btn.className = 'w-full p-3 bg-safety-green/20 border-2 border-safety-green text-safety-green text-sm font-medium uppercase cursor-default';
                btn.onclick = () => clearNA(section);
            }
            // Hide photo upload if photos section is marked N/A
            if (section === 'photos') {
                const uploadLabel = document.getElementById('photos-upload-label');
                if (uploadLabel) uploadLabel.classList.add('hidden');
            }
            saveReport();
            updateAllPreviews();
            showToast('Marked as N/A');
        }

        function clearNA(section) {
            if (report.meta.naMarked) { delete report.meta.naMarked[section]; }
            const btn = document.getElementById(`${section}-na-btn`);
            if (btn) {
                const labels = { issues: 'No Issues - Mark as N/A', inspections: 'No Inspections - Mark as N/A', communications: 'No Communications - Mark as N/A', visitors: 'Nothing to Report - Mark as N/A', photos: 'No Photos - Mark as N/A' };
                btn.innerHTML = `<i class="fas fa-ban mr-2"></i>${labels[section] || 'Mark as N/A'}`;
                btn.className = 'w-full p-3 bg-slate-100 border border-slate-300 text-slate-600 hover:bg-slate-200 transition-colors text-sm font-medium uppercase';
                btn.onclick = () => markNA(section);
            }
            // Show photo upload if photos section is cleared
            if (section === 'photos') {
                const uploadLabel = document.getElementById('photos-upload-label');
                if (uploadLabel) uploadLabel.classList.remove('hidden');
            }
            saveReport();
            updateAllPreviews();
            showToast('N/A cleared');
        }

        function updateNAButtons() {
            const naMarked = report.meta.naMarked || {};
            Object.keys(naMarked).forEach(section => {
                if (naMarked[section]) {
                    const btn = document.getElementById(`${section}-na-btn`);
                    if (btn) {
                        btn.innerHTML = '<i class="fas fa-check mr-2"></i>Marked as N/A';
                        btn.className = 'w-full p-3 bg-safety-green/20 border-2 border-safety-green text-safety-green text-sm font-medium uppercase cursor-default';
                        btn.onclick = () => clearNA(section);
                    }
                    // Hide photo upload if photos is marked N/A
                    if (section === 'photos') {
                        const uploadLabel = document.getElementById('photos-upload-label');
                        if (uploadLabel) uploadLabel.classList.add('hidden');
                    }
                }
            });
        }

        // ============ UTILITIES ============
        // getHighAccuracyGPS() moved to /js/media-utils.js

        function dismissWarningBanner() { document.getElementById('permissionsWarningBanner').classList.add('hidden'); }

        function checkAndShowWarningBanner() {
            const micGranted = localStorage.getItem('fvp_mic_granted') === 'true';
            const locGranted = localStorage.getItem('fvp_loc_granted') === 'true';
            if (isMobile && (!micGranted || !locGranted)) {
                document.getElementById('permissionsWarningBanner').classList.remove('hidden');
            }
        }

        // ============ PERMISSIONS ============
        async function requestMicrophonePermission() {
            const btn = document.getElementById('micPermissionBtn');
            const status = document.getElementById('micPermissionStatus');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            status.textContent = 'Testing...';
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                localStorage.setItem('fvp_mic_granted', 'true');
                updatePermissionUI('mic', 'granted');
                showToast('Microphone enabled!', 'success');
            } catch (err) {
                console.error('Microphone permission error:', err);
                updatePermissionUI('mic', 'denied');
                status.textContent = 'Blocked - check settings';
            }
        }

        async function requestLocationPermission() {
            const btn = document.getElementById('locPermissionBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
                });
                localStorage.setItem('fvp_loc_granted', 'true');
                updatePermissionUI('loc', 'granted');
                showToast('Location enabled!');
                fetchWeather();
            } catch (err) {
                console.error('Location permission error:', err);
                if (err.code === 1) { updatePermissionUI('loc', 'denied'); }
            }
        }

        function updatePermissionUI(type, state) {
            const btn = document.getElementById(`${type}PermissionBtn`);
            const status = document.getElementById(`${type}PermissionStatus`);
            const row = document.getElementById(`${type}PermissionRow`);
            if (state === 'granted') {
                btn.innerHTML = '<i class="fas fa-check"></i>';
                btn.className = 'px-4 py-2 bg-safety-green text-white text-xs font-bold cursor-default';
                btn.disabled = true;
                status.textContent = type === 'mic' ? 'Verified Working' : 'Enabled';
                status.className = 'text-xs text-safety-green';
                row.className = 'bg-safety-green/10 border-2 border-safety-green p-4';
            } else if (state === 'denied') {
                btn.textContent = 'Denied';
                btn.className = 'px-4 py-2 bg-red-500/50 text-white text-xs font-bold';
                btn.disabled = true;
                status.textContent = 'Blocked - check settings';
                status.className = 'text-xs text-red-500';
                row.className = 'bg-red-50 border-2 border-red-500 p-4';
            }
        }

        function closePermissionsModal() {
            document.getElementById('permissionsModal').classList.add('hidden');
            localStorage.setItem('permissions_dismissed', 'true');
        }

        async function finishReport() {
            // Validate required fields before finishing
            const workSummary = report.guidedNotes?.workSummary?.trim();
            const safetyAnswered = report.safety.noIncidents === true || report.safety.hasIncidents === true;

            if (!workSummary) {
                showToast('Work Summary is required', 'error');
                // Open the activities section to show user where to fill
                const activitiesCard = document.querySelector('[data-section="activities"]');
                if (activitiesCard && !activitiesCard.classList.contains('expanded')) {
                    toggleSection('activities');
                }
                document.getElementById('work-summary-input')?.focus();
                return;
            }

            if (!safetyAnswered) {
                showToast('Please answer the Safety question', 'error');
                // Open the safety section
                const safetyCard = document.querySelector('[data-section="safety"]');
                if (safetyCard && !safetyCard.classList.contains('expanded')) {
                    toggleSection('safety');
                }
                return;
            }

            // Get button reference for loading state
            const finishBtn = document.querySelector('button[onclick="finishReport()"]');
            const originalBtnHtml = finishBtn ? finishBtn.innerHTML : '';

            // Show loading state
            if (finishBtn) {
                finishBtn.disabled = true;
                finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Processing...';
            }
            showToast('Processing with AI...', 'info');

            // Set up report data
            report.overview.endTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            report.meta.interviewCompleted = true;
            if (report.overview.startTime) {
                const start = new Date(`2000/01/01 ${report.overview.startTime}`);
                const end = new Date(`2000/01/01 ${report.overview.endTime}`);
                const diffMs = end - start;
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                report.overview.shiftDuration = `${hours}.${String(mins).padStart(2, '0')} hours`;
            }
            if (report.safety.notes.length === 0) { report.safety.notes.push('No safety incidents reported.'); }

            // Store guided notes for AI processing
            report.guidedNotes.issues = report.generalIssues?.join('\n') || '';
            report.guidedNotes.safety = report.safety.noIncidents ? 'No incidents reported' : (report.safety.hasIncidents ? 'INCIDENT REPORTED: ' + report.safety.notes.join('; ') : '');

            // Ensure report is saved to Supabase first
            await saveReportToSupabase();

            // Build payload
            const payload = buildProcessPayload();

            // Check if online
            if (!navigator.onLine) {
                handleOfflineProcessing(payload, true);
                return;
            }

            // Save AI request to Supabase
            await saveAIRequest(payload);

            const startTime = Date.now();

            // Call webhook
            try {
                const result = await callProcessWebhook(payload);
                const processingTime = Date.now() - startTime;

                // Save AI response to Supabase
                await saveAIResponse(result.aiGenerated, processingTime);

                // Save AI response to local report
                if (result.aiGenerated) {
                    report.aiGenerated = result.aiGenerated;

                    // Cache AI response to localStorage for immediate availability on report.html
                    const todayStr = new Date().toISOString().split('T')[0];
                    try {
                        localStorage.setItem(`fvp_ai_response_${currentReportId}`, JSON.stringify({
                            reportId: currentReportId,
                            reportDate: todayStr,
                            aiGenerated: result.aiGenerated,
                            cachedAt: new Date().toISOString()
                        }));
                        console.log('[CACHE] AI response cached to localStorage');
                    } catch (e) {
                        console.warn('[CACHE] Failed to cache AI response:', e);
                    }
                }
                report.meta.status = 'refined';
                await saveReportToSupabase();

                // Clear localStorage draft - report is now saved and refined
                clearLocalStorageDraft();

                // Navigate to report with date and reportId parameters
                const todayStr = new Date().toISOString().split('T')[0];
                window.location.href = `report.html?date=${todayStr}&reportId=${currentReportId}`;
            } catch (error) {
                console.error('AI processing failed:', error);

                // Restore button state
                if (finishBtn) {
                    finishBtn.disabled = false;
                    finishBtn.innerHTML = originalBtnHtml;
                }

                // Handle as offline - save to drafts queue and redirect
                handleOfflineProcessing(payload, true);
            }
        }

        // ============ EVENT LISTENERS ============
        // Site conditions input (Weather section)
        document.getElementById('site-conditions-input').addEventListener('change', (e) => {
            report.overview.weather.jobSiteCondition = e.target.value;
            saveReport();
        });

        // Safety checkboxes
        document.getElementById('no-incidents').addEventListener('change', (e) => {
            if (e.target.checked) { report.safety.hasIncidents = false; report.safety.noIncidents = true; document.getElementById('has-incidents').checked = false; }
            else { report.safety.noIncidents = false; }
            saveReport();
            updateAllPreviews();
            updateProgress();
        });

        document.getElementById('has-incidents').addEventListener('change', (e) => {
            report.safety.hasIncidents = e.target.checked;
            if (e.target.checked) { report.safety.noIncidents = false; document.getElementById('no-incidents').checked = false; }
            saveReport();
            updateAllPreviews();
            updateProgress();
        });

        // Photo input
        document.getElementById('photoInput').addEventListener('change', handlePhotoInput);

        // ============ INIT ============
        function updateLoadingStatus(message) {
            const statusEl = document.getElementById('loadingStatus');
            if (statusEl) statusEl.textContent = message;
        }

        function hideLoadingOverlay() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.transition = 'opacity 0.3s ease-out';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 300);
            }
        }

        document.addEventListener('DOMContentLoaded', async () => {
            try {
                // STATE PROTECTION: Check if report is already refined BEFORE any other initialization
                // This must run first to redirect users away from editing refined reports
                updateLoadingStatus('Checking report state...');
                const canEdit = await checkReportState();
                if (!canEdit) {
                    return; // Stop initialization if redirecting
                }

                // Load user settings from Supabase
                updateLoadingStatus('Loading user settings...');
                await loadUserSettings();

                // v6: Initialize sync manager for real-time backup
                initSyncManager();

                // Load active project and contractors from Supabase
                updateLoadingStatus('Loading project data...');
                await loadActiveProject();

                // Load report from Supabase (baseline)
                updateLoadingStatus('Loading report data...');
                report = await getReport();

                // LOCALSTORAGE-FIRST: Check if we have a localStorage draft with unsaved changes
                // This recovers data if user swiped away the app without clicking FINISH
                updateLoadingStatus('Checking for saved draft...');
                const localDraft = loadFromLocalStorage();
                if (localDraft) {
                    console.log('[INIT] Found localStorage draft, restoring...');
                    restoreFromLocalStorage(localDraft);
                }

                // If user came back to edit a draft report that was marked completed but not yet refined,
                // mark it as in-progress again. Note: Refined/submitted/finalized reports are blocked
                // by checkReportState() above, so we only get here for draft status.
                if (report.meta?.interviewCompleted && report.meta?.status === 'draft') {
                    report.meta.interviewCompleted = false;
                    // Don't need to save here - we're just resetting local state
                }

                // Auto-populate project info from active project if not already set
                if (activeProject && !report.project?.name) {
                    report.project.name = activeProject.name || '';
                    report.overview.projectName = activeProject.name || '';
                    // Don't save here - let regular auto-save handle it
                }

                // Auto-populate reporter name from user settings
                if (userSettings && !report.reporter?.name) {
                    report.reporter.name = userSettings.full_name || '';
                    report.overview.completedBy = userSettings.full_name || '';
                    // Don't save here - let regular auto-save handle it
                }

                // Hide loading overlay
                hideLoadingOverlay();

                // Check if we need to show mode selection or jump to a specific mode
                if (shouldShowModeSelection()) {
                    showModeSelectionScreen();
                    // Fetch weather in background for when user selects a mode
                    if (report.overview.weather.generalCondition === 'Syncing...' || report.overview.weather.generalCondition === '--') {
                        fetchWeather();
                    }
                } else {
                    // Show the appropriate mode UI
                    const mode = report.meta?.captureMode || 'guided';
                    showModeUI(mode);

                    // Fetch weather if needed
                    if (report.overview.weather.generalCondition === 'Syncing...' || report.overview.weather.generalCondition === '--') {
                        await fetchWeather();
                        // Update weather display in minimal mode if active
                        if (mode === 'minimal') {
                            updateMinimalWeatherDisplay();
                        }
                    }
                }

                checkAndShowWarningBanner();
                checkDictationHintBanner();
            } catch (error) {
                console.error('Initialization failed:', error);
                hideLoadingOverlay();
                showToast('Failed to load data. Please refresh.', 'error');
            }
        });
