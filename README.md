# Civic Flow — Election Process Education

Civic Flow is a lightweight, interactive, and fully accessible web-based assistant designed to demystify the democratic voting journey. From registering to vote, researching candidates safely, to knowing exactly where and when to vote on Election Day, Civic Flow serves as a comprehensive educational hub for civic engagement.

---

## 🎯 Challenge Requirements Fulfillment

### 1. Chosen Vertical: Election Process Education
The application is entirely dedicated to civic education. It provides an **AI-powered Civic Assistant** and a step-by-step guide through:
- State-specific voter registration deadlines and portals.
- Nonpartisan candidate research resources (with active safety tips against misinformation).
- Polling day preparation (required IDs, what to bring, and what is prohibited).

### 2. Approach: Data-Driven Assistance
Civic Flow leverages **six Google Services** to provide hyper-local, real-time data. Rather than generic advice, users input their address and immediately receive tailored information about their specific upcoming elections, early voting sites, and ballot drop-off locations.

### 3. Meaningful Google Services Integration

| Service | Module | Integration Type |
|---|---|---|
| **Civic Information API** | `api.js` | `fetch()` to `googleapis.com/civicinfo/v2` for real-time election data |
| **Google Maps JS API** | `api.js` | Dynamic `<script>` loading, `Geocoder`, `Map`, `Marker` rendering |
| **Google Calendar** | `api.js` | Template URL generation for one-click event creation |
| **Google Gemini API** | `api.js` | `fetch()` to `generativelanguage.googleapis.com` for AI chat |
| **Google Identity Services** | `auth.js` | Lazy-loaded GIS for OAuth Sign-In; JWT decoding |
| **Firebase Firestore** | `storage.js` | REST API writes gated behind authentication |
| **Google Analytics 4** | `app.js` | `gtag.js` tracking `search`, `ai_query`, `login`, `save_plan` events |

### 4. Assumptions
- **Valid Residential Address**: The core lookup functionality assumes the user inputs a valid U.S. residential street address.
- **Modern Browser**: Chrome, Firefox, Safari, or Edge with JavaScript enabled.
- **API Availability**: Live data relies on the configured Google APIs being online.

---

## 🚀 How to Run the App

Civic Flow is completely portable with **zero heavy build dependencies**. Total project size: **< 100 KB**.

### Prerequisites
- A modern web browser.
- (Optional) A local web server. If you have Node.js: `npx serve .`

### Step-by-Step Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/election-civic-guide.git
   cd election-civic-guide
   ```

2. **Configure API Keys**
   ```bash
   cp config.js.template config.js
   ```
   Edit `config.js` and replace each `YOUR_*` placeholder with your actual keys from the [Google Cloud Console](https://console.cloud.google.com/).

3. **Launch the Application**
   - **Method A:** Double-click `index.html` to open in your browser.
   - **Method B:** Run a local server:
     ```bash
     npx serve .
     ```
     Then open `http://localhost:3000`.

4. **Run the Test Suite**
   Add `<script src="test.js"></script>` to the bottom of `index.html`, refresh the page, and open the Developer Console (F12). All tests run in-browser with mocked APIs — **no network calls required**.

---

## 🛠️ Architecture & Modules

```
election-civic-guide/
├── index.html              # Main HTML with GA4 snippet & GIS Sign-In button
├── config.js.template      # Secure API key template (never committed)
├── test.js                 # Comprehensive test suite (16+ tests)
├── Dockerfile              # Cloud Run deployment (nginx:alpine)
├── src/
│   ├── config.js           # Centralised key resolver for all 6 services
│   ├── api.js              # Civic Info, Maps, Calendar, Gemini API calls
│   ├── auth.js             # Google Identity Services (lazy-loaded)
│   ├── storage.js          # Firebase Firestore REST (auth-gated)
│   ├── ui.js               # DOM rendering, chat interface, map container
│   ├── app.js              # Bootstrapper, event wiring, GA4 analytics
│   └── styles.css          # Design system & high-contrast theme
└── .gitignore              # Excludes config.js & .env files
```

---

## 🔒 Security Implementation

### API Key Management
- **No keys are ever hardcoded.** All keys are resolved at runtime from `config.js` (which is `.gitignore`-d) or from the in-browser UI input fields.
- Input sanitisation strips HTML tags and control characters to prevent XSS.
- API requests use `AbortController` timeouts and rate limiting to prevent abuse.

### Firestore Security Rules (Auth-Required)
The following rules **must** be deployed to your Firebase project to enforce data isolation and prevent unauthorized access:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Election plans: users can only access their own data
    match /electionPlans/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId
                         && request.resource.data.keys().size() < 20
                         && request.resource.data.address is string
                         && request.resource.data.address.size() < 500;
    }

    // Default: deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Risk vectors addressed:**
- Unauthenticated writes → blocked by `request.auth != null`
- Cross-user data access → blocked by `request.auth.uid == userId`
- Oversized payloads → blocked by `keys().size() < 20` and `size() < 500`

### Authentication Flow
- The GIS script is **lazy-loaded** only when the user clicks "Sign In", minimising initial page load.
- JWT tokens are decoded client-side for display; in production they should be verified server-side.

---

## ♿ Accessibility & Performance

- **WCAG 2.1 Compliant**: All interactive elements have `aria-label` attributes. The Sign-In button includes `aria-label="Sign in with Google to save your election plan"`.
- **High Contrast Mode**: A persistent toggle saves preference to `localStorage`.
- **Semantic HTML**: Proper `<header>`, `<main>`, `<section>`, `<footer>` structure.
- **Performance**: All external scripts (`gtag.js`, GIS, Maps) use `async`/`defer` to avoid render blocking. Firestore uses the lightweight REST API instead of the full SDK (~80KB saved).

---

*Built with ❤️ for civic education.*
