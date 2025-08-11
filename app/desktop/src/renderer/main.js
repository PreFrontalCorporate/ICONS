var appEl = document.getElementById('app');
appEl.innerHTML = "\n  <h1 style=\"margin:0 0 8px 0;\">Icon Desktop</h1>\n  <div>Renderer loaded \u2705</div>\n  <div id=\"ver\" style=\"opacity:.8; margin-top:8px;\">Version: \u2026</div>\n";
window.desktop.version()
    .then(function (v) {
    var ver = document.getElementById('ver');
    if (ver)
        ver.textContent = "Version: ".concat(v);
})
    .catch(function (err) {
    var pre = document.createElement('pre');
    pre.textContent = String(err);
    appEl.appendChild(pre);
});
