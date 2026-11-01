import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWritingIndex,
  validateWritingShard,
} from '../lib/writing.ts';

test('Writing Shard Validator: validates correct index and shard', () => {
  const sampleIndex = [
    {
      shardId: 'writing-officer-it-2024-2026',
      title: 'Officer (IT) & AME',
      post: 'Officer IT / Assistant Maintenance Engineer',
      file: '/shards/writing-officer-it.json',
    },
  ];

  const validatedIndex = validateWritingIndex(sampleIndex);
  assert.equal(validatedIndex.length, 1);
  assert.equal(validatedIndex[0].shardId, 'writing-officer-it-2024-2026');

  const sampleShard = {
    shardId: 'writing-officer-it-2024-2026',
    title: 'Combined Bank Officer (IT) & AME Written Question Bank',
    examBody: 'BB / BSC',
    post: 'Officer IT / Assistant Maintenance Engineer',
    totalQuestions: 1,
    questions: [
      {
        id: 'write-it-001',
        category: 'Focus Writing & Essay',
        marks: 10,
        stem: 'Sample stem',
      },
    ],
  };

  const validatedShard = validateWritingShard(sampleShard);
  assert.equal(validatedShard.questions.length, 1);
  assert.equal(validatedShard.questions[0].id, 'write-it-001');
  assert.equal(validatedShard.questions[0].marks, 10);
});

test('Writing Shard Validator: rejects malformed data', () => {
  assert.throws(() => validateWritingIndex({ not: 'an array' }), /Writing index must be an array/);
  assert.throws(() => validateWritingIndex([{ incomplete: true }]), /Invalid writing index entry/);

  assert.throws(
    () => validateWritingShard({ shardId: 'test', missing: 'fields' }),
    /Writing shard is missing required top-level fields/
  );

  assert.throws(
    () =>
      validateWritingShard({
        shardId: 'test',
        title: 'Title',
        examBody: 'BB',
        post: 'IT',
        totalQuestions: 1,
        questions: [{ id: '1', category: 'cat', marks: 'not-a-number', stem: 'stem' }],
      }),
    /Invalid question item at index 0/
  );
});
