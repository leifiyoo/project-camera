'use client';
import { Tabs } from 'radix-ui';
import { Monitor, Moon, Sun } from '@/components/ui/studio-icons';
import type { Asset } from '@/lib/studio/model';
import { selectedScene, useStudio } from '@/lib/studio/store';
import Inspector, { type MediaTarget } from './Inspector';
import { ChoiceCapsules } from '@/components/ui/choice-capsules';
import { CanvasSettings } from './VideoSidebar';

export default function WorkspaceSettings({
  theme,
  onTheme,
  quality,
  onQuality,
  assets,
  onImport,
  onPickFocus,
}: {
  theme: string;
  onTheme: (value: string) => void;
  quality: 'high' | 'draft';
  onQuality: (value: 'high' | 'draft') => void;
  assets: Asset[];
  onImport: (target: MediaTarget) => void;
  onPickFocus: () => void;
}) {
  const scene = useStudio(selectedScene);
  const props = { assets, onImport, onPickFocus, compact: true };
  return (
    <Tabs.Root defaultValue="general" className="settings-layout">
      <Tabs.List className="settings-nav" aria-label="Settings categories">
        <Tabs.Trigger value="general">General</Tabs.Trigger>
        <Tabs.Trigger value="canvas">Canvas</Tabs.Trigger>
        <Tabs.Trigger value="advanced" disabled={!scene}>
          Advanced
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="general" className="settings-content">
        <header className="settings-page-heading">
          <h3>General</h3>
          <p>Set up your workspace.</p>
        </header>
        <section className="settings-section">
          <h3>Appearance</h3>
          <p>Choose how your workspace looks.</p>
          <ChoiceCapsules
            value={theme}
            onChange={onTheme}
            label="Appearance"
            options={[
              { value: 'system', label: 'System', icon: <Monitor size={16} aria-hidden="true" /> },
              { value: 'light', label: 'Light', icon: <Sun size={16} aria-hidden="true" /> },
              { value: 'dark', label: 'Dark', icon: <Moon size={16} aria-hidden="true" /> },
            ]}
          />
        </section>
        <section className="settings-section">
          <h3>Preview quality</h3>
          <p>Draft keeps playback fast. Exports always use full quality.</p>
          <ChoiceCapsules
            label="Preview quality"
            value={quality}
            options={[
              { value: 'high', label: 'High quality' },
              { value: 'draft', label: 'Draft' },
            ]}
            onChange={onQuality}
          />
        </section>
        <section className="settings-section settings-shortcuts">
          <h3>Quick shortcuts</h3>
          <div>
            <span>Undo / redo</span>
            <kbd>Ctrl Z / ⇧ Z</kbd>
          </div>
          <div>
            <span>Play / pause</span>
            <kbd>Space</kbd>
          </div>
          <div>
            <span>Split clip</span>
            <kbd>Ctrl B</kbd>
          </div>
        </section>
      </Tabs.Content>
      <Tabs.Content value="canvas" className="settings-content">
        <section className="settings-section">
          <h3>Output format</h3>
          <p>The canvas shape applies to photos and videos.</p>
          <CanvasSettings />
          {!scene && <p>Add a clip to adjust its background.</p>}
          {scene && (
            <>
              <h3 className="settings-subheading">Background</h3>
              <Inspector kind="background" {...props} />
            </>
          )}
        </section>
      </Tabs.Content>
      <Tabs.Content value="advanced" className="settings-content">
        <Inspector kind="settings" {...props} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
