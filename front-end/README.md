# Amadeus Frontend

A simple, responsive web interface for interacting with the Amadeus API backend.

## Features

- 🎨 **Clean UI** - Modern, responsive design that works on desktop and mobile
- 🔄 **API Testing** - Built-in forms to test both API endpoints
- 📝 **Request History** - Keeps track of your last 20 API requests
- 💾 **Local Storage** - History is saved in the browser and persists across sessions
- ✅ **Real-time Feedback** - See responses with status codes and formatted JSON

## Quick Start

### Option 1: Simple HTTP Server (Recommended)

If you have Python installed:
```bash
# Python 3
python -m http.server 3000

# Python 2
python -m SimpleHTTPServer 3000
```

Then open `http://localhost:3000` in your browser.

### Option 2: Using Node.js

If you have Node.js installed, you can use `npx`:
```bash
npx http-server . -p 3000
```

Then open `http://localhost:3000` in your browser.

### Option 3: Direct File Access

Simply open `index.html` directly in your browser:
```bash
# On Windows
start index.html

# On macOS
open index.html

# On Linux
xdg-open index.html
```

## Usage

### 1. Say Hello Endpoint
- Enter your name in the text field
- Click "Send Request"
- You'll see the response from `/api/hello`

**Example:**
- Input: `John`
- Output: `Hello John!`

### 2. Return Parameters Endpoint
- Enter query parameters in the format: `key1=value1&key2=value2`
- Click "Send Request"
- You'll see all parameters echoed back as JSON

**Example:**
- Input: `title=MyCollection&category=Art&count=5`
- Output: Returns all parameters as JSON

### 3. Request History
- All requests are automatically saved
- View the history at the bottom of the page
- Click "Clear History" to reset

## Important Notes

⚠️ **Backend Requirements:**
- The Amadeus Java backend must be running on `http://localhost:8080`
- Make sure to start the server before using the frontend
- The frontend will warn you if the backend is not reachable

## File Structure

```
front-end/
├── index.html     # Main HTML file
├── style.css      # Styling
├── script.js      # JavaScript for API calls and UI interactions
└── README.md      # This file
```

## Troubleshooting

### Backend not reachable
- Make sure the Java server is running on port 8080
- Check the browser console for error messages
- Verify there's no firewall blocking port 8080

### CORS issues
- The frontend assumes the backend is on `http://localhost:8080`
- If you're running on a different port, edit `script.js` and change `API_BASE_URL`

### History not saving
- Check if browser has localStorage enabled
- Some browsers in private/incognito mode don't support localStorage

## Browser Compatibility

Works on all modern browsers:
- ✓ Chrome/Chromium
- ✓ Firefox
- ✓ Safari
- ✓ Edge

## Features Planned

- [ ] Integration with collection management endpoints
- [ ] Marketplace browsing interface
- [ ] User authentication
- [ ] Advanced filtering and search

## License

Part of the Amadeus project
