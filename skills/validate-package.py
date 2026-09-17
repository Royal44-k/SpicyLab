"""Validate this skill's package links, data and metadata; no external calls."""
import csv
import hashlib
import json
from pathlib import Path
import re
import sys

import yaml

root = Path(sys.argv[1]).resolve()
files = sorted(p for p in root.rglob('*') if p.is_file())
errors = []
links = []
graph = {}
json_count = csv_count = 0

for path in files:
    rel = path.relative_to(root).as_posix()
    if path.suffix == '.md':
        source = path.read_text(encoding='utf-8')
        targets = set()
        for match in re.finditer(r'!?\[[^\]]*\]\(([^)]+)\)', source):
            href = match.group(1).strip().strip('<>')
            if href.startswith(('#', 'https://', 'http://', 'mailto:')):
                continue
            resolved = (path.parent / href.split('#')[0]).resolve()
            if not resolved.is_relative_to(root) or not resolved.is_file():
                errors.append(f'{rel}: invalid local link {href}')
            else:
                targets.add(resolved)
            links.append((rel, href))
        graph[path] = targets
    elif path.suffix == '.json':
        json.loads(path.read_text(encoding='utf-8'))
        json_count += 1
    elif path.suffix == '.csv':
        with path.open(encoding='utf-8-sig', newline='') as stream:
            rows = list(csv.reader(stream))
        if not rows or len(rows[0]) != len(set(rows[0])):
            errors.append(f'{rel}: empty or duplicate CSV headings')
        else:
            for i, row in enumerate(rows[1:], 2):
                if len(row) != len(rows[0]):
                    errors.append(f'{rel}:{i}: wrong CSV column count')
        csv_count += 1

seen = set()
pending = [root / 'SKILL.md']
while pending:
    current = pending.pop()
    if current in seen:
        continue
    seen.add(current)
    pending.extend(graph.get(current, set()) - seen)
refs = list((root / 'references').glob('*.md'))
for path in refs:
    if path not in seen:
        errors.append(f'unreachable reference: {path.name}')

metadata = yaml.safe_load((root / 'agents/openai.yaml').read_text(encoding='utf-8'))
interface = metadata['interface']
if not 25 <= len(interface['short_description']) <= 64:
    errors.append('short_description must be 25–64 characters')
if '$culinary-service-expert' not in interface['default_prompt']:
    errors.append('default_prompt lacks explicit skill invocation')
if metadata.get('policy', {}).get('allow_implicit_invocation', True) is not True:
    errors.append('automatic invocation unexpectedly disabled')

for path in files:
    if path.suffix in ('.md', '.mjs', '.json', '.yaml', '.csv'):
        source = path.read_text(encoding='utf-8')
        if re.search(r'\b(?:TODO|TBD)\b|(?:C|D):[\\/]|localhost', source):
            errors.append(f'{path.name}: unfinished placeholder or machine-specific path')

manifest = [
    {'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size,
     'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
    for p in files
]
print(json.dumps({
    'valid': not errors, 'files': len(files), 'references': len(refs),
    'localLinks': len(links), 'jsonFiles': json_count, 'csvFiles': csv_count,
    'totalBytes': sum(p.stat().st_size for p in files),
    'shortDescriptionCharacters': len(interface['short_description']),
    'errors': errors, 'manifest': manifest
}, ensure_ascii=False, indent=2))
sys.exit(1 if errors else 0)
