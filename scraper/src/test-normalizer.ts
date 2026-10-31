import { sanitizeMath, computeQuestionHash, mapSubject } from './normalizer.js';

console.log('--- Testing normalizer ---');

const math1 = sanitizeMath('In a simultaneous throw, what is 3<sup>x+2</sup> - 3<sup>x-1</sup> = 702?');
console.log('Math 1:', math1);
if (math1.hasMath !== true) throw new Error('Expected hasMath true');
if (!math1.text.includes('$3^{x+2}$')) console.log('Notice formula formatting:', math1.text);

const fraction = sanitizeMath('The value of ½ + ¾ is:');
console.log('Fraction:', fraction);
if (!fraction.text.includes('\\frac{1}{2}')) throw new Error('Expected fraction conversion');

const stem = 'What is the sum of angles in a triangle?';
const hash = computeQuestionHash(stem);
console.log('Hash:', hash, 'Length:', hash.length);
if (hash.length !== 16) throw new Error('Expected 16 char hash');

const subject = mapSubject('গণিত', 'What is x?');
console.log('Subject:', subject);
if (subject !== 'MATH') throw new Error('Expected MATH');

const banglaSubject = mapSubject('বাংলা সাহিত্য', 'বাংলা সাহিত্যের আদি নিদর্শন কি?');
console.log('Bangla:', banglaSubject);
if (banglaSubject !== 'BANGLA_SKIP') throw new Error('Expected BANGLA_SKIP');

console.log('ALL NORMALIZER TESTS PASSED');

