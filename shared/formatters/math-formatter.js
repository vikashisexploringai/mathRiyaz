// shared/formatters/math-formatter.js
const MathFormatter = {
    // Format question text - smart fraction handling
    formatQuestion: (text) => {
        if (!text) return text;
        
        // Check if this looks like a word problem (has words before/after)
        if (text.includes(' ') && text.match(/\d+\/\d+/)) {
            // For word problems, use unicode fractions
            return text.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
                return formatUnicodeFraction(num, den);
            });
        } else {
            // For math expressions, use stacked fractions
            return text.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
                return `<span class="fraction"><span class="numerator">${num}</span><span class="denominator">${den}</span></span>`;
            });
        }
    },
    
    // Format options - keep stacked for answers
    formatOptions: (options) => {
        return options.map(opt => ({
            display: opt.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
                return `<span class="fraction"><span class="numerator">${num}</span><span class="denominator">${den}</span></span>`;
            }),
            value: opt
        }));
    }
};

// Helper function for unicode fractions
function formatUnicodeFraction(num, den) {
    const unicodeFractions = {
        '1/2': '½', '1/3': '⅓', '2/3': '⅔',
        '1/4': '¼', '3/4': '¾', '1/5': '⅕',
        '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
        '1/6': '⅙', '5/6': '⅚', '1/8': '⅛',
        '3/8': '⅜', '5/8': '⅝', '7/8': '⅞'
    };
    
    const key = `${num}/${den}`;
    if (unicodeFractions[key]) {
        return unicodeFractions[key];
    }
    
    // For uncommon fractions, use sup/sub
    return `${superscript(num)}⁄${subscript(den)}`;
}

function superscript(n) {
    const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
                  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return n.toString().split('').map(d => map[d]).join('');
}

function subscript(n) {
    const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
                  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
    return n.toString().split('').map(d => map[d]).join('');
}
