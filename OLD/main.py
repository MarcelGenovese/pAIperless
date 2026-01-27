
import time
import os
import shutil
import logging
import hashlib
import smtplib
import re
import io
from logging.handlers import RotatingFileHandler
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from google.cloud import documentai_v1 as documentai
from google.api_core.client_options import ClientOptions

# --- PFADE ---
INPUT_FOLDER = "/app/in"
PROCESSING_FOLDER = "/app/processing"
OUTPUT_FOLDER = "/app/out"
ERROR_FOLDER = "/app/error"
LOG_FILE = "/app/logs/watcher.log"
DB_FILE = "/app/state/processed_hashes.txt"
# Standardpfad passend zur docker-compose.yml
KEY_FILE_PATH = os.getenv("GCP_KEY_FILE", "/app/keys/service-account.json")

# --- KONFIGURATION ---
PROJECT_ID = os.getenv("GCP_PROJECT_ID")
LOCATION = os.getenv("GCP_LOCATION", "eu")
PROCESSOR_ID = os.getenv("GCP_PROCESSOR_ID")
MAX_PAGES = int(os.getenv("MAX_PAGES", "15"))
MAX_SIZE_MB = int(os.getenv("MAX_SIZE_MB", "20"))

# --- SMTP ---
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
EMAIL_FROM = os.getenv("EMAIL_FROM")
EMAIL_TO = os.getenv("EMAIL_TO")
ENABLE_EMAIL = os.getenv("ENABLE_EMAIL", "false").lower() == "true"

# --- LOGGING ---
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - [WATCHER] - %(message)s')

# 1. Console Handler (für docker logs)
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# 2. File Handler (für persistente Logs)
try:
    file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5*1024*1024, backupCount=2)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
except Exception as e:
    print(f"WARNUNG: Konnte Logfile nicht erstellen: {e}")

# --- HELPER FUNKTIONEN ---
def send_email(subject, body):
    if not ENABLE_EMAIL: return
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = EMAIL_TO
        msg['Subject'] = f"[DocAI Watcher] {subject}"
        msg.attach(MIMEText(body, 'plain'))
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
        logger.info(f"📧 E-Mail gesendet: {subject}")
    except Exception as e:
        logger.error(f"E-Mail Fehler: {e}")

def get_file_hash(filepath):
    sha256 = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            while True:
                data = f.read(65536)
                if not data: break
                sha256.update(data)
        return sha256.hexdigest()
    except: return None

def is_processed(file_hash):
    if not os.path.exists(DB_FILE): return False
    with open(DB_FILE, "r") as f: return file_hash in f.read()

def mark_as_processed(file_hash):
    with open(DB_FILE, "a") as f: f.write(f"{file_hash}\n")

def get_pdf_info(filepath):
    try:
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        doc = fitz.open(filepath)
        pages = doc.page_count
        doc.close()
        return pages, size_mb
    except: return 9999, 9999

def wait_for_file_ready(filepath):
    historicalSize = -1
    while (historicalSize != os.path.getsize(filepath)):
        historicalSize = os.path.getsize(filepath)
        time.sleep(1)
    return True

# --- ROTATION (TESSERACT) ---
def get_rotation_angle(pix_map):
    try:
        img_data = pix_map.tobytes("png")
        image = Image.open(io.BytesIO(img_data))
        osd = pytesseract.image_to_osd(image)
        match = re.search(r"Rotate: (\d+)", osd)
        if match: return int(match.group(1))
    except: pass
    return 0

def preprocess_and_rotate_pdf(input_path):
    doc = fitz.open(input_path)
    needs_save = False
    logger.info("⚙️ Pre-Check: Untersuche Ausrichtung...")
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        angle = get_rotation_angle(pix)
        if angle != 0:
            logger.info(f"   ↪ Seite {i+1}: {angle}° Drehung nötig.")
            page.set_rotation(angle)
            needs_save = True
    
    if needs_save:
        temp_path = input_path.replace(".pdf", "_rotated.pdf")
        doc.save(temp_path)
        doc.close()
        return temp_path, True
    else:
        doc.close()
        return input_path, False

# --- GOOGLE DOC AI ---
def process_with_google(file_path):
    opts = ClientOptions(api_endpoint=f"{LOCATION}-documentai.googleapis.com")
    client = documentai.DocumentProcessorServiceClient.from_service_account_json(
        KEY_FILE_PATH, client_options=opts
    )
    name = client.processor_path(PROJECT_ID, LOCATION, PROCESSOR_ID)
    with open(file_path, "rb") as image:
        image_content = image.read()
    request = documentai.ProcessRequest(
        name=name,
        raw_document=documentai.RawDocument(content=image_content, mime_type="application/pdf")
    )
    return client.process_document(request=request).document

def create_searchable_pdf(rotated_pdf_path, doc_ai_result, output_path):
    doc_src = fitz.open(rotated_pdf_path)
    doc_out = fitz.open()
    full_text = doc_ai_result.text
    
    for page_idx, page_src in enumerate(doc_src):
        pix = page_src.get_pixmap(dpi=200)
        img_data = pix.tobytes("jpeg", jpg_quality=70)
        page_out = doc_out.new_page(width=page_src.rect.width, height=page_src.rect.height)
        page_out.insert_image(page_out.rect, stream=img_data)
        pw, ph = page_src.rect.width, page_src.rect.height
        if page_idx < len(doc_ai_result.pages):
            for token in doc_ai_result.pages[page_idx].tokens:
                try:
                    seg = token.layout.text_anchor.text_segments[0]
                    word_text = full_text[int(seg.start_index):int(seg.end_index)].replace("\n", "").strip()
                    if not word_text: continue
                    v = token.layout.bounding_poly.normalized_vertices
                    rect = fitz.Rect(v[0].x * pw, v[0].y * ph, v[2].x * pw, v[2].y * ph)
                    page_out.insert_text(rect.bl, word_text, fontsize=rect.height * 0.75, render_mode=3)
                except: continue
    doc_out.save(output_path, deflate=True, garbage=4)
    doc_out.close()
    doc_src.close()

# --- VERARBEITUNGSLOGIK ---
def process_file(file_path):
    filename = os.path.basename(file_path)
    proc_path = os.path.join(PROCESSING_FOLDER, filename)
    rotated_path = None
    success = False # Flag für sauberes Error-Handling
    
    try:
        wait_for_file_ready(file_path)
        shutil.move(file_path, proc_path)
        
        file_hash = get_file_hash(proc_path)
        if file_hash and is_processed(file_hash):
            logger.warning(f"🛑 Duplikat: {filename}")
            os.remove(proc_path)
            return

        pages, size_mb = get_pdf_info(proc_path)
        out_path = os.path.join(OUTPUT_FOLDER, filename)

        if pages > MAX_PAGES or size_mb > MAX_SIZE_MB:
            logger.info("⏩ Zu groß für Google - Direkter Forward.")
            shutil.move(proc_path, out_path)
            send_email(f"Datei weitergeleitet: {filename}", 
                       f"Die Datei war zu groß für DocAI (oder zu viele Seiten).\nGröße: {size_mb:.2f} MB, Seiten: {pages}")
        else:
            actual_pdf, was_rotated = preprocess_and_rotate_pdf(proc_path)
            if was_rotated: rotated_path = actual_pdf
            
            logger.info(f"🚀 Starte DocAI für {filename}...")
            res = process_with_google(actual_pdf)
            create_searchable_pdf(actual_pdf, res, out_path)
            
            if file_hash: mark_as_processed(file_hash)
            
            success = True # Markiere als erfolgreich
            
            # Aufräumen erst NACH Erfolg
            if os.path.exists(proc_path): os.remove(proc_path)
            if rotated_path and os.path.exists(rotated_path): os.remove(rotated_path)
            
            logger.info(f"✅ Erfolgreich verarbeitet: {filename}")
            send_email(f"Verarbeitung erfolgreich: {filename}", 
                       f"Die Datei wurde erfolgreich von Google DocAI verarbeitet und liegt nun in Paperless.")

    except Exception as e:
        logger.error(f"❌ Fehler bei {filename}: {e}")
        send_email(f"FEHLER bei {filename}", f"Ein Fehler ist aufgetreten:\n{str(e)}")
        
        # Nur verschieben, wenn Verarbeitung gescheitert ist
        if not success and os.path.exists(proc_path):
            try:
                shutil.move(proc_path, os.path.join(ERROR_FOLDER, filename))
            except Exception as move_err:
                logger.error(f"Konnte Datei nicht in Error-Ordner verschieben: {move_err}")

# --- HANDLER & START ---
class ScanHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory and event.src_path.lower().endswith(".pdf"):
            process_file(event.src_path)

if __name__ == "__main__":
    # Sicherheitscheck
    if not PROJECT_ID or not PROCESSOR_ID:
        logger.error("❌ FEHLER: GCP_PROJECT_ID oder GCP_PROCESSOR_ID fehlt!")
        exit(1)
    
    if not os.path.exists(KEY_FILE_PATH):
        logger.error(f"❌ FEHLER: Key-Datei nicht gefunden unter {KEY_FILE_PATH}")
        # Hinweis: Kein Exit hier, damit man bei falschem Mount debuggen kann,
        # aber ohne Key wird DocAI crashen.
        exit(1)

    # Ordner erstellen
    for d in [INPUT_FOLDER, OUTPUT_FOLDER, ERROR_FOLDER, PROCESSING_FOLDER, "/app/state", "/app/logs"]:
        try:
            os.makedirs(d, exist_ok=True)
        except PermissionError:
            logger.error(f"Keine Rechte, Ordner {d} zu erstellen!")

    logger.info("🤖 DocAI Watcher v14.0 (Final Fix) gestartet.")
    
    # 1. INITIALER SCAN (Alte Dateien abarbeiten)
    try:
        files = os.listdir(INPUT_FOLDER)
        for f in files:
            if f.lower().endswith(".pdf"):
                logger.info(f"📦 Altdaten gefunden: {f}")
                process_file(os.path.join(INPUT_FOLDER, f))
    except Exception as e:
        logger.error(f"Fehler beim Initial-Scan: {e}")

    # 2. WATCHER STARTEN
    obs = Observer()
    obs.schedule(ScanHandler(), INPUT_FOLDER, recursive=False)
    obs.start()
    
    try:
        while True: 
            time.sleep(1)
    except KeyboardInterrupt:
        obs.stop()
    obs.join()
