import * as cheerio from 'cheerio';

async function testParse() {
  const url = 'https://sattacademy.com/%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%E0%A6%A6%E0%A7%87%E0%A6%B6-%E0%A6%AC%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%82%E0%A6%95-%E0%A6%B8%E0%A6%B9%E0%A6%95%E0%A6%BE%E0%A6%B0%E0%A7%80-%E0%A6%AA%E0%A6%B0%E0%A6%BF%E0%A6%9A%E0%A6%BE%E0%A6%B2%E0%A6%95/all/mcq-questions';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);

  const cards = $('.card-bordered');
  console.log('Cards found:', cards.length);
  cards.slice(0, 5).each((i, el) => {
    const stem = $(el).find('.question-span').text().trim().replace(/\s+/g, ' ');
    const subject = $(el).closest('.card.bg-light').find('h3 a').text().trim();
    const correctIdx = $(el).find('.test-mode-data input[name="answer"]').val();
    const options: { text: string; isCorrect: boolean }[] = [];
    $(el).find('.reading-mode-data .row > div').each((_, optEl) => {
      const isCorrect = $(optEl).find('.fa-check-circle').length > 0;
      const text = $(optEl).find('label').text().trim().replace(/\s+/g, ' ');
      if (text) {
        options.push({ text, isCorrect });
      }
    });
    console.log({ i, subject, stem: stem.substring(0, 80), correctIdx, options });
  });
}

testParse().catch(console.error);

