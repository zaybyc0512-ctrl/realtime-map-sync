# Realtime Map Sync - Project Rules & Recipes

## 1. Project Overview
Next.jsを用いた「ブラウザ完結型・リアルタイムマップ共有ツール」。
TRPGやFPSゲームの作戦会議のように、ホストとゲストが画像を共有し、その上にピンや線を書き込めるWebアプリケーション。
サーバーコストを抑えるため、PeerJSを用いたP2P通信を採用し、ホストのブラウザを親機として動作させる (Host is Truth)。

## 2. Technology Stack (Confirmed)
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI based)
- **Icons**: Lucide React (**ONLY** this for icons)
- **Canvas**: react-konva / konva
- **State Management**: Zustand
- **P2P**: PeerJS

## 3. Communication Guidelines
- **Language**: Japanese (日本語).
- **Tone**: Friendly, logical, and easy to understand.
- **Terminology**: Explain complex terms or use parenthesis for supplements.

## 4. Safety & Permissions (Strict Adherence)
1.  **Rule 1: Pre-Execution Confirmation**
    - Before creating, modifying, deleting files, or running programs, **ALWAYS** report the plan and ask for "y/n".
    - STOP execution until "y" is received.
2.  **Rule 2: Consultation on Plan Changes**
    - If the initial plan fails, DO NOT implement alternatives on your own judgment.
    - Explain the new approach and get approval first.
3.  **Rule 3: Prioritize User Intent**
    - Do not change or optimize user instructions without permission even if there's a better technical way.
    - Suggest improvements separately after implementation.

## 5. UI/UX Rules (Strict)
- **NO Emojis**: Emojis (📝, ✅, 🚀, etc.) are strictly prohibited in the user-facing interface.
- **NO Decorative Asterisks**: Do not use `*` for decoration in the UI.
- **Icons**: Always use `lucide-react` SVG icons. Use text if sufficient.

## 6. Technical Decisions form Guidelines
- **P2P & Strict Mode**: Implement robust connection handling (e.g., using `useRef` for initialization guards) to prevent duplicate connections in React Strict Mode.
- **Image Transfer**: Start with simple Base64 transfer. Optimization (chunking, etc.) is deferred (YAGNI).
- **Session Logic**: Host disconnection equals session termination. Data persistence is handled via local storage/file export.

## 7. Development Roadmap
- **Phase 1**: Local Canvas Foundation (Upload, Zoom/Pan, Pin)
- **Phase 2**: State Management & Save (Zustand, LocalStorage, JSON)
- **Phase 3**: P2P Foundation (PeerJS, Host/Guest, Sync)
- **Phase 4**: Permissions (Request, Approve/Deny, Timer)
- **Phase 5**: Extensions (Lines, Laser Pointer, Polish)
