import React from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Crosshair,
  RotateCcw,
} from 'lucide-react';
import type { MergerImage } from '../types/merger';
import { normalizeDegrees } from '../utils/canvasEngine';

interface LayerPanelProps {
  images: MergerImage[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onUpdateLayerTransform: (
    id: string,
    patch: Partial<Pick<MergerImage, 'x' | 'y' | 'scale' | 'rotation' | 'opacity'>>,
    commitHistory?: boolean,
  ) => void;
  onMoveLayerOrder: (
    id: string,
    direction: 'forward' | 'back' | 'front' | 'toBack',
  ) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  images,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayerTransform,
  onMoveLayerOrder,
}) => {
  const selected =
    images.find((im) => im.id === selectedLayerId) ?? images[images.length - 1] ?? null;

  return (
    <section
      aria-label="Overlay layer inspector"
      className="rounded-card border border-border bg-surface shadow-surface"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-foreground">
            Overlay Layer Composition
          </h2>
          <p className="text-xs text-muted">
            Select a layer below or drag directly inside the preview canvas.
          </p>
        </div>
        {selected && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateLayerTransform(selected.id, { x: 0, y: 0 }, true)}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 text-xs font-medium text-foreground hover:bg-accent-soft/60"
            >
              <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Center</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLayerTransform(
                  selected.id,
                  { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100 },
                  true,
                )
              }
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 text-xs font-medium text-foreground hover:bg-accent-soft/60"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {images.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted">
          Add images to adjust overlay coordinates, rotation, scale, and Z-order.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-12">
          {/* Layer Stack List (top-most first) */}
          <div className="space-y-1.5 lg:col-span-5">
            <span className="block text-xs font-semibold text-foreground">
              Layer Stack (Top → Bottom)
            </span>
            <div role="list" className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {[...images].reverse().map((layer, revIdx) => {
                const isSelected = selected?.id === layer.id;
                const stackNumber = images.length - revIdx;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => onSelectLayer(layer.id)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-control border px-2.5 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-accent-soft text-foreground'
                        : 'border-border bg-well/50 text-foreground hover:bg-well'
                    }`}
                  >
                    <img
                      src={layer.src}
                      alt={layer.name}
                      className="h-9 w-9 shrink-0 rounded border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{layer.name}</div>
                      <div className="font-mono text-[11px] text-muted tabular-nums">
                        L{stackNumber} · {layer.scale}% · {normalizeDegrees(layer.rotation)}° ·{' '}
                        {layer.opacity}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transform Sliders & Z-order Controls */}
          {selected && (
            <div className="space-y-3.5 lg:col-span-7">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor="layer-x-slider" className="font-medium text-foreground">
                      Position X
                    </label>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {selected.x} px
                    </span>
                  </div>
                  <input
                    id="layer-x-slider"
                    name="layerX"
                    type="range"
                    min={-800}
                    max={800}
                    value={selected.x}
                    onChange={(e) =>
                      onUpdateLayerTransform(selected.id, { x: Number(e.target.value) }, false)
                    }
                    className="studio-range w-full"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor="layer-y-slider" className="font-medium text-foreground">
                      Position Y
                    </label>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {selected.y} px
                    </span>
                  </div>
                  <input
                    id="layer-y-slider"
                    name="layerY"
                    type="range"
                    min={-800}
                    max={800}
                    value={selected.y}
                    onChange={(e) =>
                      onUpdateLayerTransform(selected.id, { y: Number(e.target.value) }, false)
                    }
                    className="studio-range w-full"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label htmlFor="layer-scale-slider" className="font-medium text-foreground">
                      Layer Scale
                    </label>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {selected.scale}%
                    </span>
                  </div>
                  <input
                    id="layer-scale-slider"
                    name="layerScale"
                    type="range"
                    min={10}
                    max={250}
                    value={selected.scale}
                    onChange={(e) =>
                      onUpdateLayerTransform(selected.id, { scale: Number(e.target.value) }, false)
                    }
                    className="studio-range w-full"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label
                      htmlFor="layer-rotation-slider"
                      className="font-medium text-foreground"
                    >
                      Rotation (0–360°)
                    </label>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {normalizeDegrees(selected.rotation)}°
                    </span>
                  </div>
                  <input
                    id="layer-rotation-slider"
                    name="layerRotation"
                    type="range"
                    min={0}
                    max={360}
                    value={normalizeDegrees(selected.rotation)}
                    onChange={(e) =>
                      onUpdateLayerTransform(
                        selected.id,
                        { rotation: Number(e.target.value) },
                        false,
                      )
                    }
                    className="studio-range w-full"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor="layer-opacity-slider" className="font-medium text-foreground">
                    Layer Opacity
                  </label>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {selected.opacity}%
                  </span>
                </div>
                <input
                  id="layer-opacity-slider"
                  name="layerOpacity"
                  type="range"
                  min={0}
                  max={100}
                  value={selected.opacity}
                  onChange={(e) =>
                    onUpdateLayerTransform(selected.id, { opacity: Number(e.target.value) }, false)
                  }
                  className="studio-range w-full"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onMoveLayerOrder(selected.id, 'front')}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 text-xs font-medium text-foreground hover:bg-accent-soft/60"
                >
                  <ArrowUpToLine className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>To Front</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMoveLayerOrder(selected.id, 'forward')}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 text-xs font-medium text-foreground hover:bg-accent-soft/60"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Forward</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMoveLayerOrder(selected.id, 'back')}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 text-xs font-medium text-foreground hover:bg-accent-soft/60"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Backward</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMoveLayerOrder(selected.id, 'toBack')}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control border border-border bg-well px-2.5 text-xs font-medium text-foreground hover:bg-accent-soft/60"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>To Back</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
