# Minimal QuickFS Frontend

This is a simplified version of the QuickFS frontend that maintains the same core functionality but uses vanilla HTML/JavaScript instead of SvelteKit.

## Features

- ✅ File upload via drag & drop or click
- ✅ Light/dark theme toggle
- ✅ Host page with QR code and receiver management
- ✅ Join page for file receivers
- ✅ WebSocket communication with backend
- ✅ Responsive design with Tailwind CSS
- ✅ Same Danish text and styling as original

## Simplified Architecture

- **Single HTML file** - All pages in one file with show/hide logic
- **Vanilla JavaScript** - No complex framework dependencies
- **Tailwind CDN** - No build process required
- **WebSocket Service** - Simplified class for backend communication

## Usage

1. Open `index.html` in a web browser
2. Make sure the Go backend is running on the same host
3. Upload a file to start hosting
4. Share the generated link with receivers
5. Receivers can join and download the file

## Differences from Original

- **No SvelteKit routing** - Uses single page with JavaScript navigation
- **No complex icons** - Simplified to basic SVG icons
- **No QR code library** - Placeholder QR code (can be enhanced)
- **Simplified file type detection** - Basic MIME type handling
- **No advanced animations** - Basic CSS transitions only

## To Run

Simply open `index.html` in a web browser. No build process required!

The backend API should be running on the same origin for WebSocket connections to work.

## File Structure

```
minimal-frontend/
├── index.html  # Main application file
├── app.js     # JavaScript functionality
└── README.md  # This file
```
