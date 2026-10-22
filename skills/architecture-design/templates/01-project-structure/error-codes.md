# Error Codes

Range `<-NNN001>` to `<-NNN999>`, sequential without gaps. A failed response carries `status`, `code`, `message`
only; a success response carries the same plus `data`.

| Status | Code | Name | Message | Raised by |
| --- | --- | --- | --- | --- |
| 404 | <-NNN001> | `<ENTITY>_NOT_FOUND` | <Entity> not found | `<UseCase>`, `<UseCase>` |
| 409 | <-NNN002> | `<ENTITY>_VERSION_STALE` | The <entity> was changed by someone else. Please reload | every mutation |
| 403 | <-NNN003> | `<SCOPE>_FORBIDDEN` | You cannot see this <entity> | every read and mutation |
| 500 | -999999 | `UNKNOWN` | Unexpected error | any unhandled error |

## Status mapping

| Status | Meaning | Transport mapping |
| --- | --- | --- |
| 400 | Request is invalid | gRPC `INVALID_ARGUMENT` or in-body `status` |
| 404 | Not found, or outside the caller's scope | in-body `status` |
| 409 | State or version conflict | in-body `status` |
| 500 | Unexpected | in-body `status` |
