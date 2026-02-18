"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePriorModeration = evaluatePriorModeration;
function evaluatePriorModeration(priorWarnings, priorTimeouts) {
    const signals = [];
    if (priorWarnings > 0) {
        signals.push('prior_warning');
    }
    if (priorTimeouts > 0) {
        signals.push('prior_timeout');
    }
    return signals;
}
