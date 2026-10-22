"""Validate every <name>.example(s).json against <name>.schema.json next to it, and parse every .jsonc.

Usage: python3 validate_json.py <folder-to-check> [<design-root-holding-all-schemas>]
The design root defaults to the folder to check. Every *.schema.json under it is loaded, so a relative
$ref such as "../06-data-modeling/_common.schema.json#/$defs/objectId" resolves the way file-based tools do.
Needs: pip install jsonschema referencing
"""
import json, sys, pathlib, re
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
root = pathlib.Path(sys.argv[1])
def strip(t):
    out=[];i=0;ins=False
    while i<len(t):
        c=t[i]
        if ins:
            out.append(c)
            if c=='\\': out.append(t[i+1]); i+=2; continue
            if c=='"': ins=False
        else:
            if c=='"': ins=True; out.append(c)
            elif t.startswith('//',i):
                while i<len(t) and t[i]!='\n': i+=1
                continue
            else: out.append(c)
        i+=1
    return ''.join(out)
# Resources are keyed by file URI, and $id is set to that URI in memory, so a relative $ref
# ("../06-data-modeling/_common.schema.json#/...") resolves the same way file-based tools resolve it.
res={}
designs=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else sys.argv[1]).resolve()
for f in designs.rglob('*.schema.json'):
    d=json.loads(f.read_text()); d['$id']=f.resolve().as_uri(); res[f.resolve().as_uri()]=Resource.from_contents(d)
reg=Registry().with_resources(res.items())
bad=0
for f in sorted(root.rglob('*.json')):
    if f.name.endswith('.schema.json'): continue
    m=re.match(r'(.+?)\.examples?\.json$',f.name)
    if not m: continue
    sid=(f.parent/(m.group(1)+'.schema.json')).resolve().as_uri()
    if sid not in res: print('NO SCHEMA for',f); bad+=1; continue
    v=Draft202012Validator(res[sid].contents, registry=reg, format_checker=FormatChecker())
    docs=json.loads(f.read_text()); docs=docs if isinstance(docs,list) else [docs]
    for i,d in enumerate(docs):
        errs=sorted(v.iter_errors(d), key=lambda e: list(e.path))
        for e in errs[:5]: print(f'FAIL {f.name}[{i}] {list(e.absolute_path)}: {e.message[:200]}'); bad+=1
    print('ok' if not bad else '', f.name, len(docs))
for f in root.rglob('*.jsonc'):
    try: json.loads(strip(f.read_text()))
    except Exception as e: print('JSONC FAIL',f.name,e); bad+=1
print('BAD',bad); sys.exit(1 if bad else 0)
