# Query — <Source DB> <what we look up>

| Item | Value |
| --- | --- |
| Name | <query group name> |
| Description | <why we read this database> |
| Database | <engine>, `<schema>.<table>` |
| Role | read-only `<role>` (`<DB>_DATABASE_URL`) |
| Owner | <team>; DDL: <path> |
| Called by | `<Port>.<method>` in `<UseCase>` |
| Requirements | <FR ids> |

## Queries

### Q1 — <what it answers>

```sql
SELECT <column>, <column>
FROM <schema>.<table>
WHERE <column> = :<param>
  AND <scope column> = ANY(:<scope list>)
ORDER BY <column> DESC
LIMIT 1;
```

| Parameter | Type | Source |
| --- | --- | --- |
| `:<param>` | varchar | `<entity>.<field>` |

| Column read | Type | Used for |
| --- | --- | --- |
| `<column>` | varchar | <rule> |

Index used: `<index name or columns>` (`[ASSUMPTION]` until the owner confirms).

## Answer handling

| Answer | We do |
| --- | --- |
| No row | <rule> |
| Database down | <retry with backoff by timer; the flow waits, it does not skip> |
