# remote/

Content delivered from the content server only (not bundled in the app): seasonal films, collaboration packs and new AI styles. Same layout as `builtin/` (`films/<id>.json`, `characters.json`, …, assets beside them). Give each item an `availability` window to control when it appears and how long it shows the NEW badge (CNT-03/04).

`config.json` (optional) is the remote configuration (ANL-03), validated like the rest:

```json
{
  "features": { "ai": false },
  "paywallLead": [{ "ja": "案A の一文" }, { "ja": "案B の一文" }]
}
```

- `features.ai: false` hides AI mode until it is switched back (e.g. during a provider outage).
- `paywallLead` replaces the paywall's lead line. With several entries each install sees one of them, always the same one, and `paywall_shown` records which (`leadVariant`, 0-based) for comparing purchases per variant.
