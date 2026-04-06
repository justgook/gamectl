#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${1:-$ROOT_DIR/cmd/browser/assets/game/database.sqlite}"
TILEMAP_SQL="$ROOT_DIR/cmd/browser/data/migrations/006_tilemap_storage.sql"
NODEGRAPH_SQL="$ROOT_DIR/cmd/browser/data/migrations/021_nodegraph2_storage.sql"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: required command not found: $1" >&2
    exit 1
  }
}

need sqlite3
need python3

if [[ ! -f "$DB_PATH" ]]; then
  echo "error: database not found: $DB_PATH" >&2
  exit 1
fi

if [[ ! -f "$TILEMAP_SQL" ]]; then
  echo "error: migration file not found: $TILEMAP_SQL" >&2
  exit 1
fi

if [[ ! -f "$NODEGRAPH_SQL" ]]; then
  echo "error: migration file not found: $NODEGRAPH_SQL" >&2
  exit 1
fi

export DB_PATH TILEMAP_SQL NODEGRAPH_SQL

python3 - <<'PY'
import os
import re
import sqlite3
from pathlib import Path

DB_PATH = os.environ['DB_PATH']
TILEMAP_SQL = Path(os.environ['TILEMAP_SQL'])
NODEGRAPH_SQL = Path(os.environ['NODEGRAPH_SQL'])

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

row = cur.execute("SELECT quote(data), node_count FROM nodegraph2_storage WHERE name='default'").fetchone()
if row is None:
    raise SystemExit("error: missing nodegraph2_storage row: default")
node_data, node_count = row

row = cur.execute("SELECT quote(data) FROM tilemap_storage WHERE name='new_rules'").fetchone()
if row is None:
    raise SystemExit("error: missing tilemap_storage row: new_rules")
(new_rules_data,) = row

node_sql = NODEGRAPH_SQL.read_text()
node_pattern = re.compile(r"\(\n\s*'default',\n\s*'.*?'\,\n\s*\d+\n\s*\);", re.S)
node_replacement = f"(\n    'default',\n    {node_data},\n    {node_count}\n  );"
node_sql_new, node_count_replacements = node_pattern.subn(node_replacement, node_sql, count=1)
if node_count_replacements != 1:
    raise SystemExit(f"error: could not update default row in {NODEGRAPH_SQL}")
NODEGRAPH_SQL.write_text(node_sql_new)

map_sql = TILEMAP_SQL.read_text()
map_pattern = re.compile(r"\(\n\s*'new_rules',\n\s*'.*?'\n\s*\);", re.S)
map_replacement = f"(\n  'new_rules',\n  {new_rules_data}\n);"
map_sql_new, map_count_replacements = map_pattern.subn(map_replacement, map_sql, count=1)
if map_count_replacements != 1:
    raise SystemExit(f"error: could not update new_rules row in {TILEMAP_SQL}")
TILEMAP_SQL.write_text(map_sql_new)

print(f"updated: {NODEGRAPH_SQL}")
print(f"  - nodegraph2_storage.default (node_count={node_count})")
print(f"updated: {TILEMAP_SQL}")
print("  - tilemap_storage.new_rules")
PY
