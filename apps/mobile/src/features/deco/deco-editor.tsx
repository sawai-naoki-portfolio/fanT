import type { TextStampStyle } from '@fant/content-schema';
import { ColorPalette } from '../../ui/color-palette';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useRotationGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';

import { useDecoFonts } from '../../engine/deco-fonts';
import { recordDeco } from '../../engine/draw-deco';
import { PhotoCanvas } from '../../engine/photo-canvas';
import type { SkImage } from '../../engine/skia';
import { strings } from '../../i18n';
import { Chip } from '../../ui/chip';
import { Text } from '../../ui/text';
import { IconButton } from '../../ui/icon-button';
import { colors, spacing } from '../../ui/theme';
import { useContent } from '../content/content-store';
import { stampMap } from '../content/lookup';
import type { Size } from '../photo/geometry';
import type { DecoLayer, DecoStamp, DecoStroke, DecoText } from '../photo/recipe';
import type { DecoFont } from './deco-fonts';
import { StampPalette, TextComposer, WidthPicker } from './deco-tools';
import {
  addLayer,
  DECO_COLORS,
  extendStroke,
  hitTest,
  PEN_WIDTHS,
  replaceLayer,
  startStroke,
  transformLayer,
  type PlacedLayer,
} from './deco-ops';

export type DecoTool = 'pen' | 'neon' | 'stamp' | 'text' | 'date' | 'eraser';
const TOOLS: readonly DecoTool[] = ['pen', 'neon', 'stamp', 'text', 'date', 'eraser'];

interface DecoEditorProps {
  /** The photo without decorations. */
  readonly image: SkImage | null;
  /** The full-resolution size decorations are laid out on. */
  readonly photoSize: Size;
  readonly layers: readonly DecoLayer[];
  /** Applies a change; changes with the same `key` in quick succession are one undo step. */
  readonly onChange: (layers: DecoLayer[], key?: string) => void;
  readonly premium: boolean;
  /** Controls for the date tool (DCO-04); the tool is hidden without them. */
  readonly dateControls?: ReactNode;
}

/**
 * Pens, neon pens, stamps, text and eraser over a photo (DCO-01–05). Shared by the
 * deco screen and the purikura scribbling (PRI-05).
 */
export function DecoEditor({
  image,
  photoSize,
  layers,
  onChange,
  premium,
  dateControls,
}: DecoEditorProps) {
  const manifest = useContent((state) => state.manifest);
  const fonts = useDecoFonts();
  const assets = useMemo(
    () => ({ stamps: stampMap(manifest), images: {}, fonts }),
    [manifest, fonts],
  );
  const [tool, setTool] = useState<DecoTool>('pen');
  const [color, setColor] = useState<string>(DECO_COLORS[1]);
  const [width, setWidth] = useState<number>(PEN_WIDTHS[1]);
  const [selected, setSelected] = useState<number | null>(null);
  const [stroke, setStroke] = useState<DecoStroke | null>(null);
  const [photoRect, setPhotoRect] = useState<LayoutRectangle | null>(null);
  const gesture = useRef({ x: 0, y: 0, scale: 1, rotation: 0 });

  const drawing = tool === 'pen' || tool === 'neon' || tool === 'eraser';
  const shown = useMemo(() => (stroke === null ? layers : [...layers, stroke]), [layers, stroke]);
  const selectedLayer = selected === null ? null : layers[selected];
  /** Text and shape stamps can take another colour (e.g. the oshi colour, PRI-08). */
  const recolorable = (layer: DecoLayer | null): layer is DecoText | DecoStamp => {
    if (layer === null || layer.type === 'stroke') return false;
    if (layer.type === 'text') return true;
    return assets.stamps.get(layer.stampId)?.art.type !== 'image';
  };

  const overlay = useMemo(() => {
    const shortEdge = Math.min(photoSize.width, photoSize.height);
    const selection =
      selectedLayer === undefined || selectedLayer === null || selectedLayer.type === 'stroke'
        ? null
        : {
            x: selectedLayer.x * photoSize.width,
            y: selectedLayer.y * photoSize.height,
            radius: (selectedLayer.size * shortEdge) / 2 + shortEdge * 0.02,
          };
    return recordDeco(shown, photoSize.width, photoSize.height, assets, selection);
  }, [shown, photoSize, assets, selectedLayer]);

  /** A touch in view coordinates as photo fractions. */
  const toPhoto = (x: number, y: number) =>
    photoRect === null
      ? null
      : { x: (x - photoRect.x) / photoRect.width, y: (y - photoRect.y) / photoRect.height };

  const updateSelected = (change: Parameters<typeof transformLayer>[1]) => {
    if (selected === null) return;
    const layer = layers[selected];
    if (layer === undefined || layer.type === 'stroke') return;
    onChange(
      replaceLayer(layers, selected, transformLayer<PlacedLayer>(layer, change)),
      `move-${String(selected)}`,
    );
  };

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    minDistance: 0,
    onBegin: (event) => {
      gesture.current.x = event.x;
      gesture.current.y = event.y;
      const point = toPhoto(event.x, event.y);
      if (drawing && point !== null) {
        setStroke(
          startStroke(tool, color, tool === 'eraser' ? width * 2 : width, point.x, point.y),
        );
      }
    },
    onUpdate: (event) => {
      if (drawing) {
        const point = toPhoto(event.x, event.y);
        if (point !== null)
          setStroke((current) =>
            current === null ? null : extendStroke(current, point.x, point.y),
          );
        return;
      }
      if (photoRect === null) return;
      updateSelected({
        dx: (event.x - gesture.current.x) / photoRect.width,
        dy: (event.y - gesture.current.y) / photoRect.height,
        scale: 1,
        rotation: 0,
      });
      gesture.current.x = event.x;
      gesture.current.y = event.y;
    },
    onFinalize: () => {
      const next = stroke === null ? null : addLayer(layers, stroke);
      if (next !== null) onChange(next);
      setStroke(null);
    },
  });
  const pinch = usePinchGesture({
    runOnJS: true,
    onBegin: () => {
      gesture.current.scale = 1;
    },
    onUpdate: (event) => {
      updateSelected({ dx: 0, dy: 0, scale: event.scale / gesture.current.scale, rotation: 0 });
      gesture.current.scale = event.scale;
    },
  });
  const rotate = useRotationGesture({
    runOnJS: true,
    onBegin: () => {
      gesture.current.rotation = 0;
    },
    onUpdate: (event) => {
      const degrees = (event.rotation * 180) / Math.PI;
      updateSelected({ dx: 0, dy: 0, scale: 1, rotation: degrees - gesture.current.rotation });
      gesture.current.rotation = degrees;
    },
  });
  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (event) => {
      if (drawing || photoRect === null) return;
      const point = toPhoto(event.x, event.y);
      if (point === null) return;
      setSelected(
        hitTest(layers, { x: point.x * photoSize.width, y: point.y * photoSize.height }, photoSize),
      );
    },
  });
  const gestures = useSimultaneousGestures(tap, pan, pinch, rotate);

  const place = (layer: PlacedLayer) => {
    const next = addLayer(layers, layer);
    if (next === null) return;
    onChange(next);
    setSelected(layers.length);
  };

  return (
    <View style={styles.container}>
      <PhotoCanvas image={image} photoSize={photoSize} overlay={overlay} onPhotoRect={setPhotoRect}>
        <GestureDetector gesture={gestures}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      </PhotoCanvas>
      <View style={styles.panel}>
        <View accessibilityRole="tablist" style={styles.row}>
          {TOOLS.filter((candidate) => candidate !== 'date' || dateControls !== undefined).map(
            (candidate) => (
              <Chip
                key={candidate}
                label={strings.deco.tools[candidate]}
                selected={tool === candidate}
                onPress={() => {
                  setTool(candidate);
                  setSelected(null);
                }}
              />
            ),
          )}
        </View>
        {(tool === 'pen' || tool === 'neon') && (
          <>
            <ColorPalette color={color} onChange={setColor} />
            <WidthPicker width={width} onChange={setWidth} />
          </>
        )}
        {tool === 'eraser' && <WidthPicker width={width} onChange={setWidth} />}
        {tool === 'stamp' && (
          <StampPalette
            premium={premium}
            onPick={(stamp) => {
              place({ type: 'stamp', stampId: stamp.id, x: 0.5, y: 0.5, size: 0.22, rotation: 0 });
            }}
          />
        )}
        {tool === 'text' && (
          <>
            <ColorPalette color={color} onChange={setColor} />
            <TextComposer
              color={color}
              onAdd={(text: string, style: TextStampStyle, font: DecoFont) => {
                place({
                  type: 'text',
                  text,
                  style,
                  font,
                  color,
                  x: 0.5,
                  y: 0.5,
                  size: 0.08,
                  rotation: 0,
                });
              }}
            />
          </>
        )}
        {tool === 'date' && dateControls}
        {selected !== null && selectedLayer !== undefined && recolorable(selectedLayer) && (
          <>
            <Text style={styles.label}>{strings.deco.layerColor}</Text>
            <ColorPalette
              color={selectedLayer.color ?? ''}
              onChange={(next) => {
                onChange(replaceLayer(layers, selected, { ...selectedLayer, color: next }));
              }}
            />
          </>
        )}
        {selected !== null && !drawing && (
          <IconButton
            icon="trash-outline"
            label={strings.deco.removeLayer}
            style={styles.remove}
            onPress={() => {
              onChange(replaceLayer(layers, selected, null));
              setSelected(null);
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  panel: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  remove: { alignSelf: 'flex-end' },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
