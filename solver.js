// This script runs in a background Web Worker thread.
onmessage = function(e) {
    const { numbers, target, level } = e.data;
    const solver = new Solver(numbers, target, level);
    const result = solver.solve();
    postMessage(result);
};

class Solver {
    constructor(numbers, target, level) {
        this.initialNumbers = numbers;
        this.target = target;
        this.level = level;
        this.solutions = [];
        this.closest = { value: Infinity, str: '', complexity: Infinity };
        this.memo = new Map();
    }

    solve() {
        const initialItems = this.initialNumbers.map(n => ({ value: n, str: n.toString(), complexity: 0 }));
        this.find(initialItems);
        this.solutions.sort((a, b) => a.complexity - b.complexity);
        const uniqueSolutions = [...new Map(this.solutions.map(item => [item.str, item])).values()];
        return { solutions: uniqueSolutions, closest: this.closest };
    }
    
    find(items) {
        const key = items.map(it => it.value).sort().join(',');
        if (this.memo.has(key)) return;

        if (items.length === 1) {
            const item = items[0];
            if (Math.abs(item.value - this.target) < 0.0001) { this.solutions.push(item); }
            else if (item.value % 1 === 0 && Math.abs(item.value - this.target) < Math.abs(this.closest.value - this.target)) {
                this.closest = item;
            }
            return;
        }

        this.runUnaryOps(items);
        if (this.level >= 3) this.runSigmaOps(items);
        this.runBinaryOps(items);
        
        this.memo.set(key, true);
    }
    
    runUnaryOps(items) {
        if (this.level >= 2) {
             for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.value > 0) {
                    const remaining = items.filter((_, idx) => idx !== i);
                    this.find([...remaining, { value: Math.sqrt(item.value), str: `\\sqrt{${item.str}}`, complexity: item.complexity + 5 }]);
                    if (item.value > 0) this.find([...remaining, { value: Math.sqrt(Math.sqrt(item.value)), str: `\\sqrt{\\sqrt{${item.str}}}`, complexity: item.complexity + 6 }]);
                }
            }
        }
        if (this.level >= 3) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.value >= 0 && item.value <= 10 && item.value % 1 === 0) {
                     const remaining = items.filter((_, idx) => idx !== i);
                     this.find([...remaining, { value: this.factorial(item.value), str: `(${item.str})!`, complexity: item.complexity + 8 }]);
                }
            }
        }
    }

    runBinaryOps(items) {
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = items[i], b = items[j];
                const remaining = items.filter((_, idx) => idx !== i && idx !== j);
                this.tryOp(a, b, '+', remaining);
                this.tryOp(a, b, '-', remaining); this.tryOp(b, a, '-', remaining);
                this.tryOp(a, b, '*', remaining);
                this.tryOp(a, b, '/', remaining); this.tryOp(b, a, '/', remaining);
                if (this.level >= 1) { this.tryOp(a, b, '^', remaining); this.tryOp(b, a, '^', remaining); }
                if (this.level >= 2) { this.tryOp(a, b, 'root', remaining); this.tryOp(b, a, 'root', remaining); }
            }
        }
    }
    
    runSigmaOps(items) {
        const n = items.length;
        if (n < 2) return;
        for (let i = 0; i < (1 << n); i++) {
            const startSet = [], remaining1 = [];
            for (let k = 0; k < n; k++) { ((i >> k) & 1) ? startSet.push(items[k]) : remaining1.push(items[k]); }
            if (startSet.length === 0 || startSet.length > 2) continue;
            for (let j = 0; j < (1 << remaining1.length); j++) {
                const endSet = [], remaining2 = [];
                for (let k = 0; k < remaining1.length; k++) { ((j >> k) & 1) ? endSet.push(remaining1[k]) : remaining2.push(remaining1[k]); }
                if (endSet.length === 0 || endSet.length > 2 || startSet.length + endSet.length > n) continue;
                this.processSigma(startSet, endSet, remaining2);
            }
        }
    }

    processSigma(startSet, endSet, remaining) {
        const startBounds = this.getBoundaryValues(startSet);
        const endBounds = this.getBoundaryValues(endSet);
        for (const sBound of startBounds) {
            for (const eBound of endBounds) {
                const start = Math.min(sBound.value, eBound.value), end = Math.max(sBound.value, eBound.value);
                if (start <= 0 || start % 1 !== 0 || end % 1 !== 0 || end - start > 12 || end > 15) continue;
                
                const strI = sBound.value < eBound.value ? sBound.str : eBound.str;
                const strEnd = sBound.value < eBound.value ? eBound.str : sBound.str;
                
                // Patterns not consuming numbers from 'remaining'
                const simplePatterns = [
                    {p: 'i', s: 'i', c:10}, {p: 'i+i', s: 'i+i', c:11}, {p: 'i*i', s: 'i \\times i', c:11},
                    {p: 'i!', s: 'i!', c:15}, {p: 'i^i', s: 'i^i', c:16}, {p: 'sqrt(i)', s: '\\sqrt{i}', c:14}
                ];
                for (const pat of simplePatterns) {
                    const sigmaResult = this.calculateSigma(start, end, pat.p);
                    if (sigmaResult === null || !isFinite(sigmaResult)) continue;
                    const newItem = { value: sigmaResult, str: `\\sum_{i=${strI}}^{${strEnd}} ${pat.s}`, complexity: sBound.complexity + eBound.complexity + pat.c };
                    this.find([...remaining, newItem]);
                }

                // Patterns consuming one number 'k' from 'remaining'
                if (remaining.length > 0) {
                    for (let k_idx = 0; k_idx < remaining.length; k_idx++) {
                        const k = remaining[k_idx];
                        const finalRemaining = remaining.filter((_, idx) => idx !== k_idx);
                        const complexPatterns = [
                           {p: 'i+k', s: `i+${k.str}`, c:12}, {p: 'i*k', s: `i \\times ${k.str}`, c:13},
                           {p: 'k-i', s: `${k.str}-i`, c:12}, {p: 'i-k', s: `i-${k.str}`, c:12},
                           {p: 'i^k', s: `i^{${k.str}}`, c:14}, {p: 'k^i', s: `${k.str}^{i}`, c:14}
                        ];
                        for (const pat of complexPatterns) {
                             const sigmaResult = this.calculateSigma(start, end, pat.p, k.value);
                             if (sigmaResult === null || !isFinite(sigmaResult)) continue;
                             const newItem = { value: sigmaResult, str: `\\sum_{i=${strI}}^{${strEnd}} (${pat.s})`, complexity: sBound.complexity + eBound.complexity + k.complexity + pat.c };
                             this.find([...finalRemaining, newItem]);
                        }
                    }
                }
            }
        }
    }
    
    getBoundaryValues(items) {
        if (items.length === 1) return [items[0]];
        if (items.length === 2) {
            const a = items[0], b = items[1]; const results = [];
            results.push({ value: a.value + b.value, str: `${a.str}+${b.str}`, complexity: a.complexity + b.complexity + 1 });
            if (a.value > b.value) results.push({ value: a.value - b.value, str: `${a.str}-${b.str}`, complexity: a.complexity + b.complexity + 1 });
            if (b.value > a.value) results.push({ value: b.value - a.value, str: `${b.str}-${a.str}`, complexity: a.complexity + b.complexity + 1 });
            results.push({ value: a.value * b.value, str: `${this.addParen(a, '*')}*${this.addParen(b, '*')}`, complexity: a.complexity + b.complexity + 1 });
            return results;
        }
        return [];
    }
    
    tryOp(a, b, op, remaining) {
        let value, str, complexity;
        if ((op === '*' || op === '/') && b.value === 1) return;
        if (op === '^' && b.value === 1) return;
        if (op === '*' && a.value === 1) { a = b; b = {value: 1, str: "1"}; }

        switch (op) {
            case '+': value = a.value + b.value; str = `${a.str}+${b.str}`; complexity = a.complexity + b.complexity + 1; break;
            case '-':
                if (a.value < b.value) return; value = a.value - b.value; str = `${a.str}-${b.str.includes('+') || b.str.includes('-') ? `(${b.str})` : b.str}`; complexity = a.complexity + b.complexity + 1.1; break;
            case '*': value = a.value * b.value; str = `${this.addParen(a, '*')}*${this.addParen(b, '*')}`; complexity = a.complexity + b.complexity + 1.2; break;
            case '/':
                if (b.value === 0) return; value = a.value / b.value; str = `${this.addParen(a, '/')} / ${this.addParen(b, '/')}`; complexity = a.complexity + b.complexity + 1.5; break;
            case '^': value = Math.pow(a.value, b.value); str = `{${this.addParen(a, '^')}}^{${b.str}}`; complexity = a.complexity + b.complexity + 4; break;
            case 'root': value = Math.pow(a.value, 1/b.value); str = `\\sqrt[${b.str}]{${a.str}}`; complexity = a.complexity + b.complexity + 5; break;
            default: return;
        }
        if (!isFinite(value)) return;
        if (value % 1 !== 0 && remaining.every(item => item.value % 1 === 0) && this.level < 2) return;
        this.find([...remaining, { value, str, complexity }]);
    }
    
    factorial = (n) => (n <= 1 ? 1 : n * this.factorial(n - 1));
    addParen = (item, op) => {
        const hasLowPrecedence = item.str.includes('+') || item.str.includes('-');
        if ((op === '*' || op === '/') && hasLowPrecedence) return `(${item.str})`;
        if (op === '^' && (hasLowPrecedence || item.str.includes('*') || item.str.includes('/'))) return `(${item.str})`;
        return item.str;
    };
    calculateSigma(start, end, pattern, k = null) {
        let sum = 0;
        for (let i = start; i <= end; i++) {
            let term;
            switch(pattern) {
                case 'i': term = i; break;
                case 'i+i': term = i + i; break;
                case 'i*i': term = i * i; break;
                case 'i!': if (i > 10) return null; term = this.factorial(i); break;
                case 'sqrt(i)': if (i < 0) return null; term = Math.sqrt(i); break;
                case 'i^i': term = Math.pow(i, i); break;
                // Patterns with k
                case 'i+k': term = i + k; break;
                case 'i*k': term = i * k; break;
                case 'k-i': if (k < i) return null; term = k - i; break;
                case 'i-k': if (i < k) return null; term = i - k; break;
                case 'i^k': term = Math.pow(i, k); break;
                case 'k^i': term = Math.pow(k, i); break;
                default: return null;
            }
            if (!isFinite(term)) return null;
            sum += term;
        }
        return sum;
    }
}
