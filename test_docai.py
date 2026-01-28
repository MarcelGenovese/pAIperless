import sys
import os
from google.cloud import documentai_v1 as documentai
from google.api_core.client_options import ClientOptions

def test_connection():
    # Daten exakt aus deinen Bildern
    PROJECT_NUMBER = "841608965746"
    LOCATION = "eu"
    PROCESSOR_ID = "7e5c6ef084f5281"
    
    if len(sys.argv) < 2:
        print("❌ Fehler: Bitte Pfad zur service-account.json angeben.")
        return
    
    key_file = sys.argv[1]
    # Setze die Umgebungsvariable für die Authentifizierung
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_file

    print(f"--- Starte Regionaler Test (EU) ---")
    
    try:
        # Erpringe den regionalen Endpunkt
        options = ClientOptions(api_endpoint=f"{LOCATION}-documentai.googleapis.com")
        
        # Erstelle den Client mit den expliziten Optionen
        client = documentai.DocumentProcessorServiceClient(client_options=options)
        
        # Baue den vollständigen Ressourcennamen
        resource_name = client.processor_path(PROJECT_NUMBER, LOCATION, PROCESSOR_ID)
        
        print(f"⏳ Versuche Zugriff auf: {resource_name}")
        
        # Teste den Zugriff durch Abruf der Prozessor-Metadaten
        processor = client.get_processor(name=resource_name)
        
        print(f"✅ ERFOLG!")
        print(f"Name: {processor.display_name}")
        print(f"Status: {processor.state.name}")

    except Exception as e:
        print(f"❌ FEHLER: {e}")

if __name__ == "__main__":
    test_connection()
