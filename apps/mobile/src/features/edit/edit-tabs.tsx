import type { ReactNode } from 'react';

import { samplePixels } from '../../engine/sample-pixels';
import type { SkImage } from '../../engine/skia';
import { showError } from '../../ui/dialogs';
import { reportError } from '../analytics/analytics';
import { BeautyControls, FaceShapeControls } from '../camera/beauty-sheet';
import { MakeupControls } from '../makeup/makeup-controls';
import type { Size } from '../photo/geometry';
import { autoAdjusted } from './auto-adjust';
import { FramePicker } from './frame-picker';
import { HistogramView } from './histogram-view';
import { AdjustPanel } from './panels/adjust-panel';
import { BackgroundPanel } from './panels/background-panel';
import { BlurPanel } from './panels/blur-panel';
import { CropPanel } from './panels/crop-panel';
import { FilmPanel } from './panels/film-panel';
import { GradingControls } from './panels/grading-controls';
import { HslPanel } from './panels/hsl-panel';
import { LensPanel } from './panels/lens-panel';
import { LightPanel } from './panels/light-panel';
import { LocalPanel } from './panels/local-panel';
import { PresetsPanel } from './panels/presets-panel';
import type { PanelProps } from './panels/panel-props';
import { RetouchPanel } from './panels/retouch-panel';
import { SceneryPanel } from './panels/scenery-panel';
import { SelectPanel } from './panels/select-panel';
import { SkyPanel } from './panels/sky-panel';
import { TonePanel } from './panels/tone-panel';
import type { useLocalTool } from './tools/use-local-tool';
import type { useRetouchTool } from './tools/use-retouch-tool';
import type { useSelectTool } from './tools/use-select-tool';

/** The editor's tabs, in the order they are offered (S-21). */
export const EDIT_TABS = [
  'film',
  'presets',
  'beauty',
  'makeup',
  'retouch',
  'background',
  'blur',
  'adjust',
  'scenery',
  'sky',
  'light',
  'tone',
  'hsl',
  'local',
  'select',
  'lens',
  'crop',
  'frame',
] as const;
export type EditTab = (typeof EDIT_TABS)[number];

export interface EditTabContext extends PanelProps {
  /** The preview as shown, for the histogram. */
  readonly preview: SkImage | null;
  readonly original: { readonly image: SkImage; readonly size: Size };
  readonly takenAt: number | null;
  readonly local: ReturnType<typeof useLocalTool>;
  readonly retouch: ReturnType<typeof useRetouchTool>;
  readonly select: ReturnType<typeof useSelectTool>;
}

/** The controls of one tab; every change goes through `update`, so it can be undone. */
export function EditTabPanel({
  tab,
  context,
}: {
  readonly tab: EditTab;
  readonly context: EditTabContext;
}) {
  const { recipe, update, local, retouch } = context;
  const props: PanelProps = { recipe, update };
  const panels: Record<EditTab, () => ReactNode> = {
    film: () => <FilmPanel {...props} takenAt={context.takenAt} />,
    presets: () => <PresetsPanel {...props} />,
    beauty: () => (
      <>
        <BeautyControls
          beauty={recipe.beauty}
          onChange={(beauty) => {
            update({ beauty }, 'beauty');
          }}
        />
        <FaceShapeControls
          faceShape={recipe.faceShape}
          onChange={(faceShape) => {
            update({ faceShape }, 'faceShape');
          }}
        />
      </>
    ),
    makeup: () => (
      <MakeupControls
        makeup={recipe.makeup}
        onChange={(makeup) => {
          update({ makeup }, 'makeup');
        }}
      />
    ),
    retouch: () => (
      <RetouchPanel
        {...props}
        tool={retouch.mode}
        onTool={retouch.onMode}
        healSize={retouch.healSize}
        onHealSize={retouch.onHealSize}
      />
    ),
    background: () => <BackgroundPanel {...props} />,
    blur: () => <BlurPanel {...props} />,
    adjust: () => (
      <>
        <HistogramView image={context.preview} />
        <AdjustPanel
          {...props}
          onAuto={() => {
            try {
              update(autoAdjusted(recipe, samplePixels(context.original.image).pixels));
            } catch (error) {
              reportError(error, 'edit.auto');
              showError();
            }
          }}
        />
      </>
    ),
    scenery: () => <SceneryPanel {...props} />,
    sky: () => <SkyPanel {...props} original={context.original.image} />,
    light: () => <LightPanel {...props} />,
    tone: () => (
      <>
        <HistogramView image={context.preview} />
        <TonePanel {...props} />
      </>
    ),
    hsl: () => (
      <>
        <HslPanel {...props} />
        <GradingControls {...props} />
      </>
    ),
    local: () => (
      <LocalPanel
        {...props}
        selected={local.selected}
        onSelect={local.onSelect}
        shape={local.shape}
        onShape={local.onShape}
      />
    ),
    select: () => <SelectPanel {...props} tool={context.select} />,
    lens: () => <LensPanel {...props} />,
    crop: () => <CropPanel {...props} originalSize={context.original.size} />,
    frame: () => (
      <FramePicker
        frame={recipe.frame}
        onChange={(frame) => {
          update({ frame });
        }}
      />
    ),
  };
  return panels[tab]();
}
