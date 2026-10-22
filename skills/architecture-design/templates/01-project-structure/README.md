# 01 — Project Structure

<Service> is a <framework> service in <Clean Architecture / hexagonal / layered> style. Dependencies point inward:
interface adapters → application → domain. Infrastructure is wired by dependency injection.

| File | Holds |
| --- | --- |
| [`modules.md`](modules.md) | Each module: entry points, commands it owns, use cases, events, collections it writes |
| [`shared-domain.md`](shared-domain.md) | Entities, ports, domain services, pure rules, events, enums |
| [`error-codes.md`](error-codes.md) | Every error code the service returns |
| [`configuration.md`](configuration.md) | Every environment variable and config file |

## Source tree

```
src/
├── main.ts                          # boot: <transports>
├── app.module.ts                    # imports every module below
├── modules/
│   ├── <adapter-module>/            # adapter: <vendor> → commands; no business rule
│   ├── <business-module-1>/         # <one-line purpose>
│   │   ├── controllers/             # <gRPC | Kafka | HTTP> entry
│   │   ├── models/                  # requests/, responses/, presenters/
│   │   ├── usecases/                # one class per use case
│   │   ├── commands/                # commands this module HANDLES (+ handlers/)
│   │   └── events/                  # events only this module raises
│   └── <business-module-2>/
└── shared/
    ├── domain/                      # framework-free: entities, ports, services, rules, events, enums
    ├── <db>/                        # repository implementations
    ├── api/                         # port implementations for external APIs
    └── config/                      # config schema, validated at boot
```

## Module map

| Module | Kind | Entry | Talks to |
| --- | --- | --- | --- |
| `<adapter-module>` | adapter | <Pub/Sub, cron> | `<business-module-1>` by `<Command>` |
| `<business-module-1>` | business | <gRPC> | shared domain; `<business-module-2>` by `<Command>` |
