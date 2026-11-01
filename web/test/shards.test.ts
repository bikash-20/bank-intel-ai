import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SHARDS_DIR = path.resolve(process.cwd(), 'public/shards');

test('Shard Integrity: manifest and all 4 question shards', () => {
  const manifestPath = path.join(SHARDS_DIR, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.shards.length, 4, 'Manifest must contain exactly 4 shards');

  const shardIds = manifest.shards.map((s: any) => s.id);
  assert.ok(shardIds.includes('bsc-so-2026'), 'bsc-so-2026 must be registered in manifest');

  for (const meta of manifest.shards) {
    const filePath = path.join(SHARDS_DIR, meta.fileName);
    assert.ok(fs.existsSync(filePath), `Shard file ${meta.fileName} must exist`);

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const questions = Array.isArray(raw) ? raw : raw.questions;
    assert.equal(questions.length, meta.questionCount, `Question count mismatch for ${meta.id}`);

    for (const q of questions) {
      assert.ok(q.id, `Question ${q.id} must have an ID`);
      assert.ok(q.hash && q.hash.length === 16, `Question ${q.id} must have a 16-char hash`);
      assert.ok(['A', 'B', 'C', 'D'].includes(q.correctOption), `Question ${q.id} must have valid correctOption`);
      assert.ok(q.options.A && q.options.B && q.options.C && q.options.D, `Question ${q.id} must have 4 options`);
      assert.ok(q.stem && q.stem.trim().length > 0, `Question ${q.id} must have non-empty stem`);
      if (q.hasMath) {
        const dollars = (q.stem.match(/\$/g) || []).length;
        assert.equal(dollars % 2, 0, `Question ${q.id} has unbalanced $ in stem`);
      }
    }
  }
});

