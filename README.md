# Realtime Map Sync

A real-time collaborative map synchronization tool built with **Next.js**, **React Konva**, and **PeerJS**. Enables users to share map images and collaborate with pins, drawings, and cursors in real-time without a backend server (P2P).

## 🚀 Features

### Core
*   **P2P Connection**: Serverless architecture using PeerJS. Host creates a room, Guest joins via ID.
*   **Map Sync**: Host's map image is automatically synchronized to Guests.
*   **Persistence**: Map state is saved locally using IndexedDB (restores on reliability).

### Collaboration
*   **Pins (Sticky Notes)**: Place pins with text memos. Supports drag & drop and real-time updates.
*   **Drawing (Pen Tool)**: Freehand drawing with customizable colors and widths.
*   **Cursor Tracking**: See where other users are pointing in real-time.
*   **Optimistic UI**: Instant feedback for local actions while syncing in background.

### Permission System
*   **Request/Approve**: Guests must request permission to edit.
*   **Host Control**: Host can grant, deny, or revoke permissions.
*   **Timeouts**: Permissions are granted for a specific duration (configurable) and automatically expire.

## 🛠️ Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/) (App Router)
*   **Canvas Library**: [React Konva](https://konvajs.org/docs/react/index.html)
*   **P2P Networking**: [PeerJS](https://peerjs.com/)
*   **State Management**: [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction) + [IDB-Keyval](https://github.com/jakearchibald/idb-keyval)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn/UI](https://ui.shadcn.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)

## 📦 Getting Started

### Prerequisites
*   Node.js 18+

### Installation

```bash
# Install dependencies
npm install
```

### Development Server

```bash
# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## 📖 How to Use

### Basic Operations
*   **Pan**: Drag screen or Space + Drag.
*   **Zoom**: Mouse wheel.
*   **Add Pin**: `Alt` + Click.
*   **Edit Pin**: Click pin -> Click text bubble.

### Host (Parent)
1.  Click **"部屋を作成 (Host)"**.
2.  Copy the **Peer ID** and share it with guests.
3.  Approve permission requests from guests to allow them to edit.

### Guest (Child)
1.  Click **"部屋に参加 (Guest)"**.
2.  Enter the Host's Peer ID.
3.  Click the **Lock Icon** (top right) to request edit permission.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
MIT
