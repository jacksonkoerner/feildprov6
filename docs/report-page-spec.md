# Report Page Technical Specification

## Overview

`report.html` is the Daily Report viewer and editor in FieldVoice Pro. It displays and allows editing of construction daily reports that combine field-captured data with AI-generated content from the n8n webhook.

### Data Flow

```
quick-interview.html (field capture)
         │
         ▼
    Field Notes + Photos + Weather
         │
         ▼
n8n webhook (POST to fieldvoice-refine)
         │
         ▼
    AI Processing
         │
         ▼
   aiGenerated payload
         │
         ▼
report.html (display + edit)
```

The webhook endpoint: `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine`

---

## Data Priority

The `getValue()` function implements a priority system for resolving field values:

```
1. userEdits        (highest priority - user has manually edited)
2. aiGenerated      (AI-processed content from webhook)
3. fieldNotes/guidedNotes (raw field capture data)
4. defaults         (project config or hardcoded defaults)
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `getValue(path, default)` | Generic value resolver with full priority chain |
| `getTextFieldValue(reportPath, aiPath, default)` | Text fields with AI path mapping |
| `getContractorActivity(contractorId)` | Per-contractor work activity data |
| `getContractorOperations(contractorId)` | Per-contractor personnel counts |
| `getEquipmentData()` | Equipment list with AI fallback |
| `getNestedValue(obj, path)` | Dot-notation path accessor |

### User Edit Tracking

When a user modifies a field, the value is stored in `report.userEdits[path]` and the field receives the `user-edited` CSS class (yellow background). User edits persist across page loads and always override AI-generated values.

---

## Form Fields Reference

### Project Overview Section

| Field ID | Label | Data Path | Type | Source |
|----------|-------|-----------|------|--------|
| `projectName` | Project Name | `overview.projectName` | text | Project config / editable |
| `noabProjectNo` | NOAB Project No. | `overview.noabProjectNo` | text | Project config / editable |
| `cnoSolicitationNo` | CNO Solicitation No. | `overview.cnoSolicitationNo` | text | Default: "N/A" |
| `noticeToProceed` | Notice to Proceed | - | date | Project config (readonly) |
| `contractDuration` | Contract Duration | - | text | Project config (readonly) |
| `expectedCompletion` | Expected Completion | - | date | Project config (readonly) |
| `contractDay` | Contract Day # | `overview.contractDay` | text | Format: "Day X of Y" |
| `weatherDaysCount` | Weather Days | `overview.weatherDays` | number | Editable |
| `reportDate` | Date | `overview.date` | date | Report date |
| `projectLocation` | Location | `overview.location` | text | Project config / editable |
| `engineer` | Engineer | `overview.engineer` | text | Project config / editable |
| `contractor` | Contractor | `overview.contractor` | text | Project config / editable |
| `startTime` | Start Time | `overview.startTime` | time | Default from project config |
| `endTime` | End Time | `overview.endTime` | time | Default from project config |
| `shiftDuration` | Shift Duration | - | text | Auto-calculated (readonly) |
| `completedBy` | Completed By | `overview.completedBy` | text | Inspector name |

### Weather Block

| Field ID | Label | Data Path | Type | Source |
|----------|-------|-----------|------|--------|
| `weatherHigh` | High Temp | `overview.weather.highTemp` | text | Field capture / editable |
| `weatherLow` | Low Temp | `overview.weather.lowTemp` | text | Field capture / editable |
| `weatherPrecip` | Precipitation | `overview.weather.precipitation` | text | Field capture / editable |
| `weatherCondition` | Condition | `overview.weather.generalCondition` | text | Field capture / editable |
| `weatherJobSite` | Job Site | `overview.weather.jobSiteCondition` | select | Options: Dry, Wet, Muddy, Frozen |
| `weatherAdverse` | Adverse Conditions | `overview.weather.adverseConditions` | text | Field capture / editable |

### Work Summary Section (Per-Contractor)

Dynamic cards rendered for each contractor in `projectContractors`. Each card contains:

| Field Class | Data Attribute | Data Path | Type | Notes |
|-------------|----------------|-----------|------|-------|
| `.no-work-checkbox` | `data-contractor-id` | `activity_[id].noWork` | checkbox | Toggle work performed |
| `.contractor-narrative` | `data-contractor-id` | `activity_[id].narrative` | textarea | Work description |
| `.contractor-equipment` | `data-contractor-id` | `activity_[id].equipmentUsed` | text | Equipment summary |
| `.contractor-crew` | `data-contractor-id` | `activity_[id].crew` | text | Crew summary |

### Personnel Table (Per-Contractor Row)

| Field Class | Data Attribute | Data Path | Type |
|-------------|----------------|-----------|------|
| `.personnel-input[data-field="superintendents"]` | `data-contractor-id` | `operations_[id].superintendents` | number |
| `.personnel-input[data-field="foremen"]` | `data-contractor-id` | `operations_[id].foremen` | number |
| `.personnel-input[data-field="operators"]` | `data-contractor-id` | `operations_[id].operators` | number |
| `.personnel-input[data-field="laborers"]` | `data-contractor-id` | `operations_[id].laborers` | number |
| `.personnel-input[data-field="surveyors"]` | `data-contractor-id` | `operations_[id].surveyors` | number |
| `.personnel-input[data-field="others"]` | `data-contractor-id` | `operations_[id].others` | number |

**Totals Row IDs:** `totalSuper`, `totalForeman`, `totalOperators`, `totalLaborers`, `totalSurveyors`, `totalOthers`, `totalAll`

### Equipment Table

| Field Class | Data Attribute | Description |
|-------------|----------------|-------------|
| `.equipment-contractor` | `data-equipment-index` | Contractor select dropdown |
| `.equipment-type` | `data-equipment-index` | Equipment type/model text |
| `.equipment-qty` | `data-equipment-index` | Quantity number |
| `.equipment-status` | `data-equipment-index` | Status select (IDLE or 1-10 hrs) |

### Text Sections

| Field ID | Label | Report Path | AI Path | Type |
|----------|-------|-------------|---------|------|
| `issuesText` | Issues, Delays & RFIs | `issues` | `generalIssues` | textarea |
| `qaqcText` | QA/QC Testing & Inspections | `qaqc` | `qaqcNotes` | textarea |
| `safetyText` | Safety Notes / Toolbox Talks | `safety.notes` | `safety.notes` | textarea |
| `communicationsText` | Communications with Contractor | `communications` | `contractorCommunications` | textarea |
| `visitorsText` | Visitors, Deliveries & Remarks | `visitors` | `visitorsRemarks` | textarea |

### Safety Incident Toggle

| Field ID | Name | Value | Description |
|----------|------|-------|-------------|
| `safetyNoIncident` | `safetyIncident` | `none` | No incidents occurred |
| `safetyHasIncident` | `safetyIncident` | `incident` | Incident occurred |

### Photos Section

Dynamic photo cards rendered from `report.photos[]`. Each card contains:

| Element | Data Attribute | Description |
|---------|----------------|-------------|
| `.photo-card-caption` | `data-photo-index` | Caption textarea for each photo |

Photo metadata displayed: date, time, GPS coordinates (if available).

### Signature Section

| Field ID | Label | Data Path | Type |
|----------|-------|-----------|------|
| `signatureName` | Inspector Name | `signature.name` | text |
| `signatureTitle` | Title | `signature.title` | text |
| `signatureCompany` | Company | `signature.company` | text |
| `signatureDate` | Date | - | display only (auto-filled) |

---

## Expected aiGenerated Payload

The n8n webhook should return a JSON response with this structure:

```json
{
  "success": true,
  "aiGenerated": {
    "activities": [
      {
        "contractorId": "contractor-uuid",
        "noWork": false,
        "narrative": "Performed excavation work on Section A...",
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
      "Delay due to material delivery",
      "RFI #45 pending response"
    ],

    "qaqcNotes": [
      "Concrete cylinder samples taken",
      "Compaction testing passed"
    ],

    "safety": {
      "hasIncidents": false,
      "noIncidents": true,
      "notes": "Toolbox talk on heat safety conducted"
    },

    "contractorCommunications": "Discussed schedule with prime contractor...",

    "visitorsRemarks": "City inspector visited at 10:00 AM..."
  }
}
```

### Array vs String Fields

| Field | Type | Notes |
|-------|------|-------|
| `activities` | Array | One object per contractor |
| `operations` | Array | One object per contractor |
| `equipment` | Array | One object per equipment item |
| `generalIssues` | Array or String | Joined with `\n` for display |
| `qaqcNotes` | Array or String | Joined with `\n` for display |
| `safety.notes` | String or Array | If array, joined with `\n` |
| `contractorCommunications` | String | Direct display |
| `visitorsRemarks` | String | Direct display |

---

## Field Mapping Table

### Text Sections

| Webhook Field | Report Field ID | Report Path | Notes |
|---------------|-----------------|-------------|-------|
| `generalIssues` | `issuesText` | `issues` | Array joined with newlines |
| `qaqcNotes` | `qaqcText` | `qaqc` | Array joined with newlines |
| `safety.notes` | `safetyText` | `safety.notes` | String or array |
| `contractorCommunications` | `communicationsText` | `communications` | String |
| `visitorsRemarks` | `visitorsText` | `visitors` | String |

### Activities Mapping

| Webhook Field | UI Element | Notes |
|---------------|------------|-------|
| `activities[].contractorId` | Card `data-contractor-id` | Matches project contractor ID |
| `activities[].noWork` | `.no-work-checkbox` | Boolean |
| `activities[].narrative` | `.contractor-narrative` | Work description |
| `activities[].equipmentUsed` | `.contractor-equipment` | Equipment summary |
| `activities[].crew` | `.contractor-crew` | Crew summary |

### Operations Mapping

| Webhook Field | UI Element | Notes |
|---------------|------------|-------|
| `operations[].contractorId` | Table row `data-contractor-id` | Matches project contractor ID |
| `operations[].superintendents` | `.personnel-input[data-field="superintendents"]` | Number |
| `operations[].foremen` | `.personnel-input[data-field="foremen"]` | Number |
| `operations[].operators` | `.personnel-input[data-field="operators"]` | Number |
| `operations[].laborers` | `.personnel-input[data-field="laborers"]` | Number |
| `operations[].surveyors` | `.personnel-input[data-field="surveyors"]` | Number |
| `operations[].others` | `.personnel-input[data-field="others"]` | Number |

### Equipment Mapping

| Webhook Field | UI Element | Notes |
|---------------|------------|-------|
| `equipment[].contractorId` | `.equipment-contractor` | Contractor select |
| `equipment[].type` | `.equipment-type` | Equipment type/model |
| `equipment[].qty` or `quantity` | `.equipment-qty` | Quantity |
| `equipment[].status` or derived from `hoursUsed` | `.equipment-status` | "IDLE" or "X hrs" |

---

## Dynamic Sections

### Contractor Work Cards

**Render Function:** `renderWorkSummary()`

**Data Source:** `projectContractors` array (from active project config)

**Behavior:**
1. Iterates through `projectContractors` sorted by type (prime first)
2. For each contractor, calls `getContractorActivity(contractorId)` to get data
3. Renders a card with:
   - Contractor name and type badge (PRIME/SUB)
   - "No work performed" checkbox
   - Collapsible work fields (narrative, equipment, crew)
4. Cards styled based on content status:
   - `.has-content`: Green border when work documented
   - `.no-work`: Gray background when no work checked

### Personnel Table Rows

**Render Function:** `renderPersonnelTable()`

**Data Source:** `projectContractors` array

**Behavior:**
1. Creates one row per contractor
2. Calls `getContractorOperations(contractorId)` to populate values
3. Columns: Contractor, Trade, Super, Foreman, Operators, Laborers, Surveyors, Others, Total
4. Auto-calculates row totals and column totals
5. Updates on any input change via `updatePersonnelRow()` and `updatePersonnelTotals()`

### Equipment Table Rows

**Render Function:** `renderEquipmentTable()`

**Data Source:** `getEquipmentData()` (merges report.equipment and aiGenerated.equipment)

**Behavior:**
1. Renders existing equipment data or one empty row
2. Each row has: Contractor dropdown, Type input, Qty input, Status dropdown
3. "Add Equipment" button appends new rows
4. Updates saved on any field change via `updateEquipmentRow()`

### Photo Cards

**Render Function:** `renderPhotos()`

**Data Source:** `report.photos[]` array

**Behavior:**
1. Single-column layout for DOT compliance
2. Each card shows: Photo number, image, metadata (date/time/GPS), caption textarea
3. Image loading handled with states: loading spinner → image or error
4. Orientation detection via `handlePhotoLoad()` (portrait vs landscape styling)
5. Captions auto-save on blur and with 1-second debounce on input

---

## Webhook Request Payload

The payload sent to the n8n webhook from `quick-interview.html`:

```json
{
  "reportId": "fieldvoice_report_projectId_2024-01-15",
  "captureMode": "guided",

  "projectContext": {
    "projectId": "uuid",
    "projectName": "Highway 61 Reconstruction",
    "noabProjectNo": "1291",
    "location": "New Orleans, LA",
    "engineer": "Engineering Firm Inc",
    "primeContractor": "ABC Construction",
    "contractors": [
      {
        "id": "uuid",
        "name": "ABC Construction",
        "type": "prime",
        "trades": "General"
      }
    ],
    "equipment": [
      {
        "id": "uuid",
        "type": "Excavator",
        "model": "CAT 320"
      }
    ]
  },

  "fieldNotes": {
    "workSummary": "Raw transcribed work summary...",
    "issues": "Raw issues notes...",
    "safety": "Raw safety notes..."
  },

  "weather": {
    "highTemp": "85",
    "lowTemp": "72",
    "precipitation": "0.00",
    "generalCondition": "Sunny",
    "jobSiteCondition": "Dry"
  },

  "photos": [
    {
      "id": "photo-uuid",
      "caption": "Existing caption",
      "timestamp": 1705329600000,
      "date": "1/15/2024",
      "time": "10:30 AM",
      "gps": { "lat": 29.9511, "lng": -90.0715 }
    }
  ],

  "reportDate": "1/15/2024",
  "inspectorName": "John Smith"
}
```

---

## Storage Keys

| Key Pattern | Description |
|-------------|-------------|
| `fieldvoice_report_[projectId]_[date]` | Project-specific daily report |
| `fieldvoice_report_[date]` | Legacy date-only key |
| `fieldvoice_report` | Most recent report (backward compatibility) |
| `[key]_submitted_[timestamp]` | Archived submitted reports |

---

## Status Tracking

The `report.meta.status` field indicates processing state:

| Status | Description |
|--------|-------------|
| `pending_refine` | Waiting for AI processing (offline or failed) |
| `refined` | AI processing complete |
| (undefined) | Fresh report, not yet processed |

When status is `pending_refine`, a yellow banner appears with "Retry Now" button to re-attempt webhook call.
