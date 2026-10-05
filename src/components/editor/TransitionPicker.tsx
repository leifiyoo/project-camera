'use client';
import { useState } from 'react';
import { Popover } from 'radix-ui';
import { Check, Play, X } from '@/components/ui/studio-icons';
import type { Scene } from '@/lib/studio/model';
import { useStudio } from '@/lib/studio/store';
import { runtime } from '@/lib/studio/runtime';
import { timelineSpans } from '@/lib/studio/evaluate';
import { Range } from './primitives';

export const transitions = [
  { kind: 'cut', label: 'None', description: 'A clean cut' },
  { kind: 'fade', label: 'Dissolve', description: 'Blend the two clips' },
  { kind: 'push', label: 'Slide', description: 'Move from right to left' },
  { kind: 'zoom', label: 'Zoom', description: 'Ease into the next clip' },
  { kind: 'wipe', label: 'Wipe', description: 'Reveal from left to right' },
  { kind: 'blur', label: 'Blur', description: 'Soften, then refocus' },
] as const;

export function TransitionGlyph({ active = false }: { active?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5h5l3 7-3 7H4l3-7-3-7Zm16 0h-5l-3 7 3 7h5l-3-7 3-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity=".16"
      />
    </svg>
  );
}

export default function TransitionPicker({
  sceneId,
  inline = false,
}: {
  sceneId: string;
  inline?: boolean;
}) {
  const project = useStudio((s) => s.project);
  const [open, setOpen] = useState(false);
  const index = project?.scenes.findIndex((s) => s.id === sceneId) ?? -1;
  const scene = project?.scenes[index];
  const previous = project?.scenes[index - 1];
  if (!scene || !previous) return null;
  const limit = Math.min(previous.duration / 2, scene.duration / 2, 3);
  const effective = Math.min(scene.transition.duration, limit);
  const choice = transitions.find((t) => t.kind === scene.transition.kind)!;
  const change = (kind: Scene['transition']['kind'], duration = scene.transition.duration) => {
    runtime.set({ playing: false });
    useStudio.getState().edit((p) => {
      const target = p.scenes.find((s) => s.id === sceneId)!;
      target.transition = { kind, duration: Math.min(limit, Math.max(0.05, duration)) };
    });
    const span = timelineSpans(useStudio.getState().project!).find((s) => s.scene.id === sceneId)!;
    runtime.set({ time: span.start + span.overlap / 2, playing: false });
  };
  return (
    <Popover.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) runtime.set({ playing: false });
        if (value) useStudio.getState().selectScene(sceneId);
      }}
    >
      <Popover.Trigger asChild>
        <button
          className={inline ? 'transition-inline' : 'transition-button'}
          aria-label={`Transition into ${scene.name}`}
          title={`${choice.label} transition`}
          data-active={scene.transition.kind !== 'cut' || undefined}
        >
          <TransitionGlyph active={scene.transition.kind !== 'cut'} />
          {inline && (
            <>
              <span>Transition</span>
              <small>{choice.label}</small>
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="transition-picker"
          data-studio-popup
          side="top"
          align="center"
          sideOffset={12}
          collisionPadding={16}
          aria-label="Choose transition"
        >
          <div className="popover-heading">
            <strong>Transition</strong>
            <Popover.Close className="popover-close" aria-label="Close transitions">
              <X size={15} />
            </Popover.Close>
          </div>
          <div className="transition-choices">
            {transitions.map(({ kind, label, description }) => (
              <button
                key={kind}
                className={`transition-choice ${scene.transition.kind === kind ? 'selected' : ''}`}
                aria-pressed={scene.transition.kind === kind}
                onClick={() => change(kind)}
                title={description}
              >
                <span className={`transition-demo demo-${kind}`} aria-hidden="true">
                  <i>A</i>
                  <i>B</i>
                </span>
                <span>
                  {label}
                  {scene.transition.kind === kind && <Check size={12} />}
                </span>
              </button>
            ))}
          </div>
          {scene.transition.kind !== 'cut' && (
            <div className="transition-duration">
              <Range
                label="Duration"
                value={effective}
                min={Math.min(0.1, limit / 2)}
                max={limit}
                step={0.05}
                unit="s"
                onChange={(duration) => change(scene.transition.kind, duration)}
              />
              <button
                className="secondary full"
                onClick={() => {
                  const span = timelineSpans(useStudio.getState().project!).find(
                    (s) => s.scene.id === sceneId,
                  )!;
                  runtime.set({
                    time: Math.max(0, span.start - 0.25),
                    playing: true,
                    playbackEnd: span.start + span.overlap + 0.35,
                  });
                }}
              >
                <Play size={13} /> Preview transition
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
