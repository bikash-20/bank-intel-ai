import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shardsDir = path.resolve(__dirname, '../public/shards');

function validate() {
  console.log('🔍 [Shard Validator] Starting strict validation of all static shards...');
  const manifestPath = path.join(shardsDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error('❌ manifest.json not found at:', manifestPath);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`📋 Found manifest v${manifest.version} with ${manifest.shards.length} shards.`);

  let totalQuestions = 0;
  let totalErrors = 0;

  for (const shardMeta of manifest.shards) {
    const shardFilePath = path.join(shardsDir, shardMeta.fileName);
    if (!fs.existsSync(shardFilePath)) {
      console.error(`❌ Shard file missing: ${shardMeta.fileName}`);
      totalErrors++;
      continue;
    }

    const questions = JSON.parse(fs.readFileSync(shardFilePath, 'utf8'));
    console.log(`\nValidating shard "${shardMeta.id}" (${questions.length} questions)...`);

    const idSet = new Set();

    questions.forEach((q, idx) => {
      totalQuestions++;
      const prefix = `[Shard ${shardMeta.id} Q#${idx + 1} (${q.id || 'NO_ID'})]`;

      // 1. Unique id
      if (!q.id || typeof q.id !== 'string') {
        console.error(`${prefix} Missing or non-string id`);
        totalErrors++;
      } else if (idSet.has(q.id)) {
        console.error(`${prefix} Duplicate id found: ${q.id}`);
        totalErrors++;
      } else {
        idSet.add(q.id);
      }

      // 2. 16-char hash
      if (!q.hash || typeof q.hash !== 'string' || q.hash.length !== 16) {
        console.error(`${prefix} Invalid hash "${q.hash}" (must be 16 chars)`);
        totalErrors++;
      }

      // 3. Stem non-empty
      if (!q.stem || typeof q.stem !== 'string' || q.stem.trim().length === 0) {
        console.error(`${prefix} Stem is empty or non-string`);
        totalErrors++;
      }

      // 4. 4 options (A, B, C, D) are non-empty strings
      if (!q.options || typeof q.options !== 'object') {
        console.error(`${prefix} Missing options object`);
        totalErrors++;
      } else {
        for (const optKey of ['A', 'B', 'C', 'D']) {
          const val = q.options[optKey];
          if (!val || typeof val !== 'string' || val.trim().length === 0) {
            console.error(`${prefix} Option [${optKey}] is empty or invalid`);
            totalErrors++;
          }
        }
      }

      // 5. correctOption strictly A | B | C | D
      if (!['A', 'B', 'C', 'D'].includes(q.correctOption)) {
        console.error(`${prefix} Invalid correctOption "${q.correctOption}" (must be A, B, C, or D)`);
        totalErrors++;
      }

      // 6. Balanced $ delimiters for hasMath === true
      if (q.hasMath) {
        const checkBalance = (text, fieldName) => {
          const dollarCount = (text.match(/\$/g) || []).length;
          if (dollarCount % 2 !== 0) {
            console.error(`${prefix} Unbalanced $ in ${fieldName}: "${text}" (count: ${dollarCount})`);
            totalErrors++;
          }
        };

        checkBalance(q.stem, 'stem');
        if (q.options) {
          for (const k of ['A', 'B', 'C', 'D']) {
            if (q.options[k]) checkBalance(q.options[k], `option ${k}`);
          }
        }
      }
    });
  }

  console.log(`\n========================================`);
  console.log(`Total questions verified: ${totalQuestions}`);
  console.log(`Total errors found: ${totalErrors}`);
  console.log(`========================================`);

  if (totalErrors > 0) {
    console.error(`💥 Shard validation FAILED with ${totalErrors} error(s)!`);
    process.exit(1);
  } else {
    console.log(`✅ All shards PASSED validation with 0 errors!`);
    process.exit(0);
  }
}

validate();

