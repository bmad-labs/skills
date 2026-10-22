# tools — Generators and validators

| Script | Reads | Writes | Run |
| --- | --- | --- | --- |
| `render_events.py` | `<folder>/_catalog.json`, payload schemas, envelope, `_common.schema.json` | `<CODE>.schema.json`, `<CODE>.examples.json`, `<code>-<slug>.md` | `python3 tools/render_events.py 02-domain-events` |
| `render_pipeline.py` | its `STEPS` table | `09-data-pipeline/pipeline.svg` | `python3 tools/render_pipeline.py 09-data-pipeline/pipeline.svg` |
| `validate_json.py` (skill `scripts/`) | every `*.schema.json` under the root | report, exit 1 on failure | `python3 <skill>/scripts/validate_json.py <folder> .` |

## Check the whole package

```sh
python3 tools/render_events.py 02-domain-events
python3 tools/render_events.py 05-<vendor>-integration
python3 tools/render_pipeline.py 09-data-pipeline/pipeline.svg
python3 <skill>/scripts/validate_json.py . .
for d in 00-c4 06-data-modeling 07-sequences 08-class-diagrams 10-*; do (cd $d && plantuml -tsvg -failfast2 *.puml); done
protoc --proto_path=03-ingress-api/grpc --descriptor_set_out=/dev/null 03-ingress-api/grpc/*.proto
npx -y @redocly/cli lint 03-ingress-api/rest/openapi.yml 04-egress-api/rest/openapi.yml
for f in */asyncapi.yml; do npx -y @asyncapi/cli validate $f; done
xmllint --noout 09-data-pipeline/*.svg
```
