# Document AI OCR-Layer Problem

## Problem
Der von Document AI erkannte Text wird NICHT richtig ins PDF eingebettet. Paperless führt daraufhin erneut OCR mit Tesseract durch.

## Root Cause
Die Funktion `createSearchablePDF()` in `lib/google.ts` Zeile 136-141 verwendet:

```typescript
page.drawText(tokenText, {
  x,
  y: y - height,
  size: fontSize,
  opacity: 0, // Make text invisible
});
```

**Problem**: `opacity: 0` ist NICHT der richtige PDF-Standard für OCR-Text!

- PDF Render Mode 3 (invisibleText) ist der korrekte Standard für OCR-Layer
- `opacity: 0` macht Text visuell unsichtbar, aber Paperless/PDF-Reader erkennen keinen echten OCR-Layer
- pdf-lib unterstützt Render Mode 3 nicht direkt

## Konsequenz
1. Document AI verarbeitet Dokument ✅
2. OCR-Text wird extrahiert ✅
3. Text wird mit `opacity: 0` eingefügt ❌ (falsche Methode)
4. Paperless erkennt keinen OCR-Layer ❌
5. Paperless führt Tesseract OCR durch ❌ (Doppel-OCR!)

## Lösung
**Option A: ocrmypdf verwenden (EMPFOHLEN)**
- ocrmypdf ist speziell für OCR-Layer in PDFs gemacht
- Unterstützt "force OCR" mit externen Textdaten
- Korrekte PDF-Standards (Render Mode 3)

**Option B: Python-Script mit pypdf/reportlab**
- Eigenes Script für korrekten OCR-Layer
- Mehr Kontrolle, aber mehr Arbeit

**Option C: qpdf + Custom PDF-Manipulation**
- Sehr low-level
- Kompliziert

## Empfohlene Lösung
1. ocrmypdf im Dockerfile installieren
2. `createSearchablePDF()` umschreiben zu einem Shell-Command:
   - ocrmypdf mit `--force-ocr` und `--sidecar` Flag
   - Textdaten von Document AI als HOCR/Text übergeben

## Nächste Schritte
Soll ich ocrmypdf integrieren?
