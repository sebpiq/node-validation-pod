var _ = require('underscore')
  , chai = require('chai')
  , async = require('async')

// Validates the object `obj`, by running all `validators` `{attrName: func(val[, done])}` on it.
// Validation errors are then stored in `validationErrors` object.
// The path of unvalid attributes is constructed by appending the name of the unvalid 
// attribute to `prefix`.
// `beforeAfter` contain hooks `before()`, `after()` and `done(err, obj, validationErrors)`
var validateObject = exports.validateObject = function(prefix, obj, validationErrors, beforeAfter, validators) {
  var asyncValid = []
    , isValid = true

  var _handleError = function(err) {
    if (err instanceof chai.AssertionError) {
      validationErrors[prefix] = err.message
      isValid = false
    } else throw err
  }

  var _doFinally = function() {
    var unknownAttrs = _.difference(_.keys(obj), _.keys(validators))
    if (unknownAttrs.length)
      _handleError(new chai.AssertionError('unknown attributes [' + unknownAttrs.join(', ') + ']'))
    if (isValid && beforeAfter.after) {
      try { beforeAfter.after.call(obj) } catch (err) { _handleError(err) }
    }
    if (beforeAfter.done) beforeAfter.done(null, obj, validationErrors)
  }

  // Run the `before` hook
  if (beforeAfter.before) {
    try { beforeAfter.before.call(obj) } catch (err) {
      _handleError(err)
      _doFinally()
      return
    }
  }

  // Run validators for all attributes
  async.series(_.pairs(validators).map(function(p) {
    var attrName = p[0]
      , func = p[1]
      , val = obj[attrName]
    return validate.bind(obj, prefix + '.' + attrName, validationErrors, val, func)
  }), function(err, results) {
    if (err) return _handleError(err)
    if (_.some(results, function(r) { return r !== null })) isValid = false
    _doFinally()
  })
}

// Validates `val` and if validation error, store it to `validationErrors[prefix]`
// The validator is `func(val[, done])`.
// Once the validation is finished, `done(err, validationErr)` is called.
var validate = exports.validate = function(prefix, validationErrors, val, func, done) {

  var _handleError = function(err) {
    if (err instanceof chai.AssertionError) {
      validationErrors[prefix] = err.message
      if (done) done(null, err)
    } else if (done) done(err, null)
    else throw err
  }

  // Both async and sync validation, in case calling the function directly throws an error.
  // For asynchronous validation, errors are returned as the first argument of the callback.
  if (func.length === 2) {
    try {
      func.call(this, val, function(err) {
        if (err) _handleError(err)
        else if (done) done(null, null)
      })
    } catch (err) { _handleError(err) }

  // Synchronous validation only
  } else {
    try {
      func.call(this, val)
      if (done) done(null, null)
    }
    catch (err) { _handleError(err) }
  }
}