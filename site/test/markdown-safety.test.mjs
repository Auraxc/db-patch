import test from 'node:test';
import assert from 'node:assert/strict';
import { remarkSafeContent } from '../scripts/markdown-safety.mjs';

test('rejects whitespace/control obfuscation in Markdown URL schemes', () => {
  const transform = remarkSafeContent();
  for (const url of [' javascript:alert(1)', '\tjavascript:alert(1)', 'java\nscript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,hello', '//untrusted.example/script']) {
    assert.throws(() => transform({ type: 'root', children: [{ type: 'link', url, children: [] }] }), /Unsupported/);
  }
  for (const url of ['/images/a.png', '#section', 'https://postgresql.org/', 'mailto:hello@example.com']) {
    assert.doesNotThrow(() => transform({ type: 'root', children: [{ type: 'link', url, children: [] }] }));
  }
});
