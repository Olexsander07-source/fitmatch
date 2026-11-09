# Exercise demonstrations

Workout cards, simple workout mode, guided sessions and replacement previews show exercise demonstrations alongside the existing technique text. No program, profile, billing or training data schema was changed.

The 25 downloadable videos are from [Your Move's free exercise videos](https://ymove.app/free-exercise-videos). The publisher explicitly permits use within commercial apps and websites, while forbidding resale or redistribution as a standalone library. Files are bundled solely as part of the FitGoIn application. The app credits the source. `node scripts/download-exercise-demos.mjs` reproduces these files from the publisher's URLs.

Additional beginner bodyweight demonstrations use the creators' YouTube embeds, including PureGym, Margaret Martin and Community Medical Centers. The iframe loads only when the visitor opens it, and the card links to the source on YouTube. The voice/language of these videos is English; FitGoIn's existing exercise text remains visible.

Cloudflare Workers static assets do not support HTTP byte ranges, which can prevent playback in Safari. Bundled clips are therefore fetched only on opening a card and played from a browser-local blob URL; downloads and blob URLs are released when the card closes or the screen rerenders. A failed download shows an error and the video search remains available.

Matching is by reviewed exact names and a small number of equipment/technique disambiguation rules, with RU/EN/FR aliases. Arbitrary or unclear exercise names do not receive a guessed video: the card says no embedded demonstration is available and offers a labelled YouTube search. More entries should be added only after checking the exact movement, equipment, source and rights. Source services can remove videos or change their availability.
