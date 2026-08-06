# Security Policy

## Supported version

Security fixes are applied to the latest FuelLog release line. During the 0.x development phase, users should upgrade to the newest available version.

## Reporting a vulnerability

Do not publish sensitive exploit details, personal data or malicious proof-of-concept payloads in a public issue. Contact the repository owner privately and include:

- affected version
- operating system or browser
- reproduction steps
- impact
- logs with personal data removed

## Security controls

FuelLog uses:

- a Tauri content security policy
- parameterized SQLite queries
- explicit SQL capabilities for the main window
- strict input and date validation
- transactional database migrations and backup restore
- dependency lockfiles
- CI checks for high and critical npm vulnerabilities
- automated frontend and repository regression tests

## Windows installer trust

CI-generated Windows installers are not automatically trustworthy merely because they build successfully. Public distribution should use a reputable code-signing certificate and a protected signing workflow. Until signing is configured, Windows SmartScreen may show an unknown-publisher warning.

Never instruct users to disable antivirus protection or add broad exclusions to install FuelLog.

## Secrets

API keys, signing certificates, passwords and private updater keys must not be committed to the repository. Use protected repository or environment secrets with least-privilege workflows.
