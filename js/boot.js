// Laeuft vor dem ersten Bild: Umzug alter Speicherschluessel und das Thema.
//
// Bewusst eine eigene Datei statt eines Inline-Skripts. Damit kommt die
// Seite mit script-src 'self' aus — ohne 'unsafe-inline'. Genau das ist die
// Zeile, die einen eingeschleusten onerror-Handler wirkungslos macht, falls
// doch einmal fremder Text ungeschuetzt ins DOM geraet.
(function () {
  try {
    // Die App hiess frueher lifty. Zugaenge und Zwischenspeicher liegen auf
    // derselben Origin weiter unter den alten Schluesseln — einmal umtragen,
    // damit niemand Token und intervals-Key neu eintippen muss.
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf('lifty.') === 0) {
        var neuK = 'setlist.' + k.slice(6);
        if (localStorage.getItem(neuK) === null) localStorage.setItem(neuK, localStorage.getItem(k));
        localStorage.removeItem(k);
      }
    }
    var w = localStorage.getItem('setlist.theme') || 'dunkel';
    var hell = w === 'hell' ||
      (w === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
    if (hell) document.documentElement.setAttribute('data-theme', 'light');
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', hell ? '#f4f1ea' : '#0c0c0e');
  } catch (e) { /* Speicher gesperrt — dann eben dunkel */ }
})();
