'use strict';

const { getTest } = require('./helpers');

const testOutput = `
TAP version 13
1..6
ok 1 test 1
ok 2 ctx1 : test 2
ok 3 ctx1 : test 3
ok 4 ctx2 : test 4
ok 5 ctx2 : ctx3 : test 5
ok 6 test 6

`;

module.exports = function (cb) {
  const { test, context } = getTest({
    expected: testOutput,
    cb,
    config: { summary: false, contextSeparator: ' : ' }
  });

  test('test 1', () => {});
  context('ctx1', () => {
    test('test 2', () => {});
    test`test 3`(() => {});
  });
  context`ctx2`(() => {
    test('test 4', () => {});
    context`ctx3`(() => {
      test('test 5', () => {});
    });
  });
  test('test 6', () => {});

  test();
};

if (require.main === module) {
  module.exports(function () {});
}
