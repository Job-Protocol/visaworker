## Summary

<!-- What does this change do, in one or two sentences? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / internal cleanup
- [ ] Documentation
- [ ] Other (please describe)

## Checklist

- [ ] I ran `bun run lint` and `bunx tsgo --noEmit` locally
- [ ] I did **not** add imports from `@/ee/*` deep paths — only the barrel (`@/ee` / `@/ee/server`) is allowed from open code
- [ ] I did not commit secrets, `.env` files, or production credentials
- [ ] If this touches the database schema, I updated `docs/oss/ee-db-manifest.json` when the change concerns an EE-only table/function/column
- [ ] Docs updated where relevant (`README.md`, `docs/`)

## Testing

<!-- How did you verify the change? -->
