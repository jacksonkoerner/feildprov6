# FieldVoice Pro - Voice-Powered Construction Field Reporting System

## Overview

**FieldVoice Pro** is a mobile-optimized web application designed for construction field documentation. It enables Resident Project Representatives (RPRs), field engineers, and inspectors to quickly document daily work activities using native device dictation, generating professional DOT-compliant reports.

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

---

## Technology Stack

### Frontend (100% Client-Side)
| Technology | Purpose | Version/Source |
|------------|---------|----------------|
| **Tailwind CSS** | Utility-first CSS framework | CDN (`cdn.tailwindcss.com`) |
| **Font Awesome** | Icon library | v6.4.0 CDN |
| **Vanilla JavaScript** | Core application logic | ES6+ |

### External APIs & Services
| Service | Purpose | Authentication |
|---------|---------|----------------|
| **Open-Meteo API** | Real-time weather data | None (free, no key required) |

### Browser APIs Used
| API | Purpose |
|-----|---------|
| MediaDevices API | Camera access |
| Geolocation API | GPS coordinates for photos/weather |
| Canvas API | Image compression |
| localStorage | Client-side data persistence |
| Service Worker API | Offline caching and PWA support |
| FileReader API | Document import and image handling |
| Drag and Drop API | File upload for document import |

### Architecture
- **Type**: Static Single Page Application (SPA)
- **Backend**: None - fully client-side
- **Database**: Browser localStorage only
- **Deployment**: Any static web server (HTTPS required for media APIs)

---

## Project Structure

```
/
├── index.html              # Home dashboard / main entry point with project selection
├── quick-interview.html    # Daily report flow (contractor-based DOT field entry)
├── review.html             # AI Kit - text refinement & editing via n8n webhook
├── report.html             # Print-ready PDF report viewer/generator
├── editor.html             # Photo editor & section-specific editing
├── permissions.html        # System setup, permission testing (mic, camera, GPS)
├── permission-debug.html   # Permission debugging and troubleshooting utility
├── project-config.html     # Project & contractor configuration management
├── settings.html           # Inspector profile & personal information
├── landing.html            # Marketing/onboarding landing page
├── sw.js                   # Service worker for PWA offline support
├── manifest.json           # PWA manifest with app metadata and icons
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
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   └── icon-512x512.png
└── README.md               # This documentation file
```

### Page Descriptions

| Page | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~880 | Dashboard with project selection, active project display, weather, and navigation |
| `quick-interview.html` | ~2,487 | DOT-compliant report with 12 sections: Weather, Contractor Work, Personnel, Equipment, Issues, Inspections, Safety, Contractor Communications, Visitors/Deliveries, Photos |
| `review.html` | ~1,296 | AI Kit - side-by-side original vs. AI-refined text comparison with manual editing, n8n webhook integration |
| `report.html` | ~883 | Professional PDF-ready report with submit functionality, streamlined navigation |
| `editor.html` | ~674 | Photo capture with GPS embedding, section-specific editing interface |
| `permissions.html` | ~1,596 | Permission testing (mic, camera, GPS), iOS-specific instructions for native dictation |
| `permission-debug.html` | ~1,074 | Debugging utility for troubleshooting permission issues |
| `project-config.html` | ~1,581 | Project management with document import, contractor roster, equipment inventory, and contract details |
| `settings.html` | ~444 | Inspector profile - personal information, title, company, signature preview, and app refresh |
| `landing.html` | ~1,560 | Marketing page with feature overview and onboarding |

---

## Data Model

### Project Data Structure (localStorage: `fvp_projects`)

```javascript
// Array of project configurations
[
  {
    id: "proj_1705234567890",           // Unique project ID
    projectName: "I-10 Bridge Reconstruction",
    noabProjectNo: "1291",
    cnoSolicitationNo: "N/A",
    location: "Jefferson Highway at Mississippi River",
    engineer: "AECOM",
    primeContractor: "Boh Bros Construction",
    noticeToProceed: "2025-01-15",       // ISO date
    contractDuration: 467,                // Days
    weatherDays: 0,
    expectedCompletion: "2026-04-25",    // ISO date
    defaultStartTime: "06:00",
    defaultEndTime: "16:00",

    // Contractor roster
    contractors: [
      {
        id: "cont_1705234567891",
        name: "Boh Bros Construction",
        abbreviation: "BOH",
        type: "prime",                   // "prime" or "subcontractor"
        trades: ["General", "Pile Driving"]
      },
      {
        id: "cont_1705234567892",
        name: "Delta Concrete",
        abbreviation: "DELTA",
        type: "subcontractor",
        trades: ["Concrete"]
      }
    ],

    // Equipment inventory per contractor
    equipment: [
      {
        id: "equip_1705234567893",
        contractorId: "cont_1705234567891",
        type: "Excavator",
        model: "CAT 336"
      }
    ],

    createdAt: "2025-01-14T08:00:00.000Z",
    updatedAt: "2025-01-14T08:00:00.000Z"
  }
]
```

### User Settings Structure (localStorage: `fvp_user_settings`)

```javascript
{
  inspectorName: "Andrew Stiebing",       // Required
  title: "RPR",                           // Required - Resident Project Representative
  company: "Burns & McDonnell",           // Required
  email: "astiebing@burnsmcd.com",        // Optional
  phone: "(504) 555-1234"                 // Optional
}
// Generates signature: "Andrew Stiebing, RPR (Burns & McDonnell)"
```

### Report Data Structure (localStorage: `fieldvoice_report_YYYY-MM-DD`)

```javascript
{
  // Metadata
  meta: {
    createdAt: "2025-01-14T08:00:00.000Z",  // ISO timestamp
    interviewCompleted: false,               // Report finalization status
    reportType: "quick" | "full",            // Report type selected
    currentStep: 0,                          // Progress tracking
    version: 2,                              // Schema version
    naMarked: {                              // Sections marked as "Not Applicable"
      issues: false,
      inspections: false,
      contractorCommunications: false,
      visitorsRemarks: false,
      photos: false
    }
  },

  // Project Overview (auto-populated from active project)
  overview: {
    projectName: "I-10 Bridge Reconstruction",
    noabProjectNo: "1291",
    cnoSolicitationNo: "N/A",
    date: "1/14/2025",
    startTime: "6:00 AM",
    endTime: "4:00 PM",
    shiftDuration: "10.00 hours",
    location: "Jefferson Highway at Mississippi River",
    engineer: "AECOM",
    contractor: "Boh Bros Construction",
    noticeToProceed: "1/15/2025",
    contractDuration: "467 days",
    expectedCompletion: "4/25/2026",
    contractDayNo: "Day 1 of 467",
    weatherDays: "0 days",
    completedBy: "Andrew Stiebing, RPR (Burns & McDonnell)",
    weather: {
      highTemp: "78°F",
      lowTemp: "62°F",
      precipitation: "0.00\"",
      generalCondition: "Partly Cloudy",  // From Open-Meteo API
      jobSiteCondition: "Dry",            // User input: "Dry" or "Wet"
      adverseConditions: "N/A"
    }
  },

  // Contractor-based work activities (NEW FORMAT)
  activities: [
    {
      contractorId: "cont_1705234567891",
      noWork: false,                      // True if "No work performed" checked
      narrative: "Continued pile driving operations at Bent 4...",
      equipmentUsed: "Crane (1); Pile Driver (1)",
      crew: "Operator (2); Laborer (4)"
    },
    {
      contractorId: "cont_1705234567892",
      noWork: true,                       // No work performed today
      narrative: "",
      equipmentUsed: "",
      crew: ""
    }
  ],

  // Personnel/Operations tracking (DOT-compliant columns)
  operations: [
    {
      contractorId: "cont_1705234567891",
      superintendents: 1,
      foremen: 2,
      operators: 4,
      laborers: 6,
      surveyors: 0,
      others: 0
      // Total calculated automatically
    }
  ],

  // Equipment status tracking
  equipment: [
    {
      equipmentId: "equip_1705234567893",
      contractorId: "cont_1705234567891",
      hoursUtilized: 8                    // 0 = IDLE, 1-10 = hours utilized
    }
  ],

  // Issues and delays
  generalIssues: [
    "Utility conflict at Station 45+00 requiring redesign"
  ],

  // QA/QC inspections and testing
  qaqcNotes: [
    "Concrete cylinders cast for barrier wall pour"
  ],

  // Safety information
  safety: {
    hasIncidents: false,      // Incident occurred today
    noIncidents: true,        // Explicitly confirmed no incidents
    notes: [
      "Toolbox talk conducted: Heat stress awareness"
    ]
  },

  // Contractor communications (NEW - separate section)
  contractorCommunications: "Discussed schedule acceleration with BOH superintendent...",

  // Visitors, deliveries, remarks (NEW - separate section, string format)
  visitorsRemarks: "DOT inspector on site 10:00 AM - 2:00 PM. Material delivery: 500 LF of 24\" pipe.",

  // Photo documentation
  photos: [
    {
      id: "photo_1705234567890_0",
      url: "data:image/jpeg;base64,...",  // Compressed base64 image
      caption: "",
      timestamp: "2025-01-14T14:30:00.000Z",
      date: "1/14/2025",
      time: "2:30:00 PM",
      gps: {
        lat: 29.9934,
        lng: -90.2580,
        accuracy: 10  // meters
      },
      fileName: "IMG_1234.jpg",
      fileSize: 2500000,
      fileType: "image/jpeg"
    }
  ],

  // Edited versions of text (populated after review.html editing)
  refinedData: {
    weather: "Site conditions were dry with partly cloudy skies...",
    activities: "The contractor continued earthwork operations...",
    issues: "A utility conflict was identified at Station 45+00...",
    inspections: "Quality control testing included casting of concrete cylinders...",
    safety: "No safety incidents were reported. A toolbox talk on heat stress...",
    contractorCommunications: "Coordination meeting held with prime contractor...",
    visitors: "DOT representative conducted a site inspection..."
  }
}
```

### localStorage Keys

| Key Pattern | Purpose |
|-------------|---------|
| `fieldvoice_report_YYYY-MM-DD` | Primary storage for date-specific reports |
| `fieldvoice_report` | Legacy/backup key for compatibility |
| `fvp_projects` | Array of saved project configurations |
| `fvp_active_project` | ID of currently active project |
| `fvp_user_settings` | User's personal inspector profile (name, title, company) |
| `fvp_settings` | Legacy settings key (deprecated, migrated to above) |
| `fvp_mic_granted` | Microphone permission status flag |
| `fvp_loc_granted` | Location permission status flag |
| `fvp_onboarded` | First-time onboarding completed flag |
| `fvp_banner_dismissed` | Permission warning banner dismissed |
| `fvp_banner_dismissed_date` | Timestamp of banner dismissal (24hr reset) |

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
     ├─► Check for existing report
     │    ├─► No report: Show "Begin Daily Report" button
     │    ├─► In progress: Show progress bar, "Continue" button
     │    └─► Completed: Show "View Report" / "Edit" options
     │
     └─► User clicks "Begin Daily Report"
          │
          ├─► Project picker modal appears
          │    ├─► Shows all saved projects
          │    ├─► Highlights currently active project
          │    └─► "Manage Projects" link to project-config.html
          │
          └─► User selects project ─► [quick-interview.html]
```

### 2. Project Configuration Workflow

```
[project-config.html] Project Management
     │
     ├─► View saved projects list
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
     │    └─► All fields editable, changes saved automatically
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
          └─► Project saved and ready for daily reports
```

### 4. Interview/Documentation Flow

```
[quick-interview.html]
     │
     ├─► Load contractors/equipment from active project
     │
     ├─► Expandable section cards (12 sections):
     │    ├─► Weather & Site Conditions
     │    ├─► Contractor Work (per-contractor cards)
     │    │    ├─► "No work performed" checkbox
     │    │    ├─► Work narrative textarea
     │    │    ├─► Equipment used input
     │    │    └─► Crew input (role/quantity)
     │    ├─► Personnel/Operations (DOT columns)
     │    │    ├─► Superintendent(s), Foreman, Operators
     │    │    ├─► Laborers, Surveyors, Others
     │    │    └─► Auto-calculated totals
     │    ├─► Equipment Status
     │    │    ├─► Per-equipment status dropdown
     │    │    ├─► IDLE or 1-10 hours utilized
     │    │    └─► "Mark All IDLE" quick action
     │    ├─► Issues & Delays
     │    ├─► QA/QC Inspections
     │    ├─► Safety
     │    ├─► Communications with Contractor
     │    ├─► Visitors; Deliveries; Other Remarks
     │    └─► Progress Photos
     │
     ├─► Each section supports:
     │    ├─► Text input (manual typing or keyboard dictation)
     │    ├─► Mark as N/A (skip section)
     │    └─► Real-time preview updates
     │
     ├─► Progress bar shows completion percentage (12 sections)
     │
     └─► User clicks "Finish" ─► [review.html] (AI Kit)
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

### 6. AI Kit Flow (review.html)

```
[review.html] Loaded with report data (AI Kit)
     │
     ├─► Display side-by-side: Original | AI Refined
     │
     ├─► User can:
     │    ├─► Click "Refine All" ─► Process all sections
     │    ├─► Click individual "Refine" ─► Process single section
     │    ├─► Manually edit either column
     │    └─► Export training data for prompt refinement
     │
     ├─► Refinement Process (via n8n webhook):
     │    ├─► Send original text + section name + report context
     │    ├─► n8n workflow processes and returns refined text
     │    └─► Display with typing animation
     │
     ├─► AI Refinement Rules (enforced by n8n workflow):
     │    ├─► Never invent or add information
     │    ├─► Keep all facts, quantities, names exactly as stated
     │    ├─► Convert informal language to professional tone
     │    ├─► Format for DOT documentation standards
     │    └─► Highlight safety concerns appropriately
     │
     └─► User clicks "Export" ─► [report.html]
```

### 7. Report Generation Flow

```
[report.html] Loaded with report data
     │
     ├─► Navigation bar with:
     │    ├─► Home button (return to dashboard)
     │    ├─► Back to AI Kit link
     │    └─► Submit button
     │
     ├─► Render 4-page professional report:
     │    ├─► Page 1: Project Overview + Daily Work Summary
     │    ├─► Page 2: Personnel Table + Equipment Table
     │    ├─► Page 3: Issues, Visitors, QA/QC, Safety + Signature
     │    └─► Page 4: Photo Gallery (if photos exist)
     │
     ├─► User clicks "Submit"
     │    ├─► Confirmation modal appears
     │    └─► Report submitted via n8n webhook
     │
     └─► Print CSS ensures proper formatting:
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
     │    ├─► If storage near limit ─► Try higher compression (800px, 50%)
     │    ├─► Check localStorage quota
     │    └─► If quota exceeded ─► Remove oldest photo, warn user
     │
     ├─► Create photo object with:
     │    ├─► Unique ID (timestamp-based)
     │    ├─► Compressed base64 URL
     │    ├─► GPS coordinates (if available)
     │    ├─► Date/time stamp
     │    └─► Original file metadata
     │
     └─► Save to report.photos array ─► Update display
```

---

## Configuration

### Project Configuration

Project details are configured via `project-config.html` and stored in localStorage under the `fvp_projects` key. Each project includes:

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

Personal information is configured via `settings.html` (Inspector Profile) and stored under `fvp_user_settings`:

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

The application uses n8n webhooks for AI text refinement, report submission, and document extraction. Configure webhook URLs in the code:

**Webhook Endpoints:**
| Endpoint | Location | Purpose |
|----------|----------|---------|
| **N8N_REFINE_WEBHOOK** | `review.html` | AI text refinement requests |
| **N8N_SUBMIT_WEBHOOK** | `report.html` | Submitting completed reports |
| **EXTRACT_WEBHOOK_URL** | `project-config.html` | Document extraction for project setup |

**Production Webhook URLs (n8n Cloud):**
- Refine: `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine`
- Submit: `https://advidere.app.n8n.cloud/webhook/fieldvoice-submit`
- Extract: `https://advidere.app.n8n.cloud/webhook/fieldvoice-project-extractor`

**Webhook Request Format (Refine):**
```javascript
{
    section: "weather|activities|issues|inspections|safety|visitors|additionalNotes",
    originalText: "User's original text",
    reportContext: {
        projectName: "Project Name",
        reporterName: "Inspector Name",
        date: "1/14/2025"
    }
}
```

**Webhook Request Format (Document Extraction):**
```javascript
{
    files: [
        {
            name: "RPR_Daily_Report.pdf",
            type: "application/pdf",
            content: "base64-encoded-file-content"
        }
    ]
}
```

**Expected Response (Refine):**
```javascript
{
    refinedText: "Professionally refined text"
}
```

**Expected Response (Document Extraction):**
```javascript
{
    success: true,
    projectName: "I-10 Bridge Reconstruction",
    noabProjectNo: "1291",
    cnoSolicitationNo: "N/A",
    location: "Jefferson Highway at Mississippi River",
    engineer: "AECOM",
    primeContractor: "Boh Bros Construction",
    noticeToProceed: "2025-01-15",      // ISO date format
    contractDuration: 467,               // Days as number
    expectedCompletion: "2026-04-25",   // ISO date format
    defaultStartTime: "06:00",          // 24-hour format
    defaultEndTime: "16:00",            // 24-hour format
    weatherDays: 0,
    contractors: [
        {
            name: "Boh Bros Construction",
            abbreviation: "BOH",
            type: "prime",
            trades: "General; Pile Driving"
        }
    ],
    equipment: [
        {
            type: "Excavator",
            model: "CAT 336",
            contractorName: "Boh Bros Construction"
        }
    ],
    notes: ["Note about extraction uncertainties"]
}
```

---

## Permission Requirements

### Required Permissions

| Permission | Purpose | How to Test |
|------------|---------|-------------|
| **Microphone** | Native keyboard dictation support | `permissions.html` → Enable Microphone → Start Test |
| **Camera** | Photo documentation | `editor.html` or inline photo capture |
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

## Storage & Limitations

### localStorage Limits
- **Typical limit**: 5-10MB per domain
- **Photo impact**: Each compressed photo ~50-200KB
- **Report without photos**: ~5-20KB

### Storage Management
- Automatic image compression (1200px → 800px if needed)
- JPEG quality reduction (70% → 50% if needed)
- Oldest photo removal when quota exceeded
- Clear warnings displayed to user

### Report History
- Up to 30 past reports stored
- Accessed via "Archives" on home dashboard
- Date-keyed storage prevents conflicts

---

## PWA & Offline Support

FieldVoice Pro is a fully installable Progressive Web App (PWA) that works offline when saved to the home screen on mobile devices.

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

### Offline Capabilities

| Feature | Offline Support | Notes |
|---------|-----------------|-------|
| **App Loading** | Full | All HTML, CSS, JS cached by service worker |
| **View Existing Reports** | Full | Reports stored in localStorage |
| **Create/Edit Reports** | Full | All data saved locally |
| **Photo Capture** | Full | Photos stored as base64 in localStorage |
| **Weather Sync** | None | Requires internet (shows "Offline" status) |
| **AI Refinement** | None | Requires internet (shows error message) |
| **Report Submission** | None | Requires internet (shows error message) |
| **Print/PDF Export** | Full | Uses browser print functionality |

### Service Worker Details

**File:** `sw.js`

**Cache Strategy:**
- **Static Assets (Cache-First):** HTML files, manifest, icons cached on install
- **CDN Assets:** Tailwind CSS and Font Awesome cached with CORS handling
- **API Calls (Network-First):** Weather and webhook calls attempt network first, return JSON error when offline

**Cache Versioning:**
```javascript
const CACHE_VERSION = 'v1.2.0';
const CACHE_NAME = `fieldvoice-pro-${CACHE_VERSION}`;
```

To force a cache update, increment the version number in `sw.js`.

**Cached Files:**
- All 10 HTML files
- `manifest.json`
- App icons (192x192, 512x512)
- Tailwind CSS CDN
- Font Awesome CSS and webfonts

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
- Uses CSS transitions for smooth animation

**Feature-Specific Messages:**
- Weather sync: Shows "Offline" with wifi-slash icon
- Report submission: Toast message "You are offline - Please connect to the internet to submit your report"
- AI refinement: Toast message "You are offline - AI refinement requires internet connection"

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

### App Icons

Icons are located in `/icons/` with a construction/microphone themed design using the app's color palette:
- **Navy (#0a1628):** Background
- **Orange (#ea580c):** Microphone body
- **Yellow (#f59e0b):** Microphone stand and accents
- **Green (#16a34a):** Checkmark badge

Available sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

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
| Storage quota exceeded | Remove oldest photo, try higher compression |
| Invalid file type | Reject with error message |

### Webhook Errors
| Scenario | Recovery |
|----------|----------|
| Webhook URL not configured | Configure N8N_REFINE_WEBHOOK and N8N_SUBMIT_WEBHOOK in code |
| Server error (5xx) | Check n8n workflow status, retry |
| Request timeout (30s) | Check network connection, retry |
| Invalid response | Verify n8n workflow returns expected JSON format |
| Network failure | Check internet connection, retry |

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
- **localStorage**: Required for data persistence

---

## Development Notes

### No Build Process
This is a static HTML/JS/CSS application with no build tools, bundlers, or package managers. Simply serve the files via any HTTP/HTTPS server.

### Testing Locally
```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .

# Then open https://localhost:8000 (or use ngrok for HTTPS)
```

### Modifying Project Configuration
1. Edit `INITIAL_OVERVIEW` object in `index.html` and `quick-interview.html`
2. Update project details in `settings.html` form defaults
3. Modify report template headers in `report.html`

### Adding New Report Sections
1. Add section HTML to `quick-interview.html`
2. Add corresponding data field to report object structure
3. Update `renderSection()` function for display
4. Add refinement support in `review.html`
5. Add export rendering in `report.html`

---

## File Size Reference

| File | Lines | Size (approx) |
|------|-------|---------------|
| index.html | 880 | 42 KB |
| quick-interview.html | 2,487 | 135 KB |
| review.html | 1,296 | 64 KB |
| report.html | 883 | 43 KB |
| editor.html | 674 | 32 KB |
| permissions.html | 1,596 | 81 KB |
| permission-debug.html | 1,074 | 53 KB |
| project-config.html | 1,581 | 77 KB |
| settings.html | 444 | 21 KB |
| landing.html | 1,560 | 80 KB |
| sw.js | 205 | 7 KB |
| manifest.json | 65 | 2 KB |
| icons/ | - | ~3 KB |
| assets/ | - | ~325 KB |
| **Total** | **~12,745** | **~965 KB** |

---

## Security Considerations

### Data Privacy
- All report data stored locally in browser
- Data only sent to configured n8n webhook endpoints for AI refinement and report submission
- Photos stored as base64 in localStorage (never uploaded unless explicitly shared)
- GPS coordinates embedded in photos for audit purposes

### Webhook Security
- Webhook URLs should be configured with appropriate authentication in the n8n workflow
- Data transmitted includes report text content for AI refinement
- Consider using HTTPS endpoints and API key authentication in production

### HTTPS Requirement
- Camera, microphone, and geolocation APIs require secure context (HTTPS)
- Development with localhost is allowed by browsers

---

## Common Modifications

### Change Project Details
Edit in `index.html` lines 275-300 and `quick-interview.html` lines 597-604.

### Add New Contractor
Modify the `contractors` array in the report object, or use the Full Report flow which includes a contractor management interface.

### Customize Report Styling
Edit the print styles in `report.html` (lines 10-20) and the report template structure.

### Adjust Photo Compression
Modify `compressImage()` function parameters in `quick-interview.html` (line 634):
```javascript
// Current: maxWidth = 1200, quality = 0.7
await compressImage(rawDataUrl, 1200, 0.7);
```

### Add New Weather Codes
Extend the `weatherCodes` object in `index.html` (lines 418-433) with additional Open-Meteo weather code mappings.

---

## Recent Changes

### Document Import System (January 2026)
- **New feature in project-config.html** - Automated project data extraction from existing reports
  - Drag-and-drop file upload for PDF and DOCX documents
  - Multi-file support for comprehensive extraction
  - Automatic form field population from extracted data
  - Missing field indicators (red styling) for incomplete extractions
  - Collapsible extraction notes section for uncertain values
  - Auto-population of contractor roster from document data
  - Equipment inventory extraction with contractor matching
  - Success/error banner feedback with detailed messages
  - Loading spinner animation during webhook processing
  - Webhook integration: `fieldvoice-project-extractor` endpoint

### Project Configuration System (January 2026)
- **New page: project-config.html** - Comprehensive project management interface
  - Create and manage multiple construction projects
  - Configure project details (name, number, location, engineer, contractor)
  - Set contract information (NTP date, duration, expected completion)
  - Build contractor roster with prime and subcontractor designations
  - Manage equipment inventory per contractor
  - Set active project for daily reports

### Dashboard Project Integration
- Added "Manage Projects" button in header navigation
- New Active Project card displays current project name and number
- Project picker modal appears when beginning a daily report
- Warning modal when no active project is selected
- Seamless navigation between dashboard and project configuration

### Inspector Profile (Settings Refactored)
- **settings.html renamed to Inspector Profile**
- Personal information section: Name, Title, Company/Firm, Email, Phone
- Live signature preview shows formatted "Completed By" line
- Project configuration moved to dedicated project-config.html
- Storage key changed from `fvp_settings` to `fvp_user_settings`
- Added prominent "Manage Projects" link

### Contractor-Based Work Entry
- Replaced simple work summary with contractor-organized system
- Each contractor from active project displayed as expandable card
- "No work performed on [date]" checkbox for inactive contractors
- Per-contractor fields: work narrative, equipment used, crew
- Prime contractors sorted first, visual distinction from subcontractors

### DOT-Compliant Personnel/Operations Section
- New Personnel section tracks headcounts with DOT columns:
  - Superintendent(s), Foreman, Operator(s), Laborer(s), Surveyor(s), Other(s)
- Compact grid layout with number inputs per contractor
- Auto-calculated totals row
- Trade abbreviation logic (Pile Driving→PLE, Concrete→CONC)
- Visual indicators: green border for prime, blue for subcontractors

### Equipment Status Tracking
- New Equipment section loads inventory from active project
- Per-equipment status dropdown: IDLE or 1-10 hours utilized
- "Mark All IDLE" quick action for low-activity days
- Summary shows active vs. idle equipment counts
- Data stored with equipmentId, contractorId, and hoursUtilized

### Visitors Section Split into DOT-Compliant Sections
- **Communications with Contractor**: Dedicated section for contractor discussions
- **Visitors; Deliveries; Additional Contract and/or Change Order Activities; Other Remarks**: Matches official DOT form title
- Both sections use text areas with dictation support and N/A toggle
- Migrated from array format to string format for DOT compatibility

### Progress Tracking Expanded
- Quick interview now tracks 12 sections (up from 7)
- Progress bar accurately reflects completion across all new sections
- Status icons update in real-time for each section

### AI Review Renamed to AI Kit
- The review page has been rebranded from "AI Review" to "AI Kit"
- Updated page title and header to reflect the new branding
- Added training data export functionality for prompt refinement

### Report Page Streamlining
- Removed Edit and Print buttons from report.html for a cleaner interface
- Report page now focuses on Submit functionality with streamlined navigation
- Navigation includes Home button, Back to AI Kit link, and Submit button

### Navigation Improvements
- Added Home buttons to key pages for easier navigation
- Improved workflow tracking throughout the application
- Better integration between AI Kit and Report pages

### Dashboard Simplification
- Simplified the home dashboard to a single-action interface
- Setup functionality moved to the Settings page for cleaner UX

### Voice Input Streamlining
- Removed dedicated microphone buttons throughout the app
- Voice input now relies exclusively on native keyboard dictation (iOS Siri, Android Google Voice)
- This approach provides better reliability and consistency across devices

### iOS Support Improvements
- Added safe-area CSS insets for proper display on devices with notch/Dynamic Island
- Fixed PWA standalone mode navigation issues on iOS

### Favicon & Branding
- Added proper favicon assets in the `/assets/` directory
- Includes favicon.ico, PNG favicons (16x16, 32x32), and apple-touch-icon
- All HTML pages now reference the new favicon assets

### Report Workflow Improvements
- Improved report status tracking to accurately reflect workflow state
- Fixed post-submission flow to allow starting fresh reports after submission

### PWA Enhancements
- Fixed PWA paths for GitHub Pages subdirectory hosting
- Updated webhook URLs to production endpoints

### Refresh App Button (January 2026)
- **New feature in settings.html** - Added "Refresh App" button in Troubleshooting section
  - Clears PWA service worker cache to get latest app version
  - Preserves all user data (reports, settings, projects) in localStorage
  - Unregisters service workers and clears browser caches
  - Automatically reloads page after cache clear
  - Useful for troubleshooting or forcing app updates

### Mobile-Friendly Layouts (January 2026)
- **Refactored Personnel and Equipment sections** for improved mobile experience
  - Personnel section uses compact grid layout optimized for small screens
  - Equipment section cards with touch-friendly dropdowns
  - Better responsive behavior on narrow viewports
  - Improved readability with adjusted font sizes and spacing

---

## Summary

FieldVoice Pro is a sophisticated, production-ready field documentation system that:
- **Multi-project management** - Configure and switch between multiple construction projects with contractor rosters and equipment inventories
- **Document import** - Automatically extract project data from existing PDF/DOCX reports via AI-powered document processing
- **Fully installable as a PWA** - Works offline when saved to home screen on mobile devices
- **DOT-compliant reporting** - Contractor-based work entry, personnel tracking, and equipment status matching DOT form requirements
- **AI Kit integration** - Side-by-side text refinement with training data export for prompt improvement
- Operates primarily client-side with optional n8n webhook integration for AI features
- Supports voice-first data entry via native keyboard dictation with AI enhancement
- Generates professional, DOT-compliant PDF reports with 12 comprehensive sections
- **Complete offline support** for report creation, editing, and viewing (weather sync and AI features require internet)
- Uses n8n webhooks for AI text refinement, report submission, and document extraction
- Manages browser storage efficiently with automatic compression
- **Service worker caching** ensures fast load times and airplane mode compatibility
- **Safe-area support** for modern iOS devices with notch/Dynamic Island
- **Streamlined navigation** with project picker, Home buttons, and improved workflow tracking

The codebase is mature (~12,745 lines including PWA infrastructure), well-structured, and includes comprehensive error handling for real-world field conditions including graceful offline degradation.
