/*
Copyright 2015, Yahoo Inc. All rights reserved.
Code licensed under the MIT License.
See LICENSE.txt
*/

'use strict'

const makeTap = require('make-tap-output')
const tage = require('tage')
const createTestPromise = require('create-test-promise')

const isNum = n => typeof n === 'number'

class PitestiSuite {
  constructor (opts = {}) {
    this.tests = []
    this.afterTest = []
    this.testNames = []
    this.skips = {}
    this.totalSkips = 0
    this.totalPasses = 0
    this.totalFails = 0
    this.totalTests = 0
    this.onlyTest = null
    this.exitCode = 0
    this.finisher = opts.done || process.exit
    this.out = opts.outputStream || process.stdout
    this.summary = opts.summary === undefined ? true : opts.summary
    this.tap = makeTap()
    this.tap.pipe(this.out)
    this.timeout = opts.timeout || 5000
    this.contextSeparator = opts.contextSeparator || ' '
    this.contexts = []
  }

  test (name, fnOrP, opts = {}) {
    this.testNames.push(
      this.contexts.length
      ? [...this.contexts, name].join(this.contextSeparator)
      : name
    )
    const testCase = fnOrP ? createTestPromise(fnOrP, {
      timeout: opts.timeout || this.timeout
    }) : null
    if (this.startSub) {
      testCase.startSub = this.startSub
      delete this.startSub
    }
    this.tests.push(testCase)
  }

  runTest (i) {
    if (i === this.tests.length) {
      if (this.summary) {
        this.out.write('\n')
        this.tap.diag(`tests ${this.totalTests}`)
        this.tap.diag(`pass  ${this.totalPasses}`)
        this.tap.diag(`fail  ${this.totalFails}`)
        if (this.totalSkips > 0) {
          this.tap.diag(`skip  ${this.totalSkips}`)
        }
      }
      return this.finisher(this.exitCode)
    }
    this.totalTests++
    const name = this.testNames[i]
    if (!this.tests[i] || (isNum(this.onlyTest) && this.onlyTest !== i)) {
      this.tap.pass(name, 'SKIP')
      this.totalSkips++
      return this.runTest(++i)
    }
    const testCase = this.tests[i]
    if (testCase.startSub) {
      const parentTap = this.tap
      this.tap = this.tap.unbufferedSub(testCase.startSub)
      this.tap.parentTap = parentTap
    }
    testCase()
    .then(
      () => {
        this.totalPasses++
        this.tap.pass(name)
      },
      err => {
        this.exitCode = 1
        this.totalFails++
        this.tap.fail(name, typeof err === 'string' ? {message: err} : err)
      }
    )
    .then(() => {
      if (this.afterTest[i]) {
        this.afterTest[i]()
      }
      this.runTest(++i)
    })
    .catch(e => this.bailOut(e))
    // ^ Should only get here if there's an error in our code.
  }

  skip (name) {
    this.testNames.push(name)
    this.tests.push(null)
  }

  only (...args) {
    this.onlyTest = this.tests.length
    this.test(...args)
  }

  context (prefix, fn) {
    this.contexts.push(prefix)
    fn()
    this.contexts.pop(prefix)
  }

  subtest (name, fn) {
    this.startSub = name
    const testLength = this.tests.length
    fn()
    if (this.tests.length === testLength) {
      throw new Error('empty subtest')
    }
    const last = this.tests.length - 1
    const preExistingAfterTest = this.afterTest[last]
    this.afterTest[last] = () => {
      if (preExistingAfterTest) {
        preExistingAfterTest()
      }
      this.tap = this.tap.parentTap
    }
  }

  plan () {
    this.tap.plan(this.tests.length)
  }

  bailOut (err) {
    this.out.write(err.stack)
    this.out.write('\n\nBail out! Internal pitesti error, see above.\n')
    this.finisher(2)
  }
}

for (const func of ['test', 'only', 'skip', 'context', 'subtest']) {
  PitestiSuite.prototype[func] = tage(PitestiSuite.prototype[func])
}

module.exports = function (opts) {
  let testStarted = false
  const suite = new PitestiSuite(opts)
  const test = (...args) => {
    if (testStarted) {
      return
    }
    if (args.length === 0) {
      testStarted = true
      suite.plan()
      suite.runTest(0)
      return
    }
    return suite.test(...args)
  }
  test.only = (...args) => suite.only(...args)
  test.skip = (...args) => suite.skip(...args)
  test.context = (...args) => suite.context(...args)
  test.subtest = (...args) => suite.subtest(...args)
  test.test = test // For destructuring
  return test
}
