// shared/formatters/math-formatter.js
// Math-specific formatter that converts fractions to proper HTML

const MathFormatter = {
    // Format question text - smart detection of word problems
    formatQuestion: (text) => {
        if (!text) return text;
        
        // Check if this is likely a word problem
        // Word problems typically have words before/after fractions and longer text
        const isWordProblem = text.includes(' ') && 
                              text.length > 30 && 
                              text.match(/[a-zA-Z]/g)?.length > 20;
        
        if (isWordProblem) {
            // For word problems, use inline unicode fractions
            return text.replace(/(\d+)\s*\/\s*(\d+)/g, (match, numerator, denominator) => {
                return MathFormatter.formatInlineFraction(numerator, denominator);
            });
        } else {
            // For math expressions, use stacked fractions
            return text.replace(/(\d+)\s*\/\s*(\d+)/g, (match, numerator, denominator) => {
                return `<span class="fraction"><span class="numerator">${numerator}</span><span class="denominator">${denominator}</span></span>`;
            });
        }
    },
    
    // Format inline fraction for word problems
    formatInlineFraction: (numerator, denominator) => {
        // Common fractions have unicode characters
        const commonFractions = {
            '1/2': '½', '1/3': '⅓', '2/3': '⅔',
            '1/4': '¼', '3/4': '¾', '1/5': '⅕',
            '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
            '1/6': '⅙', '5/6': '⅚', '1/8': '⅛',
            '3/8': '⅜', '5/8': '⅝', '7/8': '⅞'
        };
        
        const fraction = `${numerator}/${denominator}`;
        if (commonFractions[fraction]) {
            return commonFractions[fraction];
        }
        
        // For uncommon fractions, use sup/sub
        return `${MathFormatter.superscript(numerator)}⁄${MathFormatter.subscript(denominator)}`;
    },
    
    // Convert number to superscript
    superscript: (n) => {
        const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
                      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
        return n.toString().split('').map(d => map[d]).join('');
    },
    
    // Convert number to subscript
    subscript: (n) => {
        const map = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
                      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
        return n.toString().split('').map(d => map[d]).join('');
    },
    
    // Format options array - return objects with display and value
    formatOptions: (options) => {
        if (!options || !Array.isArray(options)) return options;
        
        return options.map(opt => ({
            display: MathFormatter.formatOption(opt),
            value: opt
        }));
    },
    
    // Format a single option for display
    formatOption: (text) => {
        if (!text) return text;
        
        // Options are usually simple fractions, so use stacked format
        const fractionRegex = /(\d+)\s*\/\s*(\d+)/g;
        return text.replace(fractionRegex, (match, numerator, denominator) => {
            return `<span class="fraction"><span class="numerator">${numerator}</span><span class="denominator">${denominator}</span></span>`;
        });
    },
    
    // Format correct answer for display
    formatAnswer: (text) => {
        if (!text) return text;
        
        const fractionRegex = /(\d+)\s*\/\s*(\d+)/g;
        return text.replace(fractionRegex, (match, numerator, denominator) => {
            return `<span class="fraction"><span class="numerator">${numerator}</span><span class="denominator">${denominator}</span></span>`;
        });
    }
};

export default MathFormatter;
