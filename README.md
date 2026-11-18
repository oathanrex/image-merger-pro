# Image Merger Pro 🖼️⚡

> **Precision client-side image stitching, grid collage creator, overlay compositor, and size-optimized export studio.** Everything executes directly in your browser using HTML5 Canvas — zero server uploads, 100% private, no watermarks, and free forever.

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-168f67?style=for-the-badge&logo=github)](https://oathanrex.github.io/image-merger-pro/)
[![Built With React 19](https://img.shields.io/badge/React-19.0.1-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3.0-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38b2ac?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 🚀 Live Studio
Access the application instantly without installation:
👉 **[https://oathanrex.github.io/image-merger-pro/](https://oathanrex.github.io/image-merger-pro/)**

---

## ✨ Key Features & Capabilities

### 1. Dynamic Layout Modes
* **Horizontal Stitching (Side-by-Side)**: Combine before/after comparisons, product angles, or panoramic photos side-by-side with uniform heights or original dimensions.
* **Vertical Stacking**: Create long-strip webtoons, mobile screenshots, infographics, or step-by-step tutorial sequences.
* **Smart Grid Collage**: Build structured $M \times N$ matrix grids with custom column counts, gap spacing, and outer margins.
* **Freeform Layered Overlay**: Full-featured compositor with draggable layers, free positioning, opacity blending, rotation, and z-index reordering.

### 2. Deep Image Transformations & Editing
* **Precision Cropping**: Freeform crop or locked aspect ratios (`1:1 Square`, `4:3`, `16:9 Cinema`, `9:16 Story/Reel`).
* **Non-Destructive Filters**: Adjust brightness, contrast, saturation, sharpness, grayscale, sepia, and invert with live feedback.
* **Transform Controls**: One-click 90° clockwise/counter-clockwise rotations, horizontal flips, and vertical flips.
* **Edge Alignment**: Smart snapping to top, center, bottom, left, or right edges.

### 3. Bulk & Batch Operations
* **Batch Renaming**: Pattern-based renaming with prefix, suffix, and auto-incrementing index tokens.
* **Batch Color & Filter Tuning**: Apply uniform visual styles or watermarks across all uploaded source images at once.
* **Batch ZIP Export**: Process, crop, filter, and compress multiple photos simultaneously and download as a single organized `.zip` package.

### 4. Advanced Export Engine
* **Formats Supported**: Export to high-resolution **PNG**, size-tuned **JPEG**, modern **WebP**, or multi-page/single-sheet **PDF**.
* **Target File Size Compressor**: Specify a strict budget in Kilobytes (e.g., `< 500 KB` or `< 1 MB`) — the engine performs automated binary search compression to find the optimal quality ceiling.
* **Instant Clipboard Copy**: Copy composite graphics directly to your system clipboard (`Ctrl+C`) for immediate pasting into Discord, Slack, Figma, or Word.
* **Zero Watermarks**: Clean, studio-grade outputs with no logos or hidden artifacts.

### 5. 100% Privacy Guarantee
* **No Server Processing**: Every single pixel operation runs client-side via hardware-accelerated HTML5 Canvas contexts.
* **Zero Cloud Storage**: Your sensitive receipts, personal photos, or proprietary assets never leave your local browser sandbox.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Ctrl` + `Z` / `Cmd` + `Z` | **Undo** | Reverts the last layout, transform, or setting change. |
| `Ctrl` + `Y` / `Cmd` + `Shift` + `Z` | **Redo** | Restores the previously reverted state. |
| `Ctrl` + `V` / `Cmd` + `V` | **Paste Image** | Directly ingests clipboard images into the canvas tray. |
| `Ctrl` + `E` / `Cmd` + `E` | **Export Modal** | Opens the export configuration dialogue. |
| `Ctrl` + `A` / `Cmd` + `A` | **Select All** | Selects all images in the source tray for batch actions. |
| `Delete` / `Backspace` | **Remove Selected** | Removes the currently selected layer or active image. |
| `Arrow Keys` | **Nudge Layer** | Moves selected overlay layer by 1px (Hold `Shift` for 10px). |
| `?` | **Shortcuts Dialog** | Displays the full shortcut cheat sheet. |

---

## 🏗️ Technical Architecture

```
image-merger-pro/
├── .github/workflows/
│   └── deploy.yml            # Automated CI/CD pipeline deploying to GitHub Pages
├── public/
│   ├── .nojekyll             # Bypasses Jekyll processing on GitHub Pages
│   ├── robots.txt            # Search engine crawler permissions & directives
│   └── sitemap.xml           # XML sitemap for SEO discovery
├── src/
│   ├── components/           # Modular React 19 UI components
│   │   ├── AboutSection.tsx  # Semantic SEO & FAQ accordion component
│   │   ├── BatchPanel.tsx    # Multi-file batch transform operations
│   │   ├── ControlSidebar.tsx# Layout, dimension, border, and style settings
│   │   ├── CropModal.tsx     # Aspect-ratio locked canvas cropping dialog
│   │   ├── ExportModal.tsx   # Multi-format exporter with target KB optimizer
│   │   ├── HeaderBar.tsx     # Responsive brand navigation
│   │   ├── ImageTray.tsx     # Reorderable, flippable image strip
│   │   ├── LayerPanel.tsx    # Drag-and-drop overlay layer stack
│   │   └── PreviewViewport.tsx# Real-time hardware-accelerated canvas renderer
│   ├── types/
│   │   └── merger.ts         # Strictly typed interfaces and presets
│   ├── utils/
│   │   ├── canvasEngine.ts   # Core offscreen canvas rendering & binary compression
│   │   ├── imageMetadata.ts  # Client-side EXIF & file metadata parser
│   │   └── sampleGenerator.ts# Deterministic test canvas patterns
│   ├── App.tsx               # Root state coordinator with history snapshots
│   └── index.css             # Tailwind CSS tokens & layout utilities
├── index.html                # Enhanced SEO meta tags & Schema.org JSON-LD
├── package.json              # Dependencies & build scripts
└── vite.config.ts            # Vite bundler configuration
```

### Engineering Highlights:
* **Offscreen Canvas Rendering**: High-DPI canvas computations take place in isolated memory buffers to prevent main-thread UI jank.
* **Target Size Binary Search**: Implements a logarithmic quality convergence algorithm that delivers optimal visual fidelity within tight KB limits.
* **Full History Snapshots**: Deep undo/redo stack tracks layer positions, transforms, global borders, and layout switches.

---

## 🛠️ Local Development Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation & Run
```bash
# 1. Clone the repository
git clone https://github.com/oathanrex/image-merger-pro.git

# 2. Navigate to project root
cd image-merger-pro

# 3. Install dependencies
npm install

# 4. Start local development server
npm run dev
```

Visit `http://localhost:3000` to interact with the local studio.

### Testing & Production Build
```bash
# Typecheck TypeScript definitions
npm run lint

# Generate optimized static bundle for deployment
npm run build

# Preview production build locally
npm run preview
```

---

## 📈 Search Engine Optimization (SEO) Checklist
- [x] Schema.org `WebApplication` & `FAQPage` JSON-LD Structured Data
- [x] OpenGraph (`og:*`) & Twitter Cards (`twitter:*`) with rich previews
- [x] Self-referencing Canonical URL
- [x] Optimized `<title>` with high-intent keywords: *image combiner, photo stitcher, collage studio*
- [x] `public/robots.txt` & `public/sitemap.xml` for crawler discovery
- [x] Semantic HTML5 headings (`<header>`, `<main>`, `<section>`, `<article>`, `<footer>`)
- [x] High-contrast accessible color scheme adhering to WCAG 2.1 AA guidelines

---

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 👤 Author
Developed with ❤️ by **[Oathan Rex](https://github.com/oathanrex)**.
* **GitHub**: [@oathanrex](https://github.com/oathanrex)
* **Portfolio**: [https://oathanrex.github.io](https://oathanrex.github.io)
