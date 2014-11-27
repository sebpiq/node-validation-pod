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

  describe('validateObject', function() {

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

    it('should return a validation error if unknown fields', function(done) {
      var validationErrors = {}
        , obj = {attr1: 'bla', unknown1: 1234, unknown2: 5678}
        , opts = {prefix: 'root'}

      var validator = new ChaiValidator({
        attr1: function(val) {},
        attr2: function(val) {}
      })

      validator.run(obj, opts, function(err, obj2, validationErrors) {
        assert.ok(obj === obj2)
        assert.deepEqual(_.keys(validationErrors), ['root'])
        done()
      })
    })

  })


})