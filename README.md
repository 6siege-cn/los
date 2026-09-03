# Six Siege Line of Sight Calculator

A browser-only line-of-sight calculator for *Six Siege: The Board Game*.
The application runs entirely on the user's device and does not send map
placements or calculations to a server.

## Website

After GitHub Pages is enabled, the site is published at:

<https://rainlef508.github.io/six-siege-los/>

## Features

- Eight maps with their original grid alignment
- Blue and Orange player placement and dragging
- Openable walls and windows
- 2x2, 2x1, and 1x2 smoke patterns
- Browser-local line-of-sight calculation
- Responsive canvas zoom from 50% to 1000%

## Local preview

Serve this directory with any static HTTP server, then open its root page.
Opening `index.html` directly from disk is not supported because browsers
restrict local JSON module requests.

## Tests

With Node.js installed:

```sh
npm test
```

## Deployment

Every push to `main` runs the test suite and deploys this directory through
the GitHub Pages workflow in `.github/workflows/deploy-pages.yml`.

## Notice

This is an unofficial community project. It is not affiliated with or
endorsed by Mythic Games, Ubisoft, or the operators of 6siege.com. Game names,
map artwork, and other third-party materials remain the property of their
respective owners. Review the redistribution rights for third-party assets
before publishing or licensing this repository.
