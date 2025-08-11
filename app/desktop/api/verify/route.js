"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
var multipass_1 = require("@shopify/multipass"); // npm i @shopify/multipass
var shopify_api_1 = require("@shopify/shopify-api");
var shopify = new shopify_api_1.Shopify({
    apiKey: process.env.SHOPIFY_ADMIN_KEY,
    apiSecretKey: process.env.SHOPIFY_ADMIN_SECRET,
    scopes: ['read_customers', 'read_orders'],
    shop: process.env.SHOPIFY_SHOP,
    apiVersion: '2024-07'
});
function POST(req) {
    return __awaiter(this, void 0, void 0, function () {
        var token, customerId, customer, orders, allowedIds, manifest, hash, manifestHash;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, req.json()];
                case 1:
                    token = (_a.sent()).token;
                    if (!token)
                        return [2 /*return*/, new Response('Missing token', { status: 400 })];
                    try {
                        customer = (0, multipass_1.decode)(token, process.env.SHOPIFY_MULTIPASS_SECRET);
                        customerId = customer.id;
                    }
                    catch (_b) {
                        return [2 /*return*/, new Response('Invalid token', { status: 401 })];
                    }
                    return [4 /*yield*/, shopify.rest.Order.all({
                            customer_id: customerId,
                            status: 'any',
                            fields: 'line_items'
                        })];
                case 2:
                    orders = _a.sent();
                    allowedIds = new Set();
                    orders.forEach(function (o) {
                        return o.line_items.forEach(function (li) { return allowedIds.add(li.sku.toLowerCase()); });
                    });
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@/packages/stickers/index.json'); })];
                case 3:
                    manifest = _a.sent();
                    return [4 /*yield*/, crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifest.default)))];
                case 4:
                    hash = _a.sent();
                    manifestHash = Buffer.from(hash).toString('hex');
                    return [2 /*return*/, Response.json({ allowedIds: Array.from(allowedIds), manifestHash: manifestHash })];
            }
        });
    });
}
