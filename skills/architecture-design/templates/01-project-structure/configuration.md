# Configuration

Environment variables are validated at boot in `<src/shared/config/config.schema.ts>`. Secrets come from
<secret store>, never from committed files. `{env}` = `<RUNTIME_ENV>` (`dev`, `test`, `uat`, `prod`).

## <Concern: runtime and transports>

| Variable | Type | Default | Used for |
| --- | --- | --- | --- |
| `<RUNTIME_ENV>` | string | — | Topic and bucket names |
| `<DATABASE_URI>` | secret | — | <what needs it> |
| `<FEATURE>_ENABLED` | boolean | `false` | <phase or requirement that switches it on> |

## <Concern: external API>

| Variable | Type | Default | Used for |
| --- | --- | --- | --- |
| `<VENDOR>_BASE_URL` | string | — | <endpoint> |
| `<VENDOR>_TIMEOUT_MS` | number | `<n>` | <why this value: the measurement or rule behind it> |

## Files

| File | Holds | Validated |
| --- | --- | --- |
| `config/<name>.json` | <content> | <how, at boot> |
