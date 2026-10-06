'use client';
import { useState } from 'react';
import { Button, Tabs } from '@radix-ui/themes';
import {
  ArrowUpRight,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  Type,
} from '@/components/ui/studio-icons';
import { VIDEO_MODE_ENABLED } from '@/lib/studio/features';
import { defaultPose, type Asset } from '@/lib/studio/model';
import { selectedScene, useStudio } from '@/lib/studio/store';
import Inspector, { type MediaTarget } from './Inspector';
import { LogoSection, TextSection } from './OverlaySettings';
import { IconButton } from './primitives';
type Props = {
  assets: Asset[];
  onImport: (target: MediaTarget) => void;
  onPickFocus: () => void;
  onLibrary: () => void;
  onUseAsset: (asset: Asset) => void;
};
export default function ShotSidebar({
  assets,
  onImport,
  onPickFocus,
  onLibrary,
  onUseAsset,
}: Props) {
  const scene = useStudio(selectedScene);
  const [tab, setTab] = useState('design');
  const asset = assets.find((item) => item.id === scene?.assetId);
  const hasContent = !!scene?.assetId || !!scene?.layers.length;
  const inspectorProps = { assets, onImport, onPickFocus, compact: true };
  return (
    <aside className="shot-sidebar compact-sidebar" aria-label="Shot controls">
      <Tabs.Root value={tab} onValueChange={setTab} className="shot-sidebar-tabs">
        <div className="shot-sidebar-heading">
          <h2>Properties</h2>
        </div>
        <header className="shot-source">
          <span className="shot-source-icon" aria-hidden="true">
            {scene?.kind === 'text' ? <Type size={17} /> : <ImageIcon size={17} />}
          </span>
          <strong title={asset?.name || scene?.name}>
            {asset?.name || (hasContent ? scene?.name : 'No media selected')}
          </strong>
          <IconButton
            label={hasContent ? 'Replace source' : 'Choose source'}
            onClick={() => onImport('replace')}
            disabled={!scene}
          >
            <RefreshCw size={14} />
          </IconButton>
        </header>
        <Tabs.List className="shot-tabs" aria-label="Shot settings">
          <Tabs.Trigger value="design">Design</Tabs.Trigger>
          <Tabs.Trigger value="library">Library</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="design" className="shot-sidebar-content" aria-label="Design settings">
          {hasContent && scene?.kind !== 'text' && (
            <section className="shot-sidebar-section" aria-label="Focus and depth">
              <h2>Focus</h2>
              <Inspector kind="focus" {...inspectorProps} />
            </section>
          )}
          {hasContent && (
            <section className="shot-sidebar-section" aria-label="Camera settings">
              <div className="section-heading">
                <h2>Camera</h2>
                <button
                  type="button"
                  className="section-reset"
                  title="Reset angle, zoom and position"
                  onClick={() => {
                    const state = useStudio.getState();
                    state.begin();
                    state.editCamera((pose) => {
                      const d = defaultPose();
                      Object.assign(pose, {
                        x: d.x,
                        y: d.y,
                        z: d.z,
                        rx: d.rx,
                        ry: d.ry,
                        rz: d.rz,
                        zoom: d.zoom,
                        fov: d.fov,
                      });
                    });
                    state.commit();
                  }}
                >
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
              <Inspector kind="camera" {...inspectorProps} />
            </section>
          )}
          <section className="shot-sidebar-section" aria-label="Background settings">
            <h2>Background</h2>
            <Inspector kind="background" {...inspectorProps} />
          </section>
          {hasContent && (
            <section className="shot-sidebar-section" aria-label="Style settings">
              <h2>Style</h2>
              <Inspector kind="shadow" {...inspectorProps} />
            </section>
          )}
          {hasContent && <TextSection />}
          {hasContent && <LogoSection assets={assets} onImport={onImport} />}
          <section className="shot-sidebar-section" aria-label="Canvas settings">
            <h2>Canvas</h2>
            <Inspector kind="aspect" {...inspectorProps} />
          </section>
        </Tabs.Content>
        <Tabs.Content value="library" className="shot-sidebar-content" aria-label="Library">
          <section className="shot-sidebar-section">
            <h2>Media</h2>
            <div className="shot-library-list">
              {assets
                .filter((item) => VIDEO_MODE_ENABLED || item.kind === 'image')
                .slice(0, 6)
                .map((item) => (
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
