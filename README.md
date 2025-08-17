<div align="center">
  <img src="icons/icon128.png" alt="SnapGPT Logo" width="128">
  <h1>SnapGPT</h1>
  <p><strong>Send screenshots to ChatGPT with a single keyboard shortcut</strong></p>
</div>

## 🚀 Overview

SnapGPT is a browser extension that simplifies sharing visual content with ChatGPT. With a single keyboard shortcut, you can:

- Capture the current tab's visible area as a screenshot
- Open ChatGPT or use an existing tab
- Automatically upload the screenshot and send it
- Organize uploads into specific ChatGPT folders

Perfect for quickly sharing errors, designs, or any visual content with ChatGPT without the hassle of manual screenshots and uploads. OR If you are working on homeword and feel too lazy to manually upload and paste.

## ✨ Features

- **One-key Screenshot & Upload**: Capture and send with a single keyboard shortcut (default: Ctrl+Shift+Y / Cmd+Shift+Y)
- **ChatGPT Folder Support**: Send screenshots to specific ChatGPT folders/conversations
- **Intelligent Tab Management**: Reuses existing ChatGPT tabs instead of creating new ones
- **Flexible Configuration**: Change keyboard shortcuts and set default folders
- **Seamless Integration**: Works with both chat.openai.com and chatgpt.com

## 🔧 Installation

### Chrome Web Store (Recommended)

1. Visit [SnapGPT on the Chrome Web Store](#) (coming soon)
2. Click "Add to Chrome"
3. Configure your preferred keyboard shortcut in the extension options

### Developer Mode

1. Clone or download this repository
2. Go to `chrome://extensions` in Chrome/Edge
3. Enable **Developer Mode** (toggle in the top-right corner)
4. Click **Load Unpacked** and select the SnapGPT folder
5. Go to `chrome://extensions/shortcuts` to customize your keyboard shortcut

## 🎮 Usage

1. Navigate to any webpage you want to share with ChatGPT
2. Press the keyboard shortcut (default: Ctrl+Shift+Y / Cmd+Shift+Y)
3. SnapGPT will capture the screen, open ChatGPT, and upload the image
4. ChatGPT will immediately receive your screenshot

### Using Folders

1. Click the SnapGPT icon in your browser toolbar
2. Select a destination folder from the dropdown menu
3. Click "Capture and Send" or use the keyboard shortcut
4. Your screenshot will be sent to the selected ChatGPT folder

## 🔄 Updating Folders

If you've created new ChatGPT folders that don't appear in SnapGPT:

1. Click the SnapGPT icon in your browser toolbar
2. Click the "Refresh Folders" button
3. SnapGPT will open ChatGPT and scan for available folders

## ⚙️ Configuration

- **Keyboard Shortcut**: Change in browser extension settings (`chrome://extensions/shortcuts`)
- **Default Folder**: Set in the popup by selecting a folder (automatically saved)
- **Additional Settings**: Access through the options page (right-click extension icon → Options)

## 🔒 Privacy

SnapGPT only captures the visible area of your current tab. The extension:

- Does not record any personal data
- Only activates when you trigger it via keyboard shortcut or popup
- Does not track your browsing history
- Only requires permissions necessary for its core functionality

## 🛠️ Technical Details

- Built with vanilla JavaScript
- Uses Chrome Extension Manifest V3
- Requires permissions: activeTab, tabs, scripting, storagenshot Uploader Extension
