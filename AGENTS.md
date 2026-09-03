# Home Assistant plugin Agent Instructions

This project is integrated into the Gokivego workspace as a Git Subtree.

## Git Subtree and Upstream Workflow

- **Upstream Remote:** `grokbot-home-assistant` (`https://github.com/gokivego/grokbot-home-assistant.git`)
- **Primary Branch:** `main`
- **Subtree Directory:** `home-assistant/`

When making changes within this directory:
1. Ensure changes are tested and verified locally according to [`README.md`](./README.md).
2. Document meaningful changes, decisions, and troubleshooting in [`LOG.md`](./LOG.md).
3. Commit changes to the root workspace repository.
4. Push subtree changes to the upstream private remote:
   ```bash
   git subtree push --prefix=home-assistant grokbot-home-assistant main
   ```
5. If syncing changes from upstream:
   ```bash
   git subtree pull --prefix=home-assistant grokbot-home-assistant main --squash
   ```

Keep `.env` gitignored. Do not commit `HA_TOKEN`.
