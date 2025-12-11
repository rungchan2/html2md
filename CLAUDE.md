# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**html2md** is a Chrome Extension (Manifest V3) that allows users to visually select sections of web pages and convert them to Markdown format. The target users are developers who frequently need to copy documentation or web content into AI tools like Claude Code.

## Current Status

This is a **planning-stage repository** - only documentation exists, no implementation yet. The actual Chrome extension needs to be built according to the PRD in README.md.

## Planned Architecture

### Extension Structure (to be implemented)
```
html2md/
├── manifest.json         # Manifest V3 configuration
├── background.js         # Service worker for extension lifecycle
├── content.js            # Content script injected into web pages
├── content.css           # Styles for highlight overlays and UI
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── lib/
│   └── turndown.js       # HTML to Markdown conversion library
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Core Components (to be implemented)

1. **Selection Mode System** (`content.js`)
   - Toggle via `Cmd+Shift+M` or extension icon
   - Hover highlighting with visual feedback
   - Multi-select with `Shift+Click`
   - Range adjustment with `Shift+↑/↓` for parent/child elements
   - Selection state management

2. **HTML to Markdown Conversion** (`lib/turndown.js`)
   - Use Turndown.js for reliable conversion
   - Add turndown-plugin-gfm for table support
   - Custom rules for code block language detection
   - Site-specific rules for GitHub, MDN, React Docs

3. **Export Functionality** (`content.js`, `background.js`)
   - Copy to clipboard via Clipboard API
   - Download as `.md` file with naming format: `{PageTitle}_{YYYYMMDD}.md`

4. **UI Components** (`content.css`, Shadow DOM)
   - Hover highlight: `2px dashed #3B82F6` with `rgba(59, 130, 246, 0.1)` background
   - Selected state: `2px solid #3B82F6` with `rgba(59, 130, 246, 0.15)` background
   - Top notification bar for instructions
   - Floating action popup near selection
   - Toast notifications for feedback

## Key Technical Considerations

### 1. DOM Element Selection
- Prioritize semantic elements: `article`, `section`, `main`, `pre`, `table`, `ul`, `ol`, `blockquote`
- Handle arbitrary DOM structures across different websites
- Implement parent/child traversal for range adjustment

### 2. Code Block Language Detection
Multiple detection strategies needed:
```javascript
// Check class: .language-*, .lang-*
// Check data attributes: data-lang, data-language
// Check parent element classes
// Site-specific rules for GitHub, MDN, etc.
```

### 3. Style Isolation
- Use Shadow DOM for UI components to prevent CSS conflicts
- Use highly specific selectors with `!important` for overlays
- Avoid inline styles where possible

### 4. Site-Specific Handling
Different sites need custom rules:
- **GitHub**: Already markdown-rendered, complex code block structure
- **MDN**: Multi-language tabs, nested sections
- **React Docs**: RSC-built, interactive examples
- **Notion**: Custom block structure

### 5. Edge Cases
- SPA navigation: Monitor URL changes with MutationObserver
- iframes: Only same-origin accessible (cross-origin blocked by security)
- Dynamic content: Handle lazy-loaded sections
- CSS conflicts: Use Shadow DOM and specific selectors

## Required Dependencies

When implementing:
- **Turndown.js**: Core HTML to Markdown conversion (~8KB gzipped)
- **turndown-plugin-gfm**: GitHub Flavored Markdown support (tables, strikethrough)

## Manifest V3 Permissions

```json
{
  "permissions": ["activeTab", "clipboardWrite", "downloads"],
  "commands": {
    "toggle-selection-mode": {
      "suggested_key": {
        "default": "Ctrl+Shift+M",
        "mac": "Command+Shift+M"
      }
    }
  }
}
```

## Development Workflow (once implemented)

### Testing the Extension
```bash
# Load unpacked extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the project directory
```

### Testing on Target Sites
Prioritize testing on:
- MDN Web Docs (developer.mozilla.org)
- React Documentation (react.dev)
- GitHub (github.com)
- Stack Overflow (stackoverflow.com)

## Implementation Priority

### MVP (v1)
1. Basic selection mode toggle
2. Single element selection with hover highlight
3. Basic HTML to Markdown conversion using Turndown
4. Copy to clipboard functionality
5. ESC to cancel

### v1.5
1. Multi-select with Shift+Click
2. Parent/child range adjustment (Shift+↑/↓)
3. Download as .md file
4. Code block language detection
5. Top notification bar with instructions

### v2 (Future)
- Markdown preview before export
- Custom conversion rules in settings
- Site-specific presets
- Full page conversion option
- Conversion history

## Notes for Future Implementation

- Keep the solution simple - avoid over-engineering
- Use Turndown.js instead of custom HTML parser
- Test on real documentation sites early
- Handle CSS conflicts with Shadow DOM from the start
- Focus on semantic HTML elements for selection
