#!/usr/bin/env bash
# generate-context-pack.sh — Canonical repository context-pack generator.
#
# Generates a structured, .gitignore-respecting context pack for LLM consumption.
# Uses git ls-files as the authoritative file list (respects .gitignore).
# Permanently replaces the external gather-chatgpt-repo-context.sh and the
# unknown single-file generator that produced calvin-opencode-system-context-pack.md.
#
# Usage:
#   bash scripts/dev/generate-context-pack.sh [--format single|chunked] [--output <dir>]
#
# Default: chunked format, output to .context-pack/
#
# Exit code 0: pack generated successfully.
# Exit code 1: error during generation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

# ── Configuration ──
FORMAT="chunked"
OUTPUT_DIR=".context-pack"

# ── Parse arguments ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --format)
      FORMAT="$2"; shift 2 ;;
    --output)
      OUTPUT_DIR="$2"; shift 2 ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: bash scripts/dev/generate-context-pack.sh [--format single|chunked] [--output <dir>]"
      exit 1
      ;;
  esac
done

# ── Safety: purge run-logs before collecting any file contents (AUD-P0-001, B.5) ──
if [ -d ".opencode/run-logs" ]; then
  rm -f .opencode/run-logs/*
fi

# ── Step 0: Validate prerequisites ──
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required"
  exit 1
fi

# ── Step 1: Build the file list from git ls-files ──
echo "=== Building file list from git ls-files ==="
FILE_LIST=$(mktemp)
git ls-files > "$FILE_LIST"

# Add explicitly allowed untracked files (if they exist)
ALLOWLIST=(".env.example")
for f in "${ALLOWLIST[@]}"; do
  if [ -f "$f" ] && ! grep -qxF "$f" "$FILE_LIST" 2>/dev/null; then
    echo "$f" >> "$FILE_LIST"
  fi
done

FILE_COUNT=$(wc -l < "$FILE_LIST")
echo "  $FILE_COUNT candidate files from git ls-files + allowlist"

# ── Step 2: Filter and generate with Python ──
echo "=== Generating context pack ($FORMAT format) ==="
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

python3 - "$FILE_LIST" "$OUTPUT_DIR" "$FORMAT" "$REPO_ROOT" << 'PYEOF'
import os, sys, json, hashlib
from datetime import datetime, timezone

file_list_path = sys.argv[1]
output_dir = sys.argv[2]
format_mode = sys.argv[3]
repo_root = sys.argv[4]

# Load file list
with open(file_list_path) as f:
    all_files = [line.strip() for line in f if line.strip()]

# Exclusion rules
EXCLUDE_PATTERNS = [
    'node_modules/', '.turbo/', 'dist/', '.next/', 'coverage/',
    'ci-output/', 'test-results/', 'benchmark_out/',
    '.venv/', '__pycache__/', '.git/',
    'pnpm-lock.yaml',  # huge, not useful for context
]
EXCLUDE_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp3', '.mp4', '.wav', '.webm', '.mov',
    '.zip', '.tar', '.gz', '.bz2', '.xz',
    '.pdf', '.bin', '.exe', '.dll', '.so', '.dylib',
    '.db', '.sqlite', '.sqlite3',
}
MAX_FILE_SIZE = 500 * 1024  # 500KB max per file

selected = []
excluded = []
for path in all_files:
    # Check exclusion patterns
    excluded_flag = False
    for pat in EXCLUDE_PATTERNS:
        if pat in path:
            excluded.append((path, f'pattern:{pat}'))
            excluded_flag = True
            break
    if excluded_flag:
        continue

    # Check extension
    ext = os.path.splitext(path)[1].lower()
    if ext in EXCLUDE_EXTENSIONS:
        excluded.append((path, f'binary-ext:{ext}'))
        continue

    # Check file size
    full_path = os.path.join(repo_root, path)
    try:
        size = os.path.getsize(full_path)
    except OSError:
        excluded.append((path, 'os-error'))
        continue
    if size > MAX_FILE_SIZE:
        excluded.append((path, f'too-large:{size}'))
        continue
    if size == 0:
        excluded.append((path, 'empty'))
        continue

    selected.append(path)

# ── Generate output ──
timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
sha = hashlib.sha256()
for path in sorted(selected):
    sha.update(path.encode())
pack_id = sha.hexdigest()[:12]

# Inventory
os.makedirs(os.path.join(output_dir, '01-inventory'), exist_ok=True)
os.makedirs(os.path.join(output_dir, '04-content'), exist_ok=True)

# Write inventory
with open(os.path.join(output_dir, '01-inventory', 'repository-summary.md'), 'w') as f:
    f.write(f'# Context Pack Inventory\n\n')
    f.write(f'- **Pack ID:** {pack_id}\n')
    f.write(f'- **Generated:** {timestamp}\n')
    f.write(f'- **Repository root:** {repo_root}\n')
    f.write(f'- **Files selected:** {len(selected)}\n')
    f.write(f'- **Files excluded:** {len(excluded)}\n')
    f.write(f'- **Format:** {format_mode}\n')
    f.write(f'- **Generator:** scripts/dev/generate-context-pack.sh (canonical, git-ls-files-based)\n')

# Write selected-files list
with open(os.path.join(output_dir, '01-inventory', 'selected-files.txt'), 'w') as f:
    for path in sorted(selected):
        f.write(f'{path}\n')

# Write excluded-files list
with open(os.path.join(output_dir, '01-inventory', 'excluded-files.tsv'), 'w') as f:
    f.write('path\treason\n')
    for path, reason in sorted(excluded):
        f.write(f'{path}\t{reason}\n')

if format_mode == 'single':
    # Single-file output
    with open(os.path.join(output_dir, 'context-pack.md'), 'w') as out:
        out.write(f'# Repository Context Pack\n\n')
        out.write(f'- **Pack ID:** {pack_id}\n')
        out.write(f'- **Generated:** {timestamp}\n')
        out.write(f'- **Files:** {len(selected)}\n\n')
        out.write('---\n\n')

        # Tree listing
        out.write('## File Tree\n\n```\n')
        for path in sorted(selected):
            out.write(f'{path}\n')
        out.write('```\n\n---\n\n')

        # File contents
        for path in sorted(selected):
            full_path = os.path.join(repo_root, path)
            try:
                with open(full_path, 'r', errors='replace') as fh:
                    content = fh.read()
            except Exception:
                content = '[Error reading file]'
            out.write(f'## {path}\n\n')
            out.write(f'```\n{content}\n```\n\n')

else:
    # Chunked output (default)
    MAX_CHUNK_BYTES = 500 * 1024  # 500KB per chunk
    current_chunk = 1
    current_bytes = 0
    current_fh = open(os.path.join(output_dir, '04-content', f'chunk-{current_chunk:04d}.md'), 'w')
    current_fh.write(f'# Context Pack — Chunk {current_chunk:04d}\n\n')
    current_fh.write(f'- **Pack ID:** {pack_id}\n')
    current_fh.write(f'- **Generated:** {timestamp}\n\n---\n\n')

    for path in sorted(selected):
        full_path = os.path.join(repo_root, path)
        try:
            with open(full_path, 'r', errors='replace') as fh:
                content = fh.read()
        except Exception:
            content = '[Error reading file]'

        entry = f'## {path}\n\n```\n{content}\n```\n\n'
        entry_bytes = len(entry.encode('utf-8'))

        if current_bytes + entry_bytes > MAX_CHUNK_BYTES and current_bytes > 0:
            current_fh.close()
            current_chunk += 1
            current_bytes = 0
            current_fh = open(os.path.join(output_dir, '04-content', f'chunk-{current_chunk:04d}.md'), 'w')
            current_fh.write(f'# Context Pack — Chunk {current_chunk:04d}\n\n')
            current_fh.write(f'- **Pack ID:** {pack_id}\n')
            current_fh.write(f'- **Generated:** {timestamp}\n\n---\n\n')

        current_fh.write(entry)
        current_bytes += entry_bytes

    current_fh.close()

# Write README
os.makedirs(os.path.join(output_dir, '00-start-here'), exist_ok=True)
with open(os.path.join(output_dir, '00-start-here', 'README-FIRST.md'), 'w') as f:
    f.write(f'# Context Pack — {pack_id}\n\n')
    f.write(f'Generated: {timestamp}\n')
    f.write(f'Generator: scripts/dev/generate-context-pack.sh (canonical, git-ls-files-based)\n\n')
    f.write(f'## Scope\n\n')
    f.write(f'- {len(selected)} files selected from git ls-files + explicit allowlist\n')
    f.write(f'- {len(excluded)} files excluded (binary, large, generated, gitignored)\n')
    f.write(f'- .gitignore is respected: no gitignored files are included\n')
    f.write(f'- .opencode/run-logs/ is purged before collection\n\n')
    f.write(f'## Usage\n\n')
    if format_mode == 'chunked':
        f.write(f'Upload chunks from 04-content/ in numeric order.\n')
    else:
        f.write(f'Upload context-pack.md directly.\n')
    f.write(f'See 01-inventory/ for file lists and exclusion reasons.\n')

print(f'  Context pack generated: {output_dir}/')
print(f'  Files: {len(selected)} selected, {len(excluded)} excluded')
print(f'  Format: {format_mode}')
if format_mode == 'chunked':
    print(f'  Chunks: {current_chunk}')
print(f'  Pack ID: {pack_id}')

# Cleanup
os.unlink(file_list_path)
PYEOF

echo ""
echo "=== Context pack generation complete ==="
echo "  Output: $OUTPUT_DIR/"
echo "  Files selected: $(wc -l < "$OUTPUT_DIR/01-inventory/selected-files.txt" 2>/dev/null || echo 0)"
