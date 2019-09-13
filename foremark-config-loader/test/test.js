const assert = require('assert');

const loader = require('../index.js');

describe('loader', () => {
    it('generated module exports an (unmerged) config object', () => {
        const config = `
            (window.foremarkConfig = window.foremarkConfig || []).push({
                prop: 'value',
            });
        `;

        const generated = loader(config);

        const moduleObject = eval(`
            (() => {
                let module = {};
                ${generated}
                return module;
            })()
        `);

        assert.equal(moduleObject.exports[0].prop, 'value');
    });
});