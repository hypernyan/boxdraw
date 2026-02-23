class StrokeCell {
  constructor() {
    this.mode = "empty";
    this.edges = { N: 0, E: 0, S: 0, W: 0 };
    this.char = " ";
  }

  clear() {
    this.mode = "empty";
    this.edges = { N: 0, E: 0, S: 0, W: 0 };
    this.char = " ";
  }
}

class GlyphResolver {
  constructor() {
    this.styleCode = { single: 1, double: 2, rounded: 3 };
    this.edgeOrder = ["N", "E", "S", "W"];

    this.maps = {
      single: {
        0b0101: "─",
        0b1010: "│",
        0b0011: "┌",
        0b0110: "┐",
        0b1100: "┘",
        0b1001: "└",
        0b1011: "├",
        0b1110: "┤",
        0b0111: "┬",
        0b1101: "┴",
        0b1111: "┼"
      },
      double: {
        0b0101: "═",
        0b1010: "║",
        0b0011: "╔",
        0b0110: "╗",
        0b1100: "╝",
        0b1001: "╚",
        0b1011: "╠",
        0b1110: "╣",
        0b0111: "╦",
        0b1101: "╩",
        0b1111: "╬"
      },
      rounded: {
        0b0101: "─",
        0b1010: "│",
        0b0011: "╭",
        0b0110: "╮",
        0b1100: "╯",
        0b1001: "╰",
        0b1011: "├",
        0b1110: "┤",
        0b0111: "┬",
        0b1101: "┴",
        0b1111: "┼"
      }
    };
  }

  resolveCell(cell) {
    if (cell.mode !== "connect") return cell.char;

    const active = this.edgeOrder.filter((dir) => cell.edges[dir] !== 0);
    if (active.length === 0) return " ";

    const style = this.resolveStyle(cell.edges);
    const bitmask = this.makeBitmask(cell.edges);
    const glyph = this.maps[style][bitmask];

    if (glyph) {
      return glyph;
    }

    if (active.length === 1) {
      return active[0] === "N" || active[0] === "S" ? "│" : "─";
    }

    return "┼";
  }

  resolveStyle(edges) {
    const values = Object.values(edges).filter((v) => v !== 0);
    if (values.length === 0) return "single";

    const hasSingle = values.includes(this.styleCode.single);
    const hasDouble = values.includes(this.styleCode.double);

    if (hasSingle && hasDouble) {
      return "single";
    }

    if (values.every((v) => v === this.styleCode.rounded)) {
      return "rounded";
    }

    if (values.every((v) => v === this.styleCode.double)) {
      return "double";
    }

    return "single";
  }

  makeBitmask(edges) {
    const flags = [edges.N, edges.E, edges.S, edges.W].map((v) => (v ? 1 : 0));
    return (flags[0] << 3) | (flags[1] << 2) | (flags[2] << 1) | flags[3];
  }

  charForSegment(direction, style) {
    const isVertical = direction === "N" || direction === "S";

    if (style === "double") return isVertical ? "║" : "═";
    return isVertical ? "│" : "─";
  }
}

class GridModel {
  constructor(rows, cols, resolver) {
    this.rows = rows;
    this.cols = cols;
    this.resolver = resolver;
    this.styleCode = resolver.styleCode;
    this.grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => new StrokeCell()));
  }

  clear() {
    for (const row of this.grid) {
      for (const cell of row) {
        cell.clear();
      }
    }
  }

  inBounds(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  carveSegment(row, col, direction, style, mode) {
    if (!this.inBounds(row, col)) return;
    const cell = this.grid[row][col];

    if (mode === "connect") {
      cell.mode = "connect";
      cell.edges[direction] = this.styleCode[style] ?? this.styleCode.single;
      cell.char = this.resolver.resolveCell(cell);
      return;
    }

    if (cell.char !== " " && cell.char !== undefined) {
      cell.char = "╳";
    } else {
      cell.char = this.resolver.charForSegment(direction, style);
    }
    cell.mode = "overlap";
  }

  syncConnectCells() {
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell.mode === "connect") {
          cell.char = this.resolver.resolveCell(cell);
        }
      }
    }
  }

  setChar(row, col, char) {
    if (!this.inBounds(row, col)) return;
    const cell = this.grid[row][col];
    cell.mode = "overlap";
    cell.char = char;
  }

  toString() {
    return this.grid
      .map((row) => row.map((cell) => cell.char ?? " ").join(""))
      .join("\n");
  }
}

class DiagramApp {
  constructor() {
    this.canvasEl = document.querySelector("#canvas");
    this.tool = "line";
    this.style = "single";
    this.mode = "connect";
    this.dragStart = null;
    this.measurement = { charW: 9, rowH: 20 };

    this.resolver = new GlyphResolver();
    this.grid = new GridModel(34, 110, this.resolver);

    this.bindUI();
    this.measureCellSize();
    this.render();
  }

  bindUI() {
    this.activatePicker("#tool-picker", "tool", (value) => (this.tool = value));
    this.activatePicker("#style-picker", "style", (value) => (this.style = value));
    this.activatePicker("#mode-picker", "mode", (value) => (this.mode = value));

    document.querySelector("#clear-btn").addEventListener("click", () => {
      this.grid.clear();
      this.render();
    });

    document.querySelector("#copy-btn").addEventListener("click", async () => {
      await navigator.clipboard.writeText(this.grid.toString());
    });

    this.canvasEl.addEventListener("mousedown", (event) => {
      const point = this.eventToGridPoint(event);
      if (!point) return;
      this.dragStart = point;
    });

    window.addEventListener("mouseup", (event) => {
      if (!this.dragStart) return;
      const end = this.eventToGridPoint(event);
      if (!end) {
        this.dragStart = null;
        return;
      }

      this.drawShape(this.dragStart, end);
      this.dragStart = null;
      this.grid.syncConnectCells();
      this.render();
    });

    window.addEventListener("resize", () => this.measureCellSize());
  }

  activatePicker(selector, key, onPick) {
    const container = document.querySelector(selector);
    container.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      container.querySelectorAll("button").forEach((node) => node.classList.remove("is-active"));
      button.classList.add("is-active");
      onPick(button.dataset[key]);
    });
  }

  measureCellSize() {
    const probe = document.createElement("span");
    probe.textContent = "M";
    this.canvasEl.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    this.measurement = {
      charW: rect.width || 9,
      rowH: rect.height || 20
    };
    probe.remove();
  }

  eventToGridPoint(event) {
    const rect = this.canvasEl.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientY < rect.top || event.clientX > rect.right || event.clientY > rect.bottom) {
      return null;
    }

    const x = event.clientX - rect.left - 16;
    const y = event.clientY - rect.top - 16;
    const col = Math.max(0, Math.min(this.grid.cols - 1, Math.floor(x / this.measurement.charW)));
    const row = Math.max(0, Math.min(this.grid.rows - 1, Math.floor(y / this.measurement.rowH)));

    return { row, col };
  }

  drawShape(start, end) {
    if (this.tool === "box") {
      this.drawBox(start, end);
      return;
    }

    this.drawOrthogonal(start, end, this.tool === "arrow");
  }

  drawOrthogonal(start, end, withArrow) {
    const turn = { row: start.row, col: end.col };

    this.drawSegment(start, turn, this.style, this.mode);
    this.drawSegment(turn, end, this.style, this.mode);

    if (withArrow) {
      this.addArrowHead(turn, end);
    }
  }

  drawBox(a, b) {
    const top = Math.min(a.row, b.row);
    const bottom = Math.max(a.row, b.row);
    const left = Math.min(a.col, b.col);
    const right = Math.max(a.col, b.col);

    this.drawSegment({ row: top, col: left }, { row: top, col: right }, this.style, this.mode);
    this.drawSegment({ row: bottom, col: left }, { row: bottom, col: right }, this.style, this.mode);
    this.drawSegment({ row: top, col: left }, { row: bottom, col: left }, this.style, this.mode);
    this.drawSegment({ row: top, col: right }, { row: bottom, col: right }, this.style, this.mode);
  }

  drawSegment(start, end, style, mode) {
    if (start.row === end.row) {
      const [left, right] = [Math.min(start.col, end.col), Math.max(start.col, end.col)];
      for (let col = left; col < right; col += 1) {
        this.grid.carveSegment(start.row, col, "E", style, mode);
        this.grid.carveSegment(start.row, col + 1, "W", style, mode);
      }
      return;
    }

    if (start.col === end.col) {
      const [top, bottom] = [Math.min(start.row, end.row), Math.max(start.row, end.row)];
      for (let row = top; row < bottom; row += 1) {
        this.grid.carveSegment(row, start.col, "S", style, mode);
        this.grid.carveSegment(row + 1, start.col, "N", style, mode);
      }
    }
  }

  addArrowHead(turn, end) {
    const rowDelta = end.row - turn.row;
    const colDelta = end.col - turn.col;

    if (Math.abs(colDelta) >= Math.abs(rowDelta)) {
      this.grid.setChar(end.row, end.col, colDelta >= 0 ? "▶" : "◀");
      return;
    }

    this.grid.setChar(end.row, end.col, rowDelta >= 0 ? "▼" : "▲");
  }

  render() {
    this.canvasEl.textContent = this.grid.toString();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new DiagramApp();
});
