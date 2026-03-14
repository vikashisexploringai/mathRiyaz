// shared/formatters/math-formatter.js
// Math-specific formatter that converts fractions to proper HTML

const MathFormatter = {
    // Format question text - convert fractions to HTML
    formatQuestion: (text) => {
        if (!text) return text;
        
        // Regular expression to find fractions like "1/4", "2/3", etc.
        // This matches numbers separated by a slash, optionally with spaces
        const fractionRegex = /(\d+)\s*\/\s*(\d+)/g;
        
        // Replace each fraction with HTML span structure
        return text.replace(fractionRegex, (match, numerator, denominator) => {
            return `<span class="fraction"><span class="numerator">${numerator}</span><span class="denominator">${denominator}</span></span>`;
        });
    },
    
    // Format options array - convert each option's fractions to HTML
    formatOptions: (options) => {
        if (!options || !Array.isArray(options)) return options;
        
        return options.map(opt => MathFormatter.formatOption(opt));
    },
    
    // Format a single option
    formatOption: (text) => {
        if (!text) return text;
        
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
