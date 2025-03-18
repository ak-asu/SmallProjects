# Fun Timer Extension

A browser extension that allows you to set timers and trigger fun animations on web pages.

## Features

- Create timers with custom names and specific times
- Choose from different animation types (balloons, rockets)
- Option to repeat animations
- Support for triggering animations on active tab or all open tabs
- Simple and intuitive user interface

## Installation

1. Clone this repository or download the source code:
  ```
  git clone https://github.com/yourusername/FunTimerExtension.git
  ```

2. Install dependencies:
  ```
  cd FunTimerExtension
  npm install
  ```

3. Build the extension:
  ```
  npm run build
  ```

4. Load the extension in your browser:
  - Chrome/Edge: Go to `chrome://extensions/` or `edge://extensions/`
  - Enable "Developer mode"
  - Click "Load unpacked" and select the `dist` folder from this project

## Usage

1. Click on the extension icon in your browser toolbar
2. Configure a new timer:
  - Enter a name for your timer
  - Set the time when the animation should trigger
  - Select an animation type (balloons or rockets)
  - Choose whether to repeat the timer
  - Decide if the animation should appear on all tabs
3. Click "Add" to set the timer
4. View and manage your timers from the "Timers" tab

## Development

### Project Structure
```
├── public/                # Static files
│   ├── animations.css     # Animation styles
│   ├── background.js      # Background service worker
│   ├── contentScript.js   # Content script for animations
│   ├── manifest.json      # Extension manifest
│   └── assets/            # Animation assets
├── src/                   # React application source
│   ├── components/        # UI components
│   ├── utils/             # Utility functions
│   ├── App.js             # Main React component
│   ├── Popup.js           # Extension popup component
│   └── styles.css         # Global styles
└── webpack.config.cjs     # Webpack configuration
```

### Building for Development
For development builds with source maps:

```
npm run build -- --mode=development
```

## License

This project is licensed under the MIT License.