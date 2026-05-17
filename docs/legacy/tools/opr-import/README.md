# OPR Import Tool

Converts One Page Rules army book JSON files from the OPR API into SQL INSERT statements.

## Usage

### 1. Download Army JSON from OPR API

```bash
# Example: Alien Hives for Grimdark Future
curl -o alien-hives.json "https://army-forge.onepagerules.com/api/army-books/78qp9l5alslt6yj8?gameSystem=2&simpleMode=false"
```

### 2. Build the tool

```bash
cd tools/opr-import
go build -o opr-import
```

### 3. Generate SQL

```bash
./opr-import \
  -input alien-hives.json \
  -universe grimdark-future \
  -army gf-alien-hives \
  -output ../../cmd/browser/data/opr/10-gf-alien-hives.sql
```

## Parameters

- `-input`: Path to OPR JSON file (required)
- `-universe`: Universe ID like `grimdark-future` or `age-of-fantasy` (required)
- `-army`: Army ID like `gf-alien-hives` (required)
- `-output`: Output SQL file path (optional, defaults to stdout)

## ID Generation

All IDs are auto-generated using slugification:

- **Army ID**: Manual input (e.g., `gf-alien-hives`)
- **Equipment ID**: `{army-id}-{equipment-name}` (e.g., `gf-alien-hives-razor-claws`)
- **Unit ID**: `{army-id}-{unit-name}` (e.g., `gf-alien-hives-hive-lord`)
- **Special Rule ID**: `{army-id}-{rule-name}` or `universal-{rule-name}` (e.g., `gf-alien-hives-hive-bond`)

## Example Workflow

```bash
# Download army data
curl -o battle-brothers.json "https://army-forge.onepagerules.com/api/army-books/{id}?gameSystem=2&simpleMode=false"

# Generate SQL
./opr-import \
  -input battle-brothers.json \
  -universe grimdark-future \
  -army gf-battle-brothers \
  -output ../../cmd/browser/data/opr/11-gf-battle-brothers.sql

# Load into database (via your existing workflow)
```

## Finding Army Book IDs

1. Go to https://army-forge.onepagerules.com
2. Select your game system
3. Select an army
4. Check the URL or network tab for the army book ID
5. Use format: `https://army-forge.onepagerules.com/api/army-books/{id}?gameSystem={1|2}&simpleMode=false`
   - `gameSystem=1` = Age of Fantasy
   - `gameSystem=2` = Grimdark Future
