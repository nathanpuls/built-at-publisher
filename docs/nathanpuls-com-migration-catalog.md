# NathanPuls.com Migration Catalog

Last verified: 2026-06-09

## Purpose

This catalog records the known `nathanpuls.com` routing surface before Built.at
takes over any of it. It is a planning artifact only. No route should move to
Built.at until its dependencies and verification checks are complete.

## Scope

The migration applies only to paths after the apex domain:

- In scope: `nathanpuls.com/<path>`
- Out of scope: `<subdomain>.nathanpuls.com`

All subdomains must remain untouched, including their DNS records, Worker
routes, hosting providers, redirects, and storage behavior.

## Migration Rules

1. Never attach the current simple-editor Worker directly to
   `*.nathanpuls.com/*`.
2. Built.at may take over `nathanpuls.com/*` after explicit exceptions for
   active apex paths have been chosen.
3. Proxy the current upstream first when a route has APIs, media, authentication,
   or other behavior that a plain Built.at page cannot replace.
4. Historical apex paths may be overwritten unless they are deliberately
   selected for restoration.
5. Do not change any subdomain as part of the apex migration.
6. Verify the public page, admin page, APIs, redirects, media, and mobile layout
   before switching an active route.

## Confirmed Active Apex Routes

| Route pattern | Current owner | Upstream / source | Dependencies | Initial migration mode | Verification required |
| --- | --- | --- | --- | --- | --- |
| `/suno*` and `/Suno*` | Worker `suno-path-proxy` | `suno-audio-player.pages.dev`; local source `/Users/nathanpuls/Documents/suno-audio-player` | Pages Functions, R2 bucket `media`, protected playlist API, `media.nathanpuls.com` | Proxy first | `/suno/`, `/suno/admin`, playlist/tracks/download APIs, uppercase redirect, all audio |
| `/week4*` | Worker `week4-proxy` | `week-4.pages.dev`; local source `/Users/nathanpuls/Desktop/Week 4` | Pages Functions, D1 `week4-play-counts` (`624f6b9a-3153-4855-8b14-9a8c995fa356`), audio files | Evaluate iframe or proxy | `/week4`, `/week4/admin`, track-order and play-count APIs, all audio |
| `/api/md/*` | Worker `ai-workflow-md-proxy` | Local source `/Users/nathanpuls/Desktop/code 2026/AI Workflow Gist/worker` | GitHub Contents API, repo `nathanpuls/ai-workflow-notes`, secret `GITHUB_PAT` | Preserve API route | Valid reads/writes, auth failures, GitHub error handling |
| `/robots.txt` | Cloudflare-managed response | Cloudflare content signals | Zone-level configuration | Preserve system path | Confirm the same content signals after any apex change |

### Live observations

- `/` currently returns the apex fallback 404.
- `/suno` redirects to `/suno/`; the page and admin are live.
- `/week4` and `/week4/admin` are live.
- `/api/md/` reaches the dedicated API Worker.
- `/robots.txt` is live even though the other historical top-level candidates
  currently return 404.
- Unknown apex paths currently return a 404 with
  `x-subdomain-path-redirect: apex-fallback`.

## Out-of-Scope Subdomains

These are recorded only to prevent accidental changes. They are not migration
targets.

| Host | Current behavior | Required action |
| --- | --- | --- | --- |
| `docs.nathanpuls.com` | Live GitBook/Vercel site | Do not change |
| `jobs.nathanpuls.com` | Live GitBook/Vercel site | Do not change |
| `e.nathanpuls.com` | Live Google/ESF-hosted site | Do not change |
| `media.nathanpuls.com` | Worker-backed R2 media host | Do not change |
| `www.nathanpuls.com` | Redirects to apex | Do not change its subdomain routing |
| `timmymorgan.nathanpuls.com` | Existing wildcard redirect behavior | Do not change |
| `rd.nathanpuls.com` | Existing wildcard redirect behavior | Do not change |
| `*.nathanpuls.com` | Existing wildcard behavior | Do not change |

## Confirmed Supporting Services

| Service | Status | Notes |
| --- | --- | --- |
| Pages project `suno-audio-player` | Active | Current `/suno*` upstream |
| Pages project `week-4` | Active | Current `/week4*` upstream |
| Pages project `original-songs-audio-player` | Active but not attached to a confirmed `nathanpuls.com` route | Uses R2 `media`; candidate for a future route only after naming is approved |
| R2 bucket `media` | Active and shared | Used by Suno, original songs, and `media.nathanpuls.com` |
| D1 database `week4-play-counts` | Active | Required by Week Four |
| GitHub repo `nathanpuls/ai-workflow-notes` | Active dependency | Used by `/api/md/*` |

## Historical Apex URL Candidates

These URLs appeared as successful HTML pages in the Internet Archive. They are
not currently proven live. Each should be classified as restore, redirect,
archive, or intentionally gone before a broad apex takeover.

`/`, `/1478-2`, `/a-super-test`, `/about`, `/about.html`, `/acting`, `/advice`,
`/answer`, `/author`, `/bio`, `/bio.html`, `/blog`, `/blog.html`, `/call`,
`/car-sick-lyrics`, `/cartoonradio`, `/category`, `/clients`, `/clients.html`,
`/comics`, `/contact`, `/contact.html`, `/contact2`, `/demo2`, `/demos`,
`/equipment`, `/fake-facts`, `/faq`, `/form`, `/free`,
`/free-voice-over-library`, `/gallery`, `/generosity`, `/hello-world`,
`/hidden-lost`, `/home`, `/home-5`, `/home-6`, `/ill-be-there`, `/improv-robot`,
`/index.html`, `/just-kidding`, `/justaudio`, `/lee-marketing`, `/linksaw`,
`/me`, `/music`, `/music.html`, `/news`, `/order.html`, `/past-projects`,
`/pay`, `/phone`, `/photos`, `/photos.html`, `/photos2`, `/podcast.html`,
`/policies`, `/portfolio`, `/projects`, `/projects.html`, `/reel`, `/reel.html`,
`/representation`, `/request-quote`, `/resum%C3%A9.html`, `/resume`,
`/resume.html`, `/review`, `/review-test`, `/reviews`, `/reviews.html`,
`/script`, `/services`, `/sleeve-lyrics`, `/social-security-number`, `/studio`,
`/studio.html`, `/super-nathan`, `/test`, `/test-2`, `/testimonials`, `/upload`,
`/videos`, `/vo`, `/vo.html`, `/voiceover`, `/voprojects.html`, `/write`.

Historical asset/system families such as `/assets`, `/audio`, `/cdn-cgi`, and
`/wp-content` should be reviewed separately from pages. `/robots.txt` is
currently active and is cataloged above.

## Known Legacy Redirect Candidates

| Path | Historical target | Current result | Suggested classification |
| --- | --- | --- | --- |
| `/twins` | `https://wyr.es/twins` | 404 | Restore redirect only if still wanted |
| `/google` | `https://google.com` | 404 | Likely intentionally gone; confirm |

## Unconfirmed Candidates

| Candidate | What is known | Next check |
| --- | --- | --- |
| A `nathanpuls.com` path for `original-songs-audio-player` | Pages project is live, but `/original-songs`, `/originalsongs`, and `/music` currently return 404 | Choose whether it should receive a new public path |
| Historical WordPress/static pages | Internet Archive proves prior existence, not current intent | Classify the list before broad routing changes |
| Other Cloudflare Workers in the account | Worker names exist, but no evidence currently ties them to `nathanpuls.com` | Inspect only if route/DNS evidence appears |

## Proposed Takeover Sequence

1. Preserve the current Workers and upstreams as the rollback layer.
2. Leave all subdomain DNS and Worker routes untouched.
3. Let the existing, more-specific `/suno*`, `/week4*`, and `/api/md/*` Worker
   routes continue to win.
4. Replace only the current `nathanpuls.com/*` apex fallback with Built.at.
5. Import or recreate approved apex pages in Built.at and verify them on a
   non-public preview host.
6. Later, replace, proxy, or embed the special route families only if there is
   a reason to consolidate them.

## Current Readiness

- Safe to design the route registry: **yes**
- Safe to import approved pages in the background: **yes**
- Safe to leave all historical 404 apex paths behind: **yes**
- Safe to change any subdomain: **no; subdomains are out of scope**
- Safe to switch the apex after active path handling is selected and verified:
  **not yet**

## Built.at Overhaul Status

The local Built.at codebase now supports the planned editable-page model:

- Pages are namespaced by `domain + path`.
- `built.at` and `nathanpuls.com` paths can be edited independently.
- Iframe is a first-class page mode alongside Markdown, HTML, and redirects.
- The same path may exist on both domains.
- The editor can switch domains without changing any subdomain.

The production D1 migration and Built.at deployment were completed on
2026-06-09. Editable iframe records are staged for:

- `nathanpuls.com/week4` -> `https://week-4.pages.dev/`
- `nathanpuls.com/suno` -> `https://suno-audio-player.pages.dev/`
- `nathanpuls.com/week4/admin` -> `https://week-4.pages.dev/admin`
- `nathanpuls.com/suno/admin` -> `https://suno-audio-player.pages.dev/admin`

The `nathanpuls.com/*` apex route moved to Built.at on 2026-06-09. The old
`week4-proxy` and `suno-path-proxy` Worker deployments were removed, and their
public paths now render the staged editable iframe records. All subdomains
remain on their existing routing and providers.

## Iframe Notes

An iframe can be a practical replacement for a self-contained visual page such
as Week Four because it allows the existing Pages site and its relative API
calls to keep working. Before choosing it, verify:

- The upstream permits iframe embedding through CSP and frame headers.
- Mobile sizing, scrolling, audio playback, and admin interactions work.
- The visible URL and navigation behavior are acceptable.
- Authentication and clipboard/browser permissions still work inside the frame.

A proxy remains the more transparent option when the whole route family should
behave like a native `nathanpuls.com` site.

As of 2026-06-09, the Week Four and Suno Pages sites did not send
`X-Frame-Options` or a Content Security Policy that blocks framing. Iframes are
therefore technically available, but are not required for the initial apex
takeover.
