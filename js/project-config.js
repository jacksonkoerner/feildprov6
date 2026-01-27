// ============ CONSTANTS ============
const EXTRACT_WEBHOOK_URL = 'https://advidere.app.n8n.cloud/webhook/fieldvoice-project-extractor';

// ============ STATE ============
let currentProject = null;
let deleteCallback = null;
let selectedFiles = [];
let isLoading = false;

// ============ INITIALIZATION ============
// Note: Initialization moved to end of script with setupDropZone()

// ============ PROJECT MANAGEMENT ============
async function getProjects() {
    try {
        // Fetch all projects
        const { data: projectRows, error: projectError } = await supabaseClient
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (projectError) {
            console.error('Error fetching projects:', projectError);
            showToast('Failed to load projects', 'error');
            return [];
        }

        if (!projectRows || projectRows.length === 0) {
            return [];
        }

        // Fetch all contractors
        const { data: contractorRows, error: contractorError } = await supabaseClient
            .from('contractors')
            .select('*');

        if (contractorError) {
            console.error('Error fetching contractors:', contractorError);
        }

        // Fetch all equipment
        const { data: equipmentRows, error: equipmentError } = await supabaseClient
            .from('equipment')
            .select('*');

        if (equipmentError) {
            console.error('Error fetching equipment:', equipmentError);
        }

        // Build the nested structure
        const projects = projectRows.map(projectRow => {
            const project = fromSupabaseProject(projectRow);

            // Add contractors for this project
            if (contractorRows) {
                project.contractors = contractorRows
                    .filter(c => c.project_id === project.id)
                    .map(fromSupabaseContractor);
            }

            // Add equipment for this project
            if (equipmentRows) {
                project.equipment = equipmentRows
                    .filter(e => e.project_id === project.id)
                    .map(fromSupabaseEquipment);
            }

            return project;
        });

        return projects;
    } catch (error) {
        console.error('Error in getProjects:', error);
        showToast('Failed to load projects', 'error');
        return [];
    }
}

async function saveProjectToSupabase(project) {
    try {
        // 1. Upsert the project
        const projectData = toSupabaseProject(project);
        const { error: projectError } = await supabaseClient
            .from('projects')
            .upsert(projectData, { onConflict: 'id' });

        if (projectError) {
            console.error('Error saving project:', projectError);
            throw new Error('Failed to save project');
        }

        // 2. Handle contractors - get existing ones first
        const { data: existingContractors } = await supabaseClient
            .from('contractors')
            .select('id')
            .eq('project_id', project.id);

        const existingContractorIds = new Set((existingContractors || []).map(c => c.id));
        const currentContractorIds = new Set((project.contractors || []).map(c => c.id));

        // Delete removed contractors (equipment will cascade)
        const contractorsToDelete = [...existingContractorIds].filter(id => !currentContractorIds.has(id));
        if (contractorsToDelete.length > 0) {
            const { error: deleteContractorError } = await supabaseClient
                .from('contractors')
                .delete()
                .in('id', contractorsToDelete);

            if (deleteContractorError) {
                console.error('Error deleting contractors:', deleteContractorError);
            }
        }

        // Upsert current contractors
        if (project.contractors && project.contractors.length > 0) {
            const contractorData = project.contractors.map(c => toSupabaseContractor(c, project.id));
            const { error: contractorError } = await supabaseClient
                .from('contractors')
                .upsert(contractorData, { onConflict: 'id' });

            if (contractorError) {
                console.error('Error saving contractors:', contractorError);
                throw new Error('Failed to save contractors');
            }
        }

        // 3. Handle equipment
        const { data: existingEquipment } = await supabaseClient
            .from('equipment')
            .select('id')
            .eq('project_id', project.id);

        const existingEquipmentIds = new Set((existingEquipment || []).map(e => e.id));
        const currentEquipmentIds = new Set((project.equipment || []).map(e => e.id));

        // Delete removed equipment
        const equipmentToDelete = [...existingEquipmentIds].filter(id => !currentEquipmentIds.has(id));
        if (equipmentToDelete.length > 0) {
            const { error: deleteEquipmentError } = await supabaseClient
                .from('equipment')
                .delete()
                .in('id', equipmentToDelete);

            if (deleteEquipmentError) {
                console.error('Error deleting equipment:', deleteEquipmentError);
            }
        }

        // Upsert current equipment
        if (project.equipment && project.equipment.length > 0) {
            const equipmentData = project.equipment.map(e => toSupabaseEquipment(e, project.id));
            const { error: equipmentError } = await supabaseClient
                .from('equipment')
                .upsert(equipmentData, { onConflict: 'id' });

            if (equipmentError) {
                console.error('Error saving equipment:', equipmentError);
                throw new Error('Failed to save equipment');
            }
        }

        return true;
    } catch (error) {
        console.error('Error in saveProjectToSupabase:', error);
        throw error;
    }
}

async function deleteProjectFromSupabase(projectId) {
    try {
        // Delete the project - contractors and equipment cascade automatically
        const { error } = await supabaseClient
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) {
            console.error('Error deleting project:', error);
            throw new Error('Failed to delete project');
        }

        return true;
    } catch (error) {
        console.error('Error in deleteProjectFromSupabase:', error);
        throw error;
    }
}

function getActiveProjectId() {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

function setActiveProjectId(projectId) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
}

function createNewProject() {
    currentProject = {
        id: generateId(),
        name: '',
        logo: null,
        noabProjectNo: '',
        cnoSolicitationNo: 'N/A',
        location: '',
        engineer: '',
        primeContractor: '',
        noticeToProceed: '',
        reportDate: '',
        contractDuration: '',
        expectedCompletion: '',
        defaultStartTime: '06:00',
        defaultEndTime: '16:00',
        weatherDays: 0,
        contractDayNo: '',
        contractors: [],
        equipment: []
    };
    populateForm();
    showProjectForm();
}

async function loadProject(projectId) {
    try {
        const projects = await getProjects();
        const project = projects.find(p => p.id === projectId);
        if (project) {
            currentProject = JSON.parse(JSON.stringify(project)); // Deep copy
            populateForm();
            showProjectForm();
        }
    } catch (error) {
        console.error('Error loading project:', error);
        showToast('Failed to load project', 'error');
    }
}

async function saveProject() {
    if (!currentProject) return;

    // Validate required fields
    const name = document.getElementById('projectName').value.trim();
    if (!name) {
        showToast('Project name is required', 'error');
        document.getElementById('projectName').focus();
        return;
    }

    // Update current project from form
    currentProject.name = name;
    currentProject.logo = currentProject.logo || null;
    currentProject.noabProjectNo = document.getElementById('noabProjectNo').value.trim();
    currentProject.cnoSolicitationNo = document.getElementById('cnoSolicitationNo').value.trim() || 'N/A';
    currentProject.location = document.getElementById('location').value.trim();
    currentProject.engineer = document.getElementById('engineer').value.trim();
    currentProject.primeContractor = document.getElementById('primeContractor').value.trim();
    currentProject.noticeToProceed = document.getElementById('noticeToProceed').value;
    currentProject.reportDate = document.getElementById('reportDate').value;
    currentProject.contractDuration = parseInt(document.getElementById('contractDuration').value) || null;
    currentProject.expectedCompletion = document.getElementById('expectedCompletion').value;
    currentProject.defaultStartTime = document.getElementById('defaultStartTime').value || '06:00';
    currentProject.defaultEndTime = document.getElementById('defaultEndTime').value || '16:00';
    currentProject.weatherDays = parseInt(document.getElementById('weatherDays').value) || 0;
    currentProject.contractDayNo = parseInt(document.getElementById('contractDayNo').value) || '';

    try {
        // Save to Supabase
        await saveProjectToSupabase(currentProject);
        showToast('Project saved successfully');
        await renderSavedProjects();
        updateActiveProjectBadge();
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Failed to save project', 'error');
    }
}

function deleteProject(projectId) {
    showDeleteModal('Are you sure you want to delete this project? This cannot be undone.', async () => {
        try {
            await deleteProjectFromSupabase(projectId);

            // Clear active project if it was deleted
            if (getActiveProjectId() === projectId) {
                localStorage.removeItem(ACTIVE_PROJECT_KEY);
            }

            // If we're currently editing this project, close the form
            if (currentProject && currentProject.id === projectId) {
                hideProjectForm();
            }

            await renderSavedProjects();
            showToast('Project deleted');
        } catch (error) {
            console.error('Error deleting project:', error);
            showToast('Failed to delete project', 'error');
        }
    });
}

async function setActiveProject() {
    if (!currentProject) return;

    // Save first to ensure project exists
    await saveProject();

    setActiveProjectId(currentProject.id);
    showToast('Set as active project');
    await renderSavedProjects();
    updateActiveProjectBadge();
}

function cancelEdit() {
    currentProject = null;
    hideProjectForm();
}

// ============ UI RENDERING ============
async function renderSavedProjects() {
    const container = document.getElementById('savedProjectsList');

    // Show loading state
    container.innerHTML = `
        <div class="p-6 text-center">
            <i class="fas fa-spinner fa-spin text-slate-400 text-2xl mb-3"></i>
            <p class="text-sm text-slate-500">Loading projects...</p>
        </div>
    `;

    const projects = await getProjects();
    const activeId = getActiveProjectId();

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center">
                <i class="fas fa-folder-open text-slate-300 text-3xl mb-3"></i>
                <p class="text-sm text-slate-500">No saved projects</p>
                <p class="text-xs text-slate-400 mt-1">Create a new project to get started</p>
            </div>
        `;
        return;
    }

    container.innerHTML = projects.map(project => {
        const isActive = project.id === activeId;
        const isEditing = currentProject && currentProject.id === project.id;
        return `
            <div class="p-4 ${isEditing ? 'bg-dot-blue/5' : ''} ${isActive ? 'border-l-4 border-safety-green' : ''}">
                <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <p class="font-bold text-slate-800 truncate">${escapeHtml(project.name)}</p>
                            ${isActive ? '<span class="shrink-0 text-[10px] bg-safety-green text-white px-2 py-0.5 font-bold uppercase">Active</span>' : ''}
                        </div>
                        <p class="text-xs text-slate-500 mt-1">
                            ${project.noabProjectNo ? `#${escapeHtml(project.noabProjectNo)}` : 'No project number'}
                            ${project.location ? ` • ${escapeHtml(project.location)}` : ''}
                        </p>
                        <p class="text-xs text-slate-400 mt-1">
                            ${project.contractors?.length || 0} contractors • ${project.equipment?.length || 0} equipment
                        </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button onclick="loadProject('${project.id}')" class="w-9 h-9 bg-dot-blue text-white flex items-center justify-center hover:bg-blue-800 transition-colors" title="Edit">
                            <i class="fas fa-edit text-sm"></i>
                        </button>
                        <button onclick="deleteProject('${project.id}')" class="w-9 h-9 bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors" title="Delete">
                            <i class="fas fa-trash text-sm"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function populateForm() {
    if (!currentProject) return;

    document.getElementById('projectName').value = currentProject.name || '';
    document.getElementById('noabProjectNo').value = currentProject.noabProjectNo || '';
    document.getElementById('cnoSolicitationNo').value = currentProject.cnoSolicitationNo || 'N/A';
    document.getElementById('location').value = currentProject.location || '';
    document.getElementById('engineer').value = currentProject.engineer || '';
    document.getElementById('primeContractor').value = currentProject.primeContractor || '';
    document.getElementById('noticeToProceed').value = currentProject.noticeToProceed || '';
    document.getElementById('reportDate').value = currentProject.reportDate || '';
    document.getElementById('contractDuration').value = currentProject.contractDuration || '';
    document.getElementById('expectedCompletion').value = currentProject.expectedCompletion || '';
    document.getElementById('defaultStartTime').value = currentProject.defaultStartTime || '06:00';
    document.getElementById('defaultEndTime').value = currentProject.defaultEndTime || '16:00';
    document.getElementById('weatherDays').value = currentProject.weatherDays || 0;
    document.getElementById('contractDayNo').value = currentProject.contractDayNo || '';

    // Handle logo preview
    const logoUploadZone = document.getElementById('logoUploadZone');
    const logoPreviewArea = document.getElementById('logoPreviewArea');
    const logoPreviewImg = document.getElementById('logoPreviewImg');

    if (currentProject.logo) {
        logoPreviewImg.src = currentProject.logo;
        logoUploadZone.classList.add('hidden');
        logoPreviewArea.classList.remove('hidden');
    } else {
        logoUploadZone.classList.remove('hidden');
        logoPreviewArea.classList.add('hidden');
        logoPreviewImg.src = '';
    }

    renderContractors();
    renderEquipment();
    updateActiveProjectBadge();
}

function showProjectForm() {
    document.getElementById('projectFormContainer').classList.remove('hidden');
    // Scroll to form
    document.getElementById('projectFormContainer').scrollIntoView({ behavior: 'smooth' });
}

function hideProjectForm() {
    document.getElementById('projectFormContainer').classList.add('hidden');
    currentProject = null;
}

function updateActiveProjectBadge() {
    const badge = document.getElementById('activeProjectBadge');
    const setActiveBtn = document.getElementById('setActiveBtn');

    if (currentProject && getActiveProjectId() === currentProject.id) {
        badge.classList.remove('hidden');
        setActiveBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Currently Active';
        setActiveBtn.disabled = true;
        setActiveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        badge.classList.add('hidden');
        setActiveBtn.innerHTML = '<i class="fas fa-star mr-2"></i>Set as Active Project';
        setActiveBtn.disabled = false;
        setActiveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// ============ CONTRACTOR MANAGEMENT ============
function renderContractors() {
    const container = document.getElementById('contractorList');

    if (!currentProject || currentProject.contractors.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center">
                <i class="fas fa-hard-hat text-slate-300 text-2xl mb-2"></i>
                <p class="text-sm text-slate-500">No contractors added</p>
            </div>
        `;
        updateEquipmentContractorDropdown();
        return;
    }

    // Sort: prime contractors first
    const sortedContractors = [...currentProject.contractors].sort((a, b) => {
        if (a.type === 'prime' && b.type !== 'prime') return -1;
        if (a.type !== 'prime' && b.type === 'prime') return 1;
        return 0;
    });

    container.innerHTML = sortedContractors.map((contractor, index) => `
        <div class="p-4 flex items-start gap-3" data-contractor-id="${contractor.id}" draggable="true">
            <div class="drag-handle w-8 h-8 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <p class="font-bold text-slate-800">${escapeHtml(contractor.name)}</p>
                    <span class="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 font-mono">${escapeHtml(contractor.abbreviation)}</span>
                </div>
                <p class="text-xs mt-1">
                    <span class="${contractor.type === 'prime' ? 'text-safety-green font-bold' : 'text-slate-500'}">${contractor.type === 'prime' ? 'PRIME' : 'Subcontractor'}</span>
                    ${contractor.trades ? ` • ${escapeHtml(contractor.trades)}` : ''}
                </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button onclick="editContractor('${contractor.id}')" class="w-8 h-8 text-dot-blue hover:bg-dot-blue/10 flex items-center justify-center transition-colors" title="Edit">
                    <i class="fas fa-edit text-sm"></i>
                </button>
                <button onclick="deleteContractor('${contractor.id}')" class="w-8 h-8 text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors" title="Delete">
                    <i class="fas fa-trash text-sm"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Setup drag and drop
    setupContractorDragDrop();
    updateEquipmentContractorDropdown();
}

function showAddContractorForm() {
    document.getElementById('addContractorForm').classList.remove('hidden');
    document.getElementById('contractorFormTitle').textContent = 'Add New Contractor';
    document.getElementById('editContractorId').value = '';
    document.getElementById('contractorName').value = '';
    document.getElementById('contractorAbbr').value = '';
    document.getElementById('contractorType').value = 'subcontractor';
    document.getElementById('contractorTrades').value = '';
    document.getElementById('addContractorForm').scrollIntoView({ behavior: 'smooth' });
}

function hideAddContractorForm() {
    document.getElementById('addContractorForm').classList.add('hidden');
}

function editContractor(contractorId) {
    const contractor = currentProject.contractors.find(c => c.id === contractorId);
    if (!contractor) return;

    document.getElementById('addContractorForm').classList.remove('hidden');
    document.getElementById('contractorFormTitle').textContent = 'Edit Contractor';
    document.getElementById('editContractorId').value = contractorId;
    document.getElementById('contractorName').value = contractor.name;
    document.getElementById('contractorAbbr').value = contractor.abbreviation;
    document.getElementById('contractorType').value = contractor.type;
    document.getElementById('contractorTrades').value = contractor.trades || '';
    document.getElementById('addContractorForm').scrollIntoView({ behavior: 'smooth' });
}

function saveContractor() {
    const name = document.getElementById('contractorName').value.trim();
    const abbr = document.getElementById('contractorAbbr').value.trim().toUpperCase();
    const type = document.getElementById('contractorType').value;
    const trades = document.getElementById('contractorTrades').value.trim();
    const editId = document.getElementById('editContractorId').value;

    if (!name || !abbr) {
        showToast('Name and abbreviation are required', 'error');
        return;
    }

    if (editId) {
        // Edit existing
        const contractor = currentProject.contractors.find(c => c.id === editId);
        if (contractor) {
            contractor.name = name;
            contractor.abbreviation = abbr;
            contractor.type = type;
            contractor.trades = trades;
        }
    } else {
        // Add new
        currentProject.contractors.push({
            id: generateId(),
            name,
            abbreviation: abbr,
            type,
            trades
        });
    }

    hideAddContractorForm();
    renderContractors();
    showToast(editId ? 'Contractor updated' : 'Contractor added');
}

function deleteContractor(contractorId) {
    showDeleteModal('Delete this contractor? Any equipment assigned to them will also be removed.', () => {
        currentProject.contractors = currentProject.contractors.filter(c => c.id !== contractorId);
        // Also remove equipment for this contractor
        currentProject.equipment = currentProject.equipment.filter(e => e.contractorId !== contractorId);
        renderContractors();
        renderEquipment();
        showToast('Contractor deleted');
    });
}

function setupContractorDragDrop() {
    const container = document.getElementById('contractorList');
    const items = container.querySelectorAll('[data-contractor-id]');

    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleContractorDrop);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleContractorDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (this !== draggedItem) {
        const draggedId = draggedItem.getAttribute('data-contractor-id');
        const targetId = this.getAttribute('data-contractor-id');

        const draggedIndex = currentProject.contractors.findIndex(c => c.id === draggedId);
        const targetIndex = currentProject.contractors.findIndex(c => c.id === targetId);

        if (draggedIndex > -1 && targetIndex > -1) {
            const [removed] = currentProject.contractors.splice(draggedIndex, 1);
            currentProject.contractors.splice(targetIndex, 0, removed);
            renderContractors();
        }
    }
}

// ============ EQUIPMENT MANAGEMENT ============
function renderEquipment() {
    const container = document.getElementById('equipmentList');
    const addBtn = document.getElementById('addEquipmentBtn');

    if (!currentProject || currentProject.contractors.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center">
                <i class="fas fa-truck-monster text-slate-300 text-2xl mb-2"></i>
                <p class="text-sm text-slate-500">Add contractors first</p>
            </div>
        `;
        addBtn.disabled = true;
        return;
    }

    addBtn.disabled = false;

    if (currentProject.equipment.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center">
                <i class="fas fa-truck-monster text-slate-300 text-2xl mb-2"></i>
                <p class="text-sm text-slate-500">No equipment added</p>
            </div>
        `;
        return;
    }

    // Group equipment by contractor
    const grouped = {};
    currentProject.contractors.forEach(c => {
        grouped[c.id] = {
            contractor: c,
            equipment: []
        };
    });

    currentProject.equipment.forEach(eq => {
        if (grouped[eq.contractorId]) {
            grouped[eq.contractorId].equipment.push(eq);
        }
    });

    let html = '';
    Object.values(grouped).forEach(group => {
        if (group.equipment.length === 0) return;

        html += `
            <div class="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <p class="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <i class="fas fa-hard-hat mr-1 text-dot-orange"></i>
                    ${escapeHtml(group.contractor.name)} (${escapeHtml(group.contractor.abbreviation)})
                </p>
            </div>
        `;

        group.equipment.forEach(eq => {
            html += `
                <div class="p-4 pl-8 flex items-center gap-3">
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-slate-800">${escapeHtml(eq.type)}</p>
                        ${eq.model ? `<p class="text-xs text-slate-500">${escapeHtml(eq.model)}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button onclick="editEquipment('${eq.id}')" class="w-8 h-8 text-dot-blue hover:bg-dot-blue/10 flex items-center justify-center transition-colors" title="Edit">
                            <i class="fas fa-edit text-sm"></i>
                        </button>
                        <button onclick="deleteEquipment('${eq.id}')" class="w-8 h-8 text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors" title="Delete">
                            <i class="fas fa-trash text-sm"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    });

    container.innerHTML = html || `
        <div class="p-6 text-center">
            <i class="fas fa-truck-monster text-slate-300 text-2xl mb-2"></i>
            <p class="text-sm text-slate-500">No equipment added</p>
        </div>
    `;
}

function updateEquipmentContractorDropdown() {
    const select = document.getElementById('equipmentContractor');

    if (!currentProject || currentProject.contractors.length === 0) {
        select.innerHTML = '<option value="">No contractors available</option>';
        return;
    }

    select.innerHTML = currentProject.contractors.map(c =>
        `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.abbreviation)})</option>`
    ).join('');
}

function showAddEquipmentForm() {
    if (!currentProject || currentProject.contractors.length === 0) {
        showToast('Add contractors first', 'warning');
        return;
    }

    document.getElementById('addEquipmentForm').classList.remove('hidden');
    document.getElementById('equipmentFormTitle').textContent = 'Add New Equipment';
    document.getElementById('editEquipmentId').value = '';
    document.getElementById('equipmentContractor').value = currentProject.contractors[0]?.id || '';
    document.getElementById('equipmentType').value = '';
    document.getElementById('equipmentModel').value = '';
    document.getElementById('addEquipmentForm').scrollIntoView({ behavior: 'smooth' });
}

function hideAddEquipmentForm() {
    document.getElementById('addEquipmentForm').classList.add('hidden');
}

function editEquipment(equipmentId) {
    const equipment = currentProject.equipment.find(e => e.id === equipmentId);
    if (!equipment) return;

    document.getElementById('addEquipmentForm').classList.remove('hidden');
    document.getElementById('equipmentFormTitle').textContent = 'Edit Equipment';
    document.getElementById('editEquipmentId').value = equipmentId;
    document.getElementById('equipmentContractor').value = equipment.contractorId;
    document.getElementById('equipmentType').value = equipment.type;
    document.getElementById('equipmentModel').value = equipment.model || '';
    document.getElementById('addEquipmentForm').scrollIntoView({ behavior: 'smooth' });
}

function saveEquipment() {
    const contractorId = document.getElementById('equipmentContractor').value;
    const type = document.getElementById('equipmentType').value.trim();
    const model = document.getElementById('equipmentModel').value.trim();
    const editId = document.getElementById('editEquipmentId').value;

    if (!contractorId || !type) {
        showToast('Contractor and equipment type are required', 'error');
        return;
    }

    if (editId) {
        // Edit existing
        const equipment = currentProject.equipment.find(e => e.id === editId);
        if (equipment) {
            equipment.contractorId = contractorId;
            equipment.type = type;
            equipment.model = model;
        }
    } else {
        // Add new
        currentProject.equipment.push({
            id: generateId(),
            contractorId,
            type,
            model
        });
    }

    hideAddEquipmentForm();
    renderEquipment();
    showToast(editId ? 'Equipment updated' : 'Equipment added');
}

function deleteEquipment(equipmentId) {
    showDeleteModal('Delete this equipment?', () => {
        currentProject.equipment = currentProject.equipment.filter(e => e.id !== equipmentId);
        renderEquipment();
        showToast('Equipment deleted');
    });
}

// ============ MODAL ============
function showDeleteModal(message, callback) {
    document.getElementById('deleteModalMessage').textContent = message;
    document.getElementById('deleteModal').classList.remove('hidden');
    deleteCallback = callback;
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    deleteCallback = null;
}

function confirmDelete() {
    if (deleteCallback) {
        deleteCallback();
    }
    closeDeleteModal();
}

// ============ FILE IMPORT FUNCTIONS ============
function setupDropZone() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-active'), false);
    });

    dropZone.addEventListener('drop', handleFileDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFileDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    const validExtensions = ['.pdf', '.docx'];
    const newFiles = Array.from(files).filter(file => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(ext)) {
            showToast(`Invalid file type: ${file.name}. Only PDF and DOCX allowed.`, 'error');
            return false;
        }
        // Check for duplicates
        if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            showToast(`File already added: ${file.name}`, 'warning');
            return false;
        }
        return true;
    });

    selectedFiles = [...selectedFiles, ...newFiles];
    renderFileList();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
        return '<i class="fas fa-file-pdf text-red-500"></i>';
    } else if (ext === 'docx' || ext === 'doc') {
        return '<i class="fas fa-file-word text-blue-500"></i>';
    }
    return '<i class="fas fa-file text-slate-400"></i>';
}

function renderFileList() {
    const listContainer = document.getElementById('selectedFilesList');
    const filesContainer = document.getElementById('filesContainer');
    const extractBtn = document.getElementById('extractBtn');

    if (selectedFiles.length === 0) {
        listContainer.classList.add('hidden');
        extractBtn.classList.add('hidden');
        return;
    }

    listContainer.classList.remove('hidden');
    extractBtn.classList.remove('hidden');

    filesContainer.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item flex items-center gap-3 bg-white p-3 rounded border border-slate-200">
            <span class="text-lg">${getFileIcon(file.name)}</span>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-slate-800 truncate">${escapeHtml(file.name)}</p>
                <p class="text-xs text-slate-500">${formatFileSize(file.size)}</p>
            </div>
            <button onclick="removeFile(${index})" class="w-8 h-8 text-red-500 hover:bg-red-50 flex items-center justify-center rounded transition-colors" title="Remove file">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
}

function clearSelectedFiles() {
    selectedFiles = [];
    document.getElementById('fileInput').value = '';
    renderFileList();
}

// ============ LOGO UPLOAD FUNCTIONS ============
function handleLogoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate it's an image
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        showToast('Please select a valid image file (PNG, JPG, SVG, GIF)', 'error');
        event.target.value = '';
        return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result;
        currentProject.logo = base64Data;

        // Show preview
        const logoUploadZone = document.getElementById('logoUploadZone');
        const logoPreviewArea = document.getElementById('logoPreviewArea');
        const logoPreviewImg = document.getElementById('logoPreviewImg');

        logoPreviewImg.src = base64Data;
        logoUploadZone.classList.add('hidden');
        logoPreviewArea.classList.remove('hidden');

        showToast('Logo uploaded');
    };
    reader.onerror = function() {
        showToast('Error reading file', 'error');
    };
    reader.readAsDataURL(file);

    // Clear the input so the same file can be selected again
    event.target.value = '';
}

function removeLogo() {
    if (!currentProject) return;

    currentProject.logo = null;

    const logoUploadZone = document.getElementById('logoUploadZone');
    const logoPreviewArea = document.getElementById('logoPreviewArea');
    const logoPreviewImg = document.getElementById('logoPreviewImg');

    logoPreviewImg.src = '';
    logoPreviewArea.classList.add('hidden');
    logoUploadZone.classList.remove('hidden');

    // Clear the file input
    document.getElementById('logoInput').value = '';

    showToast('Logo removed');
}

function setupLogoDropZone() {
    const logoDropZone = document.getElementById('logoUploadZone');
    if (!logoDropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        logoDropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        logoDropZone.addEventListener(eventName, () => logoDropZone.classList.add('drag-active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        logoDropZone.addEventListener(eventName, () => logoDropZone.classList.remove('drag-active'), false);
    });

    logoDropZone.addEventListener('drop', handleLogoDrop, false);
}

function handleLogoDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        // Create a fake event to reuse handleLogoSelect
        const fakeEvent = {
            target: {
                files: files,
                value: ''
            }
        };
        handleLogoSelect(fakeEvent);
    }
}

// ============ EXTRACTION FUNCTIONS ============
async function extractProjectData() {
    if (selectedFiles.length === 0) {
        showToast('Please select at least one file', 'error');
        return;
    }

    // Hide any previous banners
    hideExtractionBanners();

    // Show loading state
    setExtractButtonLoading(true);

    try {
        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('documents', file);
        });

        const response = await fetch(EXTRACT_WEBHOOK_URL, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success && result.data) {
            // Populate form with extracted data
            populateFormWithExtractedData(result.data);

            // Show success banner
            document.getElementById('extractionSuccessBanner').classList.remove('hidden');

            // Show extraction notes if any
            if (result.extractionNotes && result.extractionNotes.length > 0) {
                showExtractionNotes(result.extractionNotes);
            }

            // Clear selected files
            clearSelectedFiles();

            // Scroll to top of form
            document.getElementById('projectFormContainer').scrollIntoView({ behavior: 'smooth' });
        } else {
            // Show error banner
            const errorMsg = result.error || 'Failed to extract project data. Please try again.';
            document.getElementById('extractionErrorMessage').textContent = errorMsg;
            document.getElementById('extractionErrorBanner').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Extraction error:', error);
        document.getElementById('extractionErrorMessage').textContent = 'Network error. Please check your connection and try again.';
        document.getElementById('extractionErrorBanner').classList.remove('hidden');
    } finally {
        setExtractButtonLoading(false);
    }
}

function setExtractButtonLoading(isLoading) {
    const btn = document.getElementById('extractBtn');
    const icon = document.getElementById('extractBtnIcon');
    const text = document.getElementById('extractBtnText');

    if (isLoading) {
        btn.disabled = true;
        icon.className = 'fas fa-spinner spin-animation';
        text.textContent = 'Extracting...';
    } else {
        btn.disabled = false;
        icon.className = 'fas fa-magic';
        text.textContent = 'Extract Project Data';
    }
}

function hideExtractionBanners() {
    document.getElementById('extractionSuccessBanner').classList.add('hidden');
    document.getElementById('extractionErrorBanner').classList.add('hidden');
}

function showExtractionNotes(notes) {
    const section = document.getElementById('extractionNotesSection');
    const list = document.getElementById('extractionNotesList');

    list.innerHTML = notes.map(note => `<li>${escapeHtml(note)}</li>`).join('');
    section.classList.remove('hidden');
}

function toggleExtractionNotes() {
    const content = document.getElementById('extractionNotesContent');
    const icon = document.getElementById('notesToggleIcon');

    content.classList.toggle('hidden');
    icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

// ============ FORM POPULATION FROM EXTRACTED DATA ============
function populateFormWithExtractedData(data) {
    if (!currentProject) return;

    // Define field mappings: formFieldId -> dataFieldPath
    const fieldMappings = {
        'projectName': 'projectName',
        'noabProjectNo': 'noabProjectNo',
        'cnoSolicitationNo': 'cnoSolicitationNo',
        'location': 'location',
        'engineer': 'engineer',
        'primeContractor': 'primeContractor',
        'noticeToProceed': 'noticeToProceed',
        'reportDate': 'reportDate',
        'contractDuration': 'contractDuration',
        'expectedCompletion': 'expectedCompletion',
        'defaultStartTime': 'defaultStartTime',
        'defaultEndTime': 'defaultEndTime',
        'weatherDays': 'weatherDays',
        'contractDayNo': 'contractDayNo'
    };

    // Track missing fields
    const missingFields = [];

    // Populate each field
    Object.entries(fieldMappings).forEach(([fieldId, dataKey]) => {
        const input = document.getElementById(fieldId);
        if (!input) return;

        const value = data[dataKey];

        // Clear any previous missing field indicators
        clearMissingFieldIndicator(input);

        if (value === null || value === undefined || value === '') {
            // Mark as missing
            markFieldAsMissing(input);
            missingFields.push(fieldId);
            input.value = '';
        } else {
            input.value = value;
            // Update currentProject
            currentProject[dataKey] = value;
        }
    });

    // Process contractors
    if (data.contractors && Array.isArray(data.contractors)) {
        const contractorIdMap = {}; // Map original names to new IDs
        currentProject.contractors = data.contractors.map(contractor => {
            const id = generateId();
            contractorIdMap[contractor.name] = id;
            return {
                id: id,
                name: contractor.name || '',
                abbreviation: contractor.abbreviation || generateAbbreviation(contractor.name),
                type: contractor.type || 'subcontractor',
                trades: contractor.trades || ''
            };
        });

        // Process equipment
        if (data.equipment && Array.isArray(data.equipment)) {
            currentProject.equipment = data.equipment.map(equip => {
                // Try to match contractor by name
                let contractorId = contractorIdMap[equip.contractorName];

                // If not found by exact name, try to find by partial match
                if (!contractorId && equip.contractorName) {
                    const matchedContractor = currentProject.contractors.find(c =>
                        c.name.toLowerCase().includes(equip.contractorName.toLowerCase()) ||
                        equip.contractorName.toLowerCase().includes(c.name.toLowerCase())
                    );
                    if (matchedContractor) {
                        contractorId = matchedContractor.id;
                    }
                }

                // If still not found, use first contractor as fallback
                if (!contractorId && currentProject.contractors.length > 0) {
                    contractorId = currentProject.contractors[0].id;
                }

                return {
                    id: generateId(),
                    contractorId: contractorId || '',
                    type: equip.type || '',
                    model: equip.model || ''
                };
            }).filter(eq => eq.contractorId); // Only keep equipment with valid contractor
        }

        renderContractors();
        renderEquipment();
    }

    // Setup input listeners to clear missing indicators when user types
    setupMissingFieldListeners();
}

function generateAbbreviation(name) {
    if (!name) return '';
    // Take first letter of each word, max 4 characters
    const words = name.split(/\s+/);
    if (words.length === 1) {
        return name.substring(0, 3).toUpperCase();
    }
    return words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
}

function markFieldAsMissing(input) {
    input.classList.add('missing-field');

    // Create missing indicator if it doesn't exist
    const parent = input.parentElement;
    let indicator = parent.querySelector('.missing-indicator');
    if (!indicator) {
        indicator = document.createElement('p');
        indicator.className = 'missing-indicator mt-1';
        indicator.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i>Missing - please fill in';
        parent.appendChild(indicator);
    }
}

function clearMissingFieldIndicator(input) {
    input.classList.remove('missing-field');
    const parent = input.parentElement;
    const indicator = parent.querySelector('.missing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function setupMissingFieldListeners() {
    const inputs = document.querySelectorAll('.missing-field');
    inputs.forEach(input => {
        // Remove existing listener if any to avoid duplicates
        input.removeEventListener('input', handleMissingFieldInput);
        input.addEventListener('input', handleMissingFieldInput);
    });
}

function handleMissingFieldInput(e) {
    const input = e.target;
    if (input.value.trim() !== '') {
        clearMissingFieldIndicator(input);
    }
}

// Initialize drop zones when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await renderSavedProjects();
    setupDropZone();
    setupLogoDropZone();
});
