from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf/BYTEFORCE-Working-Guide.pdf'
SHOTS=Path(__file__).resolve().parent/'screens'
W,H=landscape(A4)
NAVY=HexColor('#172438');BLUE=HexColor('#28566D');MUTED=HexColor('#56677A');LINE=HexColor('#D8E0E8');PALE=HexColor('#EEF3F7')
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('BYTEFORCE | Illustrated Working Guide')
c.setAuthor('BYTEFORCE Project Documentation')
c.setSubject('Application workflows, architecture, authentication, verification and operations')
page_num=0
styles={
 'body':ParagraphStyle('body',fontName='Helvetica',fontSize=10.5,leading=15,textColor=NAVY,spaceAfter=8),
 'small':ParagraphStyle('small',fontName='Helvetica',fontSize=8.7,leading=12,textColor=MUTED),
 'h':ParagraphStyle('h',fontName='Helvetica-Bold',fontSize=13,leading=17,textColor=BLUE,spaceAfter=8),
 'table':ParagraphStyle('table',fontName='Helvetica',fontSize=9,leading=12,textColor=NAVY),
}

def para(text,x,y,width,style='body'):
 p=Paragraph(text,styles[style]);pw,ph=p.wrap(width,1000)
 if y-ph<49:raise RuntimeError(f'Page {page_num} text overflow {text[:50]} bottom={y-ph}')
 p.drawOn(c,x,y-ph);return y-ph-9

def start(title,section='WORKING GUIDE'):
 global page_num
 page_num+=1
 c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(BLUE);c.rect(0,H-9,W,9,fill=1,stroke=0)
 c.setFont('Helvetica-Bold',9);c.setFillColor(BLUE);c.drawString(42,H-34,'BYTEFORCE  /  '+section)
 size=min(24,24*(W-84)/c.stringWidth(title,'Helvetica-Bold',24));c.setFont('Helvetica-Bold',size);c.setFillColor(NAVY);c.drawString(42,H-72,title)
 c.setStrokeColor(LINE);c.line(42,38,W-42,38)
 c.setFont('Helvetica',8);c.setFillColor(MUTED);c.drawString(42,24,'National Weather Intelligence & Analytics Platform | 18 September 2026')
 c.drawRightString(W-42,24,f'{page_num:02d}')
 c.bookmarkPage(f'p{page_num}');c.addOutlineEntry(title,f'p{page_num}',0,False)

def end():c.showPage()

def cols(title,left,right,section='HOW IT WORKS'):
 start(title,section)
 width=(W-108)/2
 for x,content in [(42,left),(66+width,right)]:
  y=H-101
  for heading,body in content:
   y=para(heading,x,y,width,'h')
   y=para(body,x,y,width)
 end()

def table(headers,rows,x,y,width,widths=None):
 data=[[Paragraph(str(v),styles['table']) for v in row] for row in [headers]+rows]
 widths=[width*v for v in widths] if widths else [width/len(headers)]*len(headers)
 t=Table(data,colWidths=widths,hAlign='LEFT');t.setStyle(TableStyle([
 ('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),
 ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
 ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
 ('LINEBELOW',(0,0),(-1,0),.7,LINE),('LINEBELOW',(0,1),(-1,-1),.3,LINE)]))
 tw,th=t.wrap(width,1000)
 if y-th<50:raise RuntimeError(f'Table overflow page{page_num}')
 t.drawOn(c,x,y-th);return y-th-16

def screen(title,name,caption,section):
 start(title,section)
 p=SHOTS/(name+'.png');im=Image.open(p);iw,ih=im.size
 availw=W-84;availh=H-151;scale=min(availw/iw,availh/ih)
 dw,dh=iw*scale,ih*scale;x=(W-dw)/2;y=H-92-dh
 c.setStrokeColor(LINE);c.rect(x-1,y-1,dw+2,dh+2,stroke=1,fill=0)
 c.drawImage(str(p),x,y,width=dw,height=dh)
 para(caption,42,y-10,W-84,'small');end()

# 1
start('An illustrated guide to BYTEFORCE','PRODUCT & OPERATIONS')
para('National Weather Intelligence<br/>&amp; Analytics Platform',42,H-116,650,'h')
para('How reports become evidence, events and operational decisions.',42,H-174,650)
for i,(a,b) in enumerate([('01 / OBSERVE','Collect citizen observations and simulated source reports.'),('02 / VERIFY','Compare location, time, corroboration and duplicate evidence.'),('03 / RESPOND','Review consolidated events, analyse trends and manage alerts.')]):
 x=42+i*255;c.setFillColor(PALE);c.roundRect(x,190,239,143,5,fill=1,stroke=0)
 para(a,x+16,315,207,'h');para(b,x+16,279,207)
para('<b>Scope:</b> the existing running application, with screenshots captured on 18 September 2026. This document explains current behaviour, including Resend OTP login and account-management improvements.',42,158,730)
para('The weather workspace uses development data and simulated external feeds. It is not an official warning service. Counts and timestamps in screenshots are snapshots, not fixed product statistics.',42,99,730,'small');end()
#2
start('How to use this guide','READING MAP')
table(['Pages','What you will learn'],[
 ('3-4','Architecture and the end-to-end report lifecycle'),('5-8','Dashboard, map, monitoring, filtering and search'),('9-15','Citizen reporting, scoring, officer review and event management'),('16-18','Social intelligence, analytics and exports'),('19-22','Alerts, data sources, system health and reliability'),('23-26','Email OTP, permissions and account administration'),('27-30','Data model, API contracts, local operation and readiness limits')],42,H-104,W-84,[.15,.85])
para('<b>Reading convention:</b> screenshot pages show the real interface; explanation pages describe the backend behaviour. Illustrative examples are labelled and do not represent measured weather conditions. Configuration defaults can be changed by authorised administrators.',42,147,W-84)
para('Use the PDF bookmarks to jump between sections. Start with pages 3-4 for the overall system, then follow the screen relevant to your role.',42,86,W-84,'small');end()
#3 architecture
start('Architecture: one application, clear service boundaries','SYSTEM DESIGN')
boxes=[(42,365,230,85,'Browser / Next.js','Screens, filters, charts and map'),(305,365,230,85,'FastAPI backend','Validation, sessions, roles and APIs'),(568,365,230,85,'SQLAlchemy + database','SQLite locally; PostgreSQL/PostGIS deployment'),(42,222,230,85,'Classification + verification','Category, evidence score, duplicates and event fusion'),(305,222,230,85,'Transactional outbox + WebSocket','Committed changes trigger client refresh'),(568,222,230,85,'External services','Resend email; OSM map tiles; optional Redis Streams')]
for x,y,w,h,title,sub in boxes:
 c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y,w,h,5,fill=1,stroke=1)
 sub_y=para(title,x+12,y+h-13,w-24,'h');para(sub,x+12,sub_y+4,w-24,'small')
for x1,y1,x2,y2 in [(272,407,305,407),(535,407,568,407),(420,365,420,307),(150,365,150,307),(683,365,683,307)]:
 c.setStrokeColor(BLUE);c.line(x1,y1,x2,y2)
para('<b>Request path:</b> the browser calls /api through the Next.js proxy. FastAPI validates input, reads the current user and enforces permissions. Business services update records; SQLAlchemy persists them.',42,190,W-84)
para('<b>Update path:</b> weather changes and an outbox message commit together. A dispatcher publishes notifications. The browser fetches authoritative reports, events and alerts again, updating views without a full page reload.',42,137,W-84)
para('Current ML is deterministic. Redis is optional. Kafka, distributed consumers, learned embeddings and live authoritative weather ingestion are future extensions, not active components of this deployment.',42,83,W-84,'small');end()
#4
cols('The complete report lifecycle',[
 ('1. Observation enters the platform','A citizen provides an event description, coordinates, city, district, state, time and optional media. The public reporting form does not require staff privileges. Server validation rejects malformed input before processing.'),
 ('2. Category and nearby evidence','The classifier examines the text. A recognised category can replace the submitted category. Nearby reports are retrieved inside the configured radius and time window, then assessed for corroboration and possible duplication.'),
 ('3. Report joins an event','An active event with the same category inside the radius and time window is reused; otherwise an event is created. The report starts as Pending. Citizen identity/contact fields are blanked for anonymous submissions.')],
 [('4. Save and broadcast','The report, event changes, possible alert and outbox notification are committed. The dispatcher delivers the update; connected dashboards refresh their data. A disconnected browser also polls periodically.'),
 ('5. Officer assesses evidence','An authorised officer reads the original observation, location, scoring breakdown and duplicate candidates. The officer may verify, request further review, flag, reject or merge the report with another event.'),
 ('6. Derived views change','The event count, confidence and severity are recomputed. Verification history preserves who changed the report and why. Maps, live monitoring, analytics and alerts reflect the new stored state.')])
#5-8
screen('Overview: the national operating picture','overview','Figure 1. KPI summaries, national event map and priority alerts. These figures reflect the captured development database; metric scopes differ and are explained on page 8.','DASHBOARD')
screen('National map: locate and inspect weather events','map','Figure 2. Severity-coloured event markers and clusters on an OpenStreetMap base map. Event display, verified-only filtering, density mode, zoom and reset support geographic triage.','GEOSPATIAL MONITORING')
screen('Live monitoring: incoming observations','monitoring','Figure 3. Reports appear with source, location, severity, trust and verification state. Use pause/resume for inspection; it does not stop backend ingestion.','REPORT MONITORING')
cols('Reading the operational workspace',[
 ('Metric scope matters','Total reports today is a time-bounded count. Other cards can describe the loaded workspace, such as all verified reports or reports awaiting review. Do not assume every card shares the same denominator. Continuous simulated ingestion can increase totals between screenshots.'),
 ('Reports versus events','A report is one observation from one source. An event groups related reports into a location/category incident. Many social posts may refer to one flood. A large report count is not the same as a large number of independent weather events.'),
 ('Filters and search','Use the state, event and severity selectors first. More filters exposes district, source, verification and dates. Global search matches identifiers and location/category text in loaded records; it is not a national full-text search engine.')],
 [('Map interpretation','Marker colour means severity, not verified truth. A clustered marker represents nearby events at the current zoom level. Open a marker to inspect confidence, sources and associated reports. Density visualises data concentration; it is not calibrated rainfall intensity.'),
 ('Live feed controls','Pause the visible table to inspect a record without the list shifting. Resume to continue updates. WebSocket messages trigger data refreshes, with periodic polling as a fallback. The development simulator creates a new observation approximately every 14 seconds.'),
 ('Bounded data access','The current report API returns up to 5,000 recent records. Client-side filtering and charts operate on the data retrieved. National-scale historical search requires server-side pagination and analytical aggregation before the system can claim complete archive coverage.')])
#9-10
screen('Citizen reporting: submit a structured observation','citizen','Figure 4. Event details, place/time information and supporting evidence are captured together. Anonymous reporting is available; submission creates a report pending officer verification.','PUBLIC REPORTING')
cols('From a citizen form to stored evidence',[
 ('What to enter','Choose a category, describe observable conditions, and provide a specific location. Use accurate coordinates and the observation time. Optional media should show the reported situation. The form supports browser GPS when permission is granted, but typed coordinates are also accepted.'),
 ('Validation and media','The backend validates text length, latitude/longitude ranges and timestamps. Media accepts supported image/video types with a 20 MB limit in the current interface. Upload validation is not forensic media verification: authenticity, reuse and scene consistency still require review.'),
 ('Illustrative flood submission','Example text: "Road completely submerged after heavy rainfall near MVP Colony." Coordinates: 17.6868, 83.2185. The deterministic classifier finds "submerged" and returns Flooding. The location then participates in proximity checks and event association.')],
 [('Initial trust calculation','Default evidence weights: official correlation +25, nearby matching reports +20, coordinates +15, recent timestamp +10, and duplicate evidence -15. The total is clamped to 0-100. Unimplemented source-history and image checks contribute zero.'),
 ('Worked example - illustrative','If official and nearby corroboration exist, coordinates are supplied and the report is recent, the score is 25 + 20 + 15 + 10 = 70. A duplicate match lowers it to 55. This is a rule-based evidence score, not a statistical probability that the report is true.'),
 ('Classification and scoring limits','Flooding receives a fixed 0.94 development confidence; other recognised categories use 0.86, and Other uses 0.35. These are deterministic outputs, not calibrated model estimates. Coordinate presence does not prove GPS authenticity or agreement between text and location.')])
#11-15
screen('Trust-score policy: configurable evidence weights','trust-config','Figure 5. Administrators can change scoring weights. Policy changes affect new intake assessments; existing stored intake scores are retained, and policy updates are audited.','EVIDENCE POLICY')
screen('Verification centre: queue and report assessment','verification','Figure 6. The incoming queue sits beside the selected report. Officers inspect source text, category, coordinates and observation time before making a decision.','HUMAN REVIEW')
screen('Evidence review: score, duplicates and decisions','evidence','Figure 7. The lower assessment area exposes scoring evidence and duplicate candidates. Officer actions and audit history continue below this viewport; duplicate matches still require judgement.','HUMAN REVIEW')
screen('Event dossier: a consolidated incident record','event','Figure 8. A dedicated event page combines report activity, source distribution, related alerts and operational history. Its URL can be shared with other authorised users.','EVENT MANAGEMENT')
cols('Officer decisions and event fusion',[
 ('Verification is a human action','All new citizen reports enter Pending. An automated "Likely Verified" assessment does not grant Verified status. Administrators and Verification Officers may verify, mark under review, flag suspicious or reject. Rejection and suspicious flags require a meaningful reason.'),
 ('Duplicate detection','The current detector combines lexical sequence similarity with normalised-word overlap. Nearby comparisons above 0.6 are presented as possible duplicates. A shown percentage is lexical similarity, not proof of duplicate imagery or deception. Sentence embeddings and image pHash are not active.'),
 ('Merge or keep separate','Merge moves a report to an existing event and recomputes affected event aggregates. Keep separate removes the duplicate association rather than silently discarding the report. The original report remains an accountable record; grouping should preserve the evidence trail.')],
 [('Fusion policy','Defaults are a 5 km radius and 24-hour window with matching event category and Active status. The current algorithm uses the first eligible nearby event; it is not advanced spatiotemporal clustering. Administrators can change the policy for subsequent intake.'),
 ('Confidence and severity','Event confidence averages 0.98 for Verified reports and trust_score/100 for other non-Rejected reports. Rejected reports are excluded; suspicious reports are not automatically excluded from this aggregate. Event severity takes the highest severity among usable reports. This heuristic needs validation before operational reliance.'),
 ('Event response history','Authorised officers can add notes, resolve, archive or reopen an event. Status changes require a reason and expected-status check. Resolving or archiving resolves outstanding related alerts. Later report reviews do not automatically reopen explicitly resolved or archived events.')])
#16-18
screen('Social intelligence: structured public-feed evidence','social','Figure 9. Social-style observations show category, extracted location and confidence. These records come from the development simulator, not a connected live social network.','SOURCE INTELLIGENCE')
screen('Analytics: trends and geographic distribution','analytics','Figure 10. Time selection and geographic/source filters drive the displayed report set. Charts and district comparisons support workload and event analysis.','ANALYTICS')
cols('How to interpret analytics and exports',[
 ('Select a meaningful range','Choose 24 Hours, 7 Days, 30 Days or Custom Range. Custom day boundaries use India Standard Time. State, district and source filters narrow the selected observations. An invalid date range should not be interpreted as a meaningful zero.'),
 ('What the charts count','Report activity counts observations over time. Event-category analysis counts distinct events represented by the selected reports. Source distribution explains where the observations originated. Verification rate is verified reports divided by selected reports, not an estimate of detection accuracy.'),
 ('District-level comparisons','District rows show report count, distinct events, verification rate, most common category and highest reported severity. High report volume can reflect repeated simulated posts or population/reporting activity; it does not automatically measure physical impact.')],
 [('Verification workload','The average verification-time summary is explicitly all-time, even when the report charts use a shorter range. Pending and under-review counts identify officer workload. Interpret processing time alongside evidence availability and staffing, not as an isolated quality score.'),
 ('CSV and JSON exports','Table exports provide CSV or JSON. Event dossiers can export their associated reports or the dossier record. Analytics exports contain the selected observations. CSV output quotes cell values and prefixes dangerous formula-leading characters to reduce spreadsheet formula injection risk.'),
 ('Analysis limits','The browser works on bounded API results, so a long date range may not include the whole historical archive. Screenshots use simulated evidence and should not be cited as observed Indian weather statistics. PDF export of arbitrary tables is a future extension; this guide is a separately authored document.')])
#19-22
screen('Alerts: acknowledge, assign and resolve','alerts','Figure 11. Alert records link an event, location, severity and confidence to an operational status. These are internal workflow records, not messages automatically sent to the public.','RESPONSE MANAGEMENT')
screen('Data sources: distinguish connected from simulated','sources','Figure 12. The registry identifies simulated external connectors and the citizen reporting API. Unmeasured latency/error-rate fields remain labelled rather than inventing performance values.','INGESTION OPERATIONS')
screen('System health: current runtime measurements','health','Figure 13. Runtime checks report API/database availability, host CPU, process memory, request activity and queue information. Development and external services are identified separately.','SYSTEM OPERATIONS')
cols('Alerts, realtime delivery and operational health',[
 ('Alert creation','Intake compares the submitted severity with the configured alert threshold. Eligible reports open a Warning or Critical alert unless an unresolved event alert already exists. The default threshold is Critical. This suppresses repeated open alerts for the same event.'),
 ('Response workflow','Officers can acknowledge, assign to a person/team, resolve or archive an alert. Assignment is an internal field, not an email/SMS notification. Event resolution/archive also resolves associated outstanding alerts. Human decisions remain necessary before field action.'),
 ('What health metrics mean','CPU measures host utilisation; memory measures API-process resident memory. Request rate and latency cover the current process and its recent window. The review queue is a database count. A healthy API does not establish that an external weather feed is current or authoritative.')],
 [('Durable notification path','The weather transaction writes an outbox row along with the report. A dispatcher checks pending rows about every 0.5 seconds and retries failures with capped backoff. Delivery is at least once, so downstream consumers must deduplicate stable message IDs when applying side effects.'),
 ('Browser resilience','The browser refreshes authoritative data on notifications, making repeated notifications safe. WebSocket reconnects and periodic polling help recover from connection loss. Pausing the monitor does not stop storage or the simulator. Missing live connectivity should be investigated, not treated as no weather activity.'),
 ('Current scale boundary','The broadcaster/dispatcher is designed for a single API worker. Redis Streams optionally persists messages but does not yet provide distributed fan-out. Multi-worker delivery, consumer groups, external metrics collection and retained-message cleanup are deployment work rather than current guarantees.')])
#23-26
screen('Sign-in: email verification with password fallback','login','Figure 14. OTP requests originate in the browser, but code generation, delivery, verification and session creation are all controlled by the backend. No real code or credential is shown here.','AUTHENTICATION')
cols('How Resend email OTP authentication works',[
 ('Request and delivery','POST /api/auth/send-otp normalises and validates the email, enforces shared database rate limits, generates a cryptographically random six-digit code and stores only its keyed hash. Older challenges for that email are invalidated. The backend Resend SDK sends a plain-text and HTML message.'),
 ('Verification','POST /api/auth/verify-otp loads the newest challenge and checks delivery readiness, expiry, unused state and attempt count. A constant-time comparison checks the keyed hash. Successful verification consumes the challenge atomically; database failure must not create an authenticated session.'),
 ('Account and session','The existing user is reused without changing their role/profile. A new email creates a Viewer after successful verification. The backend sets an eight-hour HttpOnly JWT cookie; it is Secure in production and SameSite=Lax. Tokens are not placed in localStorage. Password login is retained.')],
 [('Limits and lifecycle','Defaults: five-minute expiry, five verification attempts per code, 45-second resend cooldown, five sends per email and ten per IP per 15 minutes. Additional verification limits apply by email and IP. Expired challenges and old rate buckets are cleaned after 24 hours; an optional daily cleanup task covers idle systems.'),
 ('Resend configuration','RESEND_API_KEY and EMAIL_FROM exist only on the backend. OTP_HASH_SECRET is a separate server secret. The onboarding@resend.dev sender is restricted to the Resend account email. A verified custom domain permits wider delivery by changing EMAIL_FROM, with no code change.'),
 ('What has been verified','Resend accepted a real test send, and the user reported inbox arrival and successful sign-in. Provider dashboard delivery status was not independently verified because the status lookup was rejected. Use HTTPS and correctly configured proxy trust before public deployment. Email OTP is passwordless login, not a second factor.')])
screen('Roles: authentication is separate from permission','roles','Figure 15. Administrator, Weather Analyst, Verification Officer and Viewer are existing database roles. Backend permissions remain authoritative; a hidden button is not the security boundary.','ACCESS CONTROL')
cols('Account management and access safeguards',[
 ('New users start read-only','OTP registration uses Viewer, the least privileged existing role. Viewers may read the workspace; public citizen submission remains available. The system does not create administrators, analysts or verification officers based on a frontend role field.'),
 ('Administrator role changes','Admin > User Management shows users and last sign-in. Change role requires a new role, the expected existing role and a reason. Successful changes are stored in System Logs. A stale-role conflict requires refreshing the list before retrying.'),
 ('Protection against lockout','An administrator cannot change their own role through this control. Role decisions are serialized, and the acting administrator is checked again after the lock. Tests cover two administrators attempting to demote each other concurrently.')],
 [('Profile editing','Settings lets the signed-in user update their display name. Email, role and organisation cannot be changed through that profile request. Extra fields are rejected by the backend. The UI refreshes the displayed name after a successful save; the action is audited.'),
 ('Session expiry and logout','Expired operational API sessions redirect to login with an explanatory message and the original local destination. Logout clears the cookie. API requests load current permissions from the database, so a saved role change affects subsequent requests without waiting for the JWT to expire.'),
 ('Audit scope','Security logs include OTP requests and verification outcomes, login/logout, profile updates and role assignments. Verification logs separately record report decisions. Logs must not include plaintext codes, API keys or session secrets. Name display is not identity proof; verified email and account records provide the login identity.')])
#27
a=[('users','Identity, password hash, role, organisation, created/last-login time.'),('weather_reports','Observation text, category, coordinates, source, scores, verification and event link.'),('weather_events','Consolidated incident, severity, confidence, times, report count and status.'),('citizen_reports','Citizen-specific description and optional reporter identity/contact.'),('verification_logs / event_logs','Officer report decisions and event notes/state transitions.'),('alerts / data_sources','Response records and ingestion-source registry.'),('otp_challenges / auth_rate_limits','Keyed OTP hashes, expiry/consumption and shared request limits.'),('outbox_messages / configuration / system_logs','Durable change notifications, editable policies and system/account audit.')]
start('Data model: keep evidence separate from aggregation','DATA REFERENCE')
y=table(['Entity','Purpose'],a,42,H-101,W-84,[.32,.68])
para('Relationships: one event has many reports; a citizen-report extension points to its weather report; alerts and event logs reference events. OTP challenges reference an existing user or identify an email awaiting first successful verification. The current local database is SQLite; geographic PostgreSQL queries use PostGIS when deployed.',42,y,W-84,'small');end()
#28
start('API reference: the main application contracts','TECHNICAL REFERENCE')
y=table(['Area','Endpoints','Purpose'],[
 ('Authentication','POST /api/auth/send-otp<br/>POST /api/auth/verify-otp<br/>GET /api/auth/me<br/>POST /api/auth/logout','Send/verify email codes, read identity and clear the session.'),
 ('Profiles / roles','PATCH /api/auth/profile<br/>PATCH /api/admin/users/{id}/role','Update own name or assign roles with administrator checks.'),
 ('Reports / events','GET /api/reports<br/>POST /api/citizen-reports<br/>GET /api/events/{id}','Read evidence, submit observations and open an event dossier.'),
 ('Assessment','POST /api/ml/classify<br/>POST /api/verification/analyse<br/>POST /api/reports/{id}/verify','Classify, inspect evidence and save an authorised review.'),
 ('Event operations','PATCH /api/events/{id}/status<br/>POST /api/events/{id}/notes','Record event lifecycle decisions and officer notes.'),
 ('Operations','GET /api/analytics/overview<br/>GET /api/map/events<br/>GET /api/sources/status<br/>GET /api/health','Read summaries, map data, ingestion status and runtime health.')],42,H-101,W-84,[.17,.43,.40])
para('Responses use typed request validation. Typical errors: 401 sign-in required; 403 insufficient permission; 409 conflicting state; 422 invalid input; 429 rate limit; 503 provider/database unavailable. Local interactive API documentation is available at http://localhost:8000/docs. Deprecated OTP aliases are retained only for existing clients.',42,y,W-84,'small');end()
#29
cols('Running locally and preparing a deployment',[
 ('Local services','The frontend runs on port 3000 and FastAPI on port 8000. The project includes scripts/dev.sh, Python requirements, frontend package metadata and compose.yaml. Copy .env.example into private configuration and provide persistent secrets; never commit the real .env file.'),
 ('Data and migrations','Local startup creates missing tables and applies additive authentication columns before seeding. Existing users and weather records are retained. Back up data before rollout. Run the auth migration against the intended DATABASE_URL before starting multiple deployment workers.'),
 ('Email setup','Use EMAIL_PROVIDER=resend, RESEND_API_KEY and EMAIL_FROM. Defaults are OTP_EXPIRY_MINUTES=5 and OTP_RESEND_COOLDOWN_SECONDS=45. Keep OTP_HASH_SECRET independent from JWT_SECRET. Verify the sender domain before attempting delivery to general users; restart the backend after configuration changes.')],
 [('Deployment architecture','The Docker definition includes PostgreSQL/PostGIS, Redis, backend and frontend. Configure APP_ENV=production, HTTPS, allowed origins, internal API URL and public secure WebSocket URL. Do not expose database credentials or email keys to the client bundle.'),
 ('Operational checks','Check API/database health, outbox retry counts and source status. Establish database backups with restore tests, storage/media retention, monitoring, log retention and dependency patching. Configure trusted reverse proxy addresses so rate limits use valid client IPs.'),
 ('Troubleshooting','No OTP: check Resend key, sender/domain permission, recipient and spam folder. Invalid code: use the newest code and check expiry. 429: honour Retry-After. No realtime changes: inspect WebSocket connectivity and outbox retries. Blank charts: clear filters, inspect date range and confirm the API is reachable.')])
#30
cols('Validation, limitations and source notes',[
 ('Verified implementation evidence','The previous change set passed 35 backend tests; an additional concurrent role-change regression also passed. The production frontend build/type checks passed. Earlier analytics regression tests passed. These results demonstrate tested local behaviours, not certification for emergency operations.'),
 ('Functional today','Citizen intake, storage, deterministic category classification, scoring, event grouping, officer review, map/report updates, analytics, CSV/JSON export, Resend OTP, profiles and audited role controls are implemented. Real email delivery and sign-in were confirmed by the user.'),
 ('Not yet an authoritative weather service','Official/API, social and RSS feeds are simulated. Learned NLP/image models, calibrated confidence, image authenticity checks, district-boundary imports and fully distributed stream processing remain integration/scaling work. Do not interpret simulated official correlation as a live IMD warning.')],
 [('Evidence sources for this guide','Screenshots are direct captures of the running BYTEFORCE application. Behaviour was checked against frontend/features, backend/app/services/pipeline.py, verification/scoring.py, ml/classifier.py, services/otp.py, api/accounts.py, streaming modules and the project README and tests. No secrets or live OTPs are reproduced.'),
 ('External reference','Resend sender restrictions: https://resend.com/docs/knowledge-base/403-error-resend-dev-domain<br/><br/>Map attribution remains visible in captured screens: Leaflet and OpenStreetMap contributors. Screenshot counts vary because the simulator continues running.'),
 ('Before operational use','Validate PostgreSQL concurrency and Docker networking on target infrastructure, connect licensed authoritative data, review privacy and access policy, test load/recovery/accessibility, and establish accountable warning procedures. The application is an extensible operational workspace; deployment readiness requires these checks.')])
c.save()
print(f'Created {OUT} ({page_num} pages)')
