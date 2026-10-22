"""Render one event schema, one examples file, and one Markdown doc per catalog entry.

Usage: python3 tools/render_events.py <folder>
  <folder> holds _catalog.json and the payload schemas (<SCHEMA_ID>.schema.json).
  The design root is <folder>/..; it must hold 02-domain-events/_envelope.schema.json and
  06-data-modeling/_common.schema.json.

Writes, for each entry: <CODE>.schema.json, <CODE>.examples.json, <code>-<slug>.md.
Never edit those files by hand: change _catalog.json or a payload schema, then run this again.
The Attributes table puts each parameter in the column of its nesting level (one column per level).
"""
import json
import pathlib
import sys

folder = pathlib.Path(sys.argv[1]).resolve()
root = folder.parent
common = json.loads((root / "06-data-modeling/_common.schema.json").read_text())["$defs"]
envelope = json.loads((root / "02-domain-events/_envelope.schema.json").read_text())
envelope_link = "_envelope.schema.json" if folder.name == "02-domain-events" else "../02-domain-events/_envelope.schema.json"
catalog = json.loads((folder / "_catalog.json").read_text())


def type_of(node):
    if "$ref" in node:
        name = node["$ref"].split("/")[-1]
        target = common.get(name, {})
        if "enum" in target:
            return "string", ", ".join(f"`{v}`" for v in target["enum"])
        return name, ""
    if "oneOf" in node:
        parts = [type_of(option) for option in node["oneOf"]]
        return " \\| ".join(p[0] for p in parts), " ".join(p[1] for p in parts if p[1])
    if "enum" in node:
        return "string", ", ".join(f"`{v}`" for v in node["enum"])
    kind = node.get("type", "object")
    if isinstance(kind, list):
        kind = " \\| ".join(kind)
    if kind == "array":
        return f"array<{type_of(node.get('items', {}))[0]}>", ""
    return {"object": "JSONObject"}.get(kind, kind), ""


def rows(schema, depth=0, extra_required=()):
    required = set(schema.get("required", [])) | set(extra_required)
    out = []
    for name, node in schema.get("properties", {}).items():
        kind, values = type_of(node)
        desc = node.get("description", "")
        if values:
            desc = f"{desc}. Values: {values}" if desc else f"Values: {values}"
        out.append((depth, f"`{name}`", kind, "Yes" if name in required else "No", desc))
        if "properties" in node:
            out += rows(node, depth + 1)
        if "properties" in node.get("items", {}):
            out += rows(node["items"], depth + 1)
    return out


def table(items):
    levels = max(depth for depth, *_ in items) + 1
    lines = ["| Parameter |" + " |" * (levels - 1) + " Type | Required | Description |",
             "|" + " --- |" * (levels + 3)]
    for depth, name, kind, req, desc in items:
        cells = [""] * levels
        cells[depth] = name
        lines.append("| " + " | ".join(cells) + f" | {kind} | {req} | {desc} |")
    return lines


def event_schema(entry):
    data = {"$ref": f"{entry['schema']}.schema.json"}
    if entry.get("dataRequired"):
        data = {"allOf": [data, {"required": entry["dataRequired"]}]}
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": f"{entry['code']}.schema.json",
        "title": f"{entry['code']} {entry['name']}",
        "allOf": [
            {"$ref": envelope_link},
            {"properties": {
                "code": {"const": entry["code"]},
                "entity": {"const": entry["entity"]},
                "source": {"properties": {"service": {"const": entry["producer"]}}},
                "data": data,
            }},
        ],
    }


def pick(message, path):
    value = message
    for part in path.split("."):
        value = value.get(part) if isinstance(value, dict) else None
    return value


def markdown(entry):
    payload = json.loads((folder / f"{entry['schema']}.schema.json").read_text())
    lines = [
        f"# {entry['code']} — {entry['name']}", "",
        "| Item | Value |", "| --- | --- |",
        f"| Event code | `{entry['code']}` |",
        f"| Entity | `{entry['entity']}` |",
        f"| Topic | `{entry['topic']}` |",
        f"| Key | `{entry['key']}` |",
        f"| Producer (`source.service`) | `{entry['producer']}` |",
        f"| Schema | [`{entry['schema']}`]({entry['schema']}.schema.json); event schema [`{entry['code']}.schema.json`]({entry['code']}.schema.json) |",
        f"| Emitted when | {entry['when']} |",
        f"| Raised by | {entry['raisedBy']} |",
        f"| Consumers | {entry['consumers']} |",
        f"| Requirements | {entry['requirements']} |",
        "", "## Attributes", "",
    ]
    header = {k: v for k, v in envelope["properties"].items() if k != "data"}
    items = [(0, "**Common**", "", "", f"[`_envelope.schema.json`]({envelope_link})")]
    items += rows({"required": envelope["required"], "properties": header})
    items += [(0, "`data`", "JSONObject", "Yes", payload.get("description", ""))]
    items += rows(payload, 1, entry.get("dataRequired", []))
    lines += table(items)
    lines += ["", "## Message Key", "", f"`{entry['key']}`. Messages with the same key keep their order.", ""]
    if entry.get("errors"):
        lines += ["## Errors", "", "| Case | Handling | Error code |", "| --- | --- | --- |"]
        lines += [f"| {case} | {handling} | {code} |" for case, handling, code in entry["errors"]]
        lines += [""]
    lines += ["## Example", ""]
    for example in entry["examples"]:
        lines += [f"### {example['title']}", "", f"Key: `{pick(example['message'], entry['key'])}`", "",
                  "```json", json.dumps(example["message"], indent=2), "```", ""]
    return "\n".join(lines)


for entry in catalog:
    code = entry["code"]
    (folder / f"{code}.schema.json").write_text(json.dumps(event_schema(entry), indent=2) + "\n")
    (folder / f"{code}.examples.json").write_text(
        json.dumps([example["message"] for example in entry["examples"]], indent=2) + "\n")
    (folder / f"{code.lower()}-{entry['slug']}.md").write_text(markdown(entry))
print("rendered", len(catalog))
