// shared/formatters/default-formatter.js
// Default formatter that returns text as-is (no formatting)

const DefaultFormatter = {
    // Format question text
    formatQuestion: (text) => {
        return text;
    },
    
    // Format options array
    formatOptions: (options) => {
        return options;
    },
    
    // Format a single option (if needed)
    formatOption: (text) => {
        return text;
    },
    
    // Format correct answer display
    formatAnswer: (text) => {
        return text;
    }
};

export default DefaultFormatter;
