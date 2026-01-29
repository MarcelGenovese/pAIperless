# pAIperless TODO

## High Priority

### Dashboard Redesign mit Tabs
**Status**: 🔴 Nicht implementiert
**Priorität**: Hoch

**Anforderungen**:
- Single-Page Dashboard mit Tabbed Interface
- Tabs: Overview, Documents, Settings, System Status
- Alle Einstellungen direkt im Dashboard editierbar
- Einstellungen nur nach erfolgreichen Tests persistierbar
- Service-Status in Echtzeit anzeigen (Paperless, Document AI, Gemini, OAuth)
- Optional: Sidebar-Navigation statt Tabs

**Settings Tab Features**:
- Alle Setup-Schritte als Sections
- Test-Buttons für jede Integration
- "Save" nur aktiv nach erfolgreichem Test
- Inline-Bearbeitung ohne separaten Wizard

### Service Restart nach Konfigurationsänderungen
**Status**: 🔴 Nicht implementiert
**Priorität**: Hoch

**Problem**:
Änderungen an Konfigurationen (FTP, Worker, etc.) werden nicht übernommen, bis Container neugestartet wird.

**Lösung**:
Service-Management-Funktionen implementieren:

**Betroffene Services**:
1. **FTP Server** - Neustart nach Konfigurationsänderung
   - Port, Credentials, TLS-Einstellungen
   - API Endpoint: `/api/services/restart/ftp`

2. **Worker** - Neustart nach Polling-Intervall-Änderungen
   - Consume, Action, AI Todo Polling
   - API Endpoint: `/api/services/restart/worker`

3. **OAuth Token Refresh** - Nach OAuth-Neuautorisierung
   - Tokens aktualisieren ohne Container-Restart
   - API Endpoint: `/api/services/refresh/oauth`

**Implementierung**:
```typescript
// Beispiel: API für Service-Restart
POST /api/services/restart
Body: { service: 'ftp' | 'worker' | 'all' }
Response: { success: boolean, message: string }
```

**Technische Details**:
- FTP Server: Prozess-Management mit PM2 oder supervisord
- Worker: Graceful restart mit Signal-Handling
- Config-Reload ohne Container-Neustart

### Management Script für Docker-Befehle
**Status**: 🔴 Nicht implementiert
**Priorität**: Hoch (Sicherheitskritisch)

**Problem**:
Wenn der Paperless API-Token geändert wird, kann man sich aus dem System aussperren, da der Login über Paperless läuft.

**Lösung**:
Management-Script erstellen, das von außerhalb des Containers ausgeführt werden kann.

**Implementierung**:
```bash
# Beispiel: Script in scripts/manage.sh
docker exec paiperless node scripts/cli.js <command> [args]
```

**Benötigte Kommandos**:
1. `reset-paperless-token` - Paperless API Token neu setzen
   ```bash
   ./scripts/manage.sh reset-paperless-token <new-token>
   ```

2. `reset-paperless-url` - Paperless URL ändern
   ```bash
   ./scripts/manage.sh reset-paperless-url <new-url>
   ```

3. `reset-setup` - Setup komplett zurücksetzen (ohne Login)
   ```bash
   ./scripts/manage.sh reset-setup
   ```

4. `list-config` - Alle Konfigurationswerte anzeigen (ohne Secrets)
   ```bash
   ./scripts/manage.sh list-config
   ```

5. `get-config` - Einzelnen Konfigurationswert abrufen
   ```bash
   ./scripts/manage.sh get-config <key>
   ```

6. `set-config` - Konfigurationswert setzen
   ```bash
   ./scripts/manage.sh set-config <key> <value>
   ```

**Dateien**:
- `scripts/manage.sh` - Wrapper-Script für Docker-Befehle
- `scripts/cli.js` oder `scripts/cli.ts` - Node.js CLI-Tool im Container
- Dokumentation in README.md

**Sicherheit**:
- Secrets sollten als Umgebungsvariablen oder via stdin übergeben werden
- Keine Passwörter in Bash-History
- Audit-Log für kritische Änderungen

---

## Medium Priority

### Worker Pipeline
**Status**: 🟡 Teilweise implementiert
- Filesystem Watcher: ✅ Vorhanden
- File Hashing: ✅ Vorhanden
- Document AI OCR: ✅ Vorhanden
- Paperless Upload: 🔴 Fehlt
- Error Handling: 🟡 Teilweise

### Webhook Endpoints
**Status**: 🔴 Nicht implementiert
- `/api/webhook/document-added` - Webhook für neue Dokumente in Paperless
- `/api/webhook/document-updated` - Webhook für Dokumenten-Updates
- Webhook-Authentifizierung via API Key

### Gemini Tagging Pipeline
**Status**: 🔴 Nicht implementiert
- Webhook-Handler für `ai_todo` Tag
- Gemini API Integration für Metadaten-Extraktion
- Paperless API Update mit Tags, Correspondent, Custom Fields
- Action Detection

### Google Calendar/Tasks Integration
**Status**: 🟡 OAuth konfiguriert, Logik fehlt
- Event-Erstellung in Google Calendar
- Task-Erstellung in Google Tasks
- Task-Polling für Completion-Status (Konfiguration vorhanden)
- Tag-Entfernung bei Task-Completion

### Email Notifications
**Status**: 🟡 Konfiguration vorhanden, Implementierung fehlt
- nodemailer Integration
- Event-basierte Benachrichtigungen:
  - Neues Dokument verarbeitet
  - Fehler bei Verarbeitung
  - Action Required erkannt
  - Task erledigt

### FTP Server
**Status**: 🟡 Konfiguration vorhanden, Implementierung fehlt
- FTP-Server-Implementierung (pure-ftpd oder Node.js)
- Prozess-Manager (supervisord/s6-overlay) für Multi-Service Container
- FTPS (TLS/SSL) Support
- Upload direkt in /consume Ordner

---

## Low Priority

### Pre-processing
**Status**: 🔴 Nicht implementiert
- Seiten-Rotation Detection (Tesseract OSD)
- PDF-Rotation mit qpdf/ghostscript
- OCR Layer Stripping

### Document AI Limits
**Status**: 🔴 Nicht implementiert
- Dateigrößen-Check vor OCR
- Seiten-Count-Check
- Fallback zu Paperless Tesseract bei Überschreitung

### Job Queue System
**Status**: 🔴 Nicht implementiert
- Persistent Queue mit bullmq oder better-queue
- Job-Typen: CONSUME, ANALYZE, ACTION_CHECK
- Priority Queue
- Job-Retry-Logik

### Dashboard Enhancements
**Status**: 🟡 Basic Dashboard vorhanden
- Echte Statistiken (aktuell nur Dummy-Werte):
  - Anzahl verarbeiteter Dokumente
  - Pending Actions
  - API Calls This Month
- Dokument-Liste mit Status
- Error-Log-Anzeige
- Manual Retry für fehlgeschlagene Dokumente
- Token-Tracking für Gemini API (Kosten-Schätzung)

### Settings Page Enhancements
**Status**: 🟡 Basic Settings vorhanden
- Inline-Bearbeitung aller Setup-Schritte
- Test-Buttons für Integrationen (Paperless, Gemini, Document AI)
- Webhook URL Anzeige und Copy-Button
- Worker Status und Control (Start/Stop)

---

## Completed ✅

### Core Infrastructure
- ✅ Setup Wizard (Steps 1-9)
- ✅ Paperless-NGX Integration und Validation
- ✅ Gemini API Konfiguration
- ✅ Google Cloud Document AI Konfiguration und Testing
- ✅ Google OAuth Flow für Calendar/Tasks
- ✅ Database Schema (Prisma + SQLite)
- ✅ Login via Paperless-NGX Credentials
- ✅ Middleware für Setup/Auth-Routing
- ✅ OAuth Credentials Persistence und Reload
- ✅ UI Components (Switch, Button, Input, etc.)

### Worker Pipeline (v0.2.0)
- ✅ Worker Implementation with chokidar file watching
- ✅ Service Manager Integration (Start/Stop/Restart)
- ✅ File Processing Pipeline (consume → processing → Paperless)
- ✅ SHA-256 Hash Calculation für Duplicate Detection
- ✅ Database Tracking mit Status Updates
- ✅ Error Handling (Move to error folder)
- ✅ Development Mode Support (test-consume)

### Upload & Dashboard (v0.2.0)
- ✅ Document Upload (Web Interface, Drag & Drop)
- ✅ Duplicate Detection in Upload API (before disk write)
- ✅ Dashboard Redesign mit Tabbed Interface
- ✅ Live Pipeline Monitoring (3 Kacheln: Consume, Processing, Error)
- ✅ Document History mit Database Records
- ✅ Auto-Refresh (5s für Folders, 10s für Documents)
- ✅ Live Log Streaming via SSE
- ✅ Settings Management (All Setup Steps editable)

### Services & Management (v0.2.0)
- ✅ FTP Server Implementation (ftp-srv)
- ✅ Email Configuration (SMTP)
- ✅ Service Manager (FTP + Worker Control)
- ✅ Management CLI (scripts/manage.sh)
- ✅ Container-External Configuration Management
- ✅ Audit Logging für kritische Operationen

### UI/UX (v0.2.0)
- ✅ Footer mit Copyright, Author, Links
- ✅ About Page mit Version Display
- ✅ Landing Page (paperless.de) - Separate Deployment
- ✅ Email Update: info@paiperless.de
- ✅ FontAwesome Icons Integration
- ✅ Responsive Design (Mobile, Tablet, Desktop)

---

## Notes

### Prioritäts-Erklärung
- 🔴 **Hoch**: Sicherheitskritisch oder blockiert andere Features
- 🟡 **Medium**: Wichtig für Kern-Funktionalität
- 🟢 **Low**: Nice-to-have Features

### Nächste Schritte (Empfohlen)
1. **Management Script** (Sicherheit!)
2. **Paperless Upload** in Worker
3. **Webhook Endpoints** implementieren
4. **Gemini Tagging Pipeline**
5. **Google Calendar/Tasks Integration**
