# BoxDraw Studio

A lightweight, object-oriented browser app for drawing diagrams with Unicode box-drawing glyphs.

## Features

- **Tool panel** with line, arrow, and box primitives.
- **Multiple styles**: single, double, and rounded box-drawing sets.
- **Smart connection mode** that merges strokes into connected joints/intersections.
- **Overlap mode** that keeps strokes independent where they cross.
- **Copy output** as plain text for pasting into docs, Markdown, terminals, and code comments.

## Run

Open `index.html` in any modern browser.

## Notes

- Drag from start point to end point to draw.
- Arrow tool uses orthogonal routing and applies an arrow head at the destination.
- Box tool draws rectangles using your selected style and merge mode.
