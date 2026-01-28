import sys
import os
from google.cloud import documentai_v1 as documentai
from google.api_core.client_options import ClientOptions

def test_connection():
    # --- KONFIGURATION (Aus deinen Screenshots) ---
    PROJECT_ID = "gen-lang-client-0151377967"
    PROJECT_NUMBER = "841608965746"
    LOCATION = "eu"
    PROCESSOR_ID = "7e5c6ef084f5281"
    
    # Pfad zum Key-File (wird als Argument übergeben)
    if len(sys.argv) < 2:
        print("❌ Fehler: Bitte Pfad zur service-account.json angeben.")
        print("Aufruf: python3 test_docai.py /pfad/zu/deiner/key.json")
        return
    
    key_file = sys.argv[1]
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_file

    print(f"--- Starte Python Test ---")
    print(f"Projekt-ID: {PROJECT_ID}")
    print(f"Region: {LOCATION}")
    
    try:
        # 1. Client-Optionen für EU erzwingen
        opts = ClientOptions(api_endpoint=f"{LOCATION}-documentai.googleapis.com")
        
        # 2. Client initialisieren
        client = documentai.DocumentProcessorServiceClient(client_options=opts)
        
        # 3. Ressourcen-Pfad bauen (Wir testen beide Varianten: ID und Nummer)
        # Meistens ist die Projekt-Nummer im Pfad bei Document AI sicherer
        name = f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/processors/{PROCESSOR_ID}"
        
        print(f"⏳ Rufe Prozessor ab: {name}")
        
        # 4. API-Aufruf
        processor = client.get_processor(name=name)
        
        print(f"✅ ERFOLG!")
        print(f"Anzeigename: {processor.display_name}")
        print(f"Typ: {processor.type}")
        print(f"Status: {processor.state.name}")

    except Exception as e:
        print(f"❌ FEHLER: {e}")
        if "PERMISSION_DENIED" in str(e):
            print("\n💡 Tipp: Der Service-Account hat keine Rechte für dieses Projekt oder die Region ist falsch.")

if __name__ == "__main__":
    test_connection()
