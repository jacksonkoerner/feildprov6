# FieldVoice Pro - Voice-Powered Construction Field Reporting System

## Overview

**FieldVoice Pro** is a mobile-optimized Progressive Web Application (PWA) designed for construction field documentation. It enables Resident Project Representatives (RPRs), field engineers, and inspectors to quickly document daily work activities using native device dictation, generating professional DOT-compliant reports.

### Primary Use Case
- **Target Users**: Construction inspectors, Resident Project Representatives (RPRs), field engineers
- **Industry Focus**: DOT (Department of Transportation) construction projects
- **Deployment**: Configurable for any construction project

### Key Value Propositions
- Save 1+ hour daily on field documentation
- Ensure DOT compliance with structured reporting
- GPS-verified, timestamped reports for legal protection
- Optimized for mobile field use with native keyboard dictation support
- Automated project setup via document import from existing reports
- Multi-device sync via cloud storage

---

## Technology Stack

### Frontend
| Technology | Purpose | Version/Source |
|------------|---------|----------------|
| **Tailwind CSS** | Utility-first CSS framework | CDN (`cdn.tailwindcss.com`) |
| **Font Awesome** | Icon library | v6.4.0 CDN |
| **Vanilla JavaScript** | Core application logic | ES6+ |

### Backend & Storage
| Service | Purpose | Notes |
|---------|---------|-------|
| **Supabase** | PostgreSQL database, authentication, real-time sync | Cloud-hosted at `ruzadotbgkjhgwkvotlz.supabase.co` |

### External APIs & Services
| Service | Purpose | Authentication |
|---------|---------|----------------|
| **Open-Meteo API** | Real-time weather data | None (free, no key required) |
| **n8n Webhooks** | AI text refinement, document extraction | HTTPS endpoints |

### Browser APIs Used
| API | Purpose |
|-----|---------|
| MediaDevices API | Camera access |
| Geolocation API | GPS coordinates for photos/weather |
| Canvas API | Image compression |
| localStorage | Device-specific state (active project, permission flags) |
| Service Worker API | Offline caching and PWA support |
| FileReader API | Document import and image handling |
| Drag and Drop API | File upload for document import |

### Architecture
- **Type**: Progressive Web Application (PWA) with cloud backend
- **Backend**: Supabase (PostgreSQL + real-time subscriptions)
- **Database**: Supabase tables (see Data Model section)
- **Local Storage**: Device-specific preferences only
- **Deployment**: Static web server (HTTPS required for media APIs)

---

## Project Structure

```
/
├── index.html              # Home dashboard / main entry point with project selection
├── quick-interview.html    # Daily report flow (contractor-based DOT field entry)
├── report.html             # AI-populated editable report with original notes view
├── finalreview.html        # Read-only DOT RPR Daily Report viewer for finalized reports
├── archives.html           # Report archives with swipe-to-delete functionality
├── drafts.html             # Drafts & offline queue management
├── permissions.html        # System setup, permission testing (mic, camera, GPS)
├── permission-debug.html   # Permission debugging and troubleshooting utility
├── project-config.html     # Project & contractor configuration management
├── settings.html           # Inspector profile & personal information
├── landing.html            # Marketing/onboarding landing page
├── admin-debug.html        # Admin debugging tool for data investigation
├── sw.js                   # Service worker for PWA offline support
├── manifest.json           # PWA manifest with app metadata and icons
├── package.json            # NPM config (devDependency: Sharp for icon generation)
├── generate-icons.js       # Script to generate PWA icons from SVG
├── assets/                 # Favicon and browser icon assets
│   ├── favicon.ico         # Standard favicon for browsers
│   ├── favicon-16x16.png   # Small favicon
│   ├── favicon-32x32.png   # Standard favicon
│   ├── apple-touch-icon.png      # iOS home screen icon
│   ├── android-chrome-192x192.png  # Android Chrome icon
│   └── android-chrome-512x512.png  # Android Chrome large icon
├── icons/                  # PWA app icons directory
│   ├── icon.svg            # Source SVG icon (construction/microphone themed)
│   ├── icon-72x72.png      # App icon for various device sizes
│   ├── icon-72x72-maskable.png     # Maskable icon for Android
│   ├── icon-96x96.png
│   ├── icon-96x96-maskable.png
│   ├── icon-128x128.png
│   ├── icon-128x128-maskable.png
│   ├── icon-144x144.png
│   ├── icon-144x144-maskable.png
│   ├── icon-152x152.png
│   ├── icon-152x152-maskable.png
│   ├── icon-192x192.png
│   ├── icon-192x192-maskable.png
│   ├── icon-384x384.png
│   ├── icon-384x384-maskable.png
│   ├── icon-512x512.png
│   └── icon-512x512-maskable.png
├── docs/                   # Technical documentation
│   ├── project-config-spec.md
│   ├── quick-interview-spec.md
│   ├── report-page-spec.md
│   ├── finalreview-spec.md
│   ├── current-data-flow.md        # Detailed data flow mapping
│   ├── data-flow-audit.md          # Complete table usage audit by page
│   ├── supabase-schema.md          # Comprehensive Supabase schema documentation
│   └── report-finalreview-archives-investigation.md  # Page interconnection analysis
├── migrations/             # Database migration scripts
│   └── 001_add_guided_section_columns.sql  # Adds guided mode columns
└── README.md               # This documentation file
```

### Page Descriptions

| Page | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~1,100 | Dashboard with project selection, active project display, weather, and navigation |
| `quick-interview.html` | ~4,356 | DOT-compliant report with dual capture modes (Quick Notes minimal or Guided Sections), 12 expandable sections, auto-expanding textareas, contractor-based work entry |
| `report.html` | ~3,302 | AI-populated editable DOT form with Form View and Original Notes tabs, Final Review navigation |
| `finalreview.html` | ~2,320 | Read-only DOT RPR Daily Report viewer matching official DOT format with 4+ page layout, print-optimized CSS, contractor-based work summary, operations/equipment tables, and photo grid |
| `archives.html` | ~564 | Report history with swipe-to-delete, date-sorted report list, view finalized reports |
| `drafts.html` | ~699 | Drafts & offline queue management - displays pending reports waiting to sync when online |
| `permissions.html` | ~1,596 | Permission testing (mic, camera, GPS), iOS-specific instructions for native dictation |
| `permission-debug.html` | ~1,074 | Debugging utility for troubleshooting permission issues |
| `project-config.html` | ~2,106 | Project management with document import, contractor roster, equipment inventory, and contract details |
| `settings.html` | ~538 | Inspector profile - personal information, title, company, signature preview, and app refresh |
| `landing.html` | ~1,560 | Marketing page with feature overview and onboarding |
| `admin-debug.html` | ~277 | Admin debugging tool for investigating data issues, clearing localStorage, managing reports |

---

## Data Model

### Supabase Tables

FieldVoice Pro uses Supabase for cloud storage, enabling multi-device sync and persistent data storage.

#### User Profiles Table (`user_profiles`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | User identifier |
| `full_name` | text | Inspector's full name |
| `title` | text | Job title (e.g., "RPR") |
| `company` | text | Company/firm name |
| `email` | text | Email address (optional) |
| `phone` | text | Phone number (optional) |
| `created_at` | timestamp | Record creation time |
| `updated_at` | timestamp | Last update time |

#### Projects Table (`projects`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Project identifier |
| `project_name` | text | Project name |
| `noab_project_no` | text | NOAB project number |
| `cno_solicitation_no` | text | CNO solicitation number |
| `location` | text | Project location |
| `engineer` | text | Engineering firm |
| `prime_contractor` | text | Prime contractor name |
| `notice_to_proceed` | date | Contract start date |
| `contract_duration` | integer | Duration in days |
| `weather_days` | integer | Accumulated weather days |
| `expected_completion` | date | Expected completion date |
| `default_start_time` | time | Default shift start |
| `default_end_time` | time | Default shift end |
| `logo` | bytea | Project logo (base64) |
| `contractors` | jsonb | Array of contractor objects |
| `equipment` | jsonb | Array of equipment objects |
| `status` | text | "active" or "archived" |
| `created_at` | timestamp | Record creation time |
| `updated_at` | timestamp | Last update time |

#### Reports Table (`reports`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Report identifier |
| `project_id` | UUID (FK) | Reference to projects table |
| `report_date` | date | Date of the report |
| `status` | text | "draft", "submitted", or "finalized" |
| `created_at` | timestamp | Record creation time |
| `updated_at` | timestamp | Last update time |

#### Report Raw Capture (`report_raw_capture`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record identifier |
| `report_id` | UUID (FK) | Reference to reports table |
| `transcript` | text | Minimal mode notes |
| `guided_notes` | jsonb | Guided mode section data |
| `site_conditions` | text | Site conditions description |
| `work_summary` | text | Work summary text |
| `created_at` | timestamp | Record creation time |

#### Report Contractor Work (`report_contractor_work`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record identifier |
| `report_id` | UUID (FK) | Reference to reports table |
| `contractor_id` | UUID | Contractor identifier |
| `contractor_name` | text | Contractor name |
| `no_work` | boolean | No work performed flag |
| `narrative` | text | Work description |
| `equipment_used` | text | Equipment used |
| `crew` | text | Crew description |
| `created_at` | timestamp | Record creation time |

#### Report Personnel (`report_personnel`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record identifier |
| `report_id` | UUID (FK) | Reference to reports table |
| `contractor_id` | UUID | Contractor identifier |
| `contractor_name` | text | Contractor name |
| `superintendents` | integer | Count |
| `foremen` | integer | Count |
| `operators` | integer | Count |
| `laborers` | integer | Count |
| `surveyors` | integer | Count |
| `others` | integer | Count |
| `total` | integer | Calculated total |
| `created_at` | timestamp | Record creation time |

#### Report Equipment Usage (`report_equipment_usage`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record identifier |
| `report_id` | UUID (FK) | Reference to reports table |
| `equipment_id` | UUID | Equipment identifier |
| `equipment_type` | text | Equipment type |
| `equipment_model` | text | Equipment model |
| `contractor_id` | UUID | Contractor identifier |
| `contractor_name` | text | Contractor name |
| `hours_utilized` | integer | Hours used (0-10) |
| `created_at` | timestamp | Record creation time |

#### Report Photos (`report_photos`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record identifier |
| `report_id` | UUID (FK) | Reference to reports table |
| `photo_data` | text | Base64 encoded image |
| `caption` | text | Photo caption |
| `gps_lat` | numeric | GPS latitude |
| `gps_lng` | numeric | GPS longitude |
| `gps_accuracy` | integer | GPS accuracy in meters |
| `timestamp` | timestamp | Photo timestamp |
| `original_filename` | text | Original file name |
| `created_at` | timestamp | Record creation time |

#### Report AI Response (`report_ai_response`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record identifier |
| `report_id` | UUID (FK) | Reference to reports table |
| `ai_generated_content` | jsonb | All AI-generated sections |
| `model_used` | text | AI model identifier |
| `processing_time_ms` | integer | Processing time |
| `received_at` | timestamp | Response timestamp |
| `created_at` | timestamp | Record creation time |

#### Report User Edits (`report_user_edits`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record identifier |
| `report_id` | UUID (FK) | Reference to reports table |
| `field_path` | text | Path to edited field |
| `original_value` | text | Original value |
| `edited_value` | text | User-edited value |
| `edited_at` | timestamp | Edit timestamp |
| `created_at` | timestamp | Record creation time |

#### Report Final (`report_final`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Record identifier |
| `report_id` | UUID (FK) | Reference to reports table |
| `final_content` | jsonb | Complete finalized report |
| `signature` | text | Digital signature |
| `status` | text | "submitted" or "archived" |
| `submitted_at` | timestamp | Submission timestamp |
| `created_at` | timestamp | Record creation time |

### Local Storage Keys (Device-Specific)

These keys remain in localStorage for device-specific state:

| Key | Purpose |
|-----|---------|
| `fvp_active_project` | ID of currently active project on this device |
| `fvp_quick_interview_draft` | Draft data during interview session |
| `fvp_offline_queue` | Reports pending sync when offline |
| `fvp_ai_response_{reportId}` | Temporary AI response cache per report |
| `fvp_cached_weather` | Cached weather data with timestamp |
| `fvp_mic_granted` | Microphone permission status flag |
| `fvp_mic_timestamp` | Timestamp of microphone permission grant |
| `fvp_cam_granted` | Camera permission status flag |
| `fvp_loc_granted` | Location permission status flag |
| `fvp_onboarded` | First-time onboarding completed flag |
| `fvp_banner_dismissed` | Permission warning banner dismissed |
| `fvp_banner_dismissed_date` | Timestamp of banner dismissal (24hr reset) |
| `fvp_dictation_hint_dismissed` | Dictation hint dismissed flag |

---

## Application Workflows

### 1. New Report Workflow

```
[index.html] User opens app
     │
     ├─► First visit? ─► [permissions.html] Setup permissions
     │
     ├─► Check for active project
     │    ├─► No projects? ─► Prompt to create project ─► [project-config.html]
     │    └─► Has project: Show active project card with name/number
     │
     ├─► Check for existing report (from Supabase)
     │    ├─► No report: Show "Begin Daily Report" button
     │    ├─► In progress: Show progress bar, "Continue" button
     │    └─► Completed: Show "View Report" / "Edit" options
     │
     └─► User clicks "Begin Daily Report"
          │
          ├─► Project picker modal appears
          │    ├─► Shows all saved projects (from Supabase)
          │    ├─► Highlights currently active project
          │    └─► "Manage Projects" link to project-config.html
          │
          └─► User selects project ─► [quick-interview.html]
```

### 2. Project Configuration Workflow

```
[project-config.html] Project Management
     │
     ├─► View saved projects list (from Supabase)
     │    ├─► Active project highlighted with checkmark
     │    └─► Each project shows name, number, location
     │
     ├─► Create new project (Manual Entry)
     │    ├─► Project Details (name, number, location, engineer)
     │    ├─► Contract Information (NTP date, duration, completion)
     │    ├─► Contractor Roster (prime + subcontractors with trades)
     │    └─► Equipment Inventory (per contractor)
     │
     ├─► Create new project (Document Import)
     │    ├─► Drag-and-drop or browse for PDF/DOCX files
     │    ├─► Upload multiple files for extraction
     │    ├─► Auto-populate form fields from extracted data
     │    ├─► Missing fields highlighted with red indicators
     │    ├─► Extraction notes displayed for uncertain values
     │    └─► Review and save extracted project
     │
     ├─► Edit existing project
     │    └─► All fields editable, changes saved to Supabase
     │
     └─► Set active project
          └─► Selected project used for new reports
```

### 3. Document Import Workflow

```
[project-config.html] Import from Existing Report
     │
     ├─► User initiates import
     │    ├─► Click "New Project" to open project form
     │    └─► "Import from Existing Report" section at top of form
     │
     ├─► File Selection
     │    ├─► Drag-and-drop files into drop zone
     │    ├─► Or click to browse for files
     │    ├─► Accepts: PDF, DOCX
     │    ├─► Multiple files supported
     │    └─► Selected files displayed with remove option
     │
     ├─► Extraction Process
     │    ├─► Click "Extract Project Data"
     │    ├─► Files converted to base64 and sent to webhook
     │    ├─► Loading spinner during processing
     │    └─► n8n workflow processes documents
     │
     ├─► Results Handling
     │    ├─► Success: Green banner + form auto-populated
     │    │    ├─► Project details filled (name, number, location)
     │    │    ├─► Contract info populated (NTP, duration, dates)
     │    │    ├─► Contractors added to roster
     │    │    ├─► Equipment inventory populated
     │    │    └─► Missing fields marked with red indicators
     │    │
     │    ├─► Extraction Notes (collapsible)
     │    │    └─► Shows any uncertainties or assumptions made
     │    │
     │    └─► Error: Red banner with error message
     │         └─► User can retry or enter data manually
     │
     ├─► User Review
     │    ├─► Review all extracted values
     │    ├─► Fill in any missing fields (red indicators)
     │    ├─► Correct any extraction errors
     │    └─► Add additional contractors/equipment as needed
     │
     └─► Save Project
          └─► Project saved to Supabase and ready for daily reports
```

### 4. Interview/Documentation Flow

```
[quick-interview.html]
     │
     ├─► Load contractors/equipment from active project (Supabase)
     │
     ├─► Choose capture mode (toggle at top):
     │    ├─► "Quick Notes" (Minimal Mode):
     │    │    ├─► Single freeform textarea for dictation-first workflow
     │    │    ├─► Auto-expanding textarea adjusts height as you type
     │    │    └─► Best for fast field notes via voice input
     │    │
     │    └─► "Guided Sections" (Structured Mode):
     │         └─► 12 expandable section cards with structured input
     │
     ├─► Expandable section cards (Guided Mode - 12 sections):
     │    ├─► Weather & Site Conditions
     │    ├─► Contractor Work (per-contractor cards)
     │    │    ├─► "No work performed" checkbox
     │    │    ├─► Work narrative textarea (auto-expanding)
     │    │    ├─► "Add Contractor" button for on-the-fly additions
     │    │    └─► Crew input (role/quantity)
     │    ├─► Personnel/Operations (DOT columns)
     │    │    ├─► Superintendent(s), Foreman, Operators
     │    │    ├─► Laborers, Surveyors, Others
     │    │    └─► Auto-calculated totals
     │    ├─► Equipment Status
     │    │    ├─► Per-equipment status dropdown
     │    │    ├─► IDLE or 1-10 hours utilized
     │    │    ├─► "Mark All IDLE" quick action
     │    │    └─► "Add Equipment" button for on-the-fly additions
     │    ├─► Issues & Delays
     │    ├─► QA/QC Inspections
     │    ├─► Safety
     │    ├─► Communications with Contractor
     │    ├─► Visitors; Deliveries; Other Remarks
     │    └─► Progress Photos (full-size cards with orientation handling)
     │
     ├─► Each section supports:
     │    ├─► Text input (manual typing or keyboard dictation)
     │    ├─► Auto-expanding textareas (grow with content, max 60vh)
     │    ├─► Mark as N/A (skip section)
     │    └─► Real-time preview updates
     │
     ├─► Progress bar shows completion percentage (12 sections)
     │
     └─► User clicks "Finish" ─► AI processes data ─► [report.html]
```

### 5. Voice Input Flow (Native Keyboard Dictation)

```
User enters text in any input field
     │
     ├─► User taps microphone button on device keyboard:
     │    ├─► iOS: Uses Siri dictation (Settings → Keyboard → Enable Dictation)
     │    ├─► Android: Uses Google Voice Typing
     │    ├─► Desktop: Uses OS-level dictation if available
     │    └─► Transcribed text appears directly in input field
     │
     └─► Requirements:
          ├─► Microphone permission granted to browser
          ├─► Device dictation feature enabled in OS settings
          └─► Internet connection (for cloud-based transcription)

Note: The app relies exclusively on native keyboard dictation for voice input,
providing consistent, reliable behavior across all platforms without custom
microphone buttons.
```

### 6. AI Processing Flow (Integrated)

```
User clicks "Finish" in quick-interview.html
     │
     ├─► Validation:
     │    ├─► Guided mode: workSummary required, safety must be answered
     │    └─► Minimal mode: freeformNotes required
     │
     ├─► Webhook call to n8n (fieldvoice-refine):
     │    ├─► Send field notes, weather, photos metadata, project context
     │    ├─► n8n workflow processes and returns AI-generated content
     │    └─► Store result in Supabase report_ai_response table
     │
     ├─► AI Processing Rules (enforced by n8n workflow):
     │    ├─► Never invent or add information
     │    ├─► Keep all facts, quantities, names exactly as stated
     │    ├─► Convert informal language to professional tone
     │    ├─► Format for DOT documentation standards
     │    └─► Highlight safety concerns appropriately
     │
     ├─► Offline handling:
     │    ├─► Queue processing request
     │    ├─► Set status to 'pending_refine'
     │    └─► Show retry banner on report.html when online
     │
     └─► Navigate to [report.html]
```

### 7. Report Generation Flow

```
[report.html] Loaded with report data from Supabase
     │
     ├─► Tab toggle: "Form View" | "Original Notes"
     │
     ├─► Form View (default):
     │    ├─► Data priority: userEdits > aiGenerated > fieldNotes > defaults
     │    ├─► Editable DOT-format form fields
     │    └─► Changes saved as userEdits to Supabase
     │
     ├─► Original Notes View:
     │    ├─► Shows raw field capture data
     │    ├─► Display mode (minimal vs guided)
     │    └─► Photo thumbnails with original captions
     │
     ├─► Pending refine banner (if offline during processing):
     │    ├─► Shows when status is 'pending_refine'
     │    └─► "Retry Now" button to re-process
     │
     └─► User clicks "Final Review" ─► [finalreview.html]

[finalreview.html] Read-only DOT RPR Daily Report viewer
     │
     ├─► Displays finalized report in DOT RPR format
     │    ├─► Project Overview (2-column layout)
     │    ├─► Weather Conditions block
     │    ├─► Daily Work Summary (per-contractor cards)
     │    ├─► Daily Operations Table (personnel counts)
     │    ├─► Equipment Utilization Table
     │    ├─► Issues, Communications, QA/QC, Safety sections
     │    ├─► Visitors & Remarks section
     │    ├─► Photo documentation
     │    └─► Signature block
     │
     ├─► Empty field highlighting (red borders for missing data)
     │
     ├─► Navigation options:
     │    ├─► "Edit Report" ─► back to report.html
     │    ├─► "Export PDF" ─► browser print dialog
     │    └─► "Submit Report" ─► save to Supabase and archive
     │
     └─► Print CSS ensures proper DOT formatting:
          ├─► Page breaks at correct locations
          ├─► 8.5" x 11" page format
          ├─► 0.5" margins
          └─► Color-accurate printing
```

### 8. Photo Capture Flow

```
User taps photo capture (camera icon)
     │
     ├─► Browser requests camera permission
     │
     ├─► User takes photo or selects from library
     │
     ├─► Processing:
     │    ├─► Request GPS coordinates (Geolocation API)
     │    ├─► Read file as base64 data URL
     │    ├─► Compress image (max 1200px width, 70% quality JPEG)
     │    └─► If storage near limit ─► Try higher compression (800px, 50%)
     │
     ├─► Create photo object with:
     │    ├─► Unique ID (timestamp-based)
     │    ├─► Compressed base64 URL
     │    ├─► GPS coordinates (if available)
     │    ├─► Date/time stamp
     │    └─► Original file metadata
     │
     └─► Save to Supabase report_photos table ─► Update display
```

---

## Configuration

### Supabase Configuration

Supabase credentials are configured in all HTML files:

```javascript
const SUPABASE_URL = 'https://ruzadotbgkjhgwkvotlz.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### Project Configuration

Project details are configured via `project-config.html` and stored in Supabase `projects` table. Each project includes:

**Project Details:**
- Project Name
- NOAB Project Number
- CNO Solicitation Number
- Location
- Engineer (Firm)
- Prime Contractor Name

**Contract Information:**
- Notice to Proceed Date
- Contract Duration (Days)
- Weather Days
- Expected Completion Date
- Default Start/End Times

**Contractor Roster:**
- Full Name and Abbreviation
- Type (Prime or Subcontractor)
- Trades (semicolon-separated)

**Equipment Inventory:**
- Equipment Type and Model (per contractor)

### Inspector Profile

Personal information is configured via `settings.html` (Inspector Profile) and stored in Supabase `user_profiles` table:

- Inspector Name (required)
- Title (required) - e.g., RPR
- Company/Firm (required) - e.g., Burns & McDonnell
- Email (optional)
- Phone (optional)

The signature line is auto-generated as: `[Name], [Title] ([Company])`

### Custom Theme Colors (Tailwind)

```javascript
tailwind.config = {
    theme: {
        extend: {
            colors: {
                'dot-navy': '#0a1628',      // Primary dark blue
                'dot-blue': '#1e3a5f',      // Secondary blue
                'dot-slate': '#334155',     // Neutral slate
                'dot-orange': '#ea580c',    // Warning/action orange
                'dot-yellow': '#f59e0b',    // Accent yellow
                'safety-green': '#16a34a',  // Success/safety green
            }
        }
    }
}
```

### n8n Webhook Configuration

The application uses n8n webhooks for AI text refinement and document extraction:

**Webhook Endpoints:**
| Endpoint | Location | Purpose |
|----------|----------|---------|
| **N8N_PROCESS_WEBHOOK** | `quick-interview.html` | AI processing on finish |
| **EXTRACT_WEBHOOK_URL** | `project-config.html` | Document extraction for project setup |

**Production Webhook URLs (n8n Cloud):**
- Refine: `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6`
- Extract: `https://advidere.app.n8n.cloud/webhook/fieldvoice-project-extractor`

---

## Permission Requirements

### Required Permissions

| Permission | Purpose | How to Test |
|------------|---------|-------------|
| **Microphone** | Native keyboard dictation support | `permissions.html` → Enable Microphone → Start Test |
| **Camera** | Photo documentation | `quick-interview.html` inline photo capture |
| **Geolocation** | GPS for weather & photo timestamps | Auto-requested on first weather sync |

### iOS Dictation Requirements

iOS uses Siri for keyboard dictation. To enable:

1. **Dictation Enabled**: Settings → General → Keyboard → Enable Dictation
2. **Microphone Permission**: Allow Safari to access microphone when prompted

### Android Dictation Requirements

Android uses Google Voice Typing. Ensure:

1. **Google Voice Typing**: Enabled in keyboard settings
2. **Microphone Permission**: Allow browser to access microphone when prompted

---

## Storage & Sync

### Supabase Benefits
- **Multi-device sync**: Access reports from any device
- **Real-time updates**: Multiple users can view same data
- **Data persistence**: Reports stored permanently in cloud
- **Backup/audit trail**: Database provides reliable storage

### Offline Capabilities

| Feature | Offline Support | Notes |
|---------|-----------------|-------|
| **App Loading** | Full | All HTML, CSS, JS cached by service worker |
| **View Cached Reports** | Partial | Previously loaded reports available |
| **Create Reports** | Limited | Basic capture, sync when online |
| **Photo Capture** | Full | Photos stored locally until sync |
| **Weather Sync** | None | Requires internet (shows "Offline" status) |
| **AI Refinement** | None | Requires internet (queued for retry) |
| **Report Submission** | None | Requires internet |
| **Print/PDF Export** | Full | Uses browser print functionality |

---

## PWA & Offline Support

FieldVoice Pro is a fully installable Progressive Web App (PWA) that provides offline capabilities when saved to the home screen on mobile devices.

### Installation

**iOS (Safari):**
1. Open the app in Safari
2. Tap the Share button (box with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

**Android (Chrome):**
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Install app" or "Add to Home Screen"
4. Confirm installation

### Service Worker Details

**File:** `sw.js`

**Cache Strategy:**
- **Static Assets (Cache-First):** HTML files, manifest, icons cached on install
- **CDN Assets:** Tailwind CSS and Font Awesome cached with CORS handling
- **API Calls (Network-First):** Weather and webhook calls attempt network first, return JSON error when offline

**Cache Versioning:**
```javascript
const CACHE_VERSION = 'v1.5.0';
const CACHE_NAME = `fieldvoice-pro-${CACHE_VERSION}`;
```

To force a cache update, increment the version number in `sw.js`.

### Manifest Configuration

**File:** `manifest.json`

```json
{
    "name": "FieldVoice Pro",
    "short_name": "FieldVoice",
    "display": "standalone",
    "orientation": "portrait-primary",
    "background_color": "#0a1628",
    "theme_color": "#0a1628",
    "start_url": "/index.html"
}
```

### Offline UI Indicators

**Yellow Banner:** A slide-down banner appears at the top of all pages when the device goes offline:
- Message: "You are offline - Some features may be unavailable"
- Automatically hides when connection is restored

### PWA Meta Tags (All HTML Files)

Each HTML file includes:
```html
<!-- PWA Meta Tags -->
<link rel="manifest" href="./manifest.json">
<link rel="icon" type="image/x-icon" href="./assets/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="./assets/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="./assets/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="./assets/apple-touch-icon.png">
<meta name="theme-color" content="#0a1628">

<!-- iOS PWA Meta Tags -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="FieldVoice">
```

### Safe Area Support

All pages include CSS for iOS notch/Dynamic Island support:
```css
body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
}
```

---

## Error Handling

### Dictation/Speech Errors
| Error | Meaning | Recovery |
|-------|---------|----------|
| Microphone permission denied | User blocked mic access | Prompt user to enable in browser/system settings |
| Dictation not available | OS dictation feature disabled | Guide user to enable dictation in device settings |
| Network error | Connectivity issue for cloud transcription | Check internet connection |

### Photo Errors
| Error | Recovery |
|-------|----------|
| Camera permission denied | Prompt user to enable in browser/system settings |
| GPS unavailable | Continue without coordinates, mark as "No GPS" |
| Storage quota exceeded | Try higher compression |
| Invalid file type | Reject with error message |

### Webhook Errors
| Scenario | Recovery |
|----------|----------|
| Server error (5xx) | Check n8n workflow status, retry |
| Request timeout (30s) | Check network connection, retry |
| Invalid response | Verify n8n workflow returns expected JSON format |
| Network failure | Queue for retry when online |

### Supabase Errors
| Scenario | Recovery |
|----------|----------|
| Connection failed | Show offline banner, queue operations |
| Authentication error | Re-authenticate user |
| Rate limit | Exponential backoff retry |

---

## Browser Compatibility

| Browser | Support Level | Notes |
|---------|---------------|-------|
| **Chrome (Desktop/Android)** | Full | Best experience, all features work |
| **Firefox** | Full | All features work |
| **Safari (Desktop)** | Full | All features work |
| **Safari (iOS)** | Full | Requires dictation enabled in iOS settings for voice input |
| **Edge** | Full | All features work |

### Requirements
- **HTTPS**: Required for MediaDevices API (camera, microphone)
- **JavaScript**: Required (no graceful degradation)
- **Cookies/Storage**: Required for Supabase auth

---

## Development Notes

### No Build Process
This is a static HTML/JS/CSS application with no build tools, bundlers, or package managers required. Simply serve the files via any HTTP/HTTPS server.

### Testing Locally
```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .

# Then open https://localhost:8000 (or use ngrok for HTTPS)
```

### Modifying Project Configuration
1. Update Supabase credentials in HTML files
2. Modify Tailwind config for theme colors
3. Update webhook URLs for n8n integration

### Adding New Report Sections
1. Add section HTML to `quick-interview.html`
2. Add corresponding Supabase table/column if needed
3. Update `buildProcessPayload()` to include new field for AI processing
4. Add rendering in `report.html` and `finalreview.html`

---

## Code Organization Guidelines

### File Structure Convention

- All shared JavaScript should go in `/js/` directory
- HTML files should only contain page-specific logic
- Shared utilities should be imported, not duplicated

### Shared JS Files (Planned)

The following are the canonical locations for shared code:

| File | Purpose |
|------|---------|
| `/js/config.js` | Supabase credentials, constants, feature flags |
| `/js/supabase-utils.js` | fromSupabase*, toSupabase* converters |
| `/js/pwa-utils.js` | Service worker registration, offline banner, PWA navigation fix |
| `/js/ui-utils.js` | escapeHtml(), generateId(), date formatting helpers |
| `/js/media-utils.js` | Photo capture, compression, GPS coordinates, file handling |

### Rules for Claude Code

When working on this codebase, follow these rules:

1. **Before adding a function to an HTML file**, check if it exists in `/js/`
2. **If a function is needed in 2+ files**, it belongs in `/js/`
3. **Never duplicate Supabase credentials** - import from config.js
4. **Never duplicate fromSupabase/toSupabase converters** - import from supabase-utils.js

### Migration Status

| Module | Status | Files Still Using Inline |
|--------|--------|--------------------------|
| config.js | ✅ Complete | 0 files |
| supabase-utils.js | ✅ Complete | 0 files |
| pwa-utils.js | ✅ Complete | 0 files |
| ui-utils.js | ✅ Complete | 0 files |
| media-utils.js | ✅ Complete | 0 files |

---

## File Size Reference

| File | Lines | Size (approx) |
|------|-------|---------------|
| index.html | 1,100 | 52 KB |
| quick-interview.html | 4,356 | 205 KB |
| report.html | 3,302 | 150 KB |
| finalreview.html | 2,320 | 89 KB |
| archives.html | 564 | 25 KB |
| drafts.html | 699 | 30 KB |
| permissions.html | 1,596 | 81 KB |
| permission-debug.html | 1,074 | 53 KB |
| project-config.html | 2,106 | 100 KB |
| settings.html | 538 | 26 KB |
| landing.html | 1,560 | 80 KB |
| admin-debug.html | 277 | 11 KB |
| sw.js | 208 | 7 KB |
| manifest.json | 113 | 3 KB |
| icons/ | - | ~3 KB |
| assets/ | - | ~328 KB |
| **Total** | **~19,813** | **~1.3 MB** |

---

## Security Considerations

### Data Privacy
- All report data stored in Supabase with row-level security
- Photos stored as base64 in Supabase
- GPS coordinates embedded in photos for audit purposes
- User authentication via Supabase Auth

### Supabase Security
- Row-level security (RLS) policies protect data
- Anonymous key used for public operations
- Service role key (if used) should never be exposed client-side

### Webhook Security
- Webhook URLs should be configured with appropriate authentication in the n8n workflow
- Data transmitted includes report text content for AI refinement
- All webhook endpoints use HTTPS

### HTTPS Requirement
- Camera, microphone, and geolocation APIs require secure context (HTTPS)
- Development with localhost is allowed by browsers

---

## Recent Changes

### Supabase Migration (January 2026)
- **Complete migration from localStorage to Supabase**
  - All pages now use Supabase for data storage
  - Multi-device sync enabled
  - Real-time data updates
  - Persistent cloud storage
  - Tables: `user_profiles`, `projects`, `reports`, `report_raw_capture`, `report_contractor_work`, `report_personnel`, `report_equipment_usage`, `report_photos`, `report_ai_response`, `report_user_edits`, `report_final`

### Add Contractor Modal in Quick Interview (January 2026)
- **New feature in quick-interview.html** - Add contractors during report creation
  - "Add Contractor" button at bottom of Contractor Work section
  - Modal with fields: Contractor Name (required), Abbreviation (required, auto-uppercase, max 10 chars), Type dropdown (prime/subcontractor), Trades (optional)
  - New contractor saved to active project in Supabase
  - Contractor immediately appears in Contractor Work section, Personnel/Operations, and Equipment dropdowns
  - Generates unique contractor ID: `contractor_{timestamp}_{random}`
  - Initializes empty activity and operations data in current report

### Add Equipment During Interview (January 2026)
- **New feature in quick-interview.html** - Add equipment during report creation
  - Equipment section with totals display (Active/Idle counts), equipment list, and "Add Equipment" button
  - Modal with fields: Contractor dropdown, Equipment Type (required), Model (optional), Quantity
  - **Dual persistence**: Equipment saved to BOTH project config AND current report
  - **Duplicate detection**: Checks if same type/model/contractor combination exists before adding to project
  - New equipment appears in future reports and is visible to other inspectors
  - Equipment immediately added to current report's equipment tracking
  - Generates unique equipment ID: `equip_{timestamp}_{random}`
  - "Mark All IDLE" quick action for low-activity days

### Empty Field Highlighting in Final Review (January 2026)
- **New feature in finalreview.html** - Visual indicators for incomplete Project Overview fields
  - On page load, checks 15 Project Overview fields for empty values
  - Empty fields highlighted with red border and light red background
  - Dismissible banner at top shows count of incomplete fields
  - Banner does not block submission - users can submit with missing fields
  - Empty value detection: empty string, `--`, or `N/A`
  - Highlighting updates when user navigates back from report.html with new data
  - Banner hidden during print

### Dual Capture Modes (January 2026)
- **New feature in quick-interview.html** - Choose between two capture workflows:
  - **Quick Notes (Minimal)**: Single freeform textarea optimized for dictation-first workflow
  - **Guided Sections**: 12 expandable section cards with structured input fields
  - Toggle at top of page to switch between modes
  - Both modes support native keyboard dictation
  - Quick Notes ideal for fast field entry; Guided for comprehensive DOT documentation

### Auto-Expanding Textareas (January 2026)
- **Enhanced input experience** across all textarea fields
  - Textareas automatically grow as content is added
  - Maximum height capped at 60vh to prevent excessive scrolling
  - 16px font size prevents iOS zoom issues
  - Real-time height adjustment for better mobile experience
  - Scrollable when content exceeds max height

### Drafts & Offline Queue Page (January 2026)
- **New page: `drafts.html`** - Manage pending reports
  - Displays all reports in draft or pending status
  - Shows offline queue items waiting to sync
  - "Sync Now" functionality when back online
  - One-tap resume for any draft report
  - Visual indicators for sync status
  - Accessible from main dashboard navigation

### Admin Debug Tools (January 2026)
- **New page: `admin-debug.html`** - Developer/admin utilities
  - View all localStorage keys (fvp_* prefixed)
  - Browse all reports in database
  - Clear localStorage data
  - Reset reports to draft status
  - Delete reports (cascades to related tables)
  - Status flow reference guide

### Data Flow Documentation (January 2026)
- **Comprehensive documentation added**
  - `docs/current-data-flow.md` - Detailed data flow mapping
  - `docs/data-flow-audit.md` - Complete table usage audit by page
  - `docs/report-finalreview-archives-investigation.md` - Page interconnection analysis
  - Clear documentation of Supabase table usage per page

### Database Migrations (January 2026)
- **Migration scripts added** in `migrations/` directory
  - `001_add_guided_section_columns.sql` - Adds columns for guided mode sections
  - Supports structured data storage for 12 DOT sections

### Bug Fixes (January 2026)
- Fixed webhook URL and payload structure in drafts.html
- Fixed archives.html empty results using proper JOIN for project_name
- Renamed supabase variable to supabaseClient to avoid conflicts
- Improved data flow with state protection and localStorage-first editing

---

## Summary

FieldVoice Pro is a sophisticated, production-ready field documentation system that:

- **Cloud-powered with Supabase** - Multi-device sync, real-time updates, persistent storage
- **Multi-project management** - Configure and switch between multiple construction projects with contractor rosters and equipment inventories
- **Document import** - Automatically extract project data from existing PDF/DOCX reports via AI-powered document processing
- **Fully installable as a PWA** - Works offline for basic operations when saved to home screen
- **Dual capture modes** - Quick Notes (minimal freeform) or Guided Sections (12 structured DOT sections) to fit your workflow
- **DOT-compliant reporting** - Contractor-based work entry, personnel tracking, and equipment status matching DOT form requirements
- **Auto-expanding textareas** - Input fields grow with content for better mobile experience
- **AI processing integration** - n8n webhooks for text refinement
- **Drafts & offline queue** - Dedicated drafts page for managing pending reports and syncing when online
- **Admin debug tools** - Developer utilities for data investigation and troubleshooting
- Supports voice-first data entry via native keyboard dictation with AI enhancement
- Generates professional, DOT-compliant PDF reports with 12 comprehensive sections
- Uses n8n webhooks for AI text refinement and document extraction
- **Service worker caching** ensures fast load times
- **Safe-area support** for modern iOS devices with notch/Dynamic Island
- **Streamlined navigation** with project picker, Home buttons, and improved workflow tracking
- **Comprehensive documentation** - Detailed data flow audits and technical specs in docs/ directory

The codebase is mature (~19,813 lines including PWA infrastructure), well-structured, and includes comprehensive error handling for real-world field conditions including graceful offline degradation.
