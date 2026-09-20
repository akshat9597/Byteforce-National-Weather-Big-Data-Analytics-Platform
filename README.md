<div align="center">

# 🌦️ BYTEFORCE

### National Weather Intelligence & Analytics Platform

**Observe • Analyse • Verify • Respond**

<p>
<img src="https://img.shields.io/badge/Smart%20India%20Hackathon-2026-orange" />
<img src="https://img.shields.io/badge/SIH-26069-blue" />
<img src="https://img.shields.io/badge/Status-Active%20Development-brightgreen" />
<img src="https://img.shields.io/badge/Frontend-Next.js-black" />
<img src="https://img.shields.io/badge/Backend-FastAPI-009688" />
<img src="https://img.shields.io/badge/Database-PostgreSQL%20%2B%20PostGIS-336791" />
</p>

🌍 **A unified platform for weather monitoring, analytics, citizen observations and situational awareness across India.**

</div>

---

## 🧭 Overview

**BYTEFORCE** is a full-stack weather intelligence and analytics platform designed to bring together:

- 🌦️ Real weather observations
- 📡 Forecasts and weather feeds
- 🗺️ Geospatial weather visualization
- 🚨 Weather anomaly detection
- 👥 Citizen weather reports
- 🧠 Event fusion and confidence scoring
- ✅ Verification workflows
- 📊 Weather analytics
- 🔎 Data provenance
- 🩺 Source-health monitoring
- 🔐 Secure Email OTP authentication

BYTEFORCE is being developed around:

> 🏆 **Smart India Hackathon 2026**
> **Problem Statement:** SIH26069
> **Title:** National Weather Big Data Analytics Platform

---

# 🌍 The Problem

Weather information is often fragmented across:

- Meteorological APIs
- Forecast systems
- Rainfall datasets
- Observation stations
- Warning bulletins
- Maps
- Satellite products
- Citizen observations

This creates challenges such as:

❌ Fragmented information
❌ Inconsistent data formats
❌ Difficult state/district analysis
❌ Limited event correlation
❌ Delayed identification of local weather events
❌ Lack of unified verification
❌ Limited data provenance
❌ Difficulty converting raw weather data into actionable intelligence

---

# 💡 BYTEFORCE Solution

BYTEFORCE creates a unified weather intelligence layer:

```text
Weather APIs
+
Citizen Reports
+
Historical Data
↓
Data Ingestion
↓
Normalization
↓
PostgreSQL / PostGIS
↓
Analytics & Anomaly Detection
↓
Event Fusion
↓
Verification
↓
Weather Intelligence
```

---

# ✨ Key Features

## 🌦️ Weather Intelligence

- 🌡️ Temperature monitoring
- 💧 Humidity monitoring
- 🌧️ Rainfall analysis
- 💨 Wind speed and direction
- 🧭 Atmospheric pressure
- ☁️ Weather-condition monitoring
- 📅 Forecast visualization
- 📈 Historical weather trends

---

## 🗺️ Interactive Weather Map

Powered by **Leaflet + OpenStreetMap**.

Supports:

- 📍 Weather observation markers
- 🌦️ Weather events
- 🚨 Severity markers
- 👥 Citizen reports
- 🔥 Density visualization
- 🧩 Marker clustering
- 🗺️ State and district exploration
- 🔍 Geographic filtering

---

## 📊 Analytics Dashboard

BYTEFORCE provides analytical views for:

- 🌡️ Temperature trends
- 🌧️ Rainfall trends
- 💧 Humidity trends
- 💨 Wind analysis
- 🧭 Pressure analysis
- 🚨 Weather-event statistics
- 🗺️ Regional summaries
- 📡 Source distribution
- 🎯 Event confidence
- ✅ Verification statistics

Charts are rendered using **Recharts**.

---

# 🚨 Weather Anomaly Detection

BYTEFORCE can identify abnormal conditions such as:

- 🌧️ Extreme rainfall
- 🔥 High temperature
- ❄️ Unusually low temperature
- 💨 Strong winds
- 📉 Rapid pressure variations
- ⚠️ Abnormal weather patterns

Detection may use:

- Rule-based thresholds
- Statistical analysis
- Historical baselines
- Machine-learning models where appropriate

> BYTEFORCE-generated anomalies are clearly distinguished from official meteorological warnings.

---

# 🧠 Event Fusion Engine

Multiple pieces of evidence can be combined into one weather event.

```text
Weather Observation
+
Citizen Report
+
Weather Anomaly
+
Supporting Evidence
↓
Event Fusion
↓
Consolidated Event
↓
Confidence Score
↓
Verification
```

Fusion considers:

- 📍 Geographic proximity
- ⏱️ Temporal proximity
- 🌦️ Event type
- 🔗 Source diversity
- 📊 Observation consistency
- 👥 Citizen evidence

---

# 👥 Citizen Weather Reporting

Citizens can report:

- 🌧️ Heavy rainfall
- 🌊 Waterlogging
- 🏘️ Flooding
- 💨 Strong winds
- ⛈️ Thunderstorms
- 🔥 Extreme heat
- ⚠️ Weather-related damage

Reports may include:

- Event category
- Description
- Location
- Observation time
- 📷 Images
- 🎥 Videos
- Optional contact information

Citizen reports remain:

> ⚠️ **UNVERIFIED CITIZEN REPORT**

until corroborated or reviewed.

---

# ✅ Verification Workflow

Possible event states:

```text
UNVERIFIED
↓
UNDER REVIEW
↓
CORROBORATED
↓
VERIFIED
```

Reports may also be:

```text
REJECTED
```

Verification records can include:

- 👤 Reviewer
- ⏱️ Timestamp
- 📎 Evidence
- 📝 Reason
- ✅ Decision
- 📚 Audit history

---

# 🔐 Secure Email OTP Authentication

BYTEFORCE uses passwordless authentication.

```text
User Email
↓
FastAPI generates OTP
↓
OTP hash stored
↓
Resend sends OTP
↓
User enters OTP
↓
Backend verifies OTP
↓
Secure JWT session
↓
BYTEFORCE Dashboard
```

Security features:

- 🔢 6-digit OTP
- ⏳ OTP expiration
- 🔄 Resend cooldown
- 🛑 Verification attempt limits
- 🍪 Secure HttpOnly cookies
- 🔑 JWT authentication
- 👤 Role-based access control

---

# 👤 User Roles

### 👥 Citizen / Public User

- View weather information
- Check forecasts
- Track local weather events
- Submit citizen observations
- View nearby events

### 📊 Analyst / Researcher

- Weather analytics
- Historical analysis
- Trend exploration
- Data export
- Event analysis

### ✅ Verifier

- Review submitted reports
- Examine evidence
- Verify events
- Manage verification status

### 🛡️ Administrator

- User management
- Role management
- Data-source configuration
- System monitoring
- Audit logs
- Platform administration

---

# 🏗️ System Architecture

```text
┌─────────────────────────┐
│ WEATHER DATA SOURCES │
│ │
│ Open-Meteo │
│ IMD APIs (planned) │
│ MOSDAC / Other Sources │
└───────────┬─────────────┘
│
▼
┌─────────────────────┐
│ DATA INGESTION │
└──────────┬──────────┘
│
▼
┌─────────────────────┐
│ NORMALIZATION │
└──────────┬──────────┘
│
▼
┌─────────────────────┐
│ PostgreSQL/PostGIS │
└──────────┬──────────┘
│
┌────────────┼────────────┐
▼ ▼ ▼
📊 Analytics 🚨 Events 🧠 Anomalies
│ │ │
└────────────┼────────────┘
▼
┌────────────────┐
│ FastAPI │
└───────┬────────┘
│
▼
┌────────────────┐
│ Next.js │
└───────┬────────┘
│
┌───────┼────────┐
▼ ▼ ▼
🗺️ Map 📊 Charts 🚨 Alerts
```

---

# 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| 🎨 Frontend | Next.js, React, TypeScript |
| ⚡ Backend | FastAPI, Python |
| 🗃️ ORM | SQLAlchemy |
| 🗺️ Maps | Leaflet, OpenStreetMap |
| 📊 Charts | Recharts |
| 🗄️ Development DB | SQLite |
| 🐘 Production DB | PostgreSQL |
| 🌍 Geospatial DB | PostGIS |
| 🔐 Authentication | JWT + HttpOnly Cookies |
| 📧 OTP Email | Resend |
| 🌦️ Weather | Open-Meteo |
| 📡 Official Weather | IMD API integration planned |
| 🔄 Real-time Updates | WebSocket / SSE |
| ☁️ Frontend Hosting | Vercel |

---

# 📸 Platform Preview

> Add actual screenshots from BYTEFORCE here.

### 🏠 National Weather Dashboard

![BYTEFORCE Dashboard](docs/images/dashboard.png)

### 🗺️ Interactive Weather Map

![Weather Map](docs/images/weather-map.png)

### 📊 Analytics

![Analytics Dashboard](docs/images/analytics.png)

### 👥 Citizen Reporting

![Citizen Report](docs/images/citizen-report.png)

### ✅ Verification Queue

![Verification Queue](docs/images/verification.png)

---

# 📡 Real-Time Data Pipeline

```text
Weather Provider
↓
Background Worker
↓
Validate
↓
Normalize
↓
Database
↓
Analyse
↓
Detect Anomaly
↓
Correlate Events
↓
Update Dashboard
```

The ingestion system is designed to operate independently of browser activity.

---

# 🩺 Source Health Monitoring

BYTEFORCE tracks the health and freshness of external data sources.

| Data Source | Status |
|---|---|
| 🌦️ Open-Meteo | 🟢 Configurable / Active |
| 👥 Citizen Reports | 🟢 Application Generated |
| 🇮🇳 IMD API | 🟡 Access Dependent |
| 🛰️ MOSDAC | 🔵 Planned |

Possible provider states:

```text
🟢 HEALTHY
🟡 DEGRADED
🟠 STALE
🔴 OFFLINE
```

BYTEFORCE does **not generate fake weather values** when a provider becomes unavailable.

---

# 🔎 Data Provenance

Every weather event can be traced through its processing pipeline.

```text
Data Source
↓
Raw Observation
↓
Normalization
↓
Analytics
↓
Anomaly Detection
↓
Event Association
↓
Verification
↓
Final Weather Event
```

---

# 📈 Forecast Verification

BYTEFORCE architecture supports forecast-vs-observation analysis.

Metrics can include:

- MAE
- RMSE
- Bias
- Absolute Error

Example:

```text
Forecast Temperature : 31.2°C
Observed Temperature : 32.0°C
Error : +0.8°C
```

---

# 🤖 Machine Learning

BYTEFORCE can support ML-based weather anomaly detection.

Potential models:

- 🌲 Isolation Forest
- 🌳 Random Forest
- 🚀 XGBoost
- ⏱️ Time-Series Models

Potential features:

```text
temperature
humidity
rainfall
pressure
wind speed
wind direction
time
location
rainfall accumulation
pressure change
temperature variation
```

> Where no trained model is deployed, BYTEFORCE uses transparent rule-based and statistical analytics.

---

# 🗃️ Core Database Entities

```text
👤 users
🔐 email_otps
📡 weather_stations
🌦️ weather_observations
📅 weather_forecasts
🚨 weather_warnings
🧠 weather_anomalies
👥 citizen_reports
🌪️ consolidated_events
📎 event_evidence
✅ verification_actions
🩺 provider_health
📚 audit_logs
```

---

# 🔌 API Overview

```http
GET /api/weather/current
GET /api/weather/history
GET /api/weather/forecast

GET /api/stations

GET /api/events
GET /api/events/{id}

GET /api/anomalies

GET /api/providers/health

GET /api/analytics/overview

POST /api/citizen-reports

POST /api/auth/send-otp
POST /api/auth/verify-otp
POST /api/auth/logout

GET /api/auth/me
```

---

# ⚙️ Environment Variables

Create a `.env` file.

```env
DATABASE_URL=

JWT_SECRET=

RESEND_API_KEY=
EMAIL_FROM=

OTP_EXPIRY_MINUTES=5

OPEN_METEO_BASE_URL=https://api.open-meteo.com

IMD_API_KEY=
```

⚠️ **Never commit real secrets or `.env` files to GitHub.**

---

# 💻 Local Development

## 📥 Clone

```bash
git clone <YOUR_REPOSITORY_URL>
cd byteforce
```

---

## 🎨 Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## ⚡ Backend

```bash
cd backend

python -m venv venv
```

### macOS / Linux

```bash
source venv/bin/activate
```

### Windows

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload
```

Backend:

```text
http://localhost:8000
```

Swagger API Docs:

```text
http://localhost:8000/docs
```

---

# 🐳 PostgreSQL / PostGIS

For Docker-based database setup:

```bash
docker compose up -d
```

BYTEFORCE can use:

```text
SQLite
```

for lightweight local development and:

```text
PostgreSQL + PostGIS
```

for production and geospatial processing.

---

# 🚀 Deployment

```text
GitHub
│
┌─────────┴─────────┐
▼ ▼

Vercel Backend Hosting
│ │
Next.js FastAPI
│
▼
PostgreSQL/PostGIS
```

### 🎨 Frontend

**Vercel**

### ⚡ Backend

Possible options:

- Render
- Railway
- VPS / Cloud Server

### 🗄️ Database

- PostgreSQL
- PostGIS

### 📧 Email

- Resend

### 🗺️ Maps

- OpenStreetMap

---

# 📊 Data Authenticity

BYTEFORCE clearly distinguishes data according to its origin.

### 🌦️ External Weather Data

Obtained from configured legitimate weather APIs.

### 👥 Citizen Data

Submitted directly by BYTEFORCE users.

### 🧠 BYTEFORCE Analytics

Generated independently through analytics, statistical methods and event-processing logic.

### 🇮🇳 Official IMD Information

Displayed as official IMD information **only after authorized IMD integration is available**.

> BYTEFORCE never relabels simulated information as real weather observations.

---

# ⚠️ Disclaimer

BYTEFORCE is an independent academic technology project.

It is **not an official product of or affiliated with the India Meteorological Department, Ministry of Earth Sciences, ISRO, or Government of India**, unless explicitly stated otherwise.

Official warnings and emergency instructions should always be verified through the appropriate government authority.

BYTEFORCE analytical outputs are intended to support situational awareness and research and should not replace official emergency guidance.

---

# 🎯 Project Goals

- 🌍 Unified weather-data access
- 🗺️ National weather visualization
- ⚡ Near-real-time analytics
- 🚨 Weather anomaly detection
- 👥 Citizen-assisted situational awareness
- 🧠 Multi-source event fusion
- ✅ Weather-event verification
- 📊 Research-oriented analytics
- 🔎 Evidence-based decision support
- ☁️ Scalable weather intelligence infrastructure

---

# 🔮 Future Scope

- 🇮🇳 Authorized IMD API integration
- 🛰️ MOSDAC satellite integration
- 📡 Radar visualization
- ⚡ Lightning intelligence
- 🤖 Advanced ML anomaly detection
- 📈 Forecast verification
- 📱 Mobile application
- 🌐 Multilingual interface
- 🔔 Push notifications
- 📲 SMS emergency notifications
- 🚨 CAP-compatible alerts
- 🌪️ Advanced event forecasting
- 🛰️ Satellite + radar fusion
- ⚙️ Distributed ingestion workers
- 🗺️ Expanded state/district analytics

---

# 🏆 Smart India Hackathon 2026

| Field | Details |
|---|---|
| 🆔 Problem Statement | **SIH26069** |
| 📌 Title | **National Weather Big Data Analytics Platform** |
| 🖥️ Category | **Software** |
| 🌦️ Domain | **Weather / Big Data / Analytics** |
| 🚀 Project | **BYTEFORCE** |

---

# 📚 References & Technologies

- 🇮🇳 India Meteorological Department
- 🌍 Ministry of Earth Sciences
- 🌦️ Open-Meteo
- 🛰️ MOSDAC / ISRO
- 🗺️ OpenStreetMap
- 🍃 Leaflet
- ⚡ FastAPI
- ▲ Next.js
- 🐘 PostgreSQL / PostGIS
- 📧 Resend

---

# 👨‍💻 Team BYTEFORCE

Developed by students of:

### 🎓 GITAM (Deemed to be University), Visakhapatnam

---

# 🤝 Contributing

Contributions are welcome in areas including:

- 🌦️ Weather analytics
- 🗺️ Geospatial processing
- 🗃️ Data engineering
- 🤖 Machine learning
- 🎨 UI/UX
- ⚡ Backend development
- 📡 Meteorological-data integration

---

# 📄 License

Add your final license before public release.

Possible choice:

```text
MIT License
```

---

<div align="center">

# 🌦️ BYTEFORCE

### National Weather Intelligence & Analytics Platform

**🌍 Observe • 📊 Analyse • ✅ Verify • 🚨 Respond**

Built for smarter weather intelligence and a more resilient India. 🇮🇳

</div>
