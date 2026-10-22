# Shared Domain (`src/shared/domain/`)

Plain <language>. No framework, ORM, or vendor SDK imports.

## Entities (`entities/`)

| Entity | Collection or table | Notes (who may change what) |
| --- | --- | --- |
| `<Entity>` | `<collection>` | No public setter for `status`: only `<StatusMachine>` changes it |

## Ports

Each port is an interface with an injection token. Implementations are wired in infrastructure modules, never in a
business module.

| Port | Implementation | Main methods (signatures only) |
| --- | --- | --- |
| `<Entity>Repository` | `<Entity>RepositoryImpl` | `findById(id)`, `save(entity, expectedVersion)` |
| `<Vendor>Api` | `<Vendor>ApiService` (<SDK or HTTP>) | `<method>(<args>): <result>` |

## Domain services (`services/`)

They change the entities they receive; they never load or save. A use case loads, calls them, saves each entity once.

| Service | Only writer of | Methods |
| --- | --- | --- |
| `<StatusMachine>` | `status`, `statusHistory` | `transition(entity, to, actor, reason)` → event descriptor; throws `<STATUS_CHANGE_INVALID>` |

## Pure rules (`rules/`)

| Rule | Input → output | Requirements |
| --- | --- | --- |
| `<validateX>` | <input> → `passed` or `failed` + reasons | <FR ids> |

## Domain events (`events/`)

| Class | Code | Raised by |
| --- | --- | --- |
| `<Name>Event` | `<ABC101>` | `<UseCase>` after its transaction commits |

## Enums (`enums/`)

All enums of [`../06-data-modeling/_common.schema.json`](../06-data-modeling/_common.schema.json) `$defs`, one file
each. Wire values are the same strings.
