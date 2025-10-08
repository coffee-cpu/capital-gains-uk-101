# Feature Completion Checklist

Use this checklist when completing any feature from the roadmap:

## Before Committing

- [ ] Feature code is complete and tested
- [ ] Unit tests added/updated (if applicable)
- [ ] E2E tests added/updated (if applicable)
- [ ] All tests pass (`npm test && npm run test:e2e`)

## Documentation Updates

- [ ] Update `ROADMAP.md`:
  - [ ] Mark feature as completed `[x]` with completion date
  - [ ] Add to "Current Status" section if it's a major feature
  - [ ] Update "Last Updated" date
- [ ] Update `README.md` if feature affects user-facing functionality
- [ ] Update `SPECIFICATION.md` if feature changes technical architecture

## Commit Message

- [ ] Include clear description of what was implemented
- [ ] Reference roadmap item or issue number if applicable
- [ ] Include testing details
- [ ] Add co-authorship footer

## Example Commit Message

```
Add [Feature Name] from roadmap

- Implement [specific functionality]
- Add tests for [test coverage]
- Update ROADMAP.md to mark feature as complete

Closes #[issue-number] (if applicable)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Reminder

**Always update ROADMAP.md as part of the same commit as the feature implementation!**
This keeps documentation in sync with code changes.
