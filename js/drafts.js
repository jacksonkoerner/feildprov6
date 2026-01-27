// FieldVoice Pro - Drafts & Pending Reports Page Logic
// Offline queue management, sync retry, and draft editing

// ============ STATE ============
let pendingDeleteIndex = null;

// ============ OFFLINE QUEUE MANAGEMENT ============
function getOfflineQueue() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
        if (!stored) return { drafts: [] };
        const parsed = JSON.parse(stored);
        return parsed.drafts ? parsed : { drafts: [] };
    } catch (e) {
        console.error('[DRAFTS] Failed to parse offline queue:', e);
        return { drafts: [] };
    }
}

function saveOfflineQueue(queue) {
    try {
        localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (e) {
        console.error('[DRAFTS] Failed to save offline queue:', e);
    }
}

function removeDraft(index) {
    const queue = getOfflineQueue();
    if (index >= 0 && index < queue.drafts.length) {
        queue.drafts.splice(index, 1);
        saveOfflineQueue(queue);
    }
}

function updateDraftError(index, errorMessage) {
    const queue = getOfflineQueue();
    if (index >= 0 && index < queue.drafts.length) {
        queue.drafts[index].status = 'sync_failed';
        queue.drafts[index].errorMessage = errorMessage;
        queue.drafts[index].lastSaved = new Date().toISOString();
        saveOfflineQueue(queue);
    }
}

// ============ UI HELPERS ============
function getStatusBadge(status) {
    switch (status) {
        case 'draft':
            return {
                text: 'Draft',
                bgColor: 'bg-dot-slate',
                borderColor: 'border-dot-slate'
            };
        case 'pending_sync':
            return {
                text: 'Pending Sync',
                bgColor: 'bg-dot-orange',
                borderColor: 'border-dot-orange'
            };
        case 'sync_failed':
            return {
                text: 'Sync Failed',
                bgColor: 'bg-red-600',
                borderColor: 'border-red-600'
            };
        default:
            return {
                text: status || 'Unknown',
                bgColor: 'bg-slate-400',
                borderColor: 'border-slate-400'
            };
    }
}

// ============ RENDER FUNCTIONS ============
function renderDrafts() {
    const queue = getOfflineQueue();
    const drafts = queue.drafts || [];
    const container = document.getElementById('draftsList');
    const countEl = document.getElementById('queueCount');

    // Update count
    if (drafts.length === 0) {
        countEl.textContent = 'No pending items';
    } else if (drafts.length === 1) {
        countEl.textContent = '1 pending item';
    } else {
        countEl.textContent = `${drafts.length} pending items`;
    }

    // Show sync banner if online and has pending items
    const syncBanner = document.getElementById('syncBanner');
    const hasSyncable = drafts.some(d => d.status === 'pending_sync' || d.status === 'sync_failed');
    if (navigator.onLine && hasSyncable) {
        syncBanner.classList.remove('hidden');
    } else {
        syncBanner.classList.add('hidden');
    }

    // Render empty state or drafts
    if (drafts.length === 0) {
        container.innerHTML = `
            <div class="bg-white border-2 border-slate-200 p-8 text-center">
                <div class="w-20 h-20 bg-slate-100 border-2 border-slate-300 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-inbox text-slate-400 text-3xl"></i>
                </div>
                <p class="text-lg font-bold text-slate-700 mb-2">No Drafts or Pending Reports</p>
                <p class="text-sm text-slate-500 mb-6">All your reports are synced and up to date.</p>
                <a href="index.html" class="inline-block bg-dot-navy hover:bg-dot-blue text-white px-6 py-3 font-bold uppercase tracking-wide transition-colors">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </a>
            </div>
        `;
        return;
    }

    // Render draft cards
    container.innerHTML = drafts.map((draft, index) => {
        const status = getStatusBadge(draft.status);
        const showRetry = draft.status === 'pending_sync' || draft.status === 'sync_failed';

        return `
            <div class="bg-white border-l-4 ${status.borderColor} p-4 mb-4">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-bold ${status.bgColor} text-white px-2 py-0.5 uppercase">${status.text}</span>
                            <span class="text-[10px] font-bold text-slate-400 uppercase">${draft.captureMode || 'guided'} mode</span>
                        </div>
                        <p class="font-bold text-slate-800 truncate">${escapeHtml(draft.projectName || 'Unknown Project')}</p>
                        <p class="text-sm text-slate-600">${formatDate(draft.reportDate)}</p>
                    </div>
                    <div class="text-right shrink-0 ml-4">
                        <p class="text-xs text-slate-400">Last saved</p>
                        <p class="text-sm text-slate-600">${formatTime(draft.lastSaved)}</p>
                    </div>
                </div>

                ${draft.errorMessage ? `
                <div class="bg-red-50 border border-red-200 p-3 mb-3">
                    <div class="flex items-start gap-2">
                        <i class="fas fa-exclamation-circle text-red-600 mt-0.5"></i>
                        <p class="text-sm text-red-700">${escapeHtml(draft.errorMessage)}</p>
                    </div>
                </div>
                ` : ''}

                <div class="flex gap-2">
                    <button onclick="continueEditing(${index})" class="flex-1 p-3 bg-dot-navy hover:bg-dot-blue text-white text-sm font-bold uppercase transition-colors">
                        <i class="fas fa-edit mr-1"></i>Continue
                    </button>
                    ${showRetry ? `
                    <button onclick="retrySync(${index})" class="flex-1 p-3 bg-safety-green hover:bg-green-700 text-white text-sm font-bold uppercase transition-colors">
                        <i class="fas fa-sync-alt mr-1"></i>Retry
                    </button>
                    ` : ''}
                    <button onclick="confirmDelete(${index})" class="p-3 border-2 border-red-300 text-red-600 hover:bg-red-50 transition-colors">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============ ACTIONS ============
function continueEditing(index) {
    const queue = getOfflineQueue();
    const draft = queue.drafts[index];

    if (!draft) {
        showToast('Draft not found', 'error');
        return;
    }

    // Set active project
    if (draft.projectId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, draft.projectId);
    }

    // Store the draft data for quick-interview to load
    // We'll use the existing QUICK_INTERVIEW_STORAGE_KEY format
    const quickInterviewData = {
        projectId: draft.projectId,
        reportDate: draft.reportDate,
        captureMode: draft.captureMode,
        lastSaved: draft.lastSaved,
        ...draft.data
    };

    localStorage.setItem(STORAGE_KEYS.QUICK_INTERVIEW_DRAFT, JSON.stringify(quickInterviewData));

    // Navigate to quick-interview
    window.location.href = 'quick-interview.html';
}

async function retrySync(index) {
    const queue = getOfflineQueue();
    const draft = queue.drafts[index];

    if (!draft) {
        showToast('Draft not found', 'error');
        return;
    }

    if (!navigator.onLine) {
        showToast("You're offline. Connect to sync.", 'warning');
        return;
    }

    // Show loading state
    showToast('Syncing report...', 'info');

    try {
        // Attempt to sync via the same flow as FINISH
        const result = await syncDraft(draft, index);

        if (result.success) {
            // Remove from queue
            removeDraft(index);
            showToast('Report synced successfully!', 'success');

            // Redirect to report.html to view the synced report
            setTimeout(() => {
                window.location.href = 'report.html';
            }, 1000);
        } else {
            // Update error message
            updateDraftError(index, result.error || 'Sync failed. Please try again.');
            renderDrafts();
            showToast('Sync failed', 'error');
        }
    } catch (error) {
        console.error('[DRAFTS] Sync error:', error);
        updateDraftError(index, error.message || 'An unexpected error occurred');
        renderDrafts();
        showToast('Sync failed', 'error');
    }
}

async function syncDraft(draft, index) {
    try {
        // The draft contains all the data needed to complete the FINISH flow
        // This includes the payload for AI processing

        // First, ensure the report exists in Supabase
        const reportData = draft.data;
        if (!reportData) {
            return { success: false, error: 'No report data found in draft' };
        }

        // Set active project for the sync
        if (draft.projectId) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, draft.projectId);
        }

        // Check if report already exists in Supabase
        const { data: existingReport, error: fetchError } = await supabaseClient
            .from('reports')
            .select('id, status')
            .eq('project_id', draft.projectId)
            .eq('report_date', draft.reportDate)
            .single();

        let reportId;
        if (existingReport) {
            reportId = existingReport.id;
        } else {
            // Create the report in Supabase
            const { data: newReport, error: createError } = await supabaseClient
                .from('reports')
                .insert({
                    project_id: draft.projectId,
                    report_date: draft.reportDate,
                    status: 'pending_refine',
                    raw_capture: reportData
                })
                .select('id')
                .single();

            if (createError) {
                return { success: false, error: 'Failed to create report: ' + createError.message };
            }
            reportId = newReport.id;
        }

        // Build payload for AI processing
        const payload = draft.payload || buildPayloadFromDraft(draft);

        // Call the AI processing webhook
        const webhookUrl = 'https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6';
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Webhook error: ${response.status} - ${errorText}` };
        }

        const result = await response.json();

        // Save AI response to report
        if (result.aiGenerated) {
            const { error: updateError } = await supabaseClient
                .from('reports')
                .update({
                    status: 'refined',
                    ai_generated: result.aiGenerated,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reportId);

            if (updateError) {
                return { success: false, error: 'Failed to save AI response: ' + updateError.message };
            }
        }

        return { success: true, reportId };
    } catch (error) {
        console.error('[DRAFTS] Sync error:', error);
        return { success: false, error: error.message || 'Network error during sync' };
    }
}

function buildPayloadFromDraft(draft) {
    // Build payload matching quick-interview.html's buildProcessPayload() structure
    const data = draft.data || {};
    const reportKey = `${draft.projectId}_${draft.reportDate}`;

    return {
        reportId: reportKey,
        captureMode: draft.captureMode || 'guided',

        projectContext: {
            projectId: draft.projectId || null,
            projectName: draft.projectName || '',
            noabProjectNo: data.project?.noabProjectNo || '',
            location: data.project?.location || '',
            engineer: data.project?.engineer || '',
            primeContractor: data.project?.primeContractor || '',
            contractors: data.project?.contractors || [],
            equipment: data.project?.equipment || []
        },

        fieldNotes: draft.captureMode === 'minimal'
            ? { freeformNotes: data.fieldNotes?.freeformNotes || '' }
            : {
                workSummary: data.guidedNotes?.workSummary || '',
                issues: data.guidedNotes?.issues || '',
                safety: data.guidedNotes?.safety || ''
              },

        weather: data.overview?.weather || data.weather || {},

        photos: (data.photos || []).map(p => ({
            id: p.id,
            caption: p.caption || '',
            timestamp: p.timestamp,
            date: p.date,
            time: p.time,
            gps: p.gps
        })),

        reportDate: draft.reportDate || data.overview?.date || new Date().toLocaleDateString(),
        inspectorName: data.overview?.completedBy || ''
    };
}

async function syncAllPending() {
    const queue = getOfflineQueue();
    const syncable = queue.drafts.filter(d => d.status === 'pending_sync' || d.status === 'sync_failed');

    if (syncable.length === 0) {
        showToast('No items to sync', 'info');
        return;
    }

    if (!navigator.onLine) {
        showToast("You're offline. Connect to sync.", 'warning');
        return;
    }

    showToast(`Syncing ${syncable.length} report(s)...`, 'info');

    let successCount = 0;
    let failCount = 0;

    // Sync each item (process in reverse order to handle index shifts)
    for (let i = queue.drafts.length - 1; i >= 0; i--) {
        const draft = queue.drafts[i];
        if (draft.status !== 'pending_sync' && draft.status !== 'sync_failed') continue;

        try {
            const result = await syncDraft(draft, i);
            if (result.success) {
                removeDraft(i);
                successCount++;
            } else {
                updateDraftError(i, result.error);
                failCount++;
            }
        } catch (error) {
            updateDraftError(i, error.message);
            failCount++;
        }
    }

    renderDrafts();

    if (failCount === 0) {
        showToast(`${successCount} report(s) synced!`, 'success');
        if (successCount > 0) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    } else {
        showToast(`${successCount} synced, ${failCount} failed`, failCount > 0 ? 'warning' : 'success');
    }
}

// ============ DELETE MODAL ============
function confirmDelete(index) {
    const queue = getOfflineQueue();
    const draft = queue.drafts[index];

    if (!draft) return;

    pendingDeleteIndex = index;
    document.getElementById('deleteModalProject').textContent = draft.projectName || 'Unknown Project';
    document.getElementById('deleteModal').classList.remove('hidden');

    // Set up confirm button
    document.getElementById('confirmDeleteBtn').onclick = () => {
        deleteDraft(pendingDeleteIndex);
        closeDeleteModal();
    };
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    pendingDeleteIndex = null;
}

function deleteDraft(index) {
    removeDraft(index);
    renderDrafts();
    showToast('Draft deleted', 'success');
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    renderDrafts();
});

// ============ EXPOSE TO WINDOW FOR ONCLICK HANDLERS ============
window.continueEditing = continueEditing;
window.retrySync = retrySync;
window.confirmDelete = confirmDelete;
window.closeDeleteModal = closeDeleteModal;
window.syncAllPending = syncAllPending;
window.renderDrafts = renderDrafts;
