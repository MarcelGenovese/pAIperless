# pAIperless

AI-powered extension for Paperless-NGX that adds intelligent document processing, automated tagging, and action tracking.

## Features

🤖 **Automated OCR** - Google Document AI for high-quality text extraction
🏷️ **Smart Tagging** - Gemini LLM analyzes documents and extracts metadata automatically
📅 **Action Tracking** - Creates Google Calendar events and Tasks for documents requiring user action
🔄 **Seamless Integration** - Works with your existing Paperless-NGX instance
🐳 **Single Container** - Everything runs in one Docker container

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Paperless-NGX instance (running and accessible)
- Google Cloud account (for Document AI)
- Google AI Studio account (for Gemini API)
- Google account (for Calendar/Tasks OAuth)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/paiperless.git
   cd paiperless
   ```

2. Generate a secret for NextAuth:
   ```bash
   openssl rand -base64 32
   ```

3. Create `.env` file:
   ```env
   DATABASE_URL=file:/app/data/database.db
   NEXTAUTH_SECRET=<your-generated-secret>
   NEXTAUTH_URL=http://localhost:3002
   ```

4. Start the container:
   ```bash
   docker compose up -d
   ```

5. Open your browser and navigate to `http://localhost:3002`

6. Follow the setup wizard to configure:
   - Paperless-NGX connection
   - Gemini AI API key
   - Google Cloud Document AI
   - Google OAuth for Calendar/Tasks
   - Email notifications (optional)
   - Paperless integration details
   - Advanced settings

### Document Processing

Drop PDF files into the `./consume` folder or upload via FTP (planned feature). The system will:

1. Pre-process the document (rotation detection, OCR stripping)
2. Perform OCR using Google Document AI
3. Upload to Paperless-NGX with `ai_todo` tag
4. Analyze with Gemini to extract tags, metadata, and detect required actions
5. Update Paperless document with extracted information
6. Create Calendar events and Tasks if action is required

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run Prisma migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Management

```bash
# Generate Prisma client
npx prisma generate

# Create new migration
npx prisma migrate dev --name description

# Open Prisma Studio (database GUI)
npx prisma studio
```

### Docker Commands

```bash
# View logs
docker logs -f paiperless

# Shell access
docker exec -it paiperless /bin/sh

# Restart container
docker restart paiperless

# Rebuild and start
docker compose up --build
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login pages
│   ├── (dashboard)/       # Protected dashboard area
│   ├── (setup)/           # Setup wizard
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Core logic (worker, auth, APIs)
├── messages/              # i18n translation files
├── prisma/                # Database schema and migrations
└── public/                # Static assets (logos, etc.)
```

## Configuration

All configuration is stored in the database and managed through the web interface. The setup wizard guides you through all required settings.

### Volumes

- `./consume` → `/app/consume` - Input folder for new documents
- `./storage` → `/app/storage` - Processed files storage
- `db-data` (named volume) → `/app/data` - SQLite database

### Ports

- `3002:3000` - Web UI (configurable in docker-compose.yml)
- `2121:21` - FTP server (planned feature)

## Architecture

**Single Docker Container** with:
- Next.js 15+ (Frontend + API)
- SQLite database (Prisma ORM)
- Background worker (file processing)
- System tools (tesseract, ghostscript, qpdf)

**Processing Pipeline:**
1. **Ingestion** - File watching, deduplication, pre-processing
2. **OCR** - Google Document AI or Tesseract fallback
3. **Analysis** - Gemini LLM extracts metadata and detects actions
4. **Task Management** - Google Calendar/Tasks integration

## Security

- All API keys stored in database (consider encryption for production)
- Webhook authentication via generated API key
- Authentication delegated to Paperless-NGX
- JWT-based sessions (NextAuth.js)

## Cost Prevention

The system includes critical deduplication logic:
- SHA-256 hash computed IMMEDIATELY on file arrival
- Database check BEFORE any Google API calls
- Duplicate files moved to `/error` folder
- Manual retry only (no automatic reprocessing)

## Troubleshooting

### Common Issues

**Setup not loading:** Check that Docker container is running and port 3002 is accessible.

**Database errors:** Ensure named volume `db-data` exists and has proper permissions.

**Worker not processing files:** Check logs with `docker logs paiperless` and verify worker started (15s delay after container start).

**Prisma errors:** Run `npx prisma generate` after schema changes.

### Debug Mode

Access container shell for debugging:
```bash
docker exec -it paiperless /bin/sh
cd /app
ls consume/ processing/ error/
npx prisma studio
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Comprehensive development guide
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Paperless-NGX API](https://docs.paperless-ngx.com/api/)

## Contributing

Contributions are welcome! Please read the development guide in CLAUDE.md for architecture details and coding patterns.

## License

[Your License Here]

## Support

For issues and questions, please use the GitHub issue tracker.

---

**Built with:** Next.js 15, TypeScript, Tailwind CSS, Prisma, Google Cloud AI
