'use client';
import { useState } from 'react';
import { Button, Tabs } from '@radix-ui/themes';
import { ArrowUpRight, Image as ImageIcon, RefreshCw, Type } from 'lucide-react';
import type { Asset } from '@/lib/studio/model';
import { selectedScene, useStudio } from '@/lib/studio/store';
import Inspector, { type MediaTarget } from './Inspector';
import { IconButton } from './primitives';
type Props = {
  assets: Asset[];
  onImport: (target: MediaTarget) => void;
  onPickFocus: () => void;
  onAdvanced: () => void;
  onLibrary: () => void;
  onUseAsset: (asset: Asset) => void;
};
export default function ShotSidebar({
  assets,
  onImport,
  onPickFocus,
  onAdvanced,
  onLibrary,
  onUseAsset,
}: Props) {
  const scene = useStudio(selectedScene);
  const [tab, setTab] = useState('design');
  const asset = assets.find((item) => item.id === scene?.assetId);
  const inspectorProps = { assets, onImport, onPickFocus, compact: true };
  return (
    <aside className="shot-sidebar compact-sidebar" aria-label="Shot controls">
      <Tabs.Root value={tab} onValueChange={setTab} className="shot-sidebar-tabs">
        <Tabs.List className="shot-tabs" aria-label="Shot settings">
          <Tabs.Trigger value="design">Design</Tabs.Trigger>
          <Tabs.Trigger value="library">Library</Tabs.Trigger>
        </Tabs.List>
        <header className="shot-source">
          <span className="shot-source-icon" aria-hidden="true">
            {scene?.kind === 'text' ? <Type size={17} /> : <ImageIcon size={17} />}
          </span>
          <strong title={asset?.name || scene?.name}>
            {asset?.name || scene?.name || 'No photo selected'}
          </strong>
          <IconButton label="Replace source" onClick={() => onImport('replace')} disabled={!scene}>
            <RefreshCw size={14} />
          </IconButton>
        </header>
        <Tabs.Content value="design" className="shot-sidebar-content" aria-label="Design settings">
          {scene?.kind === 'text' ? (
            <section className="shot-sidebar-section">
              <h2>Text &amp; layers</h2>
              <Button variant="soft" color="gray" className="secondary full" onClick={onAdvanced}>
                Edit text and layers
              </Button>
            </section>
          ) : (
            <section className="shot-sidebar-section" aria-label="Focus and depth">
              <h2>Focus</h2>
              <Inspector kind="focus" {...inspectorProps} />
            </section>
          )}
          <section className="shot-sidebar-section" aria-label="Camera settings">
            <h2>Camera</h2>
            <Inspector kind="camera" {...inspectorProps} />
          </section>
          <section className="shot-sidebar-section" aria-label="Background settings">
            <h2>Background</h2>
            <Inspector kind="background" {...inspectorProps} />
          </section>
          <section className="shot-sidebar-section" aria-label="Style settings">
            <h2>Shadow</h2>
            <Inspector kind="shadow" {...inspectorProps} />
          </section>
          <section className="shot-sidebar-section" aria-label="Canvas settings">
            <h2>Canvas</h2>
            <Inspector kind="aspect" {...inspectorProps} />
          </section>
        </Tabs.Content>
        <Tabs.Content value="library" className="shot-sidebar-content" aria-label="Library">
          <section className="shot-sidebar-section">
            <h2>Media</h2>
            <div className="shot-library-list">
              {assets.slice(0, 4).map((item) => (
                <Button
                  variant="ghost"
                  color="gray"
                  className="shot-library-item"
                  key={item.id}
                  aria-label={'Use ' + item.name}
                  onClick={() => onUseAsset(item)}
                >
                  <img src={item.thumbnail} alt="" />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.width} × {item.height}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </Button>
              ))}
            </div>
            <Button
              variant="soft"
              color="gray"
              className="secondary full"
              onClick={() => onImport('media')}
            >
              Import media
            </Button>
            <Button variant="ghost" color="gray" className="secondary full" onClick={onLibrary}>
              Open Library
            </Button>
          </section>
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}
