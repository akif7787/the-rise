# The Rise

A responsive, Bangladesh-first editorial magazine concept about people doing meaningful work. Built with plain HTML, CSS, and vanilla JavaScript.

## Open the website

Double-click **index.html** in this folder. No installation, build step, or development server is required. Internet access is needed for Google Fonts and the direct Unsplash photographs; the layout, text, system-font fallbacks, and local interactions work without a server.

## Files

- `index.html` — all ten homepage sections, accessible navigation, story cards, and the shared dialog.
- `styles.css` — responsive layout, editorial typography, category colours, mobile navigation, focus states, and reduced-motion support.
- `script.js` — category and title filtering, mobile menu, search panel, story previews, nomination guidance, newsletter demo, and date display in Bangladesh time.
- `README.md` — opening instructions and content notes.

## Homepage sections

1. **Top bar and masthead:** date, oversized The Rise. wordmark, Subscribe link, navigation, and expandable search.
2. **Hero:** the magazine mission and a layered Featured Person of the Week card.
3. **Editor’s Pick:** an illustrated hackathon winner feature.
4. **Freshly Published:** six sample stories in a staggered grid with category, author, read time, and date.
5. **Featured Categories:** Research, Hackathon, Awards, Innovation, and Leadership photo tiles filter the story grid. Selecting the active tile again clears that category.
6. **Most Read This Week:** five numbered editorial selections and a large photo feature. The ranking is illustrative, not analytics.
7. **How to Get Featured:** nomination, evidence review, and publication. The button opens guidance and an optional email draft.
8. **The People Who Write The Rise:** four sample contributors with roles and illustrative portraits.
9. **Newsletter:** browser email validation and the requested “Thanks! You are on the list.” success message, with no reload.
10. **Footer:** Explore, About, Follow, contact email, editorial standards, copyright, and a large wordmark.

## Interactions

Category and search filters combine. Search matches story titles live; “View all stories” resets both filters. No-result searches show a clear reset option. Navigation scrolls within the page, the mobile menu closes after selection, and Escape closes search/menu panels. Story links open readable sample previews in a native modal dialog; Escape or the close button dismisses it. Keyboard focus returns to the opening control. Reduced-motion preferences disable smooth scrolling and transitions.

## Sample content and service limits

**All achievers, contributor identities, achievements, awards, teams, stories, and affiliations are fictional sample content.** Any resemblance to real people is coincidental. No real person is claimed to have received an award or published the described paper. Labels appear on the homepage and within story previews. Research excellence badges and first-, second-, and third-place results are illustrative. Card read times describe sample full-length features; dialogs contain shorter previews.

Unsplash photographs are illustrative stock images, not portraits documenting the named fictional people. They remain direct remote image URLs, with no local asset folders. Google Fonts supplies Playfair Display and Inter with local system fallbacks.

The newsletter is a front-end demonstration: **no email is stored, transmitted, or actually subscribed**, despite the requested success wording. Nomination guidance does not collect data; the optional mailto link opens an email draft only. `hello@therise.media` is the supplied concept contact address and has not been verified. Social links lead to the platforms’ homepages, not claimed official accounts. No analytics or backend is included.

## Design direction

Oriel-inspired serif masthead, fine rules, white space, and split editorial feature; CULT.MAGAZINE-inspired bold hero scale; FASHORA-inspired portrait emphasis and oversized branding; GLOBALY-inspired layered cards and category discovery; NEWSIAN-inspired rounded cards and contributor groupings; Global.News-inspired story hierarchy and numbered reading list. The palette uses white, near-black, deep navy, warm amber, and red reserved for Subscribe buttons.

## Verification

- Confirmed all four deliverables exist directly in the requested folder, with no generated subfolder. The pre-existing `PROMPT.md` was preserved.
- JavaScript syntax check passed. Local stylesheet/script references, unique IDs, internal anchor destinations, six story cards, and image alternative text passed structural checks.
- Seventy simulated-DOM assertions passed for category counts, category toggling, combined live search, no-result recovery, menu behaviour, newsletter feedback, every story trigger, modal focus return, nomination guidance, editorial standards, and the date display. These are logic checks, not a substitute for a browser test.
- Visual responsiveness and the real browser console could not be verified: native computer-use permission was unavailable and the in-app browser blocks local `file:` URLs. No server was started to work around that restriction.
- Remote image availability could not be checked because this environment’s network lookup was restricted. Images and fonts require an internet connection when opening the site.
- Nothing was installed, and no development server or build step was used.
