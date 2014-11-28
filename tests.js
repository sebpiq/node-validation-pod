var assert = require('assert')
  , _ = require('underscore')
  , chai = require('chai')
  , expect = chai.expect
  , vpod = require('./index')

var ChaiValidator = function() {
  vpod.Validator.apply(this, arguments)
}

_.extend(ChaiValidator.prototype, vpod.Validator.prototype, {
  handleError: function(err) {
    if (err instanceof chai.AssertionError) return err.message
  }
})


describe('validation-pod', function() {

  describe('validate', function() {

    var validator = new ChaiValidator({
      validSyncAttr: function(val) {},
      validAsyncAttr: function(val, done) { done() },
      unvalidSyncAttr: function(val) { throw new chai.AssertionError('dummy 1') },
      unvalidAsyncAttr: function(val, done) { done(new chai.AssertionError('dummy 2')) },
      unvalidAsyncAttrThrowing: function(val, done) { throw new chai.AssertionError('dummy 3') }
    })

    var dummyObj = {}

    it('shouldnt do anything if sync validation succeeds', function(done) {
      validator.validate(dummyObj, 'validSyncAttr', function(err, result) {
        if (err) throw err
        assert.ok(!result)
        done()
      })
    })

    it('shouldnt do anything if async validation succeeds', function(done) {
      validator.validate(dummyObj, 'validAsyncAttr', function(err, result) {
        if (err) throw err
        assert.ok(!result)
        done()
      })
    })

    it('should catch synchronous chai.AssertionErrors', function(done) {
      validator.validate(dummyObj, 'unvalidSyncAttr', function(err, result) {
        if (err) throw err
        assert.equal(result, 'dummy 1')
        done()
      })
    })

    it('should catch asynchronous chai.AssertionErrors', function(done) {
      validator.validate(dummyObj, 'unvalidAsyncAttr', function(err, result) {
        if (err) throw err
        assert.equal(result, 'dummy 2')
        done()
      })
    })

    it('should catch synchronous chai.AssertionErrors with `func` declared as async', function(done) {
      validator.validate(dummyObj, 'unvalidAsyncAttrThrowing', function(err, result) {
        if (err) throw err
        assert.equal(result, 'dummy 3')
        done()
      })
    })

  })

  describe('run', function() {

    it('should collect sync and async validation errors', function(done) {
      var validationErrors = {}
        , obj = {attr1: 'bla', attr2: ''}
        , opts = {validationErrors: validationErrors, prefix: 'root'}

      var validator = new ChaiValidator({
        attr1: function(val) { expect(val).to.be.equal(1) },
        attr2: function(val, done) { done(new chai.AssertionError('dummy')) }
      })

      validator.run(obj, opts, function(err, obj2, validationErrors2) {
        if (err) throw err
        assert.deepEqual(_.keys(validationErrors), ['root.attr1', 'root.attr2'])
        assert.ok(obj === obj2)
        assert.ok(validationErrors === validationErrors2)
        done()
      })
    })

    it('should return the error in a attr validator if one was thrown', function(done) {
      var obj = {attr1: 'bla'}

      var validator = new ChaiValidator({
        attr1: function(val) { throw new Error('not good') }
      })

      validator.run(obj, function(err) {
        assert.ok(err)
        assert.equal(err.message, 'not good')
        done()
      })
    })

    it('should return a validation error if unknown attrs', function(done) {
      var validationErrors = {}
        , obj = {attr1: 'bla', unknown1: 1234, unknown2: 5678}

      var validator = new ChaiValidator({
        attr1: function(val) {},
        attr2: function(val) {}
      })

      validator.run(obj, function(err, obj2, validationErrors) {
        assert.ok(obj === obj2)
        assert.deepEqual(_.keys(validationErrors), ['.'])
        done()
      })
    })

    it('should run the `before` hook first', function(done) {
      var obj = {attr1: 'bla'}

      var validator = new ChaiValidator({
        attr1: function(val) { expect(val).to.be.a('string') }
      }, {
        before: function() {
          this.attr1 = 'blabla'
        }
      })

      validator.run(obj, function(err, obj2, validationErrors) {
        if (err) throw err
        assert.deepEqual(obj, {'attr1': 'blabla'})
        done()
      })
    })

    it('should run the `before` hook first', function(done) {
      var obj = {attr1: 'bla'}

      var validator = new ChaiValidator({
        attr1: function(val) { expect(val).to.be.a('string') }
      }, {
        before: function() {
          this.attr1 = 'blabla'
          throw new chai.AssertionError('BLA' + this.attr1)
        }
      })

      validator.run(obj, function(err, obj2, validationErrors) {
        if (err) throw err
        assert.deepEqual(obj, {'attr1': 'blabla'})
        assert.deepEqual(validationErrors, {'.': 'BLA' + obj.attr1})
        done()
      })
    })

    it('should return the error in `before` if one was thrown', function(done) {
      var obj = {attr1: 'bla'}

      var validator = new ChaiValidator({
        attr1: function(val) { expect(val).to.be.a('string') }
      }, {
        before: function() { throw new Error('not good') }
      })

      validator.run(obj, function(err, obj2, validationErrors) {
        assert.ok(err)
        assert.equal(err.message, 'not good')
        done()
      })
    })

    it('should run the `after` hook if there was no validation error before', function(done) {
      var obj = {attr1: 'bla'}

      var validator = new ChaiValidator({
        attr1: function(val) { expect(val).to.be.a('string') }
      }, {
        after: function() {
          throw new chai.AssertionError('RIGHT' + this.attr1)
        }
      })

      validator.run(obj, function(err, obj2, validationErrors) {
        if (err) throw err
        assert.deepEqual(validationErrors, {'.': 'RIGHT' + obj.attr1})
        done()
      })
    })

    it('should return the error in `after` if one was thrown', function(done) {
      var obj = {attr1: 'bla'}

      var validator = new ChaiValidator({
        attr1: function(val) { expect(val).to.be.a('string') }
      }, {
        after: function() { throw new Error('not good') }
      })

      validator.run(obj, function(err, obj2, validationErrors) {
        assert.ok(err)
        assert.equal(err.message, 'not good')
        done()
      })
    })

    it('should throw an error if invalid number of arguments', function() {
      var validator = new ChaiValidator({})
      assert.throws(function() { validator.run() })
      assert.throws(function() { validator.run(1) })
      assert.throws(function() { validator.run(1, 2, 3) })
    })

  })


})