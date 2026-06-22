# GeneralManager — Context & Task Manager

GeneralManager is a premium, self-contained, dependency-free Kanban board and personal context manager designed for power users, developers, and researchers running multiple AI agents, research sessions, and complex workflows. 

The application is packaged entirely inside a single HTML file (`index.html`) using vanilla HTML5, CSS3, and JavaScript, requiring no package manager, compilation, or web framework. It operates directly in the browser via the `file://` protocol or any local static web server.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Quick Start Tutorial](#quick-start-tutorial)
3. [User Documentation (Docs)](#user-documentation-docs)
4. [AI Assistant Integration](#ai-assistant-integration)
5. [Keyboard Shortcuts](#keyboard-shortcuts)
6. [Data Schema & Architecture](#data-schema--architecture)
7. [Testing & Quality Assurance](#testing--quality-assurance)
8. [Remaining Recommended Enhancements](#remaining-recommended-enhancements)

---

## Key Features

- **Linear × Vercel Inspired UI**: A premium dark-mode interface featuring frosted glass (backdrop-filter) panels, subtle radial glow effects, HSL color tokens, and smooth hover states.
- **Zero Dependencies**: Pure CSS and JavaScript. No React, no Tailwind, no external fonts or icons to download, and zero runtime console errors.
- **Flexible Context Cards**: Track different context types: Note (📝), Agent (🤖), Research (🔬), Repo (📦), URL (🔗), and Idea (💡).
- **Subtasks & Checklists**: Manage task checklists inside details modals, displaying a progress badge (e.g. `☑ 2/5`) directly on the card face.
- **Advanced Column Controls**: Right-click any column header to open a context menu to rename, change colors, move left/right (reorder), or delete safely.
- **Interactive Kanban Board**: Drag and drop cards, rename columns, and customize card priorities (HIGH, MED, LOW).
- **Quick Capture Bar**: Rapidly input tasks or notes from anywhere using `/` shortcut, with automatic URL detection.
- **Detailed Metadata Modals**: Manage checklist items, attach URLs, select models, write notes, and track timestamps (`Created` and `Modified`).
- **Archive Viewer Modal**: Accessible from the toolbar; view, search, restore, permanently delete, or empty the archive.
- **Data Portability**: Full JSON export/import supporting both database replacement and intelligent data merging.
- **Context-Aware AI Assistant Panel**: Connects to OpenAI, OpenRouter, NVIDIA NIM, or custom LLM endpoints for board analysis.

---

## Quick Start Tutorial

Follow this 2-minute step-by-step tutorial to get GeneralManager up and running.

### Step 1: Launch the Application
There are two ways to open GeneralManager:
1. **Directly**: Double-click `index.html` to open it in your browser.
2. **Local Server (Recommended)**: Serve the workspace folder with a local server, e.g.:
   ```bash
   # Using Node.js
   npx -y http-server -p 8080
   
   # Or using Python
   python -m http.server 8080
   ```
   Navigate to `http://localhost:8080` in your web browser.

### Step 2: Capture Your First Task
1. Press the `/` key on your keyboard. This focuses the **Quick Capture Bar** at the top.
2. Type: `Research GPT-4o context caching benefits`
3. Click the type dropdown and choose **🔬 Research**, then click **+ Add** (or press `Enter`).
4. The card will appear at the bottom of the first column (`TODO` or `BACKLOG`).

### Step 3: Add Checklists and Notes
1. Click on the card you just created. The **Detail Modal** will open.
2. Under **Checklist**, type `Check API documentation` in the input and click **+ Add** (or press Enter).
3. Under **Priority**, select **🔴 High**.
4. In the **URL** field, paste: `https://openai.com/news/`
5. Click **Save Changes**. You will see the red high-priority badge, URL link, and the progress badge `☑ 0/1` appear on the card.

### Step 4: Move and Organize
1. Drag the card from the first column and drop it into the `ACTIVE` column.
2. Alternatively, right-click the card to open the **Context Menu** and choose **Move to...** -> **ACTIVE**.
3. Right-click the `ACTIVE` column header and select **Set Color Accent** -> **Pink** to visually separate your active work.

### Step 5: Archive and Restore
1. Once completed, move the card to the `DONE` column.
2. Click **🧹 Clear Done** in the toolbar to archive all finished tasks.
3. To view or restore it, click **📦 Archive** in the toolbar, find your task, and click **Restore**.

---

## User Documentation (Docs)

### Managing Columns
- **Rename**: Double-click any column title, type a new name, and press `Enter` or click outside to save. Alternatively, right-click the header and choose **✏️ Rename Column**.
- **Move Columns (Reorder)**: Right-click any column header and select **◀ Move Left** or **▶ Move Right** to rearrange column order horizontally.
- **Color Accent**: Right-click the column header, select **Set Color Accent**, and choose a theme (Purple, Blue, Green, Yellow, Pink, Gray) to change its top border accent color.
- **Delete Column**: Right-click the column header and select **🗑 Delete Column**. If the column contains active cards, the system will warn you and prompt for confirmation before deleting.
- **Add Column**: Click the dashed `+` card at the far right of the board. Enter the column name when prompted. The board supports up to 8 columns.

### Managing Cards
- **Create**: 
  - *Quick Capture*: Enter a title, choose a type, and click **+ Add**. If the text starts with `http://` or `https://`, it is automatically detected as a **URL** type.
  - *Column Quick-Add*: Click **+ Add card** at the bottom of any column.
- **Checklists**: Open the details modal of a card, input a subtask, and add it. Checkboxes can be toggled inside the modal (with line-through styling).
- **Edit**: Click any card to open its detail modal to edit details, add notes, change column, or assign a model tag (e.g., `gpt-4o`).
- **Cycle Priority**: Click directly on the priority badge (`HIGH` / `MED` / `LOW`) on the card face to cycle through priorities quickly.
- **Duplicate**: Right-click a card and select **📋 Duplicate** to clone it.
- **Delete**: Right-click a card and select **🗑 Delete** (or click Delete in the modal).
- **Archive**: Right-click a card and select **📦 Archive** (or click Archive in the modal) to hide it from the active board.

### Archive Modal
- Click the **📦 Archive** button in the toolbar.
- Search archived cards by keyword.
- Restore cards back to their original column (or the first column if the original was deleted).
- Permanently delete single cards or click **Empty Archive** to wipe all archived data.

### Filters and Search
- **Text Search**: Type into the search input in the toolbar to live-filter cards by title or notes.
- **Type Filtering**: Click on the type icons (🤖, 🔬, 📦, 🔗, 📝, 💡) in the toolbar to display only cards of that type.
- **Priority Filtering**: Filter cards by `High`, `Med`, or `Low` badges.

---

## AI Assistant Integration

The AI Assistant panel processes your local board state and communicates with standard language model API endpoints to assist with workflows.

### Setting Up Connection
1. Click the **🧠 AI** button in the top-right (or press key `A`).
2. Select an API Preset: **OpenAI**, **OpenRouter**, **NVIDIA NIM**, or **Custom**.
3. Enter your **API Key**. (Toggle visibility using the 👁 icon).
4. Specify your model (e.g., `gpt-4o-mini`, `google/gemini-2.5-pro`).
5. Click **🔌 Test Connection**.

*Note: Your credentials are saved locally in your browser's secure `localStorage` and never sent to any third-party server besides the Base URL you specify.*

---

## Keyboard Shortcuts

The app contains global keyboard listeners to optimize power-user speed:

| Key | Action | Scope |
| --- | --- | --- |
| `/` | Focuses the Quick Capture input field | Global (when not typing in other inputs) |
| `A` / `a` | Toggles the AI Assistant sidebar | Global (when not typing in other inputs) |
| `Esc` | Closes active detail modal, archive modal, or context menu | Modals / Context Menu |
| `Enter` | Submits input / saves title edits | During text editing or capture |

---

## Data Schema & Architecture

The application state is structured as follows:

### 1. Board State
Stored in `localStorage` under `gm_board` as a JSON string.
```typescript
interface BoardState {
  columns: Column[];  // Ordered list of columns
  cards: Card[];      // All active cards
  meta: Meta;         // Metadata (board title, last captured card type)
}

interface Column {
  id: string;         // UUID (crypto.randomUUID)
  name: string;       // Display name (e.g., "ACTIVE")
  order: number;      // Sort index (0-based)
  color?: string;     // Accent color name preset (e.g., "PINK")
}

interface Card {
  id: string;         // UUID
  columnId: string;   // Foreign Key → Column.id
  type: 'AGENT' | 'RESEARCH' | 'REPO' | 'URL' | 'NOTE' | 'IDEA';
  title: string;      // Task text
  url?: string;       // Optional link
  notes?: string;     // Optional detailed notes
  priority: 'HIGH' | 'MED' | 'LOW';
  aiModel?: string;   // Optional model tag
  order: number;      // Sort within the column
  createdAt: number;  // Epoch timestamp
  updatedAt: number;  // Epoch timestamp
  subtasks?: Subtask[]; // Checklist items
}

interface Subtask {
  id: string;         // UUID
  text: string;       // Subtask text
  done: boolean;      // Status
}
```

---

## Testing & Quality Assurance

The application underwent automated E2E testing using Chromium via Puppeteer.

### Verified Test Path
1. **Checklist Subtasks**: Verified that adding subtasks dynamically updates the progress indicator badge (`0/1` -> `1/1` upon checking) on the card face.
2. **Column Context Menu**: Checked that right-clicking column headers displays options. Successfully verified the **Pink** color theme and column shifting.
3. **Archive Modal**: Verified that archiving a card moves it out of the board array, shows it inside the Archive Modal list, and that clicking **Restore** restores it back to the correct column.
4. **Zero Runtime Errors**: Evaluated console logs during E2E verification to confirm clean browser runtime.

---

## Remaining Recommended Enhancements

If you decide to extend the app, here is the final enhancement to consider:

1. **Drag-and-Drop Columns**: Allow columns to be reordered horizontally by dragging column headers directly on the board.
