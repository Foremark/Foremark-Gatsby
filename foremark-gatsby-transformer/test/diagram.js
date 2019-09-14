const assert = require('assert');

const diagram = require('../dist/diagram.js');

describe('diagram', () => {
    it('works', done => {
        diagram.toSvg('aaa').then(() => {
            done();
        }, done);
    });
});