import { strings } from '../../i18n';
import { showMessage } from '../../ui/dialogs';
import { IconButton } from '../../ui/icon-button';
import { lookOf, withLook } from '../looks/look';
import { useLookClipboard } from '../looks/look-clipboard';
import type { PhotoRecipe } from '../photo/recipe';

/**
 * The editor's header buttons: hold to compare with the photo before editing
 * (EDT-28), copy and paste a look (EDT-33), undo and redo (EDT-05).
 */
export function EditHeaderActions({
  recipe,
  update,
  comparing,
  onCompare,
  history,
}: {
  readonly recipe: PhotoRecipe;
  readonly update: (next: Partial<PhotoRecipe>) => void;
  readonly comparing: boolean;
  readonly onCompare: (comparing: boolean) => void;
  readonly history: {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly undo: () => void;
    readonly redo: () => void;
  };
}) {
  const copied = useLookClipboard((state) => state.look);
  return (
    <>
      <IconButton
        icon="eye-outline"
        label={strings.edit.compare}
        active={comparing}
        onPress={() => undefined}
        onPressIn={() => {
          onCompare(true);
        }}
        onPressOut={() => {
          onCompare(false);
        }}
      />
      <IconButton
        icon="copy-outline"
        label={strings.edit.copyLook}
        onPress={() => {
          useLookClipboard.getState().copy(lookOf(recipe));
          showMessage(strings.edit.copied);
        }}
      />
      <IconButton
        icon="clipboard-outline"
        label={strings.edit.pasteLook}
        disabled={copied === null}
        onPress={() => {
          if (copied !== null) update(withLook(recipe, copied));
        }}
      />
      <IconButton
        icon="arrow-undo"
        label={strings.edit.undo}
        disabled={!history.canUndo}
        onPress={history.undo}
      />
      <IconButton
        icon="arrow-redo"
        label={strings.edit.redo}
        disabled={!history.canRedo}
        onPress={history.redo}
      />
    </>
  );
}
