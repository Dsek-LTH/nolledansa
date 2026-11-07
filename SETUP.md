# NolleDansa – Self-host setup (PostgreSQL + Authentik + MinIO)

## 1. Förutsättningar
- Node.js 20+
- PostgreSQL 15+
- Authentik (OIDC provider) med en klient för appen
- MinIO (S3-kompatibel bucket)
- FFmpeg och ffprobe på serverns PATH (ingår i Containerfile). För lokal utveckling
  installerar du dem separat, eller anger `FFMPEG_PATH` och `FFPROBE_PATH` till binärerna.

### Videohantering

Alla videouppladdningar kontrolleras med ffprobe på servern. MP4 med H.264,
8-bitars yuv420p och AAC-LC (eller utan ljud) sparas oförändrade. Andra behållare
packas om till MP4; kompatibla video- och ljudspår kopieras utan omkodning.
Enbart inkompatibla spår kodas om (H.264 CRF 18 respektive AAC 192 kbit/s).
Upplösning och bildfrekvens behålls; udda bildmått får en extra kantpixel vid omkodning.

Bearbetningen sker inom uppladdningsanropet, innan videon sparas i objektlagringen.
Servern skickar JSON-whitespace var tionde sekund under bearbetningen för att hålla
anslutningen aktiv genom proxyservrar. Efter att strömningen börjat returneras
bearbetningsfel som `{ "error": "..." }` med HTTP 200; klienter måste kontrollera
svarets `error`/`url`, inte enbart HTTP-status. Båda uppladdningsformulären gör det.
Webbserver/reverse proxy måste tillåta stora request bodies och upp till 30 minuters
bearbetning plus överföringstid. Servern behöver temporärt diskutrymme för original
och resultat samt minne för den färdiga filen. Formuläret visar att videon förbereds;
användaren behöver stanna kvar tills det är klart. Detta är ingen bakgrundskö.
Tillfälliga filer rensas vid både lyckad och misslyckad bearbetning.
Befintliga uppladdningar ändras inte; problematiska videor behöver laddas upp igen.

## 2. Initiera databasen
Kör SQL-filen i din PostgreSQL-databas:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## 3. Konfigurera Authentik
Skapa en OIDC-klient i Authentik och sätt callback till:

```
http://localhost:3000/api/auth/callback/authentik
```

Använd samma `issuer`, `client_id`, `client_secret` i miljövariablerna nedan.

## 4. Konfigurera MinIO
Skapa en bucket (t.ex. `dance-videos`) och ett access key-par med read/write.

## 5. Skapa `.env.local`

```env
DATABASE_URL=postgres://user:password@localhost:5432/nolledansa

AUTH_SECRET=replace-with-a-random-secret
AUTH_URL=https://nolledansa.dsek.se
AUTH_TRUST_HOST=true
AUTHENTIK_ISSUER=https://auth.example.com/application/o/nolledansa/
AUTHENTIK_CLIENT_ID=...
AUTHENTIK_CLIENT_SECRET=...

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET_NAME=dance-videos
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=http://localhost:9000/dance-videos
```

## 6. Installera och starta

```bash
npm install
npm run dev
```

Öppna `http://localhost:3000`.

### Lokal testserver med Docker Desktop

```bash
docker compose -f compose.local.yml up -d --build
```

Öppna `http://localhost:3000/upload`. Miljön bygger projektets Containerfile med
FFmpeg och använder en separat lokal PostgreSQL-databas och S3-bucket i RustFS.
Inga produktionsuppgifter från `.env.local` används. Testdata sparas i Docker-volymer.
Authentik-inloggning är inte konfigurerad här; vanliga uppladdningar kan testas utan inloggning.

Loggar och stopp:

```bash
docker compose -f compose.local.yml logs -f app
docker compose -f compose.local.yml stop
```

Automatiska uppladdningstester med små genererade provvideor (enbart lokal miljö):

```bash
docker compose -f compose.local.yml exec app node tests/video-upload.integration.cjs
```

Testerna kontrollerar H.264/AAC utan ändrade filbytes, HEVC-konvertering,
ompackning av MKV, konvertering av inkompatibelt ljud och HTTP range-anrop.

## 7. Admin
Admin-login sker via Authentik på `/admin`.
Behörighet styrs helt via Authentik-policy för applikationen.
