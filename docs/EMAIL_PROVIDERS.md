# Email Provider Kompatibilität

## Übersicht

Die aktuelle Email-Service-Implementation verwendet **Standard SMTP-Authentifizierung** (Username + Password). Dies funktioniert mit den meisten Email-Providern, erfordert aber teilweise spezielle Konfigurationen.

## ✅ Vollständig Kompatibel (mit App-Passwörtern)

### Gmail

**Status:** ✅ Funktioniert mit App-Passwort

**Voraussetzungen:**
- Google-Konto mit aktivierter 2-Faktor-Authentifizierung (2FA)
- App-spezifisches Passwort erstellt

**Setup-Schritte:**

1. **2FA aktivieren** (falls noch nicht aktiviert)
   - https://myaccount.google.com/security
   - "2-Step Verification" aktivieren

2. **App-Passwort erstellen**
   - https://myaccount.google.com/apppasswords
   - App auswählen: "Mail"
   - Gerät auswählen: "Other (Custom name)" → "pAIperless"
   - Generiertes 16-stelliges Passwort kopieren

3. **In pAIperless konfigurieren:**
   ```
   SMTP Server: smtp.gmail.com
   Port: 587
   Encryption: STARTTLS
   Username: ihre-email@gmail.com
   Password: [16-stelliges App-Passwort ohne Leerzeichen]
   Sender: ihre-email@gmail.com
   ```

**Wichtig:**
- ⚠️ Verwenden Sie NICHT Ihr normales Google-Passwort
- ✅ Verwenden Sie das generierte App-Passwort
- ⚠️ App-Passwörter sind nur verfügbar wenn 2FA aktiviert ist

**Limits:**
- 500 Emails pro Tag (kostenlos)
- 100 Empfänger pro Email

---

### Outlook / Hotmail / Office 365

**Status:** ✅ Funktioniert mit App-Passwort

**Voraussetzungen:**
- Microsoft-Konto
- App-Passwort erstellt (optional, aber empfohlen)

**Setup-Schritte:**

#### Option 1: Mit App-Passwort (Empfohlen)

1. **App-Passwort erstellen**
   - https://account.microsoft.com/security
   - "Advanced security options"
   - "App passwords" → "Create a new app password"
   - Name: "pAIperless"

2. **In pAIperless konfigurieren:**
   ```
   SMTP Server: smtp-mail.outlook.com
   Port: 587
   Encryption: STARTTLS
   Username: ihre-email@outlook.com (oder @hotmail.com)
   Password: [App-Passwort]
   Sender: ihre-email@outlook.com
   ```

#### Option 2: Mit normalem Passwort (weniger sicher)

```
SMTP Server: smtp-mail.outlook.com
Port: 587
Encryption: STARTTLS
Username: ihre-email@outlook.com
Password: [Ihr normales Passwort]
Sender: ihre-email@outlook.com
```

**Wichtig:**
- ⚠️ Microsoft kann normale Passwörter bei SMTP blockieren
- ✅ App-Passwörter sind sicherer und zuverlässiger

**Limits:**
- 300 Emails pro Tag (kostenlos)
- 100 Empfänger pro Email

---

### iCloud Mail

**Status:** ✅ Funktioniert mit App-Passwort

**Voraussetzungen:**
- Apple ID
- 2FA aktiviert
- App-spezifisches Passwort

**Setup-Schritte:**

1. **App-spezifisches Passwort erstellen**
   - https://appleid.apple.com
   - "Sign-In and Security" → "App-Specific Passwords"
   - "Generate Password"
   - Label: "pAIperless"

2. **In pAIperless konfigurieren:**
   ```
   SMTP Server: smtp.mail.me.com
   Port: 587
   Encryption: STARTTLS
   Username: ihre-email@icloud.com
   Password: [App-spezifisches Passwort]
   Sender: ihre-email@icloud.com
   ```

---

## ✅ Business/Professionelle Email-Dienste

### SendGrid

**Status:** ✅ Direkt kompatibel

```
SMTP Server: smtp.sendgrid.net
Port: 587 (oder 465 für SSL)
Encryption: STARTTLS (oder SSL)
Username: apikey
Password: [Ihr SendGrid API Key]
Sender: verified-sender@ihre-domain.de
```

**Vorteile:**
- Hohe Zuverlässigkeit
- Bis zu 100 Emails/Tag kostenlos
- Gute Delivery-Raten

---

### Mailgun

**Status:** ✅ Direkt kompatibel

```
SMTP Server: smtp.mailgun.org
Port: 587
Encryption: STARTTLS
Username: postmaster@ihre-domain.mailgun.org
Password: [Ihr Mailgun SMTP Password]
Sender: noreply@ihre-domain.de
```

**Vorteile:**
- Sehr zuverlässig
- Gute API und Tracking
- Kostenloser Tier verfügbar

---

### Amazon SES

**Status:** ✅ Direkt kompatibel

```
SMTP Server: email-smtp.eu-central-1.amazonaws.com (Region anpassen)
Port: 587
Encryption: STARTTLS
Username: [SMTP Username aus SES Console]
Password: [SMTP Password aus SES Console]
Sender: verified@ihre-domain.de
```

**Vorteile:**
- Sehr günstig
- Hohe Limits
- AWS-Integration

---

## 🧪 Test-Provider

### Mailtrap.io (Empfohlen für Entwicklung)

**Status:** ✅ Perfekt für Testing

**Vorteile:**
- ✅ Keine echten Emails versendet
- ✅ Web-Interface zum Testen
- ✅ Kostenloser Tier
- ✅ Perfekt für Entwicklung

**Setup:**
1. Sign up: https://mailtrap.io
2. Inbox erstellen
3. SMTP Settings kopieren

```
SMTP Server: sandbox.smtp.mailtrap.io
Port: 2525 (oder 587)
Encryption: STARTTLS
Username: [von Mailtrap]
Password: [von Mailtrap]
Sender: beliebig@example.com
Recipients: beliebig@example.com
```

---

### MailHog (Lokaler Test-Server)

**Status:** ✅ Perfekt für lokale Entwicklung

**Setup:**
```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

**Konfiguration:**
```
SMTP Server: localhost
Port: 1025
Encryption: NONE
Username: [leer]
Password: [leer]
```

**Web-Interface:** http://localhost:8025

---

## ❌ NICHT Kompatibel (OAuth2 erforderlich)

### Gmail ohne App-Passwort
- ❌ Normales Google-Passwort funktioniert NICHT
- ✅ Lösung: App-Passwort verwenden (siehe oben)

### Outlook ohne App-Passwort (manchmal)
- ⚠️ Kann blockiert werden
- ✅ Lösung: App-Passwort verwenden (siehe oben)

---

## 🔐 Sicherheitshinweise

### App-Passwörter vs. OAuth2

**Aktuelle Implementation: App-Passwörter (Standard SMTP Auth)**

**Vorteile:**
- ✅ Einfach zu implementieren
- ✅ Funktioniert mit allen Providern
- ✅ Keine komplexe OAuth2-Flow nötig

**Nachteile:**
- ⚠️ Weniger sicher als OAuth2
- ⚠️ Erfordert App-Passwörter bei Gmail/Outlook

**OAuth2 (Nicht implementiert):**
- ✅ Sicherer
- ✅ Keine Passwörter in Datenbank
- ❌ Komplexer zu implementieren
- ❌ Provider-spezifisch

### Empfehlung für Produktion

**Für persönliche/kleine Installationen:**
- ✅ App-Passwörter sind ausreichend
- ✅ Einfach zu konfigurieren

**Für große Deployments:**
- ⚠️ Erwägen Sie professionelle Provider (SendGrid, Mailgun)
- ⚠️ OAuth2 wäre sicherer (zukünftige Erweiterung)

---

## 🧪 Test-Anleitung

### Gmail testen (mit echten Credentials)

1. **App-Passwort erstellen:**
   ```bash
   # Browser öffnen:
   https://myaccount.google.com/apppasswords

   # App auswählen: Mail
   # Gerät: pAIperless
   # Passwort kopieren
   ```

2. **Setup-Skript ausführen:**
   ```bash
   npx tsx scripts/setup-test-email.ts

   # Option 2 wählen (Gmail)
   # Gmail-Adresse eingeben
   # App-Passwort einfügen
   ```

3. **Testen:**
   ```bash
   npx tsx scripts/test-email.ts
   ```

### Outlook testen

1. **Setup-Skript ausführen:**
   ```bash
   npx tsx scripts/setup-test-email.ts

   # Option 3 wählen (Custom SMTP)
   # smtp-mail.outlook.com eingeben
   # Port 587
   # STARTTLS
   # Outlook-Adresse
   # Passwort oder App-Passwort
   ```

2. **Testen:**
   ```bash
   npx tsx scripts/test-email.ts
   ```

---

## 📝 Zusammenfassung

| Provider | Kompatibel | Voraussetzung | Empfehlung |
|----------|-----------|---------------|------------|
| Gmail | ✅ | App-Passwort | Gut für persönlich |
| Outlook | ✅ | App-Passwort (empf.) | Gut für persönlich |
| iCloud | ✅ | App-Passwort | Gut für persönlich |
| SendGrid | ✅ | API Key | Beste für Produktion |
| Mailgun | ✅ | SMTP Password | Beste für Produktion |
| Amazon SES | ✅ | SMTP Credentials | Gut für AWS-Setup |
| Mailtrap | ✅ | Account | Perfekt für Testing |
| MailHog | ✅ | Docker | Perfekt für lokal |

**Aktuelle Implementation:**
- ✅ Standard SMTP Auth (Username/Password)
- ✅ Funktioniert mit allen oben genannten Providern
- ✅ App-Passwörter werden unterstützt
- ❌ OAuth2 ist NICHT implementiert (nicht notwendig für App-Passwörter)

---

**Empfehlung:**
Für die meisten Nutzer sind **Gmail oder Outlook mit App-Passwörtern** die einfachste und sicherste Lösung. Für Produktions-Deployments empfehlen wir **SendGrid oder Mailgun**.
