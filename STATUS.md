# pAIperless - Development Status

**Version:** v0.2.0
**Last Updated:** 2026-01-29

## Implementation Status

### ✅ Completed (Stage 1: Document Ingestion)

#### Core Infrastructure
- [x] Next.js 15 with App Router
- [x] TypeScript + Tailwind CSS
- [x] Prisma ORM + SQLite database
- [x] Docker single-container deployment
- [x] NextAuth.js with Paperless-NGX delegation
- [x] Middleware for setup/auth routing

#### Setup Wizard (9 Steps)
- [x] Welcome screen with language selector
- [x] Paperless-NGX connection & validation
- [x] Gemini API configuration
- [x] Google Cloud Document AI setup
- [x] Google OAuth for Calendar/Tasks
- [x] Email notifications (SMTP)
- [x] Paperless integration details
- [x] FTP server configuration
- [x] Advanced settings (polling intervals)

#### Document Upload & Processing
- [x] **Web Upload** - Drag & drop interface with auto-upload
- [x] **Duplicate Detection** - SHA-256 hash check BEFORE saving to disk
- [x] **Worker Pipeline** - Complete processing flow:
  - File watching (chokidar)
  - Hash calculation & duplicate prevention
  - Move to processing folder
  - Database tracking with status
  - Paperless API upload (with 'ai_todo' tag)
- [x] **FTP Server** - Optional upload method (ftp-srv)
- [x] **Error Handling** - Failed files to error folder with clear messages

#### Dashboard
- [x] **Tabbed Interface** - Overview, Documents, Logs, Settings
- [x] **Live Monitoring** - 3 cards showing pipeline status:
  - Warteschlange (Consume) - Files waiting for processing
  - In Bearbeitung (Processing) - Currently processing
  - Fehler (Error) - Failed files with delete option
- [x] **Auto-Refresh** - Every 5 seconds for folder contents
- [x] **Document History** - Database records with status tracking
- [x] **Live Logs** - SSE streaming of application logs
- [x] **Settings Management** - All setup steps editable in-place

#### Service Management
- [x] **Service Manager** - Centralized control for FTP & Worker
- [x] **Worker Control** - Start/Stop/Restart via API
- [x] **FTP Control** - Start/Stop/Restart via API
- [x] **Status Monitoring** - Real-time service status checks
- [x] **Auto-Initialization** - Services start on container boot

#### Management CLI
- [x] **Container-External Management** - `scripts/manage.sh`
- [x] **Configuration Commands:**
  - reset-paperless-token
  - reset-paperless-url
  - reset-setup
  - list-config (with --show-secrets)
  - get-config / set-config
  - generate-webhook-key
  - system-info
  - logs
- [x] **Security** - Audit logging, stdin for secrets

#### UI/UX
- [x] **Design System** - Light theme with blue (#0066CC) primary
- [x] **Responsive** - Mobile, tablet, desktop support
- [x] **Footer** - Copyright, author, contact links
- [x] **About Page** - Author info, version display, links
- [x] **Landing Page** - Minimal coming soon page (separate deployment)

#### Email & Contact
- [x] Email updated to info@paiperless.de across all pages
- [x] Contact links: GitHub, Email, PayPal donation

---

### 🚧 In Progress / Planned

#### Stage 2: AI Analysis & Tagging

##### Webhook Endpoints (Not Started)
- [ ] `/api/webhooks/paperless/document-added`
- [ ] `/api/webhooks/paperless/document-updated`
- [ ] Webhook authentication with API key
- [ ] Error handling & retry logic

##### Gemini Integration (Not Started)
- [ ] Prompt template for metadata extraction
- [ ] Tag extraction from document text
- [ ] Correspondent detection
- [ ] Custom field population
- [ ] Action detection logic
- [ ] Token usage tracking (cost estimation)
- [ ] Paperless API updates with extracted data

##### Pre-Processing (Not Started)
- [ ] Tesseract OSD for page rotation detection
- [ ] qpdf/ghostscript for PDF rotation
- [ ] OCR layer stripping
- [ ] Document AI size/page limits check
- [ ] Fallback to Tesseract for large files

#### Stage 3: Task Management (Not Started)

- [ ] Google Calendar event creation
- [ ] Google Tasks creation for action_required docs
- [ ] Task completion polling (background job)
- [ ] Paperless tag removal on task completion
- [ ] Email notifications for completed actions

---

## Current Architecture

### Technology Stack
- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Node.js API routes, Prisma ORM
- **Database:** SQLite (file-based, Docker volume)
- **Authentication:** NextAuth.js with Paperless-NGX
- **File Processing:** chokidar, Node.js streams
- **Services:** FTP (ftp-srv), Worker (custom)
- **AI/ML:** Google Document AI, Gemini (planned)
- **Cloud:** Google OAuth, Calendar, Tasks APIs

### Container Services
1. **Next.js Server** - Web UI + API (port 3000)
2. **Worker** - File processing background service
3. **FTP Server** - Optional upload method (port 2121)

### File Structure
```
/app/storage/
├── consume/       # Input folder (watched by worker)
├── processing/    # Currently processing files
├── error/         # Failed files
└── database/      # SQLite database location
```

### Database Schema
- **Config** - All application settings
- **Document** - Processing history with hash, status, IDs
- **Log** - Application logs with level, message, metadata
- **Job** - Background job queue (future use)

---

## Known Issues & Limitations

### Current Limitations
1. **Dev Mode Only** - Not fully tested in Docker with real Paperless
2. **No OCR Yet** - Document AI integration pending
3. **No AI Tagging** - Gemini integration pending
4. **No Webhooks** - Paperless integration incomplete
5. **No Task Management** - Calendar/Tasks integration pending

### Technical Debt
1. **Config Encryption** - API keys stored in plaintext in DB
2. **Error Handling** - Some edge cases not covered
3. **Testing** - No automated tests yet
4. **Logging** - Could be more structured (consider Winston)

---

## Next Steps (Priority Order)

### High Priority
1. **Docker Testing** - Test complete pipeline with real Paperless instance
2. **Webhook Implementation** - Connect to Paperless events
3. **Gemini Integration** - AI tagging pipeline (Stage 2)

### Medium Priority
4. **Pre-processing** - PDF rotation, OCR layer stripping
5. **Document AI** - OCR integration with size limits
6. **Calendar/Tasks** - Action tracking (Stage 3)

### Low Priority
7. **Job Queue** - Replace in-memory with persistent queue (bullmq)
8. **Config Encryption** - Secure API key storage
9. **Testing** - Unit tests, integration tests
10. **Documentation** - API docs, deployment guide

---

## Recent Changes (v0.2.0)

### 2026-01-29
- ✅ Implemented worker pipeline (consume → processing → Paperless)
- ✅ Added duplicate detection in upload API
- ✅ Fixed folder path inconsistencies
- ✅ Updated email to info@paiperless.de
- ✅ Created landing page (paperless.de)
- ✅ Integrated worker with service manager

### 2026-01-28
- ✅ Dashboard redesign with tabbed interface
- ✅ FTP server implementation
- ✅ Email configuration
- ✅ Live log streaming (SSE)
- ✅ Management CLI scripts

---

## Contact & Support

- **GitHub:** [MarcelGenovese/pAIperless](https://github.com/MarcelGenovese/pAIperless)
- **Email:** info@paiperless.de
- **Issues:** [GitHub Issues](https://github.com/MarcelGenovese/pAIperless/issues)
- **Donate:** [PayPal](https://paypal.me/mg3n0)

---

**This document tracks the current development status of pAIperless and is updated regularly.**
