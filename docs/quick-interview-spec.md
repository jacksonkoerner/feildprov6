# Quick Interview Technical Specification

## Overview

`quick-interview.html` is the primary field data capture interface in FieldVoice Pro. It provides construction inspectors with two capture modes for documenting daily activities, which are then sent to an n8n webhook for AI processing.

### Purpose

- Field data capture with two modes: Quick Notes (minimal) and Guided Sections
- Captures weather, work activities, issues, safety, and photos
- Sends data TO n8n for AI processing and refinement

### Webhook

**Endpoint:** `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine`

### Data Flow

```
User selects capture mode
        │
        ▼
Minimal Mode (Quick Notes)    OR    Guided Mode (Structured Sections)
        │                                   │
        └───────────────┬───────────────────┘
                        │
                        ▼
               Click "Finish"
                        │
                        ▼
        buildProcessPayload() builds request
                        │
                        ▼
        POST to fieldvoice-refine webhook
                        │
                        ▼
             n8n AI processing
                        │
                        ▼
        Response saved to report.aiGenerated
                        │
                        ▼
          Redirect to report.html
```

---

## Capture Modes

### Mode Selection Screen

When a user opens quick-interview.html with no existing data, they see a mode selection screen with two options:

| Mode | ID | Button Handler | Description |
|------|----|----------------|-------------|
| Quick Notes | `minimal` | `selectCaptureMode('minimal')` | Single freeform textarea + photos |
| Guided Sections | `guided` | `selectCaptureMode('guided')` | Structured sections with categories |

### 1. Quick Notes (Minimal Mode)

**UI Container:** `#minimalModeApp`

A streamlined interface with:
- Auto-fetched weather display (read-only)
- Single freeform textarea for all field notes
- Photo capture with GPS and timestamp

**Best for:** Quick dictation of all observations without structure.

### 2. Guided Sections Mode

**UI Container:** `#app`

Expandable section cards for structured input:
1. Weather & Site Conditions
2. Work Summary
3. Issues & Delays
4. Safety
5. Progress Photos

**Best for:** Systematic documentation with category separation.

---

## Input Fields by Section

### Mode Selection Screen

| Field ID | Input Type | Data Captured |
|----------|------------|---------------|
| `modeSelectionProjectName` | Display | Active project name |
| `modeSelectionDate` | Display | Current date formatted |

---

### Minimal Mode Fields

#### Weather Card (Display Only)

| Field ID | Input Type | Data Captured |
|----------|------------|---------------|
| `minimalWeatherIcon` | Icon | Weather condition icon |
| `minimalWeatherCondition` | Display | Weather description (e.g., "Sunny") |
| `minimalWeatherTemp` | Display | Current temperature |
| `minimalWeatherPrecip` | Display | Precipitation amount |

#### Field Notes Section

| Field ID | Input Type | Data Captured |
|----------|------------|---------------|
| `freeform-notes-input` | textarea | Freeform dictated/typed field notes |
| `fieldNotesCharCount` | Display | Character count |

**Handler:** `updateFieldNotes(value)` saves to `report.fieldNotes.freeformNotes`

#### Photos Section (Minimal)

| Field ID | Input Type | Data Captured |
|----------|------------|---------------|
| `minimalPhotoInput` | file (multiple) | Photo files with GPS |
| `minimalPhotosGrid` | Container | Rendered photo grid |
| `minimalPhotosCount` | Display | Photo count text |

---

### Guided Mode Fields

#### 1. Weather & Site Conditions

**Section Card:** `data-section="weather"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `weather-condition` | Display | Auto-fetched condition (e.g., "Sunny") |
| `weather-temp` | Display | Temperature |
| `weather-precip` | Display | Precipitation |
| `site-conditions-input` | textarea | Manual site conditions description |

**Data Path:** `report.overview.weather.jobSiteCondition`

#### 2. Work Summary

**Section Card:** `data-section="activities"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `work-summary-input` | textarea | Consolidated work performed description |

**Handler:** `updateWorkSummary(value)` saves to `report.guidedNotes.workSummary`

**Note:** This is a simplified single-textarea approach. The AI extracts per-contractor details from this summary during processing.

#### 3. Issues & Delays

**Section Card:** `data-section="issues"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `issues-na-btn` | button | Mark as "No Issues - N/A" |
| `issue-input` | textarea | Issue description input |
| `issues-list` | Container | List of added issues |
| Add button | button | `addIssue()` handler |

**Data Path:** `report.generalIssues[]` (array of strings)

**Functions:**
- `addIssue()` - Adds issue to array
- `removeIssue(index)` - Removes issue at index
- `markNA('issues')` - Marks section as N/A

#### 4. Safety

**Section Card:** `data-section="safety"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `no-incidents` | checkbox | Boolean: No incidents occurred |
| `has-incidents` | checkbox | Boolean: Incident occurred |
| `safety-input` | textarea | Safety notes/toolbox talks input |
| `safety-list` | Container | List of safety notes |
| Add button | button | `addSafetyNote()` handler |

**Data Paths:**
- `report.safety.noIncidents` (boolean)
- `report.safety.hasIncidents` (boolean)
- `report.safety.notes[]` (array of strings)

**Functions:**
- `addSafetyNote()` - Adds note to array
- `removeSafetyNote(index)` - Removes note at index

#### 5. Progress Photos

**Section Card:** `data-section="photos"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `photos-na-btn` | button | Mark as "No Photos - N/A" |
| `photoInput` | file (multiple) | Photo files with `capture="environment"` |
| `photos-grid` | Container | 2-column photo grid |

**Photo Object Structure:**
```javascript
{
    id: "photo_1705329600000_0",
    url: "data:image/jpeg;base64,...",  // Compressed image
    caption: "",                         // User-entered caption
    timestamp: "2024-01-15T10:30:00.000Z",
    date: "1/15/2024",
    time: "10:30:00 AM",
    gps: {
        lat: 29.9511,
        lng: -90.0715,
        accuracy: 10  // meters
    },
    fileName: "IMG_1234.jpg",
    fileSize: 2048000,
    fileType: "image/jpeg"
}
```

**Photo Processing:**
1. Validates file type (must be image/*)
2. Validates file size (max 20MB)
3. Captures GPS coordinates via `navigator.geolocation`
4. Reads file as DataURL
5. Compresses image (max 1200px width, 70% quality)
6. If storage low, re-compresses (max 800px width, 50% quality)
7. Captures timestamp at upload time

---

## Additional Data Sections (In Report Structure)

The following fields exist in the report data structure and are populated by AI processing, but are NOT directly captured in the simplified quick-interview UI:

### Per-Contractor Activities (AI-Populated)

| Field | Type | Description |
|-------|------|-------------|
| `report.activities[].contractorId` | string | Contractor UUID |
| `report.activities[].noWork` | boolean | No work performed flag |
| `report.activities[].narrative` | string | Work description |
| `report.activities[].equipmentUsed` | string | Equipment summary |
| `report.activities[].crew` | string | Crew summary |

### Personnel/Operations (AI-Populated)

| Field | Type | Description |
|-------|------|-------------|
| `report.operations[].contractorId` | string | Contractor UUID |
| `report.operations[].superintendents` | number | Count |
| `report.operations[].foremen` | number | Count |
| `report.operations[].operators` | number | Count |
| `report.operations[].laborers` | number | Count |
| `report.operations[].surveyors` | number | Count |
| `report.operations[].others` | number | Count |

### Equipment Status (AI-Populated)

| Field | Type | Description |
|-------|------|-------------|
| `report.equipment[].equipmentId` | string | Equipment UUID |
| `report.equipment[].contractorId` | string | Contractor UUID |
| `report.equipment[].hoursUtilized` | number/null | Hours used (null = IDLE) |
| `report.equipment[].quantity` | number | Equipment count |

### Other Fields (AI-Populated)

| Field | Type | Description |
|-------|------|-------------|
| `report.qaqcNotes[]` | array | QA/QC inspection notes |
| `report.contractorCommunications` | string | Communications with contractor |
| `report.visitorsRemarks` | string | Visitors, deliveries, remarks |
| `report.additionalNotes` | string | Additional notes |

---

## Webhook Request Payload

The `buildProcessPayload()` function (line 1047) constructs the payload sent to n8n:

```json
{
  "reportId": "fieldvoice_report_[projectId]_YYYY-MM-DD",
  "captureMode": "minimal" | "guided",

  "projectContext": {
    "projectId": "uuid-string",
    "projectName": "Highway 61 Reconstruction",
    "noabProjectNo": "1291",
    "location": "New Orleans, LA",
    "engineer": "Engineering Firm Inc",
    "primeContractor": "ABC Construction",
    "contractors": [
      {
        "id": "contractor-uuid",
        "name": "ABC Construction",
        "type": "prime",
        "trades": "General"
      },
      {
        "id": "contractor-uuid-2",
        "name": "XYZ Electrical",
        "type": "sub",
        "trades": "Electrical"
      }
    ],
    "equipment": [
      {
        "id": "equipment-uuid",
        "type": "Excavator",
        "model": "CAT 320",
        "contractorId": "contractor-uuid"
      }
    ]
  },

  "fieldNotes": {
    // For MINIMAL mode:
    "freeformNotes": "Full dictated field notes..."

    // For GUIDED mode:
    "workSummary": "Work summary from guided input...",
    "issues": "Issues joined with newlines...",
    "safety": "No incidents reported" | "INCIDENT REPORTED: ..."
  },

  "weather": {
    "highTemp": "85",
    "lowTemp": "72",
    "precipitation": "0.00\"",
    "generalCondition": "Sunny",
    "jobSiteCondition": "Dry",
    "adverseConditions": "N/A"
  },

  "photos": [
    {
      "id": "photo_1705329600000_0",
      "caption": "Foundation pour in progress",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "date": "1/15/2024",
      "time": "10:30 AM",
      "gps": {
        "lat": 29.9511,
        "lng": -90.0715,
        "accuracy": 10
      }
    }
  ],

  "reportDate": "1/15/2024",
  "inspectorName": "John Smith"
}
```

### Payload Field Details

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `reportId` | string | Generated | Format: `fieldvoice_report_[projectId]_YYYY-MM-DD` |
| `captureMode` | string | `report.meta.captureMode` | "minimal" or "guided" |
| `projectContext` | object | Active project config | From localStorage `fvp_active_project` |
| `fieldNotes` | object | Varies by mode | See below |
| `weather` | object | `report.overview.weather` | Auto-fetched + manual input |
| `photos` | array | `report.photos[]` | Photo URLs excluded (only metadata) |
| `reportDate` | string | `report.overview.date` | Formatted date |
| `inspectorName` | string | `report.overview.completedBy` | Inspector name |

### fieldNotes by Capture Mode

**Minimal Mode (`captureMode: "minimal"`):**
```json
{
  "freeformNotes": "Everything dictated in single textarea..."
}
```

**Guided Mode (`captureMode: "guided"`):**
```json
{
  "workSummary": "From work-summary-input textarea",
  "issues": "generalIssues array joined with \\n",
  "safety": "No incidents reported" | "INCIDENT REPORTED: [notes joined with ;]"
}
```

---

## Data Stored in localStorage

### Storage Key Patterns

| Key Pattern | Description |
|-------------|-------------|
| `fieldvoice_report_[projectId]_YYYY-MM-DD` | Project-specific daily report |
| `fieldvoice_report_YYYY-MM-DD` | Legacy date-only key (no project) |
| `fieldvoice_report` | Most recent report (backward compatibility) |

### Report Structure in localStorage

```json
{
  "meta": {
    "createdAt": "2024-01-15T08:00:00.000Z",
    "interviewCompleted": false,
    "version": 2,
    "naMarked": {
      "issues": false,
      "photos": false
    },
    "captureMode": "guided",
    "status": "refined",
    "offlineQueue": []
  },

  "reporter": {
    "name": "John Smith"
  },

  "project": {
    "name": "Highway 61 Reconstruction",
    "dayNumber": null
  },

  "overview": {
    "projectName": "Highway 61 Reconstruction",
    "date": "1/15/2024",
    "startTime": "7:00 AM",
    "endTime": "4:30 PM",
    "shiftDuration": "9.30 hours",
    "weather": {
      "highTemp": "85",
      "lowTemp": "72",
      "precipitation": "0.00\"",
      "generalCondition": "Sunny",
      "jobSiteCondition": "Dry",
      "adverseConditions": "N/A"
    }
  },

  "fieldNotes": {
    "freeformNotes": ""
  },

  "guidedNotes": {
    "workSummary": "Work performed today...",
    "issues": "Issues joined text...",
    "safety": "Safety status text..."
  },

  "contractors": [],
  "activities": [],
  "operations": [],
  "equipment": [],
  "generalIssues": ["Issue 1", "Issue 2"],
  "qaqcNotes": [],

  "safety": {
    "hasIncidents": false,
    "noIncidents": true,
    "notes": ["No safety incidents reported."]
  },

  "contractorCommunications": "",
  "visitorsRemarks": "",
  "additionalNotes": "",

  "photos": [
    {
      "id": "photo_1705329600000_0",
      "url": "data:image/jpeg;base64,...",
      "caption": "",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "date": "1/15/2024",
      "time": "10:30:00 AM",
      "gps": { "lat": 29.9511, "lng": -90.0715, "accuracy": 10 },
      "fileName": "IMG_1234.jpg",
      "fileSize": 2048000,
      "fileType": "image/jpeg"
    }
  ],

  "aiGenerated": { ... }
}
```

### Other localStorage Keys

| Key | Description |
|-----|-------------|
| `fvp_projects` | Array of project configurations |
| `fvp_active_project` | Active project ID |
| `fvp_mic_granted` | Microphone permission status |
| `fvp_loc_granted` | Location permission status |
| `fvp_dictation_hint_dismissed` | Hint banner dismissed flag |
| `permissions_dismissed` | Permissions modal dismissed flag |

---

## Expected n8n Response

The webhook should return a JSON response with this structure:

```json
{
  "success": true,
  "aiGenerated": {
    "activities": [
      {
        "contractorId": "contractor-uuid",
        "noWork": false,
        "narrative": "Performed excavation work on Section A. Completed 200 LF of trench excavation.",
        "equipmentUsed": "Excavator (1), Dump Truck (2)",
        "crew": "Foreman (1), Laborers (4)"
      }
    ],

    "operations": [
      {
        "contractorId": "contractor-uuid",
        "superintendents": 1,
        "foremen": 2,
        "operators": 3,
        "laborers": 8,
        "surveyors": 0,
        "others": 0
      }
    ],

    "equipment": [
      {
        "contractorId": "contractor-uuid",
        "equipmentId": "equipment-uuid",
        "type": "CAT 320 Excavator",
        "qty": 1,
        "quantity": 1,
        "status": "8 hrs",
        "hoursUsed": 8
      }
    ],

    "generalIssues": [
      "Delay due to material delivery - concrete truck arrived 2 hours late",
      "RFI #45 pending response from engineer"
    ],

    "qaqcNotes": [
      "Concrete cylinder samples taken at 10:00 AM",
      "Compaction testing passed - 98% density achieved"
    ],

    "safety": {
      "hasIncidents": false,
      "noIncidents": true,
      "notes": "Toolbox talk on heat safety conducted at 7:00 AM"
    },

    "contractorCommunications": "Discussed schedule adjustment with prime contractor. Agreed to extend work hours Thursday to make up for weather delay.",

    "visitorsRemarks": "City inspector visited at 10:00 AM - approved foundation pour. Material delivery from ABC Supply at 2:00 PM."
  }
}
```

### Response Field Types

| Field | Type | Notes |
|-------|------|-------|
| `success` | boolean | Request success indicator |
| `aiGenerated` | object | Container for all AI-processed data |
| `activities` | array | One object per contractor |
| `operations` | array | One object per contractor |
| `equipment` | array | One object per equipment item |
| `generalIssues` | array or string | If array, joined with `\n` for display |
| `qaqcNotes` | array or string | If array, joined with `\n` for display |
| `safety` | object | Safety status with notes |
| `safety.notes` | string or array | If array, joined with `\n` |
| `contractorCommunications` | string | Direct display |
| `visitorsRemarks` | string | Direct display |

### Response Validation

The `callProcessWebhook()` function validates the response:

1. Checks for `data.success` or `data.aiGenerated`
2. If `aiGenerated` is a string, attempts to parse as JSON
3. Ensures required arrays exist with defaults:
   - `activities: []`
   - `operations: []`
   - `equipment: []`
   - `generalIssues: []`
   - `qaqcNotes: []`
   - `safety: { hasIncidents: false, noIncidents: true, notes: '' }`

---

## Status Flow

| Status | Description | UI Behavior |
|--------|-------------|-------------|
| `null/undefined` | Fresh report | Mode selection shown |
| `pending_refine` | Offline or webhook failed | Queued for retry |
| `refined` | AI processing complete | Ready for report.html |

### Offline Handling

When offline or webhook fails:
1. Payload added to `report.meta.offlineQueue[]`
2. Status set to `pending_refine`
3. Toast: "You're offline - AI processing will complete when connected"
4. User redirected to report.html
