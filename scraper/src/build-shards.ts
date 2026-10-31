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

// High-value pre-baked explanations for classic Bangladesh Bank questions
const SAMPLE_EXPLANATIONS: Record<string, Partial<AIExplanationPayload>> = {
  'In a class, Rahim ranks': {
    coreConcept: 'Linear positioning identity: $\\text{Total} = \\text{Rank}_{\\text{top}} + \\text{Rank}_{\\text{bottom}} - 1$.',
    examHallShortcut: 'Direct mental math: $7 + 26 - 1 = 32$. Take 2 seconds and eliminate all other choices.',
    stepByStep: '1. Rahim is counted twice: once from the top (7th) and once from the bottom (26th).\n2. Formula: $\\text{Total} = 7 + 26 - 1 = 32$.\n3. Therefore, the class has exactly 32 students.',
    optionDiagnostics: {
      A: {
        status: 'CORRECT',
        verdict: 'Exact match: $7 + 26 - 1 = 32$. Rahim is correctly counted once.',
      },
      B: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Candidates pick 35 by misreading 26 as 28 or confusing with $7 + 28$.',
      },
      C: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Arithmetic miscalculation of $7 + 30$.',
      },
      D: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Result of arbitrary rounding up without applying the inclusion-exclusion principle.',
      },
    },
    generatedBy: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  },
  'Two pipes fill a tank': {
    coreConcept: 'Net rate of work equation: $\\text{Rate} = R_1 + R_2 - R_3$.',
    examHallShortcut: 'Compute per-minute rates: $\\frac{1}{20} + \\frac{1}{30} - \\frac{1}{15} = \\frac{3 + 2 - 4}{60} = \\frac{1}{60}$. Time to fill full tank = $60\\text{ min}$. Tank is half full $\\implies \\frac{60}{2} = 30\\text{ min}$.',
    stepByStep: '1. In 1 minute, Pipe 1 fills $\\frac{1}{20}$, Pipe 2 fills $\\frac{1}{30}$, and drain empties $\\frac{1}{15}$.\n2. Combined rate per minute = $\\frac{3 + 2 - 4}{60} = \\frac{1}{60}$ tank/min.\n3. The tank is already half full, so $\\frac{1}{2}$ tank remains to be filled.\n4. Required time = $\\frac{1/2}{1/60} = 30\\text{ minutes}$.',
    optionDiagnostics: {
      A: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Calculated by considering only Pipe 1 operating alone on a half tank: $20 / 2 = 10$, then doubling erroneously.',
      },
      B: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Arises if candidate forgets the drain and computes $(20 \\times 30)/(20 + 30) = 12$, times 2.',
      },
      C: {
        status: 'CORRECT',
        verdict: 'Accurate net rate: $\\frac{1}{60}\\text{ per min} \\times 30\\text{ min} = \\frac{1}{2}\\text{ tank}$.',
      },
      D: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Overlooked subtracting the 15-minute drain rate properly.',
      },
    },
    generatedBy: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  },
  'A viral post’s share count': {
    coreConcept: 'Recurrence relation: $a_{n} = 2a_{n-1} - 1$ with seed $a_1 = 3$.',
    examHallShortcut: 'Iterate sequence in head: $a_1=3, a_2=5, a_3=9, a_4=17, a_5=33$. Pattern is $2^n + 1$. For $n=5$, $2^5 + 1 = 32 + 1 = 33$.',
    stepByStep: '1. $a_1 = 3$\n2. $a_2 = 2(3) - 1 = 5$\n3. $a_3 = 2(5) - 1 = 9$\n4. $a_4 = 2(9) - 1 = 17$\n5. $a_5 = 2(17) - 1 = 33$.',
    optionDiagnostics: {
      A: {
        status: 'CORRECT',
        verdict: 'Exact match following recurrence $a_5 = 33$.',
      },
      B: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Off-by-two calculation trap if candidate miscalculates $2(17) - 3$.',
      },
      C: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Arithmetic subtraction slip ($34 - 5$).',
      },
      D: {
        status: 'TRAP_DISTRACTOR',
        verdict: 'Stopping early or misapplying the multiplier.',
      },
    },
    generatedBy: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  },
};

export async function buildAllShards() {
  if (!fs.existsSync(SHARDS_DIR)) {
    fs.mkdirSync(SHARDS_DIR, { recursive: true });
  }

  console.log('--- Step 1: Crawling Satt Academy questions ---');
  const sattMap = await runCrawlAll();

  console.log('\n--- Step 2: Crawling JobsTestBD questions ---');
  const jobstestBD_AD2026 = await parseJobsTestBD(
    'https://jobstestbd.com/bb-ad-mcq-question-solution-2026/',
    { id: 'bb-ad-2026', post: 'Assistant Director', year: 2026, faculty: 'BIBM' }
  );

  const jobstestBD_Cash2023 = await parseJobsTestBD(
    'https://jobstestbd.com/bb-officer-cash-mcq-question-solved-2023/',
    { id: 'bb-cash-2023', post: 'Officer (Cash)', year: 2023, faculty: 'BIBM' }
  );

  // Group by shard ID
  const shardMap: Record<string, QuestionItem[]> = {
    'bb-ad-2026': [...(sattMap['bb-ad-2026'] || []), ...jobstestBD_AD2026],
    'bb-so-it-2026': sattMap['bb-so-it-2026'] || [],
    'bb-cash-2023': jobstestBD_Cash2023,
  };

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
      // Attach pre-baked explanation if matched
      for (const [prefix, exp] of Object.entries(SAMPLE_EXPLANATIONS)) {
        if (q.stem.includes(prefix)) {
          q.staticExplanation = {
            questionId: q.id,
            coreConcept: exp.coreConcept!,
            examHallShortcut: exp.examHallShortcut!,
            stepByStep: exp.stepByStep!,
            optionDiagnostics: exp.optionDiagnostics!,
            generatedBy: exp.generatedBy!,
            cachedAt: Date.now(),
          };
          break;
        }
      }

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
