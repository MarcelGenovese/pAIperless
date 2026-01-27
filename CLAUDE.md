# CLAUDE.md - pAIperless Development Guide

This file provides comprehensive guidance to Claude Code when working with this codebase.

## Project Overview

**pAIperless** is a Next.js application that extends Paperless-NGX with AI-powered document processing capabilities. It runs as a single Docker container and provides:

- **Stage 1: Document Ingestion & OCR** - Automated PDF consumption, pre-processing, and Google Document AI OCR
- **Stage 2: AI Analysis & Tagging** - Gemini LLM integration for metadata extraction and action detection
- **Stage 3: Task Management** - Google Calendar/Tasks integration for action tracking

### Core Architecture

**Single Docker Container** containing:
- Next.js 15+ application (Frontend + API Routes)
- SQLite database (via Prisma ORM)
- Background worker for file processing
- FTP server for document upload (optional)
- System tools: `tesseract`, `ghostscript`, `qpdf`, `python3`

**Tech Stack:**
- **Framework:** Next.js 15+ with App Router, TypeScript, React Server Components
- **Styling:** Tailwind CSS, shadcn/ui components
- **Authentication:** NextAuth.js (delegated to Paperless-NGX)
- **Database:** Prisma + SQLite
- **File Watching:** chokidar
- **i18n:** next-intl (prepared for internationalization, primary language: English)

---

## Complete Feature Set & Processing Pipeline

### Stage 1: Document Ingestion & OCR

**Input Methods:**
1. Files dropped in `/consume` folder (Docker volume mount)
2. FTP upload to container FTP server → `/consume` folder

**Processing Steps:**
1. **File Detection:** chokidar watches `/consume` for new PDFs
2. **Deduplication (Critical):**
   - Calculate SHA-256 hash IMMEDIATELY
   - Check database for existing hash
   - If duplicate: Move to `/error`, prevent reprocessing, log error
   - **This MUST happen before any Google API calls to prevent cost multiplication**
3. **Move to Processing:** Shift file to `/processing` folder, create database record with status `PENDING`
4. **Pre-processing:**
   - Use `tesseract --psm 0` (OSD mode) to detect page orientation
   - Rotate pages if needed using `qpdf` or `ghostscript`
   - Strip existing OCR text layers using `qpdf` or `ghostscript`
5. **OCR Decision:**
   - Check PDF file size and page count against Google Document AI limits
   - **If within limits:** Process with Google Document AI, reassemble PDF with OCR text layer
   - **If exceeds limits:** Skip Document AI, proceed directly to Paperless (uses Tesseract fallback)
6. **Upload to Paperless:**
   - Send processed/original PDF to Paperless-NGX via API
   - Add tag `ai_todo` (user-configurable name)
   - Update database status to `COMPLETED`
7. **Error Handling:**
   - On any error: Move file to `/error` folder
   - Log error message and stack trace to database
   - Send email notification (if configured)
   - Manual retry available via dashboard

### Stage 2: AI Analysis & Tagging

**Trigger:** Paperless webhook → `/api/webhooks/paperless/document-added`

**Authentication:** Webhook must include header `x-api-key: <WEBHOOK_API_KEY>` (system-generated during setup)

**Processing Steps:**
1. Validate webhook API key
2. Query Paperless API for documents with tag `ai_todo`
3. For each document:
   - Fetch document text/content from Paperless
   - Send to Gemini LLM with structured prompt (see Prompt Template below)
   - Parse JSON response containing:
     - Tags (array of strings)
     - Filename (suggested document name)
     - Correspondent (sender/organization)
     - Custom fields (action description, due date, etc.)
     - `action_required` flag (boolean)
4. Update Paperless document via API:
   - Set all tags from Gemini response
   - Update filename if suggested
   - Set correspondent
   - Populate custom fields
   - Add tag `action_required` if flag is true
   - Remove tag `ai_todo`
5. Track token usage (sent/received) in database for cost estimation
6. Send email notification on completion (if configured)

**Gemini Prompt Template:**
```
Analyze this document and extract metadata in JSON format.

Document Text:
{document_content}

Respond with JSON:
{
  "tags": ["tag1", "tag2"],
  "filename": "suggested-filename",
  "correspondent": "Sender Name",
  "custom_fields": {
    "action_description": "What user needs to do",
    "due_date": "YYYY-MM-DD"
  },
  "action_required": true/false
}

Determine if user action is required (payment deadline, cancellation period, response needed, etc.)
```

### Stage 3: Task Management & Action Tracking

**Trigger:** Paperless webhook → `/api/webhooks/paperless/document-updated` OR periodic polling

**Processing Steps:**
1. Query Paperless API for documents with tag `action_required`
2. For each document:
   - Check if already has associated Google Task (via database tracking)
   - If not: Create Google Calendar event with reminder
   - If not: Create Google Task with action description and due date
   - Store task ID and calendar event ID in database
3. **Background Polling (configurable interval, default 10-30 min):**
   - Query Google Tasks API for completion status
   - If task marked complete:
     - Remove tag `action_required` from Paperless document
     - Update database status
     - Send email notification (if configured)

**Manual Re-trigger:**
- User can manually re-add tag `action_required` to document in Paperless
- Webhook notifies system → recreates task/event

---

## Design System & UI Guidelines

### Design Principles

**Core Philosophy:**
1. **Friendly & Approachable** - Light, inviting design that feels welcoming
2. **Professional Yet Warm** - Clean and modern without being cold or sterile
3. **Clear & Readable** - High contrast, generous spacing, easy to scan
4. **Subtle Elegance** - Use color sparingly, let white space breathe
5. **User-Focused** - Prioritize usability and clarity over decoration

**Visual Hierarchy:**
- Use blue (`#0066CC`) for primary actions and important text
- Use darker blue (`#27417A`) for emphasis and active states
- Use cyan (`#73E6F8`) VERY sparingly - only for gentle highlights
- Rely on typography, spacing, and shadows for structure
- Avoid overwhelming users with too many colors

**Spacing & Layout:**
- Generous padding and margins (16px minimum, 24-32px preferred)
- White space is a feature, not wasted space
- Group related elements, separate unrelated ones
- Cards and containers should "float" with subtle shadows
- Mobile-first responsive design

### Color Palette

**Primary Colors:**
- Primary Text/Blue: `#0066CC` - used for text, links, primary elements
- Accent/Highlights: `#27417A` (Darker Blue) - used for buttons, active states, emphasis
- Subtle Highlights: `#73E6F8` (Light Cyan) - ONLY use sparingly for gentle accents, hover states
- Background: **Light theme** - white (#FFFFFF) base with very subtle gradients
- Logo Background: **WHITE** (logos have white backgrounds)

**Theme Philosophy:**
- **Friendly & Bright** - Light, airy design with plenty of white space
- **Professional & Clean** - Modern, minimalist aesthetic
- **Subtle Color Use** - Blue dominates, cyan only as gentle accent
- **High Readability** - Strong contrast between text and background

**Gradients:**
- Form backgrounds: Very subtle blue-to-white gradient (`#F0F7FF` → `#FFFFFF`)
- Page background: Optional ultra-subtle gradient for visual depth
- Header backgrounds: Light blue tint (`#F8FBFF`)
- Use CSS `linear-gradient()` with very soft transitions
- Never use dark or heavy gradients

### Layout Architecture

**Three Main Layouts:**

1. **Auth/Setup Layout** (Unified Design)
   - Centered form container (max-width: 1200px on desktop)
   - White background with very subtle blue gradient overlay
   - Logo in form header (white background preserved)
   - Two-column layout on desktop:
     - Left: Form content (60% width) - white card with shadow
     - Right: Video preview + description (40% width) - light blue background `#F8FBFF`
   - Single column on mobile (video below form)
   - Overall page background: Very light gradient (`#F0F7FF` → `#FFFFFF`)
   - Consistent across: Welcome Screen, Login, All Setup Steps
   - Friendly, spacious feel with generous padding

2. **Dashboard Layout**
   - Sidebar navigation (left, ~240px)
     - White background with light shadow
     - Active items: Blue highlight `#27417A` with light background `#F0F7FF`
     - Icons in `#0066CC`
   - Main content area (right)
     - Light gray background `#F9FAFB`
     - Content cards: White with subtle shadows
   - Header with user info and system status
     - White background with bottom border `#E5E7EB`
     - Status badges: Blue tones
   - Responsive: collapsible sidebar on mobile

3. **Settings Layout**
   - Tabbed interface
     - Tabs: Blue text `#0066CC`, active tab: Blue underline `#27417A`
     - Tab content in white cards
   - Each tab can re-trigger setup steps
   - Display token usage, processing statistics
   - Charts/stats use blue color scheme

### Component Guidelines

**Form Fields:**
- Input fields with clear labels in `#0066CC` or dark gray
- White backgrounds with light gray borders (`#E5E7EB`)
- Focus state: Blue border (`#0066CC`) with subtle glow
- Inline validation messages (red text `#DC2626` below field)
- Toast notifications for global success/error
- Password/API key fields: Show/hide toggle (eye icon in `#0066CC`)
- Error states: red border `#DC2626` + error message
- Success states: green checkmark icon `#10B981`

**Buttons:**
- Primary: Blue background `#27417A`, white text, hover: darker blue `#1E3A5F`
- Secondary: White background, blue border `#0066CC`, blue text `#0066CC`
- Tertiary: Ghost button with blue text `#0066CC`, hover: light blue background `#F0F7FF`
- Disabled: Light gray background `#E5E7EB`, gray text, no pointer events
- Loading state: Spinner in button color + "Processing..." text

**Cards/Containers:**
- Rounded corners (8-12px border radius)
- Light background: white `#FFFFFF` or very light blue `#F8FBFF`
- Subtle shadow: `0 1px 3px rgba(0, 0, 0, 0.1)`
- Light border: `#E5E7EB` (1px)
- Padding: 24-32px
- Hover state: Slightly elevated shadow

**Logo Usage:**
- `logo_complete.png` - Full logo with text (welcome screen, large headers)
- `logo_compact.png` - Logo + "AI" text (form headers, sidebar)
- `logo_image_only.png` - Just image (favicon, small icons)
- Always preserve white background, add white padding if needed
- Logos work perfectly with light theme - no adjustments needed
- Use on white or very light blue backgrounds for best visibility

### Typography

**Font Hierarchy:**
- **Headings (h1-h6):** Dark gray `#1F2937` or primary blue `#0066CC` for emphasis
- **Body Text:** Dark gray `#374151` for optimal readability
- **Secondary Text:** Medium gray `#6B7280` for less important info
- **Links:** Primary blue `#0066CC`, hover: darker `#0052A3`, underline on hover
- **Button Text:** White on blue buttons, blue on white buttons

**Font Weights:**
- Headings: 600-700 (semibold to bold)
- Body: 400 (regular)
- Emphasis: 500-600 (medium to semibold)
- Buttons: 500 (medium)

**Font Sizes:**
- h1: 2.25rem (36px) - Page titles
- h2: 1.875rem (30px) - Section headers
- h3: 1.5rem (24px) - Subsections
- h4: 1.25rem (20px) - Card titles
- Body: 1rem (16px) - Default text
- Small: 0.875rem (14px) - Helper text, captions

### Responsive Design

**Breakpoints:**
- Mobile: < 768px (single column, stacked layout)
- Tablet: 768px - 1024px (adjusted spacing)
- Desktop: > 1024px (full two-column layout)

**Mobile Considerations:**
- Collapsible sidebar with hamburger menu
- Video section moves below form on setup screens
- Touch-friendly button sizes (min 44x44px)
- Reduced padding/margins for space efficiency

### Color Usage Examples

**Correct Usage:**
```css
/* Primary button */
background: #27417A;
color: white;

/* Text link */
color: #0066CC;

/* Hover state on card */
background: #F8FBFF;

/* Very subtle accent (use sparingly!) */
border-left: 2px solid #73E6F8;
```

**Avoid:**
```css
/* Don't use cyan as primary color */
background: #73E6F8; /* ❌ Too bright, use #27417A instead */

/* Don't use dark backgrounds */
background: #1F2937; /* ❌ We use light theme */

/* Don't overuse accents */
border: 3px solid #73E6F8; /* ❌ Too prominent */
box-shadow: 0 0 20px #73E6F8; /* ❌ Too flashy */
```

---

## Setup Wizard Flow

**Route:** `/setup` (public, redirects if setup complete)

### Welcome Screen (Step 0)

**Layout:**
- Logo centered at top
- Welcome message with project description
- **Language Selector** (dropdown or flags)
  - Primary: English
  - Future: German, others
  - Sets locale for entire session via next-intl
- "Get Started" button → Step 1

### Step 1: Paperless-NGX Connection

**Fields:**
- Paperless URL (text input with validation)
- Admin API Token (password input with show/hide)
- "Test Connection" button

**Validation:**
- Test connection to Paperless API
- Verify admin permissions
- Check for required workflows: `paiperless_document_added`, `paiperless_document_updated`
- If workflows missing: Display instructions to create them manually
- Generate webhook API key (system-generated, displayed to user for copying into Paperless)

**Video:** "How to get your Paperless API token"
**Description:** "We use your Paperless-NGX instance for authentication and document storage. Enter the URL and admin token to connect."

### Step 2: Gemini AI Configuration

**Fields:**
- Gemini API Key (password input)
- Model Selection (dropdown, auto-populated from API)
- Test prompt (auto-runs on "Next")

**Validation:**
- Fetch available models from Gemini API
- Test content generation with simple prompt
- Display token limits for selected model
- Recommended default: `gemini-2.0-flash-exp` or latest Flash model

**Video:** "Creating a Gemini API key in Google AI Studio"
**Description:** "Gemini analyzes your documents to extract tags, metadata, and detect required actions. Flash models offer the best price-performance ratio."

### Step 3: Google Cloud Document AI

**Fields:**
- Service Account JSON (file upload)
- Project ID (auto-extracted from JSON)
- Processor Location (dropdown: us, eu, asia)
- Processor ID (text input)
- Test OCR (upload sample PDF, e.g., `test.pdf`)

**Validation:**
- Parse uploaded JSON for credentials
- Verify processor access
- Run test OCR on sample document
- Display extracted text as proof of functionality

**Video:** "Setting up Document AI in Google Cloud Console"
**Description:** "Document AI performs high-quality OCR on your PDFs. Create a Document OCR processor and upload your service account credentials."

### Step 4: Google OAuth (Calendar & Tasks)

**Fields:**
- OAuth Client ID (text input)
- OAuth Client Secret (password input)
- "Authorize with Google" button (triggers OAuth flow)
- Calendar ID (dropdown after auth, auto-populated)
- Task List ID (dropdown after auth, auto-populated)

**Validation:**
- Display OAuth redirect URI for user to configure in Google Cloud
- Implement OAuth 2.0 flow (/api/auth/google/url, /api/auth/google/callback)
- Request scopes: `calendar`, `tasks`
- Fetch and display user's calendars and task lists
- Store access + refresh tokens in database

**Video:** "Creating OAuth credentials in Google Cloud Console"
**Description:** "Grant pAIperless access to create calendar events and tasks for documents requiring action. Select which calendar and task list to use."

### Step 5: Email Notifications (Optional)

**Fields:**
- Enable Email Notifications (checkbox, default: off)
- SMTP Server (text input)
- SMTP Port (number input, default: 587)
- Encryption (dropdown: None, TLS, SSL)
- Username (text input)
- Password (password input)
- Sender Email (email input)
- Recipient Email (email input, comma-separated)
- Test Email (button)

**Validation:**
- Test SMTP connection
- Send test email
- Can be skipped if checkbox disabled

**Video:** "Common SMTP settings (Gmail, Outlook, etc.)"
**Description:** "Receive notifications for new documents, processing errors, and completed actions. This step is optional."

### Step 6: Paperless Integration Details

**Fields:**
- Tag for "AI Todo" (text input, default: `ai_todo`)
- Tag for "Action Required" (text input, default: `action_required`)
- Custom Field for Action Description (text input, user enters field name)
- Custom Field for Due Date (text input, user enters field name)
- "Validate Configuration" button

**Validation:**
- Check if tags exist in Paperless (if not, offer to create via API or manual instructions)
- Check if custom fields exist (if not, display instructions to create manually)
- Verify user has created required workflows

**Video:** "Configuring tags and custom fields in Paperless"
**Description:** "pAIperless uses specific tags and custom fields to track document processing. Enter the names you've configured in Paperless."

### Step 7: Advanced Settings

**Fields:**
- Enable Consume Folder Polling (checkbox, default: off, chokidar events preferred)
- Polling Interval for Consume (number input, default: 10 minutes)
- Enable Action Tag Polling (checkbox, default: off, webhooks preferred)
- Polling Interval for Action Tags (number input, default: 30 minutes)
- Enable AI Todo Tag Polling (checkbox, default: off, webhooks preferred)
- Polling Interval for AI Todo Tags (number input, default: 30 minutes)

**Validation:**
- None, just save preferences

**Video:** "Understanding polling vs. webhooks"
**Description:** "Adjust polling intervals for fallback monitoring. Webhooks are preferred but polling ensures reliability."

### Step 8: Completion

**Display:**
- Success message with green checkmark
- Summary of configured services
- "Go to Dashboard" button
- Set `SETUP_COMPLETED` config key to `true` in database

**Video:** None (or recap video)
**Description:** "Setup complete! You can now start processing documents. Drop PDFs in the consume folder or upload via FTP."

---

## Database Schema (Prisma)

**Location:** `prisma/schema.prisma`

```prisma
model Config {
  id        Int      @id @default(autoincrement())
  key       String   @unique
  value     String   // Consider encryption for production
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Document {
  id                Int       @id @default(autoincrement())
  fileHash          String    @unique // SHA-256 hash
  originalFilename  String
  filePath          String?
  status            String    // PENDING, PREPROCESSING_COMPLETE, OCR_IN_PROGRESS, OCR_COMPLETE, UPLOADED_TO_PAPERLESS, COMPLETED, ERROR, PENDING_CONFIGURATION
  errorMessage      String?
  paperlessId       Int?      // Document ID in Paperless
  googleTaskId      String?
  googleEventId     String?
  ocrPageCount      Int?      // Pages processed by Document AI
  geminiTokensSent  Int?
  geminiTokensRecv  Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

model Job {
  id          Int      @id @default(autoincrement())
  type        String   // CONSUME, ANALYZE, ACTION_CHECK
  payload     String   // JSON
  status      String   // PENDING, IN_PROGRESS, COMPLETED, FAILED
  attempts    Int      @default(0)
  maxAttempts Int      @default(3)
  errorMsg    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Log {
  id        Int      @id @default(autoincrement())
  level     String   // INFO, WARN, ERROR
  message   String
  meta      String?  // JSON
  createdAt DateTime @default(now())
}
```

---

## Configuration Management

**Module:** `lib/config.ts`

```typescript
export const CONFIG_KEYS = {
  // Setup State
  SETUP_COMPLETED: 'SETUP_COMPLETED',
  SETUP_LOCALE: 'SETUP_LOCALE',

  // Paperless
  PAPERLESS_URL: 'PAPERLESS_URL',
  PAPERLESS_TOKEN: 'PAPERLESS_TOKEN',
  WEBHOOK_API_KEY: 'WEBHOOK_API_KEY',

  // Gemini
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  GEMINI_MODEL: 'GEMINI_MODEL',

  // Google Cloud Document AI
  GOOGLE_CLOUD_PROJECT_ID: 'GOOGLE_CLOUD_PROJECT_ID',
  GOOGLE_CLOUD_CREDENTIALS: 'GOOGLE_CLOUD_CREDENTIALS', // JSON string
  DOCUMENT_AI_PROCESSOR_ID: 'DOCUMENT_AI_PROCESSOR_ID',
  DOCUMENT_AI_LOCATION: 'DOCUMENT_AI_LOCATION',

  // Google OAuth
  GOOGLE_OAUTH_CLIENT_ID: 'GOOGLE_OAUTH_CLIENT_ID',
  GOOGLE_OAUTH_CLIENT_SECRET: 'GOOGLE_OAUTH_CLIENT_SECRET',
  GOOGLE_OAUTH_ACCESS_TOKEN: 'GOOGLE_OAUTH_ACCESS_TOKEN',
  GOOGLE_OAUTH_REFRESH_TOKEN: 'GOOGLE_OAUTH_REFRESH_TOKEN',
  GOOGLE_CALENDAR_ID: 'GOOGLE_CALENDAR_ID',
  GOOGLE_TASK_LIST_ID: 'GOOGLE_TASK_LIST_ID',

  // Email
  EMAIL_ENABLED: 'EMAIL_ENABLED',
  SMTP_SERVER: 'SMTP_SERVER',
  SMTP_PORT: 'SMTP_PORT',
  SMTP_ENCRYPTION: 'SMTP_ENCRYPTION',
  SMTP_USER: 'SMTP_USER',
  SMTP_PASSWORD: 'SMTP_PASSWORD',
  EMAIL_SENDER: 'EMAIL_SENDER',
  EMAIL_RECIPIENTS: 'EMAIL_RECIPIENTS',

  // Paperless Config
  TAG_AI_TODO: 'TAG_AI_TODO',
  TAG_ACTION_REQUIRED: 'TAG_ACTION_REQUIRED',
  FIELD_ACTION_DESCRIPTION: 'FIELD_ACTION_DESCRIPTION',
  FIELD_DUE_DATE: 'FIELD_DUE_DATE',

  // Polling
  POLL_CONSUME_ENABLED: 'POLL_CONSUME_ENABLED',
  POLL_CONSUME_INTERVAL: 'POLL_CONSUME_INTERVAL',
  POLL_ACTION_ENABLED: 'POLL_ACTION_ENABLED',
  POLL_ACTION_INTERVAL: 'POLL_ACTION_INTERVAL',
  POLL_AI_TODO_ENABLED: 'POLL_AI_TODO_ENABLED',
  POLL_AI_TODO_INTERVAL: 'POLL_AI_TODO_INTERVAL',
};

export async function getConfig(key: string): Promise<string | null> {
  const record = await prisma.config.findUnique({ where: { key } });
  return record?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.config.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function isSetupComplete(): Promise<boolean> {
  const value = await getConfig(CONFIG_KEYS.SETUP_COMPLETED);
  return value === 'true';
}
```

---

## Authentication & Middleware

### NextAuth Configuration (`lib/auth.ts`)

**Strategy:** JWT-based sessions (not database sessions)
**Provider:** CredentialsProvider
**Validation:** Delegates to Paperless-NGX `/api/auth/token/` endpoint

```typescript
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getConfig, CONFIG_KEYS } from '@/lib/config';

export const authOptions = {
  providers: [
    CredentialsProvider({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const paperlessUrl = await getConfig(CONFIG_KEYS.PAPERLESS_URL);
        const response = await fetch(`${paperlessUrl}/api/auth/token/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: credentials?.username,
            password: credentials?.password
          })
        });

        if (response.ok) {
          const data = await response.json();
          return { id: credentials.username, name: credentials.username, token: data.token };
        }
        return null;
      }
    })
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
};
```

### Middleware (`middleware.ts`)

**MUST use Node.js runtime for Prisma compatibility:**

```typescript
export const runtime = 'nodejs'; // Critical for Prisma

export async function middleware(req: NextRequest) {
  const setupComplete = await isSetupComplete();
  const { pathname } = req.nextUrl;

  // Setup routing
  if (!setupComplete) {
    if (!pathname.startsWith('/setup')) {
      return NextResponse.redirect(new URL('/setup', req.url));
    }
    return NextResponse.next();
  }

  // Auth routing
  const token = await getToken({ req });
  if (!token && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Worker System Architecture

**Module:** `lib/worker.ts`

### File Watcher (chokidar)

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch('/app/consume', {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

watcher.on('add', async (filePath) => {
  await processNewFile(filePath);
});
```

### Processing Pipeline

```typescript
async function processNewFile(filePath: string) {
  try {
    // 1. Calculate hash
    const fileHash = await calculateSHA256(filePath);

    // 2. Check for duplicate
    const existing = await prisma.document.findUnique({ where: { fileHash } });
    if (existing) {
      await moveToError(filePath, 'Duplicate file detected');
      return;
    }

    // 3. Move to processing
    const processingPath = await moveToProcessing(filePath);

    // 4. Create database record
    const doc = await prisma.document.create({
      data: {
        fileHash,
        originalFilename: path.basename(filePath),
        filePath: processingPath,
        status: 'PENDING'
      }
    });

    // 5. Pre-process
    await preprocessDocument(doc.id, processingPath);

    // 6. OCR (Google Document AI or skip)
    await performOCR(doc.id, processingPath);

    // 7. Upload to Paperless
    await uploadToPaperless(doc.id, processingPath);

    // 8. Update status
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'COMPLETED' }
    });

  } catch (error) {
    await handleError(filePath, error);
  }
}
```

### Pre-processing Steps

```typescript
async function preprocessDocument(docId: number, filePath: string) {
  // Detect rotation
  const { stdout } = await execAsync(`tesseract ${filePath} - --psm 0`);
  const rotation = parseRotation(stdout);

  if (rotation !== 0) {
    // Rotate pages
    await execAsync(`qpdf --rotate=${rotation}:1-z ${filePath} ${filePath}.rotated`);
    fs.renameSync(`${filePath}.rotated`, filePath);
  }

  // Strip existing OCR layer
  await execAsync(`qpdf --remove-page-labels ${filePath} ${filePath}.stripped`);
  fs.renameSync(`${filePath}.stripped`, filePath);

  await prisma.document.update({
    where: { id: docId },
    data: { status: 'PREPROCESSING_COMPLETE' }
  });
}
```

### Google Document AI Integration

```typescript
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

async function performOCR(docId: number, filePath: string) {
  // Check limits
  const stats = fs.statSync(filePath);
  const pageCount = await countPDFPages(filePath);

  if (stats.size > MAX_FILE_SIZE || pageCount > MAX_PAGE_COUNT) {
    // Skip OCR, let Paperless handle it
    return;
  }

  await prisma.document.update({
    where: { id: docId },
    data: { status: 'OCR_IN_PROGRESS' }
  });

  const credentials = JSON.parse(await getConfig(CONFIG_KEYS.GOOGLE_CLOUD_CREDENTIALS));
  const client = new DocumentProcessorServiceClient({ credentials });

  const imageData = fs.readFileSync(filePath);
  const request = {
    name: `projects/${projectId}/locations/${location}/processors/${processorId}`,
    rawDocument: {
      content: imageData.toString('base64'),
      mimeType: 'application/pdf',
    },
  };

  const [result] = await client.processDocument(request);

  // Save OCR'd PDF
  if (result.document?.text) {
    // Write OCR'd PDF back (implementation depends on Document AI response format)
  }

  await prisma.document.update({
    where: { id: docId },
    data: {
      status: 'OCR_COMPLETE',
      ocrPageCount: pageCount
    }
  });
}
```

### Paperless Upload

```typescript
async function uploadToPaperless(docId: number, filePath: string) {
  const paperlessUrl = await getConfig(CONFIG_KEYS.PAPERLESS_URL);
  const paperlessToken = await getConfig(CONFIG_KEYS.PAPERLESS_TOKEN);
  const aiTodoTag = await getConfig(CONFIG_KEYS.TAG_AI_TODO);

  const formData = new FormData();
  formData.append('document', fs.createReadStream(filePath));
  formData.append('tags', JSON.stringify([aiTodoTag]));

  const response = await fetch(`${paperlessUrl}/api/documents/post_document/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${paperlessToken}`
    },
    body: formData
  });

  const data = await response.json();

  await prisma.document.update({
    where: { id: docId },
    data: {
      status: 'UPLOADED_TO_PAPERLESS',
      paperlessId: data.id
    }
  });
}
```

---

## API Routes

### `/api/setup` (POST)

Handles all setup steps. Request body includes `step` and step-specific data.

**Example:**
```json
{
  "step": 1,
  "data": {
    "paperlessUrl": "https://paperless.example.com",
    "paperlessToken": "abc123..."
  }
}
```

### `/api/webhooks/paperless/document-added` (POST)

Receives webhook from Paperless when new documents added.

**Authentication:** Validates `x-api-key` header against stored `WEBHOOK_API_KEY`

**Flow:**
1. Validate API key
2. Query Paperless for documents with `ai_todo` tag
3. Queue Gemini analysis jobs
4. Return 200 OK

### `/api/webhooks/paperless/document-updated` (POST)

Receives webhook from Paperless when documents updated.

**Authentication:** Same as above

**Flow:**
1. Validate API key
2. Query Paperless for documents with `action_required` tag
3. Create Google Calendar events and Tasks
4. Return 200 OK

### `/api/worker` (POST)

Initializes or controls the background worker.

**Actions:**
- `start` - Start file watcher
- `stop` - Stop file watcher
- `status` - Get worker status

### `/api/auth/google/url` (GET)

Generates OAuth consent URL for Google Calendar/Tasks access.

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### `/api/auth/google/callback` (GET)

OAuth callback endpoint. Exchanges authorization code for tokens.

**Query Params:** `code`, `state`

**Flow:**
1. Exchange code for access + refresh tokens
2. Store tokens in Config table
3. Redirect to setup step 4

---

## Internationalization (i18n)

**Library:** `next-intl`

**Setup:**
1. Install: `npm install next-intl`
2. Create `messages/` folder with locale files:
   - `messages/en.json` (primary)
   - `messages/de.json` (future)
3. Configure in `next.config.js`:
   ```js
   const withNextIntl = require('next-intl/plugin')();
   module.exports = withNextIntl({ ... });
   ```
4. Create `i18n.ts`:
   ```typescript
   import { getRequestConfig } from 'next-intl/server';
   import { getConfig, CONFIG_KEYS } from '@/lib/config';

   export default getRequestConfig(async () => {
     const locale = await getConfig(CONFIG_KEYS.SETUP_LOCALE) || 'en';
     return {
       locale,
       messages: (await import(`./messages/${locale}.json`)).default
     };
   });
   ```
5. Use in components:
   ```typescript
   import { useTranslations } from 'next-intl';

   const t = useTranslations('SetupWizard');
   return <h1>{t('welcome')}</h1>;
   ```

**Translation Keys Structure:**
```json
{
  "SetupWizard": {
    "welcome": "Welcome to pAIperless",
    "step1Title": "Connect to Paperless-NGX",
    "step1Description": "Enter your Paperless URL and API token..."
  },
  "Dashboard": { ... },
  "Settings": { ... }
}
```

---

## Docker Configuration

### Dockerfile

```dockerfile
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    bash \
    curl \
    ghostscript \
    qpdf \
    tesseract-ocr \
    tesseract-ocr-data-deu \
    tesseract-ocr-data-eng \
    python3 \
    py3-pip \
    procps

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build Next.js
RUN npm run build

# Generate Prisma client
RUN npx prisma generate

# Create directories
RUN mkdir -p /app/consume /app/processing /app/error /app/storage /app/data

# Expose port
EXPOSE 3000

# Entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  paiperless:
    build: .
    container_name: paiperless
    ports:
      - "3002:3000"   # Web UI
      - "2121:21"     # FTP (optional)
    volumes:
      - ./consume:/app/consume
      - ./storage:/app/storage
      - db-data:/app/data
    environment:
      - DATABASE_URL=file:/app/data/database.db
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=http://localhost:3002
    restart: unless-stopped

volumes:
  db-data:
```

### entrypoint.sh

```bash
#!/bin/bash
set -e

# Run Prisma migrations
npx prisma migrate deploy

# Start worker in background (after 15s delay)
(sleep 15 && curl -s http://localhost:3000/api/worker?action=start) &

# Start Next.js
exec node server.js
```

---

## Development Workflow

### Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint

# Database
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Create + apply migration
npx prisma studio        # Database GUI

# Docker
docker compose up --build   # Build and start
docker compose down         # Stop and remove
docker logs -f paiperless   # Follow logs
docker exec -it paiperless /bin/sh  # Shell access
```

### Debugging

**View Logs:**
```bash
docker logs paiperless           # Container logs
docker logs -f paiperless        # Follow in real-time
```

**Shell Access:**
```bash
docker exec -it paiperless /bin/sh
cd /app
ls consume/ processing/ error/
npx prisma studio
```

**Manual File Processing:**
- Drop PDF in `./consume` folder
- Watch logs for processing pipeline
- Check database for Document records

---

## Common Development Patterns

### Adding New Configuration Key

1. Add to `CONFIG_KEYS` in `lib/config.ts`
2. Use `setConfig()` in setup wizard
3. Use `getConfig()` in application code

### Adding New Document Status

1. Update status enum in Prisma schema
2. Add status transitions in `lib/worker.ts`
3. Update error handling to move files to `/error`

### Extending Setup Wizard

1. Add new step component in setup page
2. Add validation logic in step component
3. Create API handler in `/api/setup`
4. Add video URL and description
5. Test error states

### Adding New API Route

1. Create `app/api/[route]/route.ts`
2. Export HTTP method handlers: `GET`, `POST`, etc.
3. Use `NextResponse.json()` for responses
4. Handle errors with try-catch
5. Add authentication if needed

---

## Critical Implementation Notes

### Security

**API Key Storage:**
- All keys stored in Config table
- Consider encryption for production (currently plaintext)
- Alternative: Environment variables (conflicts with setup wizard)

**Webhook Security:**
- System generates unique `WEBHOOK_API_KEY` during setup
- Paperless must include in `x-api-key` header
- Validate on all webhook endpoints

**Credential Handling:**
- Google service account JSON stored in database
- OAuth tokens stored in Config table
- Never log sensitive credentials

### Prisma Usage

- Always run `npx prisma generate` after schema changes
- Middleware MUST use Node.js runtime: `export const runtime = 'nodejs'`
- Use singleton pattern: `lib/prisma.ts`
- Database URL via `DATABASE_URL` environment variable
- Docker volume `db-data` prevents readonly issues

### Cost Prevention (Critical!)

**Hash-based Deduplication:**
- SHA-256 hash computed IMMEDIATELY on file arrival
- Database check BEFORE any Google API calls
- Duplicate files moved to `/error` with error message
- **Never process same file twice**

**Error Handling:**
- Failed files moved to `/error` folder
- Error state persisted in database
- Manual retry ONLY via dashboard
- No automatic retries without user intervention

### Import Paths

Use TypeScript path alias: `@/` maps to project root

```typescript
import { prisma } from '@/lib/prisma';
import { getConfig } from '@/lib/config';
```

---

## Environment Variables

**Required:**
```env
DATABASE_URL=file:/app/data/database.db
NEXTAUTH_SECRET=<random-secret-generate-with-openssl>
```

**Optional:**
```env
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=production
```

---

## Project Structure

```
paiperless/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx          # Auth layout (logo, gradient)
│   │   └── login/
│   │       └── page.tsx        # Login form
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard layout (sidebar)
│   │   ├── page.tsx            # Dashboard home
│   │   └── settings/
│   │       └── page.tsx        # Settings (tabbed)
│   ├── (setup)/
│   │   ├── layout.tsx          # Setup layout (two-column)
│   │   └── setup/
│   │       └── page.tsx        # Setup wizard (all steps)
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts
│   │   │   └── google/
│   │   │       ├── url/route.ts
│   │   │       └── callback/route.ts
│   │   ├── setup/route.ts
│   │   ├── worker/route.ts
│   │   └── webhooks/
│   │       └── paperless/
│   │           ├── document-added/route.ts
│   │           └── document-updated/route.ts
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── SetupWizard.tsx         # Main setup component
│   ├── LoginForm.tsx
│   └── ...
├── lib/
│   ├── auth.ts                 # NextAuth config
│   ├── config.ts               # Config management
│   ├── prisma.ts               # Prisma singleton
│   ├── worker.ts               # File processing worker
│   ├── paperless.ts            # Paperless API client
│   ├── google.ts               # Google APIs (Docs AI, Calendar, Tasks)
│   └── email.ts                # Email notifications
├── messages/
│   ├── en.json                 # English translations
│   └── de.json                 # German translations
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration history
├── public/
│   ├── logo_complete.png       # Full logo (white bg)
│   ├── logo_compact.png        # Logo + AI (white bg)
│   └── logo_image_only.png     # Just image (white bg)
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── CLAUDE.md                   # This file
```

---

## Future Enhancements (Post-MVP)

### FTP Server Implementation
- Use `basic-ftp-server` or `ftp-srv` (Node.js)
- Bind to `/consume` directory
- Configure in supervisord/s6-overlay
- Add FTP credentials in setup wizard

### Job Queue System
- Replace in-memory processing with persistent queue
- Options: `bullmq` + embedded Redis, or `better-queue` + SQLite
- Job types: `CONSUME`, `ANALYZE`, `ACTION_CHECK`
- Priority queuing, retry logic, dead letter queue

### Advanced Error Recovery
- Dashboard UI for failed jobs
- Bulk retry operations
- Error categorization and filtering
- Automatic retry with exponential backoff (configurable)

### Multi-Language Support
- Complete German translations
- Add language switcher in dashboard
- Per-user language preference
- RTL language support

### Monitoring & Analytics
- Processing time metrics
- Cost tracking dashboard (detailed breakdown)
- Success/failure rates
- API usage graphs
- Alert system for anomalies

---

## Support & Resources

**Documentation:**
- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- Google Document AI: https://cloud.google.com/document-ai/docs
- Google Gemini: https://ai.google.dev/docs
- Paperless-NGX: https://docs.paperless-ngx.com/

**Testing Resources:**
- Sample PDFs for OCR testing
- Gemini prompt templates
- Webhook payload examples

**Common Issues:**
- Prisma Edge Runtime Error: Ensure `export const runtime = 'nodejs'` in middleware/API routes
- Docker DB Readonly: Use named volume `db-data` instead of bind mount
- Redirect Loops: Centralize redirects in middleware, remove from page components
- OAuth Redirect URI: Must match EXACTLY in Google Console and app config

---

## Terminology

- **Paperless-NGX**: Upstream document management system
- **Consume folder**: Input directory for new PDFs
- **Document AI**: Google Cloud OCR service
- **Gemini**: Google LLM for tagging/analysis
- **Action Required**: Documents needing user action (tag)
- **AI Todo**: Documents pending AI analysis (tag)
- **Worker**: Background process for file processing
- **Setup Wizard**: Multi-step initial configuration UI

---

**Version:** 2.0
**Last Updated:** 2026-01-27
**Primary Language:** English
**Design Theme:** Light, friendly, professional
**Color Scheme:**
- Primary Blue: #0066CC (text, links)
- Accent Blue: #27417A (buttons, highlights)
- Subtle Cyan: #73E6F8 (sparingly for accents)
**Logo Background:** White
