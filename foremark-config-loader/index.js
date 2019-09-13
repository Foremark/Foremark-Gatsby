
module.exports = src => {
    return `
        const window = {foremarkConfig: []};
        (function(window){${src}})(window);
        module.exports = window.foremarkConfig;
    `;
};
