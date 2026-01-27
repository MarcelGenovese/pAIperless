import sys
import time
import os
import requests
import sqlite3
import logging
import datetime
import threading
import json
import secrets
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, request, jsonify, render_template, redirect, url_for, session

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

# --- KONSTANTEN & PFADE ---
CONFIG_FILE = "/app/state/config.json"
LOG_FILE = "/app/logs/watcher.log"
TOKEN_PATH = "/app/keys/token.json"
DB_PATH = "/app/state/sync.db"
CREDENTIALS_PATH = "/app/keys/credentials.json"
SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/tasks']

# Erlaubt OAuth über HTTP (für lokale IPs notwendig)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.secret_key = secrets.token_hex(32) # Session Security

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [SYNC] - %(message)s')
logger = logging.getLogger()

# --- CONFIG MANAGER ---
def load_config():
    defaults = {
        "MY_SYNC_API_KEY": os.getenv("MY_SYNC_API_KEY", ""),
        "WEB_PASSWORD_HASH": "",
        "PAPERLESS_URL": os.getenv("PAPERLESS_URL", "http://paperless:8000"),
        "PAPERLESS_TOKEN": os.getenv("PAPERLESS_TOKEN", ""),
        "GCP_PROJECT_ID": os.getenv("GCP_PROJECT_ID", ""),
        "GCP_LOCATION": os.getenv("GCP_LOCATION", "eu"),
        "GCP_PROCESSOR_ID": os.getenv("GCP_PROCESSOR_ID", ""),
        "TAG_NAME_TRIGGER": os.getenv("TAG_NAME_TRIGGER", "Action_Required"),
        "FIELD_NAME_ACTION": os.getenv("FIELD_NAME_ACTION", "Action"),
        "FIELD_NAME_DUE": os.getenv("FIELD_NAME_DUE", "Faelligkeitsdatum"),
        "ENABLE_EMAIL": os.getenv("ENABLE_EMAIL", "false"),
        "SMTP_HOST": os.getenv("SMTP_HOST", ""),
        "SMTP_PORT": os.getenv("SMTP_PORT", "587"),
        "SMTP_USER": os.getenv("SMTP_USER", ""),
        "SMTP_PASS": os.getenv("SMTP_PASS", ""),
        "EMAIL_FROM": os.getenv("EMAIL_FROM", ""),
        "EMAIL_TO": os.getenv("EMAIL_TO", ""),
        "GOOGLE_CALENDAR_ID": os.getenv("GOOGLE_CALENDAR_ID", "primary"),
        "GOOGLE_TASK_LIST_NAME": os.getenv("GOOGLE_TASK_LIST_NAME", "My Tasks")
    }

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                saved_conf = json.load(f)
                defaults.update(saved_conf)
        except Exception as e:
            logger.error(f"Fehler beim Laden der Config: {e}")

    if not defaults["MY_SYNC_API_KEY"]:
        new_key = secrets.token_hex(16)
        defaults["MY_SYNC_API_KEY"] = new_key
        try:
            if not os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE, 'w') as f: json.dump(defaults, f, indent=4)
        except: pass
    
    return defaults

def save_config_file(config_dict):
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config_dict, f, indent=4)
        return True
    except Exception as e:
        logger.error(f"Fehler beim Speichern: {e}")
        return False

# Globale Config laden
cfg = load_config()

# --- AUTH DECORATOR ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not cfg.get("WEB_PASSWORD_HASH"):
            return redirect(url_for('setup_password'))
        
        if 'logged_in' not in session:
            return redirect(url_for('login'))
            
        return f(*args, **kwargs)
    return decorated_function

# --- HELPER FUNKTIONEN ---
def get_paperless_headers(): 
    return {"Authorization": f"Token {cfg['PAPERLESS_TOKEN']}"}

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS sync_state (paperless_id INTEGER PRIMARY KEY, task_id TEXT, event_id TEXT, status TEXT)''')
    conn.commit(); conn.close()

def get_google_creds():
    creds = None
    if os.path.exists(TOKEN_PATH):
        try: creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        except: pass
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            with open(TOKEN_PATH, 'w') as token: token.write(creds.to_json())
        except: return None
    return creds

def find_id_by_name(endpoint, search_name):
    base = cfg['PAPERLESS_URL'].rstrip('/')
    url = f"{base}/api/{endpoint}/"
    while url:
        try:
            r = requests.get(url, headers=get_paperless_headers())
            if r.status_code != 200: return None
            data = r.json()
            for item in data.get("results", []):
                if item.get("name", "").lower() == search_name.lower(): return item.get("id")
            url = data.get("next")
        except: return None
    return None

def get_documents_with_tag(tag_id):
    base = cfg['PAPERLESS_URL'].rstrip('/')
    url = f"{base}/api/documents/?tags__id__all={tag_id}"
    docs = []
    while url:
        try:
            r = requests.get(url, headers=get_paperless_headers())
            if r.status_code == 200:
                data = r.json()
                docs.extend(data.get("results", []))
                url = data.get("next")
            else: break
        except: break
    return docs

def remove_tag_from_document(doc_id, tag_id):
    base = cfg['PAPERLESS_URL'].rstrip('/')
    r = requests.get(f"{base}/api/documents/{doc_id}/", headers=get_paperless_headers())
    if r.status_code != 200: return False
    current_tags = r.json().get("tags", [])
    if tag_id in current_tags:
        current_tags.remove(tag_id)
        requests.patch(f"{base}/api/documents/{doc_id}/", 
                       headers=get_paperless_headers(), json={"tags": current_tags})
        return True
    return True

def resolve_task_list_id(service_tasks):
    target = cfg['GOOGLE_TASK_LIST_NAME'].lower()
    pt = None
    while True:
        res = service_tasks.tasklists().list(maxResults=100, pageToken=pt).execute()
        for item in res.get('items', []):
            if item['title'].lower() == target:
                return item['id']
        pt = res.get('nextPageToken')
        if not pt: break
    return "@default"


# --- HAUPT SYNC LOGIK ---
def run_sync():
    global cfg 
    cfg = load_config()
    logger.info("♻️ Starte Sync-Lauf...")

    if not os.path.exists(TOKEN_PATH):
        logger.warning("⚠️ KEIN GOOGLE TOKEN! Bitte im Dashboard verbinden.")
        return

    creds = get_google_creds()
    if not creds: return
    
    try:
        srv_task = build('tasks', 'v1', credentials=creds)
        srv_cal = build('calendar', 'v3', credentials=creds)
    except Exception as e:
        logger.error(f"Google Service Error: {e}")
        return

    tag_name = cfg['TAG_NAME_TRIGGER']
    tag_id = find_id_by_name("tags", tag_name)
    fid_action = find_id_by_name("custom_fields", cfg['FIELD_NAME_ACTION'])
    fid_due = find_id_by_name("custom_fields", cfg['FIELD_NAME_DUE'])

    if not tag_id:
        logger.info(f"Tag '{tag_name}' nicht gefunden.")
        return

    list_id = resolve_task_list_id(srv_task)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    docs = get_documents_with_tag(tag_id)
    if docs: logger.info(f"🔍 {len(docs)} Dokumente mit Tag '{tag_name}' gefunden.")
    
    base_url = cfg['PAPERLESS_URL'].rstrip('/')

    for doc in docs:
        pid = doc['id']
        
        # Prüfung: Schon verarbeitet?
        cur.execute("SELECT status FROM sync_state WHERE paperless_id=?", (pid,))
        row = cur.fetchone()
        
        if row:
            status = row[0]
            if status == 'OPEN':
                # Läuft noch -> Skip
                continue
            elif status == 'DONE':
                # War fertig, aber Tag neu gesetzt -> Reaktivieren
                logger.info(f"♻️ Re-Aktiviere Dokument {pid} (war DONE).")
                cur.execute("DELETE FROM sync_state WHERE paperless_id=?", (pid,))
                conn.commit()

        # Task neu anlegen
        act = doc['title']
        due = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        
        for f in doc.get('custom_fields', []):
            if f['field'] == fid_action and f['value']: act = f['value']
            if f['field'] == fid_due and f['value']: due = f['value']

        logger.info(f"Sync Doc {pid}: {act}")
        try:
            task = srv_task.tasks().insert(tasklist=list_id, body={
                'title': act, 'notes': f"Link: {base_url}/documents/{pid}", 'due': f"{due}T00:00:00.000Z"
            }).execute()
            evt = srv_cal.events().insert(calendarId=cfg['GOOGLE_CALENDAR_ID'], body={
                'summary': f"TODO: {act}", 'description': f"{base_url}/documents/{pid}",
                'start': {'date': due}, 'end': {'date': (datetime.date.fromisoformat(due)+datetime.timedelta(days=1)).isoformat()},
                'reminders': {'useDefault': True}
            }).execute()
            cur.execute("INSERT INTO sync_state VALUES (?, ?, ?, 'OPEN')", (pid, task['id'], evt['id']))
            conn.commit()
        except Exception as e: logger.error(f"Sync Fail Doc {pid}: {e}")

    # B: Google -> Paperless Check
    cur.execute("SELECT paperless_id, task_id, event_id FROM sync_state WHERE status='OPEN'")
    for pid, tid, eid in cur.fetchall():
        try:
            t = srv_task.tasks().get(tasklist=list_id, task=tid).execute()
            if t['status'] == 'completed':
                logger.info(f"✅ Task {tid} erledigt. Entferne Tag bei Doc {pid}.")
                if remove_tag_from_document(pid, tag_id):
                    try: srv_cal.events().delete(calendarId=cfg['GOOGLE_CALENDAR_ID'], eventId=eid).execute()
                    except: pass
                    cur.execute("UPDATE sync_state SET status='DONE' WHERE paperless_id=?", (pid,))
                    conn.commit()
        except: pass
    conn.close()


# --- FLASK ROUTES ---

@app.route('/setup', methods=['GET', 'POST'])
def setup_password():
    global cfg 
    if cfg.get("WEB_PASSWORD_HASH"): return redirect(url_for('login'))
    if request.method == 'POST':
        pwd = request.form.get('password')
        if pwd:
            cfg['WEB_PASSWORD_HASH'] = generate_password_hash(pwd)
            save_config_file(cfg)
            session['logged_in'] = True
            logger.info("🔐 Admin-Passwort initial gesetzt.")
            return redirect(url_for('index'))
    return render_template('setup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if not cfg.get("WEB_PASSWORD_HASH"): return redirect(url_for('setup_password'))
    if request.method == 'POST':
        if check_password_hash(cfg.get("WEB_PASSWORD_HASH"), request.form.get('password')):
            session['logged_in'] = True
            return redirect(url_for('index'))
        else: return render_template('login.html', error="Falsches Passwort")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    logs = ""
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, "r") as f:
                lines = f.readlines()
                logs = "".join(lines[-100:]).replace("\n", "<br>")
        except: logs = "Konnte Logs nicht lesen."
    
    host_ip = request.host.split(':')[0]
    google_status = os.path.exists(TOKEN_PATH)
    
    return render_template('index.html', config=cfg, logs=logs, host_ip=host_ip, google_connected=google_status)

@app.route('/save-config', methods=['POST'])
@login_required
def save_settings():
    global cfg 
    new_conf = cfg.copy()
    for key in request.form:
        if key == "NEW_WEB_PASSWORD" and request.form[key].strip():
            new_conf['WEB_PASSWORD_HASH'] = generate_password_hash(request.form[key])
            continue
        if key in new_conf: new_conf[key] = request.form[key]
    new_conf['ENABLE_EMAIL'] = 'true' if request.form.get('ENABLE_EMAIL') else 'false'
    save_config_file(new_conf)
    cfg = load_config()
    return redirect(url_for('index'))

@app.route('/regenerate-key', methods=['POST'])
@login_required
def regen_key():
    global cfg 
    new_key = secrets.token_hex(16)
    cfg['MY_SYNC_API_KEY'] = new_key
    save_config_file(cfg)
    return redirect(url_for('index'))

@app.route('/reset-db', methods=['POST'])
@login_required
def reset_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DELETE FROM sync_state")
        conn.commit()
        conn.close()
        logger.warning("⚠️ Sync-Datenbank wurde manuell geleert.")
        return redirect(url_for('index'))
    except Exception as e:
        return f"Fehler: {e}"

@app.route('/webhook', methods=['POST'])
def webhook():
    key = request.headers.get("X-API-KEY") or request.args.get("key")
    if key != cfg['MY_SYNC_API_KEY']: return jsonify({"status": "unauthorized"}), 401
    threading.Thread(target=run_sync).start()
    return jsonify({"status": "triggered"}), 200

# --- GOOGLE OAUTH ROUTES ---
@app.route('/google-connect')
@login_required
def google_connect():
    if not os.path.exists(CREDENTIALS_PATH):
        return "Fehler: credentials.json fehlt im Ordner keys/."
    
    redirect_uri = url_for('oauth2callback', _external=True)
    flow = Flow.from_client_secrets_file(CREDENTIALS_PATH, scopes=SCOPES)
    flow.redirect_uri = redirect_uri
    
    auth_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')
    session['state'] = state
    return redirect(auth_url)

@app.route('/oauth2callback')
def oauth2callback():
    state = session.get('state')
    if not state: return redirect(url_for('index'))

    redirect_uri = url_for('oauth2callback', _external=True)
    try:
        flow = Flow.from_client_secrets_file(CREDENTIALS_PATH, scopes=SCOPES, state=state)
        flow.redirect_uri = redirect_uri
        
        flow.fetch_token(authorization_response=request.url)
        with open(TOKEN_PATH, 'w') as token:
            token.write(flow.credentials.to_json())
            
        logger.info("✅ Google Verbindung erfolgreich hergestellt!")
        return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"OAuth Fehler: {e}")
        return f"Fehler: {e}"

# --- STARTUP ---
def background_timer():
    while True:
        time.sleep(600)
        try: run_sync()
        except: pass

if __name__ == "__main__":
    init_db()
    threading.Thread(target=background_timer, daemon=True).start()
    
    # Optionaler Init-Sync
    try: pass 
    except: pass

    logger.info("🌍 Webinterface gestartet auf Port 5000")
    app.run(host='0.0.0.0', port=5000)
