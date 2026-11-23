# THE RISE — Build the full website in ONE go (single prompt)

## What to build
Build a complete, polished, responsive magazine website called **The Rise** in THIS folder only. Do NOT create a subfolder. Do NOT ask questions. Work in: /Users/ahanafakif/Desktop/The Rise

The Rise features people who do great work — researchers who publish papers, hackathon 1st/2nd/3rd winners, Dean's Award recipients, prize winners, and people who build platforms. Forbes / magazine style. Language: English. Audience: Bangladesh first, then global.

## Tech (keep it simple, no heavy setup)
- Plain HTML + CSS + vanilla JavaScript only. NO npm, NO build step, NO framework install.
- Files: index.html, styles.css, script.js, README.md
- Open by double-clicking index.html — it must work offline except images/fonts.
- Use Google Fonts (Playfair Display for headlines, Inter for body) with system-font fallback.
- Images: use direct Unsplash image URLs (images.unsplash.com). No broken images, no placeholder grey boxes.
- Fully responsive: desktop, tablet, mobile. Mobile menu with hamburger.

## Design — mix all 6 references into ONE unique style
Base layout = Oriel (clean premium editorial). Hero boldness = CULT.MAGAZINE + GLOBALY + FASHORA. Content grids = NEWSIAN + Global.News.
- Colours: white background, near-black text (#111), deep navy (#0F2040), warm amber accent (#F59E0B), one red accent only for Subscribe buttons (#C8102E).
- Masthead: huge serif "The Rise." centred at top, with date + Subscribe button, thin nav below: Home, Stories, Categories, Nominate, About, Search.
- Big bold headlines, generous white space, rounded story cards, numbered lists, category colour tags.
- NO lorem ipsum. Every headline and paragraph must be real, readable English.

## Sections in order (all on index.html)
1. **Top bar + Masthead:** The Rise. logo, date, Subscribe button. Nav: Home, Stories, Categories, Nominate, About.
2. **Hero:** Huge headline "Celebrating People Who Do Great Work", subtext about research, hackathons and awards, two buttons: Explore Stories, Submit a Nomination. Right side: Featured Person of the Week card — photo, name, category tag Research, short bio, Award badge.
3. **Editor's Pick:** One large feature story (image left, text right) — a hackathon winner story.
4. **Freshly Published / Latest Stories:** 6 story cards in a staggered grid. Each card: photo, category tag (Research / Hackathon / Award / Innovation), title, 1-line summary, author, read time, date. Use realistic sample achievers (e.g. a CSE researcher, a hackathon team, a Dean's Award student). Mark them clearly as sample stories in README, do NOT invent real people's awards.
5. **Featured Categories:** 5 tiles with photos: Research, Hackathon, Awards, Innovation, Leadership. Clicking a tile filters the Latest Stories grid by that category (working JavaScript filter, no page reload).
6. **Most Read This Week:** Numbered list 1-5 on the left, one large photo story on the right.
7. **How to Get Featured in 3 Steps:** 1 Submit Nomination, 2 Editorial Review (we verify proof), 3 Publish & Spotlight.
8. **The People Who Write The Rise:** Contributor strip with 4 names, roles, small round photos.
9. **Newsletter:** "Five good stories, every Sunday" — email input + Subscribe button, with a small JS success message (no backend, no real sending).
10. **Footer:** Huge THE RISE text, columns: Explore, About, Follow (LinkedIn, Facebook, Instagram, YouTube as text links), Contact email hello@therise.media, copyright 2026 The Rise.

## Interactions (must all work)
- Category filter in section 5 filters section 4.
- Search icon opens a small search box that filters story titles live.
- Mobile hamburger menu opens/closes.
- Newsletter form shows "Thanks! You are on the list." without reloading.
- Smooth scroll to sections from nav.

## Finish and verify
- After writing files, check: index.html, styles.css, script.js all exist in this folder, no missing files, no console errors in the JS you wrote.
- Write a short README.md explaining how to open the site (double-click index.html) and what each section is.
- Reply at the end with a short summary: what you built, file list, and how to view it. Do NOT start a dev server. Do NOT install anything.
