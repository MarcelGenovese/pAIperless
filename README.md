# pAIperless

AI-powered extension for Paperless-NGX that adds intelligent document processing, automated tagging, and action tracking.

## Features

✅ **Document Upload** - Web interface with drag & drop + duplicate detection
✅ **Worker Pipeline** - Automated processing from consume folder to Paperless
✅ **Live Dashboard** - Real-time monitoring of document processing pipeline
✅ **FTP Server** - Upload documents via FTP (optional)
🚧 **Automated OCR** - Google Document AI integration (planned)
🚧 **Smart Tagging** - Gemini LLM for metadata extraction (planned)
🚧 **Action Tracking** - Google Calendar/Tasks integration (planned)
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

Upload PDFs via web interface or drop into `./consume` folder (or via FTP). The system:

**✅ Stage 1 - Implemented:**
1. **Duplicate Detection** - SHA-256 hash check prevents reprocessing
2. **File Monitoring** - Worker watches consume folder with chokidar
3. **Processing Pipeline** - Moves files: consume → processing → Paperless
4. **Live Dashboard** - Real-time view of pipeline status (3 cards)

**🚧 Stage 2 - Planned:**
5. Pre-process the document (rotation detection, OCR stripping)
6. Perform OCR using Google Document AI
7. Analyze with Gemini to extract tags, metadata, and detect actions
8. Update Paperless document with extracted information

**🚧 Stage 3 - Planned:**
9. Create Calendar events and Tasks if action is required
10. Track task completion and update Paperless accordingly

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

This is a hobby project created for studying purposes (and heavily generated by Claude). It is provided "AS IS" and is known to be quite buggy. Please don't use it in a production environment without checking the code first. Use at your own risk! 

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues:** [Report bugs and feature requests](https://github.com/MarcelGenovese/pAIperless/issues)
- **Email:** info@paiperless.de
- **Donate:** [PayPal](https://paypal.me/mg3n0)

---

**Version:** v0.2.0
**Built with:** Next.js 15, TypeScript, Tailwind CSS, Prisma, Google Cloud AI
**Author:** Marcel Genovese
**License:** MIT
