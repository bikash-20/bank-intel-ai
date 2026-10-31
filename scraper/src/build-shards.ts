import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { runCrawlAll } from './crawlers/satt-bb.js';
import { parseJobsTestBD } from './crawlers/jobstestbd.js';
import type {
  QuestionItem,
  ShardManifest,
  ShardManifestItem,
  AIExplanationPayload,
} from '../../web/lib/types.js';

const SHARDS_DIR = path.resolve(process.cwd(), '../web/public/shards');

// Shards generator for Bangladesh Bank & BSC questions
const metadataMap: Record<
  string,
  { title: string; examBody: 'BB' | 'BSC'; post: string; year: number; faculty: 'BIBM' | 'IBA' | 'DU_ARTS' | 'CTI' }
> = {
  'bb-ad-2026': {
    title: 'Bangladesh Bank Assistant Director 2026',
    examBody: 'BB',
    post: 'Assistant Director',
    year: 2026,
    faculty: 'BIBM',
  },
  'bb-so-it-2026': {
    title: 'Bangladesh Bank Senior Officer (IT) 2026',
    examBody: 'BB',
    post: 'Senior Officer (IT)',
    year: 2026,
    faculty: 'CTI',
  },
  'bb-cash-2023': {
    title: 'Bangladesh Bank Officer (Cash) 2023',
    examBody: 'BB',
    post: 'Officer (Cash)',
    year: 2023,
    faculty: 'BIBM',
  },
};

  const globalQuestionsByHash = new Map<string, QuestionItem>();
  const manifestItems: ShardManifestItem[] = [];

  for (const [shardId, questions] of Object.entries(shardMap)) {
    const meta = metadataMap[shardId];
    if (!meta || questions.length === 0) continue;

    const deduplicatedShardQuestions: QuestionItem[] = [];
    const shardIdSet = new Set<string>();

    for (const q of questions) {
      // Check for global stem hash match
      if (globalQuestionsByHash.has(q.hash)) {
        const existing = globalQuestionsByHash.get(q.hash)!;
        const exists = existing.appearances.some(
          (a) => a.examBody === meta.examBody && a.post === meta.post && a.year === meta.year
        );
        if (!exists) {
          existing.appearances.push({
            examBody: meta.examBody,
            post: meta.post,
            year: meta.year,
            faculty: meta.faculty,
          });
        }
        if (!shardIdSet.has(existing.id)) {
          deduplicatedShardQuestions.push(existing);
          shardIdSet.add(existing.id);
        }
      } else {
        // Ensure question ID is strictly unique in this shard
        let finalId = q.id;
        let counter = 1;
        while (shardIdSet.has(finalId)) {
          finalId = `${shardId}-q${String(counter++).padStart(3, '0')}`;
        }
        q.id = finalId;
        shardIdSet.add(q.id);
        globalQuestionsByHash.set(q.hash, q);
        deduplicatedShardQuestions.push(q);
      }
    }

    const fileName = `${shardId}.json`;
    const filePath = path.join(SHARDS_DIR, fileName);
    const jsonContent = JSON.stringify(deduplicatedShardQuestions, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf8');

    const versionHash = createHash('sha256').update(jsonContent).digest('hex').slice(0, 16);

    manifestItems.push({
      id: shardId,
      title: meta.title,
      examBody: meta.examBody,
      post: meta.post,
      year: meta.year,
      faculty: meta.faculty,
      questionCount: deduplicatedShardQuestions.length,
      fileName,
      versionHash,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Emitted shard ${fileName}: ${deduplicatedShardQuestions.length} questions (hash: ${versionHash})`);
  }

  const manifest: ShardManifest = {
    version: '1.0.0',
    shards: manifestItems,
  };

  const manifestPath = path.join(SHARDS_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n🎉 Generated manifest.json with ${manifestItems.length} shards at ${manifestPath}`);
}

buildAllShards().catch(console.error);
