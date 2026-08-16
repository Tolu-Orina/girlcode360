# GirlCode360: YouCam hackathon submission

**Hackathon:** [YouCam API Skin AI & Apparel VTO](https://youcam-api.devpost.com/)  
**Topic:** Skin AI + Apparel VTO (combined)  
**Deadline:** 17 August 2026, 11:45am EDT  

Paste **Project story** into Devpost's story field (Markdown). Fill the placeholders before you submit.

| Item | Value |
|---|---|
| Live app | _URL_ |
| Code repository | _GitHub URL_ (public, or private shared with contact_event@PerfectCorp.com) |
| Demo video | _YouTube / Vimeo / Youku_ (1 to 3 minutes, public) |
| Screenshots | Attach on Devpost (Mirror consent, skin scores + cycle day, apparel try-on, nearby / SheMatch if shown) |

---

## Project story

### Inspiration

Cycle apps and skin apps sit in different stores. A woman who already logs bleeds, bloating, and PMOS notes still has to open a second product to ask how her face looks today, and a third if she wants to try a dress. The question we kept hearing was not "is this a nice selfie score?" It was closer to "is this the same pattern I get around my period, or is this something else?" We cannot diagnose that. We can put YouCam's numbers next to the diary she already typed.

The hackathon asked for Skin AI and Apparel VTO together. That matched how we already think about Mirror: one studio in a health account, not a landing page that wraps one Playground call. Retail mattered too. Try-on should land on tagged boutique stock and, if she wants a shop, SheMatch nearby, not a single high-street brand.

### What it does

GirlCode360 is a signed-in PWA. Home, Cycle, Mirror, Alena, and Account are the five phone tabs. Mirror is the YouCam piece. It lives in the same Cognito account as cycle logs, PMOS Manager, pregnancy, TTC, and the Health Wallet.

After she agrees to Mirror photos she can take a face still and see `skin-analysis` scores as bars, with cycle day and phase if she has logged them, plus a wellness disclaimer. She can switch to apparel, send a full-body still, and get a `cloth-v3` try-on image. Makeup (photo, live still, look transfer, shade finder), hair (length scores and colour try-on), wardrobe (owned pieces), accessories (jewellery, nails, catalogue-only eyewear), and a timeline of real studio history sit in the same Mirror workspace.

If YouCam is unconfigured, busy, or the circuit breaker is open, capture turns off. Cycle, Alena, and the wallet still load. Declining Mirror does not turn off period tracking. Seeded demo scans are labelled Sample so a judge is not looking at a fake six-month diary.

The app does not dump raw YouCam JSON. It is not a mole map, a clinic, or a sixth tab.

### How we built it

The PWA is Vite (`apps/web`). Stills never call YouCam with a browser key. They POST to our API. Lambda in `infra-backend` runs S2S (`youcam.ts`): `skin-analysis`, `cloth-v3`, makeup, hair, nail, jewellery where we have a SKU still. Many tasks return `pending`. The UI keeps the chosen photo on stage, polls GET, then shows the result image or a mapped error. Webhooks help when they arrive. Polling is the path we cannot skip.

Auth is Cognito. API Gateway, Aurora DSQL, S3 for result bytes, Secrets Manager for `youcam_api_key`. Consent for biometric photos is a separate ledger from signup. Live camera is a second grant. After we finish a YouCam file we delete it on their side.

Scan rows store cycle day and phase at capture. Apparel catalogue items can carry maternity week and PMOS-fit tags; filters go empty on purpose if pregnancy week is missing. SheMatch uses session area and existing boutique tags. Alena only sees what she has allowed. Tray photos stay in IndexedDB on the device. They are not sent to Alena.

Mirror on desktop is a studio row: stage, product rail, saved photos. On a phone the same studios sit under one nav, with the switcher next to "Your studio." Wardrobe is owned clothes. Apparel is boutique SKUs. We kept those tables apart on purpose.

### Challenges we ran into

YouCam POST is often not the answer. Every studio needed its own pending row, media fetch, and "keep this screen open" copy. Treating Playground stills as the product would have skipped that work. Wiring fail-closed across five capture paths was slower than the S2S hello world.

Skin and apparel do not share a photo. Judges want both APIs. Users should not be told to try a gown on a selfie. Face stills stay on Skin, Makeup, and Hair. Apparel Use is disabled unless the tray still is full body. Wardrobe garments are a third kind (piece on a table). Three guides, three tray filters. Mix them once and it looks like a bug.

Wardrobe is not the boutique. One clothing grid was the first sketch. Putting catalogue SKUs into `wardrobe_items` would have taught Alena that shop samples were hers. Boutique samples stay labelled as samples. Several apparel SKUs still reuse the same Perfect Corp PNG. That is ugly and honest. We did not seed a fake owned closet to fill empty states.

Accessories are limited by assets, not by UI ambition. Jewellery try-on needs a catalogue SKU still. We do not invent 3D from a random product photo. Pieces without a still stay visible with "no SKU still" and capture off. Eyewear S2S is not on this API key, so frames are catalogue only. Nails need a hand photo and a hex. Rings, bracelets, and watches want hand or wrist. Earrings and necklaces want face. Saying no without looking unfinished was the actual design problem.

A front face still can score hair length. Density needs another pose. Plotting density from a selfie would be a lie, even if the JSON has a number. Makeup had a quieter trap: thumbnail tap selects, Use runs. Auto-running on tap felt fast and was wrong.

PWA camera is not the Playground webcam. iOS Safari, HTTPS, permissions, and mapping an on-screen oval onto the video buffer. Live zoom and FaceDetector were unreliable. We crop from geometry at capture (JPEG, small pad) so the file matches what she framed. Face gets a guide. Body and hand do not fake an oval. Offline wardrobe photos can queue in IndexedDB. Try-on waits for a connection.

UK GDPR treats these photos as special category. Wellness copy only: no diagnosis, no invented hospitals, no "this score means PMOS." Cycle context appears only if she logged it.

Seven studios had to fit five tabs. Sidebar plus a three-column studio overlapped (scores over the photo tray) more than once. Timeline pulls real events from skin, makeup, hair, wardrobe, apparel, and accessories. We did not invent month-over-month cost-per-wear arrows the API does not give. UK, Nigeria, and Ghana share one English UI. Currency follows market, not a dollar sign from a mock.

### Accomplishments that we're proud of

We shipped both required YouCam products in one signed-in app, called from Lambda, not from the browser. Skin scores can sit next to a cycle day she already logged. Apparel try-on uses her body still and a boutique SKU.

Consent is split from signup. YouCam down does not take Cycle with it. Sample history is labelled. Empty maternity and PMOS filters tell the truth. Jewellery without a SKU still does not pretend to try on. Hair length is labelled as length.

The PWA has Home, Cycle, Mirror (those seven studios), and Alena on phone and desktop, with offline, pending, and error states instead of "coming soon."

### What we learned

S2S try-on is a job queue with pictures. If the UI assumes POST returns the look, it will lie the first time YouCam says `pending`.

Honesty in VTO is product work. Disabled Use on a face photo, "catalogue only" on eyewear, and Sample on seeded scans cost more copy than another gradient.

iOS capture wants geometry, not a clever live zoom. On-device photos and Alena staying blind to faces is easier to explain than to keep true across every tray "Use" button.

Combining Skin AI and Apparel VTO is easy in a slide and messy in navigation. The health record YouCam cannot see (cycle and PMOS notes) is the part worth keeping if we strip the demo down.

### What's next for GirlCode360

Live Business Portal intake for retailer 3D jewellery assets (catalogue seeds are what we have now). Distinct licensed garment stills so apparel rows do not share one PNG. Eyewear try-on if the API key allows it. Hair density only when we have the extra poses, not from a front selfie. Keep HealthLens as a separate, non-diagnostic report. Do not add a sixth app tab.

---

## Demo video (1 to 3 minutes)

Judges may stop at three minutes. Keep it on-device and quiet (no unlicensed music, no other brands' logos).

Suggested beat:

1. Home in 10 seconds. Who this is for.
2. Name the APIs: Skin Analysis and Apparel VTO (`cloth-v3`), called from our backend.
3. Consent, then a face photo. Scores + cycle day on screen. Say it is wellness, not a diagnosis.
4. Apparel try-on on a full-body photo. Result image.
5. Optional: one nearby / SheMatch beat, or Alena if there is time.
6. Close: same account, two YouCam products, health context YouCam cannot see on its own.

Record the PWA on a phone if that is the target, or desktop if that is what you demo. Do not switch mid-video without saying so.

---

## Repository notes for Perfect Corp

The repo should include:

- `apps/web` (Vite PWA)
- `infra-backend` Lambda YouCam client (`youcam.ts`) and Mirror handlers
- README: how to run locally, which env secrets are required (`youcam_api_key`), and that production keys stay in AWS Secrets Manager

Do not commit YouCam keys, Cognito passwords, or wallet passphrases.

---

## Submission checklist

- [ ] Devpost project created under **Skin AI + Apparel VTO**
- [ ] Project story pasted from this file (edit live URL and names)
- [ ] Repository URL (public licence, or private + email to contact_event@PerfectCorp.com)
- [ ] Screenshots: consent, skin + cycle overlay, apparel result, at least one other Mirror tab
- [ ] Public 1 to 3 min video link
- [ ] Team agrees to an exit interview and a Perfect Corp blog mention if we place
- [ ] Confirm you are eligible (age of majority; check excluded territories on [the hackathon page](https://youcam-api.devpost.com/))
