import { diffWords } from '../../src/engine/text';
import { parseFriend } from '../../src/screens/Friend';
import { thumbVariants } from '../../src/services/pictures';
import { teacherSystem, friendSystem, MODE_BRIEFS } from '../../src/services/ai/prompts';

describe('v2 features', () => {
  it('diffWords marks removed and added words', () => {
    const ops = diffWords('I should present my maam that we have made a attack surface engine okay', 'I have to present to my ma’am that we have made an attack surface engine');
    expect(ops.some((o) => o.type === 'del' && /okay/.test(o.text))).toBe(true);
    expect(ops.some((o) => o.type === 'add' && /an/.test(o.text))).toBe(true);
    expect(ops.filter((o) => o.type === 'same').map((o) => o.text).join(' ')).toContain('attack surface engine');
  });
  it('diffWords: identical text has no changes', () => {
    expect(diffWords('I went home.', 'I went home.').every((o) => o.type === 'same')).toBe(true);
  });
  it('parses friend replies', () => {
    const p = parseFriend('REPLY: The Tamil Nadu cabinet approved a new metro line today. Want to know more?\nCORRECTED: What is the top news in Tamil Nadu today?\nNATURAL: What’s the big news in Tamil Nadu today?\nTIPS: what is top news → what is the top news (article needed)');
    expect(p.reply).toMatch(/^The Tamil Nadu cabinet/);
    expect(p.corrected).toBe('What is the top news in Tamil Nadu today?');
    expect(p.natural).toMatch(/big news/);
    expect(p.tips).toHaveLength(1);
    expect(parseFriend('Just a plain answer').reply).toBe('Just a plain answer');
    expect(parseFriend('REPLY: hi\nCORRECTED: ok\nNATURAL: ok\nTIPS: none').tips).toHaveLength(0);
  });
  it('picture thumbnails use standard Wikimedia widths with original as last resort', () => {
    const v = thumbVariants('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/960px-X.jpg', 'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg', 2000);
    expect(v[0]).toContain('/960px-');
    expect(v.some((u) => u.includes('/500px-'))).toBe(true);
    expect(v[v.length - 1]).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg');
    expect(v.some((u) => /\/900px-/.test(u))).toBe(false);
  });
  it('debate prompt forces the opposite side; teacher asks for full corrected version', () => {
    expect(MODE_BRIEFS.debate).toMatch(/OPPOSITE/);
    const t = teacherSystem('debate', '');
    expect(t).toContain('"corrected"');
    expect(t).toContain('ALWAYS argue the OPPOSITE');
    expect(friendSystem('', 'today')).toContain('Google Search');
  });
});
