# Changelog

## [2.1.0] - 2025-12-15

### ✨ New Features (Nuove Funzionalità)

- **Minecraft Server Widget**:
  - Added a new real-time widget to the Dashboard.
  - Displays Server Status (Online/Offline) and Player Count (Current/Max).
  - **Backend Integration**: Logic moved to Electron backend to bypass CORS issues and ensure reliability.
  - **Settings**: Added configuration fields for Server IP and Port in the Settings page.

- **Power Scheduler 2.0**:
  - **Automatic Sorting**: Tasks are now automatically sorted by Priority (Daily > Monday-Sunday) and then by Time.
  - **Improved UI**: Redesigned the "Active Schedules" list with a fixed height and internal scrolling to match the creation panel.
  - **Day Selection**: Clearer interface for selecting days (Mon-Sun).

- **Settings Cleanup**:
  - Removed unused "Appearance" and "Performance" tabs to simplify the user interface.
  - Streamlined the configuration experience.

### 🐛 Bug Fixes (Correzioni)

- **Backend Stability**:
  - Resolved critical syntax errors and proper scope handling in `main.js`.
- **Scheduler Logic**:
  - Fixed a critical bug where incorrect day names caused tasks to run every day. The scheduler now strictly validates day names.
- **Production Persistence**:
  - Fixed an issue where settings (including Scheduled Tasks) were not saving when installed via `.exe`.
  - Implemented robust `AppData` storage with automatic migration from development config.
- **System Logs**:
  - Fixed the "System Activity" log viewer looking in the wrong directory; it now correctly reads from the application log folder.

### ⚡ Improvements (Miglioramenti)

- **Dashboard Layout**: Optimized spacing and widget sizing for better use of screen real estate.
- **Performance**: Reduced frontend polling overhead for fetching server status.
