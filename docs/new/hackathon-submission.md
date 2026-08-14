# GirlCode360 — YouCam hackathon submission

**Hackathon:** [YouCam API Skin AI & Apparel VTO](https://youcam-api.devpost.com/)  
**Topic:** Skin AI + Apparel VTO (combined)  
**Deadline:** 17 August 2026, 11:45am EDT  

Paste the **Project description** into Devpost. Fill the placeholders before you submit.

| Item | Value |
|---|---|
| Live app | _URL_ |
| Code repository | _GitHub URL_ (public, or private shared with contact_event@PerfectCorp.com) |
| Demo video | _YouTube / Vimeo / Youku_ (1–3 minutes, public) |
| Screenshots | Attach on Devpost (Mirror consent, skin scores + cycle day, apparel try-on, nearby / SheMatch if shown) |

---

## Project description

GirlCode360 is a working web app for women who already track a cycle, symptoms, fertility, or pregnancy, and who also care how their skin and clothes look. Mirror is the YouCam piece. It sits in the same account as those logs. It is not a separate skin toy and not a separate dressing-room demo.

A first-time user can sign in, agree to Mirror photos, take a face photo, and see YouCam skin scores on the same screen as the cycle day and phase they chose to share. They can switch to apparel try-on, send a full-body photo, and get a generated look back. Makeup, hair, and wardrobe live in the same Mirror studio. If YouCam is down, Cycle, Alena, and the Health Wallet still run. We fail that way on purpose.

Skin apps usually answer “how does my face look in this photo?” Try-on apps usually answer “how might this outfit sit on this body?” The question we hear from people with hormonal skin is closer to “is this the same pattern I get around my period, or is this something else?” We do not diagnose that. We do put YouCam’s numbers next to the cycle and PMOS diary the user already keeps, so the picture is less of a one-off snapshot.

On the retail side, try-on is wired to tagged boutique inventory through the business portal, then to nearby pharmacies, clinics, and beauty shops the user has already opted into via SheMatch. The catalogue is not locked to one high-street brand.

YouCam never runs in the browser with our API key. The PWA uploads a still to our API. Lambda talks to YouCam S2S (`skin-analysis`, `cloth-v3`, plus makeup, hair, and related try-on tasks). Webhooks and polling bring results back. Consent for biometric photos is a separate event from account signup. Declining Mirror does not turn off period tracking.

This is a production-shaped AWS PWA (Cognito, API Gateway, Lambda, Aurora DSQL, S3), not a notebook wrapping one API call. Judges can click through Home, Cycle, Mirror, and Alena on a phone or desktop.

---

## What we built (for judges)

**YouCam APIs in this submission**

- Skin Analysis (`skin-analysis`): face photo in, scores and type out. Shown as numbers and bars, with a wellness disclaimer.
- Apparel VTO (`cloth-v3`): full-body photo in, generated try-on image out.
- Same studio, same consent path: makeup try-on / look transfer, shade finder, hair analysis and hair try-on, plus accessory paths where we have assets.

**GirlCode360 around those calls**

- Cycle and PMOS diary (offline-first). Scan rows store cycle day and phase at capture.
- Cycle-correlated skin view: later scans sit on a timeline against that history. We label seeded demo history vs live scans so judges are not misled.
- Maternity / PMOS catalogue filter when those modules are on. Honest empty copy when they are not.
- SheMatch: nearby products and shops from the user’s session area, not a fake hospital list.
- Alena: in-app assistant that can talk about what the user has allowed. HealthLens is a separate, non-diagnostic report path.
- Privacy: biometric consent ledger, YouCam file delete after we are done, circuit breaker if YouCam fails repeatedly.

**What it is not**

- Not a diagnosis, mole map, or clinician replacement.
- Not a wrapper that dumps raw YouCam JSON on the user.
- Not a sixth phone tab. Mirror is one of five: Home, Cycle, Mirror, Alena, Account.

---

## Consumer and retail value

| Who | What they get in a first session |
|---|---|
| Someone tracking periods and breakouts | A YouCam skin score next to the cycle day they already logged, plus a way to compare a later photo. |
| Someone shopping clothes or makeup online | A try-on on their own photo, then nearby shops if they want a real-world next step. |
| A small boutique | Tagged looks that run through the same Apparel VTO path the shopper uses. |

---

## How this maps to judging

**Technological implementation.** Live S2S YouCam tasks, not screenshots of the Playground. Skin and apparel in one module. Keys and rate limits on the server. The rest of the health app stays up if YouCam is unavailable.

**Design.** Signed-in PWA with a real Home, Cycle, Mirror studio (Skin, Makeup, Hair, Wardrobe, Accessories), and Alena. Empty, offline, and consent states are built, not left as “coming soon.”

**Potential impact.** Audience is women in the UK, Nigeria, and Ghana (and anyone who can reach the PWA) who are tired of a cycle app, a skin app, and a shop that do not share context. The demo shows that path. It does not claim clinical outcomes.

**Quality of the idea.** Combined topic on purpose. The non-obvious part is the health record YouCam does not have: cycle and PMOS history the user already typed in. Copying a skin scan into a new landing page would miss that.

---

## Demo video (1–3 minutes)

Judges may stop at three minutes. Keep it on-device and quiet (no unlicensed music, no other brands’ logos).

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
- [ ] Description pasted from this file (edit live URL and names)
- [ ] Repository URL (public licence, or private + email to contact_event@PerfectCorp.com)
- [ ] Screenshots: consent, skin + cycle overlay, apparel result, at least one other Mirror tab
- [ ] Public 1–3 min video link
- [ ] Team agrees to an exit interview and a Perfect Corp blog mention if we place
- [ ] Confirm you are eligible (age of majority; check excluded territories on [the hackathon page](https://youcam-api.devpost.com/))
