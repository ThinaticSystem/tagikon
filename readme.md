# Project Name

> **Note**: This is a project template.

## Checklist

- [ ] Update [`readme.md`](./readme.md) (this file)
- [ ] Update [`package.json`](./package.json) details
- [ ] Update [`devcontainer.json`](./.devcontainer/devcontainer.json)
- [ ] Install Renovate on the remote repository: [Renovate Documentation](https://docs.renovatebot.com/getting-started/installing-onboarding/)

## Development

### Setup

#### in VS Code

1. Setup Dev Containers in VS Code: [Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers#_getting-started)
1. Open this project in Dev Container

   <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> -> `Dev Containers: Reopen in Container`

### Commands

#### Run

- **Terminal:** `pnpm dev`
- **VS Code:** Press <kbd>F5</kbd>

#### Format Code

- **Terminal:** `pnpm format`
- **VS Code:** <kbd>Ctrl</kbd> + <kbd>P</kbd> -> `task format`

#### Lint

- **Terminal:** `pnpm lint`
- **VS Code:** <kbd>Ctrl</kbd> + <kbd>P</kbd> -> `task lint`

#### Type Check

- **Terminal:** `pnpm typecheck`
- **VS Code:** <kbd>Ctrl</kbd> + <kbd>P</kbd> -> `task typecheck`

#### Run Tests

- **Terminal:** `pnpm test`
- **VS Code:** <kbd>Ctrl</kbd> + <kbd>P</kbd> -> `task test`

#### Run All Checks (Format, Lint, Type Check, Tests)

- **Terminal:** `pnpm check`
- **VS Code:** <kbd>Ctrl</kbd> + <kbd>P</kbd> -> `task check`

---

For other available scripts, please refer to the `scripts` section in [`package.json`](./package.json).
