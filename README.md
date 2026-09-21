# PDF Editor

A desktop PDF editor built with Electron. I built it after my student Adobe login stopped working, and to learn Claude Code.

## Features

- **Open & view:** load any PDF and browse pages as thumbnails
- **Reorder pages:** drag and drop pages into a new order
- **Delete pages:** remove individual pages
- **Rotate pages:** rotate any page 90° clockwise
- **Merge:** combine multiple PDFs into one
- **Split / Extract:** pull a range of pages out into a separate PDF
- **Watermark:** add text watermarks (center, top, or bottom) with adjustable opacity; optionally add page numbers
- **Annotate:** draw, highlight, add text, or stamp an image onto any page
- **Signature stamp:** pick an image to use as a reusable stamp; the app remembers it between sessions

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)

## Getting Started

```bash
npm install
npm start
```

## Built With

- [Electron](https://www.electronjs.org/)
- [pdf-lib](https://pdf-lib.js.org/)
- [PDF.js](https://mozilla.github.io/pdf.js/)
