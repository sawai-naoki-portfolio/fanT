import { File } from 'expo-file-system';
import { describe, expect, it } from 'vitest';

import { usePuriSession } from './puri-session';

const JPEG = new Uint8Array([0xff, 0xd8]);

describe('usePuriSession', () => {
  it('starts with an empty cell for each shot', () => {
    usePuriSession.getState().start('four', 4);

    expect(usePuriSession.getState()).toMatchObject({
      layoutId: 'four',
      shots: [null, null, null, null],
      backdrop: null,
    });
  });

  it('replaces a retaken shot and deletes the old file', () => {
    const session = usePuriSession.getState();
    session.start('two', 2);
    session.setShot(0, JPEG);
    const first = usePuriSession.getState().shots[0];
    session.setDeco(0, [
      { type: 'stamp', stampId: 'heart', x: 0.5, y: 0.5, size: 0.2, rotation: 0 },
    ]);

    session.setShot(0, new Uint8Array([1]));

    const retaken = usePuriSession.getState().shots[0];
    expect(retaken?.uri).not.toBe(first?.uri);
    expect(retaken?.deco).toEqual([]);
    expect(new File(retaken?.uri ?? '').bytesSync()).toEqual(new Uint8Array([1]));
    expect(new File(first?.uri ?? '').exists).toBe(false);
    expect(usePuriSession.getState().shots[1]).toBeNull();
  });

  it('deletes every shot when it is reset or started again', () => {
    const session = usePuriSession.getState();
    session.start('two', 2);
    session.setShot(0, JPEG);
    const shot = usePuriSession.getState().shots[0];

    session.start('two', 2);
    expect(new File(shot?.uri ?? '').exists).toBe(false);

    session.setShot(1, JPEG);
    const next = usePuriSession.getState().shots[1];
    session.reset();
    expect(new File(next?.uri ?? '').exists).toBe(false);
    expect(usePuriSession.getState()).toMatchObject({ layoutId: null, shots: [] });
  });
});
