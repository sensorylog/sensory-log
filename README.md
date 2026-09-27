# Sensory Log

Sensory Log is a calm, local-first tool for noticing energy, sensory load, masking, recovery, and the patterns that emerge over time.

## Open the app

The production app is hosted on Firebase Hosting. The default Firebase Hosting URL is based on the Hosting site ID, commonly the Firebase project ID.

If the production deployment is temporarily unavailable, use the repository's local development flow instead of assuming GitHub Pages is the production host.

## Your data

The core log is designed to stay on your device:

- Entries are stored in IndexedDB when available.
- localStorage remains as a compatibility/fallback layer.
- There is no required account for the core logging experience.
- JSON and CSV export are available from **More → Your data**.
- Imports are validated, normalized, and merged by calendar date.
- Privacy Center provides an in-app way to reset Sensory Log-owned local data on the device.\n- Clearing browser/site data can remove local history, so keep a backup of anything important.

Optional AI reflection is separate from the core logging flow. If you enable an AI provider and choose a sharing level, the selected data may leave the device to that provider. Written notes are excluded unless you explicitly enable note sharing for AI.

## What the app does

### Check in

The progressive check-in asks for:

1. Current energy/capacity
2. Sensory load and masking
3. Recovery need, social battery, and optional sleep quality

Only energy is required to save a useful check-in.

### Patterns

Pattern Intelligence looks for repeated observations in your own history. It deliberately avoids treating correlations as diagnoses or proof of cause. Cards appear once there is enough repeated information to make a comparison useful.

### Regulation

Regulation provides short, state-based protocols and a two-minute reset timer. It can use your previously logged helpful strategies as context.

### History

History gives you a local calendar and recent-entry view. Selecting a day opens that date in Check in so you can review or update it.

### Personal operating manual

The manual summarizes descriptive signals from your own history and lets you add context that the data cannot capture.

### Reports

Reports provide 7-day, 30-day, 90-day, or all-time summaries, with optional inclusion of your written notes when printing/saving a report.

### Signal

Signal is a small curated feed of neurodivergence-related people, apps, research, and community updates. It can use explicit preferences from your Personal Manual to surface relevant items, but it does not infer sensitive traits from your check-ins.

## Privacy and safety

Sensory Log is a personal reflection and journaling tool, not medical care, diagnosis, treatment, or a substitute for professional advice.

The app does not require a streak, score, or daily target. Use the information as context for your own decisions and keep backups of anything you want to preserve.

## Development

This is a static browser application with modular JavaScript and CSS. GitHub Actions validates JavaScript syntax and application integrity on pushes and pull requests.

Production deployment is automated through GitHub Actions → Firebase Hosting once the repository's Firebase service-account secret has the required access to the Firebase project. Firebase recommends Application Default Credentials for CI and requires the service account to have appropriate project permissions.
