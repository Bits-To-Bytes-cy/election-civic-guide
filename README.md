# Civic Flow — Election Process Education

Civic Flow is a lightweight, interactive, and fully accessible web-based assistant designed to demystify the democratic voting journey. From registering to vote, researching candidates safely, to knowing exactly where and when to vote on Election Day, Civic Flow serves as a comprehensive educational hub for civic engagement.

---

## 🎯 Challenge Requirements Fulfillment

### 1. Chosen Vertical: Election Process Education
The application is entirely dedicated to civic education. It provides a robust **"Election 101"** interactive wizard that guides users through:
- State-specific voter registration deadlines and portals.
- Nonpartisan candidate research resources (with active safety tips against misinformation).
- Polling day preparation (required IDs, what to bring, and what is prohibited).

### 2. Approach: Data-Driven Assistance
Civic Flow leverages the **Google Civic Information API** to provide hyper-local, real-time data. Rather than generic advice, users input their address and immediately receive tailored information about their specific upcoming elections, early voting sites, and ballot drop-off locations.

### 3. Meaningful Google Services Integration
The application tightly integrates three Google capabilities to provide a seamless user experience:
- **Google Civic Information API**: The core data engine providing election dates, names, and precise polling/drop-off locations based on user addresses.
- **Google Calendar**: Dynamic generation of `calendar.google.com` event templates. Users can one-click "Save to Google Calendar" to add their specific Election Day to their personal schedule, ensuring they never miss a vote.
- **Google Maps**: Every polling location, early voting site, and drop-off box returned by the API is automatically transformed into a direct Google Maps directions link (`maps.google.com/maps/search/?api=1&query=...`), allowing users to instantly find their way to the polls.

### 4. Assumptions
- **Valid Residential Address**: The core lookup functionality assumes the user inputs a valid U.S. residential street address. Zip codes alone or incomplete addresses will be gracefully rejected with a helpful error message.
- **Modern Browser**: The application assumes a modern web browser (Chrome, Firefox, Safari, Edge) with JavaScript enabled.
- **API Availability**: Live data relies on the Google Civic Information API being online and the user providing a valid API key. A "Demo Mode" is provided as a fallback if an API key is not available.

---

## 🚀 How to Run the App

Civic Flow is designed to be completely portable with **zero heavy build dependencies**. The total project size is under **100 KB**!

### Prerequisites
- A modern web browser.
- (Optional but recommended) A local web server to avoid CORS issues when fetching from the Google API. If you have Node.js installed, you can use `npx serve`. Otherwise, any simple HTTP server will work.

### Step-by-Step Instructions

1. **Clone or Download the Repository**
   Extract the project files to your local machine.

2. **Configure Your API Key**
   To use live election data, you need a Google Civic Information API key:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Enable the **Google Civic Information API**.
   - Create an API key.
   - Copy the `.env.example` file to `.env` (or set the `CIVIC_API_KEY` environment variable if using a build tool). 
   - *Alternatively, you can securely input your API key directly in the application's UI by clicking "Configure API Key".*

3. **Launch the Application**
   - **Method A (No Installation):** Simply double-click `index.html` to open it in your browser. (Note: The Google API might block requests made directly from `file://` protocols depending on your browser).
   - **Method B (Using Node.js):** Open your terminal in the project directory and run:
     ```bash
     npx serve .
     ```
     Then, open `http://localhost:3000` in your browser.

4. **Testing the Application**
   - We have included a custom, zero-dependency browser-based test suite!
   - To run the unit tests, simply open `tests/test.html` in your browser.

---

## 🛠️ Architecture & Security

- **Security**: The application never hardcodes API keys. It uses robust input sanitization to strip HTML/scripts from user inputs to prevent XSS. 
- **Efficiency**: API responses are cached for 5 minutes, and requests are rate-limited (max 1 per 2 seconds) to prevent quota exhaustion. AbortControllers cancel stale requests.
- **Accessibility**: Built with a WCAG-compliant high-contrast mode toggle, semantic HTML, and dynamic ARIA live regions for screen-reader compatibility.
- **Maintainability**: The codebase is strictly modularised (`config.js`, `apiHandler.js`, `uiController.js`, `election-wizard.js`) with comprehensive JSDoc comments.

---
*Built with ❤️ for civic education.*
