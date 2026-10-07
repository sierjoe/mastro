# MASTRO — Adviser's Workspace (v5)

Offline forms, documents and class management for the class adviser
(Impalutao Integrated School). Runs in the browser on MacBook and iPhone and works without internet once opened.

## What's inside
- **Home**: class summary, attendance today, credentials overview (who is missing what), and data checks.
- **Attendance** (SeatCheck inside MASTRO): seating chart (tap = absent, double-tap = late, hold = excused), month grid,
  cleaning groups with QR cards and camera scanning (100/75/50%), SF2 and SF4 (print/PDF and Excel), and SeatCheck backup import.
- **Learners**: roster plus checklist for Term 1–3 grades (automatic), Birth Certificate, Old Form 137, SF10 and LIS Enrolment.
- **Grades / Analysis**: consolidated gradesheet; mean, median, mode, SD, passing rate and more.
- **Forms**: SF1–SF10 workspaces for uploads. **SF9** generator: front and back for each learner, print, bulk PDF (A4)
  and Excel filled in your own template.
- **Item Analysis**: summative tests and term exams per term — MPS, difficulty, discrimination, distractors, competencies, print/Excel.
- **SF1 import** (Learners → Upload SF1): marks LIS Enrolment, uses SF1 names/LRN/birthdates everywhere.
- **School calendar** (Attendance → Manage): DepEd SY 2026–2027 weekdays, breaks and holidays; tap a date to mark a suspension.
- **Classes**: your ECRs (DepEd ECR 2026 layout) with the sparkling **Analyze** reports, plus **Add a class** to create a new blank ECR with all formulas kept.
- **Template auto-fill**: upload your SF2, SF3, SF4, SF5, SF6, SF7, SF8 or SF10 template in Forms and download it filled.
- **Learner status**: tag T/O, SARDO, NLP or Dropped Out; statistics and reports reflect it.
- **Printouts**: SF9 in A4 or A5 (portrait or landscape) with DepEd and school seals (upload them in Settings).
- **Repository** and **Settings** (backup/restore).

## Update your GitHub copy (you already have v1 online)
1. Unzip `MASTRO.zip`. Open the `mastro` folder.
2. In your `mastro` repository on GitHub, click **Add file → Upload files**.
3. Drag **everything inside the folder** (files and the folders `css`, `js`, `icons`, `vendor`, `templates`) — v4 adds `js/templates.js` and `js/classes.js`; into the page,
   then **Commit changes**. Files with the same name are replaced.
4. Optional clean-up: `js/app.js` and `vendor/exceljs.min.js` are no longer used — you can delete them on GitHub.
5. Wait 1–2 minutes, then open your app link. On iPhone, open MASTRO once while online so it saves the new version.
   (If you still see the old version, close the app fully and open it again.)

Your grades and settings stay on each device and carry over to v2. Your SeatCheck data (as of the backup you sent)
is already loaded; to bring in newer SeatCheck records, go to **Attendance → Manage → Import SeatCheck backup**.

## First-time setup (new device)
1. GitHub → **Settings → Pages** → Branch `main`, folder `/ (root)` → Save.
2. App link: `https://YOUR-USERNAME.github.io/mastro/`
3. iPhone: open in Safari → Share → **Add to Home Screen**.

## Your data (important — privacy)
- **No learner data is inside the app files.** GitHub Pages repositories are public, so names, LRNs and grades are never uploaded there.
- Your class data is in `MASTRO-my-data.json` (sent separately). Keep it in your **private** Google Drive — **do not upload it to GitHub**.
- New device: open MASTRO → Home → **Restore my data file** → choose `MASTRO-my-data.json`.
- A device that already has your data: don't restore (it would replace newer attendance). Just upload the ECRs in **Classes**.

- Saved only on the device (browser storage). Use **Settings → Backup** often and keep the file in your Google Drive folder.
- To move data to another device: **Settings → Restore backup** there.
- Clearing Safari website data deletes MASTRO data — keep backups.
- When you change files later, also edit `sw.js` and raise `mastro-v5.0.0` (e.g. to `mastro-v5.0.1`) so devices download the update.
