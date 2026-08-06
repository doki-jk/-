# Changelog

## 0.3.0

### Data correctness

- Automatically recalculate calories and macros when a food quantity changes
- Add controlled manual override for nutrition values
- Add meal editing, time editing, delete confirmation and eight-second undo
- Preserve meal timestamps when editing or restoring a deleted item
- Make date switching atomic and prevent stale requests from overwriting the current day
- Reject impossible calendar dates
- Store training/rest status and goal snapshots per date
- Track food usage so frequent foods rank higher

### Data safety

- Add complete JSON backup and restore across web and desktop
- Add meal CSV export
- Preserve corrupt browser data and report the problem instead of silently showing empty data
- Add strict validation and transactional SQLite restore

### Smarter guidance

- Use one canonical built-in food catalog for search, seeding and recognition
- Add confidence protection to local food recognition
- Add explainable goal recommendations based on profile, activity and objective
- Clarify that nutrition and goal results are estimates

### Security and engineering

- Enable Tauri CSP
- Add automated regression tests
- Add npm high-severity audit gate
- Upgrade Vite, Vitest, Recharts and Tauri dependencies
- Add reproducible npm and Cargo lockfiles
- Update CI to Node.js 22
- Update project, architecture, privacy and security documentation

## 0.2.0

- Add local natural-language food matching and portion estimation
- Expand built-in food catalog
- Publish web review and Windows installers

## 0.1.1

- Fix desktop SQLite write permission

## 0.1.0

- Initial nutrition dashboard, meal records, goals, body records and analytics
