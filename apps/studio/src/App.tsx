import { filmSchema, resolveFilmParams } from '@fant/content-schema';
import { BEAUTY_LEVELS, FILM_PARAM_RANGES, parseCubeLut, type LutImage } from '@fant/filters';
import type { Image } from 'canvaskit-wasm';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import {
  DEFINED_PARAMS,
  draftFromFilm,
  filmFromDraft,
  NEW_DRAFT,
  type DefinedParam,
  type FilmDraft,
} from './film-draft';
import { download, readFile, sha256Hex } from './files';
import { sampleImage, StudioRenderer } from './renderer';

const LABELS: Record<DefinedParam, string> = {
  lutIntensity: 'LUT の効き',
  warmth: '色温度',
  tint: '色かぶり（緑↔マゼンタ）',
  saturation: '彩度',
  contrast: 'コントラスト',
  fade: 'フェード',
  bloom: 'ブルーム',
  sparkle: 'キラキラ',
  chromaticAberration: '色収差',
  vignette: 'ビネット',
  grain: '粒子',
  grainSize: '粒子の大きさ',
  lowRes: '低画素化',
  jpegNoise: 'JPEG ノイズ',
};

function Range({
  label,
  value,
  min,
  max,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <label className="range">
      <span>
        {label} <output>{value.toFixed(2)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
    </label>
  );
}

/**
 * The film studio (STU-01–04, STU-06): preview the app's shaders on photos or the
 * webcam, tune every parameter, import a .cube LUT and export film JSON and LUT PNG
 * for content/.
 */
export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [renderer, setRenderer] = useState<StudioRenderer | null>(null);
  const [photo, setPhoto] = useState<Image | null>(null);
  const [draft, setDraft] = useState<FilmDraft>(NEW_DRAFT);
  const [lut, setLut] = useState<{ data: LutImage; image: Image } | null>(null);
  const [strength, setStrength] = useState(1);
  const [beauty, setBeauty] = useState<keyof typeof BEAUTY_LEVELS>('off');
  const [seed, setSeed] = useState(0.5);
  const [original, setOriginal] = useState(false);
  const [webcam, setWebcam] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void StudioRenderer.create().then(
      (created) => {
        setRenderer(created);
        setPhoto(sampleImage(created));
      },
      (failure: unknown) => {
        setError(String(failure));
      },
    );
  }, []);

  const film = useMemo(() => {
    try {
      return {
        film: filmFromDraft(
          draft,
          lut === null ? null : { path: `luts/${draft.id}.png`, sha256: '0'.repeat(64) },
        ),
        problem: null,
      };
    } catch (failure) {
      return { film: null, problem: failure instanceof Error ? failure.message : String(failure) };
    }
  }, [draft, lut]);

  const [surface, setSurface] = useState<ReturnType<StudioRenderer['surfaceFor']> | null>(null);
  useEffect(() => {
    if (renderer === null || canvas.current === null) return;
    const created = renderer.surfaceFor(canvas.current);
    void Promise.resolve().then(() => {
      setSurface(created);
    });
    return () => {
      created.delete();
    };
  }, [renderer]);

  // Draw the photo whenever the look changes; the webcam redraws every frame.
  useEffect(() => {
    if (renderer === null || surface === null || film.film === null) return;
    const look = {
      film: resolveFilmParams(film.film, { intensity: strength, seed }),
      beauty: BEAUTY_LEVELS[beauty],
      lut: lut === null ? null : { image: lut.image, size: lut.data.size },
      seed,
      original,
    };
    if (!webcam) {
      if (photo !== null) renderer.draw(surface, photo, look);
      return;
    }
    let frame = 0;
    const tick = () => {
      const element = video.current;
      if (element !== null && element.readyState >= 2) {
        const image = renderer.ck.MakeImageFromCanvasImageSource(element);
        renderer.draw(surface, image, look);
        image.delete();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [renderer, surface, photo, film, lut, strength, beauty, seed, original, webcam]);

  useEffect(() => {
    const element = video.current;
    if (!webcam || element === null) return;
    let stream: MediaStream | null = null;
    void navigator.mediaDevices.getUserMedia({ video: true }).then(
      (opened) => {
        stream = opened;
        element.srcObject = opened;
        void element.play();
      },
      (failure: unknown) => {
        setError(`Webcam: ${String(failure)}`);
        setWebcam(false);
      },
    );
    return () => {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, [webcam]);

  const update = (patch: Partial<FilmDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const loadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file === undefined || renderer === null) return;
    try {
      setPhoto(renderer.decode(await readFile(file)));
      setWebcam(false);
    } catch (failure) {
      setError(String(failure));
    }
  };

  const loadCube = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file === undefined || renderer === null) return;
    try {
      const data = parseCubeLut(await file.text());
      setLut({ data, image: renderer.lutImage(data) });
      if (draft.params.lutIntensity === 0) update({ params: { ...draft.params, lutIntensity: 1 } });
      setError(null);
    } catch (failure) {
      setError(`LUT: ${failure instanceof Error ? failure.message : String(failure)}`);
    }
  };

  const loadFilm = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setError('Film JSON: JSON として読み込めませんでした');
      return;
    }
    const parsed = filmSchema.safeParse(json);
    if (!parsed.success) {
      setError(`Film JSON: ${parsed.error.message}`);
      return;
    }
    setDraft(draftFromFilm(parsed.data));
    setLut(null);
    setError(
      parsed.data.lut === undefined
        ? null
        : 'このフィルムの LUT は .cube から読み込み直してください',
    );
  };

  const exportFilm = async () => {
    if (renderer === null) return;
    try {
      let lutRef = null;
      if (lut !== null) {
        const png = renderer.encodeLutPng(lut.data);
        lutRef = { path: `luts/${draft.id}.png`, sha256: await sha256Hex(png) };
        download(`${draft.id}.png`, png, 'image/png');
      }
      download(
        `${draft.id}.json`,
        `${JSON.stringify(filmFromDraft(draft, lutRef), null, 2)}\n`,
        'application/json',
      );
    } catch (failure) {
      setError(String(failure));
    }
  };

  return (
    <div className="studio">
      <section className="preview">
        <canvas ref={canvas} width={900} height={1200} />
        <video ref={video} hidden muted playsInline />
        <div className="toolbar">
          <label className="button">
            写真を開く
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void loadPhoto(event)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (renderer !== null) setPhoto(sampleImage(renderer));
              setWebcam(false);
            }}
          >
            サンプル
          </button>
          <button
            type="button"
            onClick={() => {
              setWebcam(!webcam);
            }}
          >
            {webcam ? 'Web カメラを止める' : 'Web カメラ'}
          </button>
          <button
            type="button"
            onMouseDown={() => {
              setOriginal(true);
            }}
            onMouseUp={() => {
              setOriginal(false);
            }}
          >
            押している間は加工前
          </button>
          <button
            type="button"
            onClick={() => {
              setSeed(Math.random());
            }}
          >
            乱数を変える
          </button>
        </div>
      </section>
      <section className="controls">
        <h1>フィルムスタジオ</h1>
        {error !== null && <p className="error">{error}</p>}
        {film.problem !== null && <p className="error">{film.problem}</p>}
        <fieldset>
          <legend>フィルム</legend>
          <label>
            ID{' '}
            <input
              value={draft.id}
              onChange={(event) => {
                update({ id: event.target.value });
              }}
            />
          </label>
          <label>
            バージョン{' '}
            <input
              type="number"
              min={1}
              value={draft.version}
              onChange={(event) => {
                update({ version: Number(event.target.value) });
              }}
            />
          </label>
          <label>
            名前{' '}
            <input
              value={draft.nameJa}
              onChange={(event) => {
                update({ nameJa: event.target.value });
              }}
            />
          </label>
          <label>
            英語名{' '}
            <input
              value={draft.nameEn}
              onChange={(event) => {
                update({ nameEn: event.target.value });
              }}
            />
          </label>
          <label>
            区分{' '}
            <select
              value={draft.tier}
              onChange={(event) => {
                update({ tier: event.target.value === 'free' ? 'free' : 'premium' });
              }}
            >
              <option value="free">無料</option>
              <option value="premium">プレミアム</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.dateStampByDefault}
              onChange={(event) => {
                update({ dateStampByDefault: event.target.checked });
              }}
            />
            日付印字を最初からオン
          </label>
        </fieldset>
        <fieldset>
          <legend>LUT</legend>
          <label className="button">
            .cube を読み込む
            <input type="file" accept=".cube" hidden onChange={(event) => void loadCube(event)} />
          </label>
          {lut !== null && (
            <button
              type="button"
              onClick={() => {
                setLut(null);
              }}
            >
              LUT を外す（{lut.data.size}³）
            </button>
          )}
        </fieldset>
        <fieldset>
          <legend>パラメーター</legend>
          {DEFINED_PARAMS.map((name) => (
            <Range
              key={name}
              label={LABELS[name]}
              value={draft.params[name]}
              min={FILM_PARAM_RANGES[name].min}
              max={FILM_PARAM_RANGES[name].max}
              onChange={(value) => {
                update({ params: { ...draft.params, [name]: value } });
              }}
            />
          ))}
        </fieldset>
        <fieldset>
          <legend>光漏れ（撮影ごとにランダム）</legend>
          <Range
            label="出る確率"
            value={draft.leakProbability}
            min={0}
            max={1}
            onChange={(leakProbability) => {
              update({ leakProbability });
            }}
          />
          <Range
            label="最小の強さ"
            value={draft.leakMin}
            min={0}
            max={1}
            onChange={(leakMin) => {
              update({ leakMin });
            }}
          />
          <Range
            label="最大の強さ"
            value={draft.leakMax}
            min={0}
            max={1}
            onChange={(leakMax) => {
              update({ leakMax });
            }}
          />
        </fieldset>
        <fieldset>
          <legend>確認用</legend>
          <Range
            label="強さ（アプリのスライダー）"
            value={strength}
            min={0}
            max={1}
            onChange={setStrength}
          />
          <label>
            美肌{' '}
            <select
              value={beauty}
              onChange={(event) => {
                setBeauty(event.target.value as keyof typeof BEAUTY_LEVELS);
              }}
            >
              {Object.keys(BEAUTY_LEVELS).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <div className="toolbar">
          <label className="button">
            フィルム JSON を開く
            <input type="file" accept=".json" hidden onChange={(event) => void loadFilm(event)} />
          </label>
          <button
            type="button"
            className="primary"
            disabled={film.film === null}
            onClick={() => void exportFilm()}
          >
            書き出す（JSON + LUT）
          </button>
        </div>
        <p className="hint">
          書き出したファイルは content/remote/films/ と content/remote/luts/ に置き、`pnpm --filter
          @fant/content hash` と CI で検証します。
        </p>
      </section>
    </div>
  );
}
