import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eraser } from "lucide-react";
import type { ActivityProps } from "./types";
import { play } from "@/lib/sfx";
import { sample } from "@/lib/utils";

const SIZE = 320; // internal canvas resolution (square)
const CELL = 10; // coverage grid cell size
const THRESHOLD = 0.55; // fraction of the glyph that must be traced

// Tracing: a faint guide glyph the child traces with a finger/stylus. Scoring
// is mask-coverage based — we render the glyph to an offscreen mask and count
// how much of it the strokes pass over. Forgiving by design (no penalty for
// going outside the lines), which suits young children.
export function Tracing({ lesson, onCorrect, solved }: ActivityProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<Uint8Array | null>(null);
  const maskCellsRef = useRef<Set<number>>(new Set());
  const visitedRef = useRef<Set<number>>(new Set());
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [progress, setProgress] = useState(0);

  // A lesson may carry a single `glyph` or a `glyphs` pool; pick one per play
  // (re-rolled on shuffle, which remounts this component).
  const glyph = useMemo(() => {
    if (lesson.glyphs && lesson.glyphs.length > 0) return sample(lesson.glyphs, 1)[0];
    return lesson.glyph ?? "?";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  function drawGuide(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.font = `bold ${SIZE * 0.7}px Fredoka, "Varela Round", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(169,155,255,0.28)";
    ctx.fillText(glyph, SIZE / 2, SIZE / 2);
    ctx.restore();
  }

  // Build the coverage mask + draw the guide whenever the glyph changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const off = document.createElement("canvas");
    off.width = SIZE;
    off.height = SIZE;
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.font = `bold ${SIZE * 0.7}px Fredoka, "Varela Round", sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillStyle = "#000";
    octx.fillText(glyph, SIZE / 2, SIZE / 2);

    const data = octx.getImageData(0, 0, SIZE, SIZE).data;
    const mask = new Uint8Array(SIZE * SIZE);
    const cells = new Set<number>();
    const cols = Math.ceil(SIZE / CELL);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const a = data[(y * SIZE + x) * 4 + 3];
        if (a > 40) {
          mask[y * SIZE + x] = 1;
          cells.add(Math.floor(y / CELL) * cols + Math.floor(x / CELL));
        }
      }
    }
    maskRef.current = mask;
    maskCellsRef.current = cells;
    visitedRef.current = new Set();
    setProgress(0);
    drawGuide(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glyph]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  }

  function mark(x: number, y: number) {
    const mask = maskRef.current;
    if (!mask) return;
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= SIZE || yi >= SIZE) return;
    if (mask[yi * SIZE + xi]) {
      const cols = Math.ceil(SIZE / CELL);
      visitedRef.current.add(Math.floor(yi / CELL) * cols + Math.floor(xi / CELL));
    }
  }

  function stroke(from: { x: number; y: number }, to: { x: number; y: number }, ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = "#6C5CE7";
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    // Sample along the segment for coverage.
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4) + 1;
    for (let i = 0; i <= steps; i++) {
      mark(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    }
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (solved) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || solved) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    stroke(last.current, p, ctx);
    last.current = p;

    const total = maskCellsRef.current.size || 1;
    const frac = visitedRef.current.size / total;
    setProgress(Math.min(1, frac / THRESHOLD));
    if (frac >= THRESHOLD) {
      drawing.current = false;
      play("ding");
      onCorrect(lesson.reward.stars);
    }
  }

  function onUp() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    visitedRef.current = new Set();
    setProgress(0);
    drawGuide(ctx);
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-cream/80">{t("activity.traceHint")}</p>
      <div className="relative rounded-blob bg-white/95 p-2 shadow-tile">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          className="h-[min(70vw,320px)] w-[min(70vw,320px)] touch-none rounded-xl2"
          style={{ touchAction: "none" }}
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-3 w-48 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-mint transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <button
          onClick={clear}
          disabled={solved}
          aria-label={t("activity.clear")}
          className="tap inline-flex items-center gap-2 rounded-blob bg-white/10 px-4 py-2 font-display"
        >
          <Eraser className="h-5 w-5" />
          {t("activity.clear")}
        </button>
      </div>
    </div>
  );
}
