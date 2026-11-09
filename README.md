# Full Circle Prayer for any website

A guided time of prayer in twelve movements: look **Up** to God, welcome His work **In** us, and pray **Out** for others and the world. This is Full Circle Prayer from the [WordPress plugin](https://fullcircleprayer.com/), made to work on any website with one script tag. Wix, Squarespace, Weebly, plain HTML and WordPress itself all work.

**Try it:** [fullcircleprayer.com](https://fullcircleprayer.com/pray/)

## Add it to your website

The easy way: open the **[settings builder](https://avdude.github.io/full-circle-prayer-web/builder/)**, fill in your church's details, and copy the code it gives you.

Or paste this where Full Circle Prayer should go, and change the settings:

```html
<div data-full-circle-prayer></div>
<script>
window.FullCirclePrayerConfig = {
  "church": "Hillside Community Church",
  "city": "Springfield"
};
</script>
<script src="https://cdn.jsdelivr.net/gh/avdude/full-circle-prayer-web@1/dist/full-circle-prayer.js" defer></script>
```

On WordPress, Squarespace or Wix, use a **Custom HTML**, **Code** or **Embed** block.

### It keeps itself up to date

The script address ends in `@1`, so your page always gets the newest 1.x release of Full Circle Prayer: new features and fixes arrive on their own, usually within a day of a release. Your settings live in your own page and are never changed.

If you'd rather stay on one exact version, use `@1.0.0` in place of `@1`.

## Settings

Every setting is optional.

| Setting | What it does | Example |
| --- | --- | --- |
| `church` | Church name at the top, and in prompts like "Pray for {church}" | `"Hillside Community Church"` |
| `tagline` | Small line under the name | `"Full Circle Prayer"` |
| `location` | Address or location line | `"120 Elm Street · Springfield"` |
| `city` | Used in "Pray for Springfield" and similar prompts | `"Springfield"` |
| `logo` | Address of your logo image | `"https://example.org/logo.png"` |
| `bible` | `"WEB"` (World English Bible, the default) or `"KJV"` | `"KJV"` |
| `colors` | Up, In, Out and button colors | `{ "up": "#c48a1c", "in": "#2c7a7f", "out": "#b24a33", "button": "#1f3a5f" }` |
| `duration` | Starting prayer time: `15`, `30`, `60`, any number of minutes, or `"pace"` for no timer | `30` |
| `mode` | `"simple"` or `"full"` | `"full"` |
| `keepNotes` | `false` clears notes when the person closes the page | `false` |
| `show` | Turn parts off or on: `phoneTools`, `homeScreen`, `attribution` (default on), `bottomList` (default off) | `{ "phoneTools": false }` |
| `feedback` | Email for "Need help?" and feedback, and the name to show | `{ "email": "prayer@example.org", "name": "the prayer team" }` |
| `footer` | A line of text at the bottom | `"Praying together"` |
| `welcome` | Change the opening words: `eyebrow`, `heading`, `intro` | `{ "heading": "Pray with us" }` |
| `groups` | Rename the groups: `up`, `in`, `out`, each with `label` and `sub` | `{ "up": { "label": "UP", "sub": "Worship" } }` |
| `missionaries` | People shown under Pray for the World | `[{ "name": "The Rivera Family", "location": "Lima, Peru", "prayer": "…", "photo": "https://…" }]` |
| `churches` | Local churches, a few shown each day under Pray for your church | `{ "perDay": 3, "list": [{ "name": "First Baptist", "detail": "Main Street", "area": "Downtown" }] }` |
| `countries` | "Country \| prompt" lines under Pray for the World | `["Peru \| for the church in the Andes"]` |
| `countryRequests` | "Country \| request" lines for places where Christians face pressure | `["North Korea \| for secret believers"]` |
| `passages` | Your own Scripture passages, added to the daily rotation | `[{ "reference": "Psalm 46:10", "text": "…", "category": "Be Still", "version": "NIV" }]` |
| `movements` | Change any movement by its key, e.g. `be-still`, `praise`, `intercede`, `church`, `city`, `world` | `{ "city": { "prompt": "Pray for our schools." } }` |
| `credits` | Scripture credits text in the footer | `"Scripture quotations marked NIV…"` |

If you use your own passages from a copyrighted translation, add its required notice in `credits`.

### More than one on a page

Put the settings inside each spot instead of using `window.FullCirclePrayerConfig`:

```html
<div data-full-circle-prayer>
  <script type="application/json">{ "church": "Hillside Community Church", "mode": "full" }</script>
</div>
```

## Privacy

- Notes, preferences and personal prayer requests stay in the person's own browser. Nothing is sent to you or to anyone else.
- There is no prayer-minutes counter in this version, because it has no server.
- The script, the prayer content and the Bible text load from [jsDelivr](https://www.jsdelivr.com/), a free public file service. Like any website, jsDelivr receives the visitor's IP address and browser details when files load. See [jsDelivr's privacy policy](https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net). If you prefer, host the `dist` folder on your own website and point the script there.

## Hosting it yourself

Copy the `dist` folder to your website and change the script address to it, e.g. `<script src="/full-circle-prayer/full-circle-prayer.js" defer></script>`. The script finds its other files next to itself. You'll then update it yourself by copying a newer `dist` folder.

## For developers

```
npm test          build, then run the checks
npm run serve     try it at http://localhost:8080/examples/ and /builder/
npm run sync      copy the prayer engine and styles from ../full-circle-prayer (the WordPress plugin)
```

- `src/loader.js` builds the page from the settings, and reads Bible references the same way the plugin does.
- `src/engine.js` and `src/full-circle-prayer.css` are the WordPress plugin's own front end, unchanged, so both stay the same.
- `tools/export-content.php` exports the movements and starter passages from the plugin into `dist/data` (run it with `wp eval-file` on a site with the plugin active, with `OUT` set to the output folder).
- `dist/` is committed, because jsDelivr serves files straight from the repository.

### Releasing

1. Update the version in `package.json` and add a line to `CHANGELOG.md`.
2. `npm test`, then commit, including `dist/`.
3. Tag and push: `git tag v1.0.1 && git push && git push --tags`
4. Sites on `@1` pick it up within about a day. To speed that up, open `https://purge.jsdelivr.net/gh/avdude/full-circle-prayer-web@1/dist/full-circle-prayer.js` in a browser.

Keep the settings working the same in every 1.x release. A change that would make churches edit their settings belongs in `v2.0.0`, which they choose by changing `@1` to `@2`.

## Credits

- Adapted from the prayer wheel in Dick Eastman's *The Hour That Changes the World*.
- Scripture from the World English Bible and the King James Version, both public domain.
- Made by [avdude](https://avdude.com/plugins/full-circle-prayer/). If Full Circle Prayer helps your church, you can [support its development](https://www.paypal.com/donate/?hosted_button_id=KPC36THAQY6QG).

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
