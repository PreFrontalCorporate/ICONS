var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
var el = function (sel) { return document.querySelector(sel); };
var email = el('#email');
var pass = el('#pass');
var tokenEl = el('#token');
var save = el('#save');
var signin = el('#signin');
var logout = el('#logout');
var grid = el('#grid');
var err = el('#err');
var hint = el('#hint');
var clearAll = el('#clearAll');
var token = null;
function showError(msg) {
    err.textContent = msg;
    err.style.display = 'block';
    setTimeout(function () { return err.style.display = 'none'; }, 5000);
}
function setLoggedIn(t) {
    token = t;
    localStorage.setItem('cat', t);
    tokenEl.value = t;
    email.value = pass.value = '';
    logout.style.display = '';
    signin.style.display = '';
    save.style.display = 'none';
    tokenEl.style.display = 'none';
    hint.textContent = 'Logged in.';
}
function setLoggedOut() {
    token = null;
    localStorage.removeItem('cat');
    logout.style.display = 'none';
    save.style.display = '';
    tokenEl.style.display = '';
    hint.textContent = 'Paste your customer access token (cat=...). Or sign in to generate one.';
    grid.innerHTML = '';
}
function refresh() {
    return __awaiter(this, void 0, void 0, function () {
        var stickers, _i, stickers_1, s, card, e_1;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    grid.innerHTML = '';
                    if (!token) {
                        setLoggedOut();
                        return [2 /*return*/];
                    }
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, window.api.list(token)];
                case 2:
                    stickers = _g.sent();
                    if (!(stickers === null || stickers === void 0 ? void 0 : stickers.length)) {
                        grid.innerHTML = '<div class="muted">No stickers yet.</div>';
                        return [2 /*return*/];
                    }
                    // Render cards
                    for (_i = 0, stickers_1 = stickers; _i < stickers_1.length; _i++) {
                        s = stickers_1[_i];
                        card = document.createElement('div');
                        card.className = 'card';
                        card.innerHTML = "\n        <img loading=\"lazy\" src=\"".concat(((_a = s.featuredImage) === null || _a === void 0 ? void 0 : _a.url) || ((_b = s.image) === null || _b === void 0 ? void 0 : _b.url) || '', "\" alt=\"").concat(((_c = s.featuredImage) === null || _c === void 0 ? void 0 : _c.altText) || s.title || '', "\">\n        <div class=\"row\">\n          <div style=\"flex:1\">").concat((_d = s.title) !== null && _d !== void 0 ? _d : s.id, "</div>\n          <button data-id=\"").concat(s.id, "\" data-url=\"").concat(((_e = s.featuredImage) === null || _e === void 0 ? void 0 : _e.url) || ((_f = s.image) === null || _f === void 0 ? void 0 : _f.url), "\">Pin</button>\n        </div>\n      ");
                        grid.appendChild(card);
                    }
                    // Wire pin buttons
                    grid.querySelectorAll('button[data-id]').forEach(function (btn) {
                        btn.addEventListener('click', function () {
                            var id = btn.dataset.id;
                            var url = btn.dataset.url;
                            if (url)
                                window.api.createOverlay(id, url);
                        });
                    });
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _g.sent();
                    showError((e_1 === null || e_1 === void 0 ? void 0 : e_1.message) || 'Failed to load stickers.');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// UI events
save.onclick = function () { return __awaiter(_this, void 0, void 0, function () {
    var raw, m;
    return __generator(this, function (_a) {
        raw = tokenEl.value.trim();
        m = raw.match(/^cat=([^;]+)$/i) || raw.match(/^([A-Za-z0-9_\-]+)$/);
        if (!m)
            return [2 /*return*/, showError('Please paste a valid cat token.')];
        setLoggedIn(m[1]);
        refresh();
        return [2 /*return*/];
    });
}); };
signin.onclick = function () { return __awaiter(_this, void 0, void 0, function () {
    var t, e_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, window.api.login(email.value.trim(), pass.value)];
            case 1:
                t = _a.sent();
                setLoggedIn(t);
                refresh();
                return [3 /*break*/, 3];
            case 2:
                e_2 = _a.sent();
                showError((e_2 === null || e_2 === void 0 ? void 0 : e_2.message) || 'Login failed');
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
logout.onclick = function () { setLoggedOut(); };
clearAll.onclick = function () { return window.api.clearOverlays(); };
// Boot
var saved = localStorage.getItem('cat');
if (saved) {
    setLoggedIn(saved);
}
refresh();
