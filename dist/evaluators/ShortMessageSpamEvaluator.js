"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateShortMessageSpam = evaluateShortMessageSpam;
function evaluateShortMessageSpam(shortRatioScaled) {
    return shortRatioScaled >= 700;
}
