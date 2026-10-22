# Modules

A module calls another module only by sending a command that the other module owns, or by an event. A command lives
in the module that handles it; the sender imports only that command class.

## `<module-name>`

<One sentence: what this module is responsible for.>

| Item | Value |
| --- | --- |
| Kind | business or adapter |
| Entry points | `<Controller>` (<gRPC methods, Kafka topics, crons>) |
| Writes | `<collection>` (<which parts>) |
| Raises | `<ABC101>`, `<ABC102>` |

### Use cases

| Use case | Called by | Does | Returns |
| --- | --- | --- | --- |
| `<Name>UseCase` | `<Controller>.<Method>` or `<Command>Handler` | <one sentence: loads, decides, saves, publishes> | `<Response>` or `void` |

### Commands owned (handled here)

| Command | Sent by | Handler pattern | Payload |
| --- | --- | --- | --- |
| `<Name>Command` | `<other module>.<UseCase>` | logic in handler, or delegates to `<UseCase>` | `{ <field>, <field> }` |

### Commands sent (owned elsewhere)

| Command | Owner | When |
| --- | --- | --- |
| `<Name>Command` | `<module>` | <trigger> |
