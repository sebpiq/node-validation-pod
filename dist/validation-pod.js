(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Validator = exports.Validator = function(validators, beforeAfter) {
  this.validators = validators
  beforeAfter = beforeAfter || {}
  this.before = beforeAfter.before
  this.after = beforeAfter.after
}

// !!! Subclasses must implement:
// `Validator.handleError(err)`.
// If `err` is a validation error and should be handled gracefully,
// this should return a message.
// Otherwise, this should return `false` or nothing, and `err` will be thrown. 


Validator.prototype.run =  function(obj, opts, done) {
  // Handling variable number of arguments and options
  var defaults = { validationErrors: {}, prefix: null }
  if (arguments.length === 3) {
    opts.validationErrors = opts.validationErrors || defaults.validationErrors
    opts.prefix = opts.prefix || defaults.prefix
  } else if (arguments.length === 2) {
    done = opts
    opts = defaults
  } else throw new Error('unvalid arguments')

  var self = this
    , attrNames = Object.keys(this.validators)
    , validationErrors = opts.validationErrors
    , prefix = opts.prefix
    , isValid = true

  var _doFinally = function() {
    // Check for unknown attributes
    var unknownAttrs = []
    for (var key in obj) {
      if (!self.validators.hasOwnProperty(key))
        unknownAttrs.push(key)
    }
    if (unknownAttrs.length)
      validationErrors[prefix || '.'] = 'unknown attributes [' + unknownAttrs.join(', ') + ']'

    // Run the `after` hook only if there is no validation error.
    if (isValid && self.after) {
      try {
        self.after.call(obj)
      } catch (err) {
        if(!_handleError(err)) return done(err)
      }
    }
    done(null, obj, validationErrors)
  }

  var _handleError = function(err) {
    var returned = self.handleError(err)
    if (!returned) return false
    else {
      validationErrors[prefix || '.'] = returned
      isValid = false
      return true
    }
  }

  // Run the `before` hook
  if (this.before) {
    try {
      this.before.call(obj)
    } catch (err) {
      if (_handleError(err)) _doFinally()
      else done(err)
      return
    }
  }

  // Run validators for all attributes, and collect validation errors
  var _asyncValidCb = function(attrName) {
    return function(err, validationErrMsg) {
      ranCount++
      if (returned) return

      if (err) {
        returned = true
        return done(err)
      }

      if (validationErrMsg) {
        validationErrors[(prefix || '') + '.' + attrName] = validationErrMsg
        isValid = false
      }

      if (ranCount === attrNames.length) _doFinally()
    }
  }, ranCount = 0, returned = false

  for (var i = 0, length = attrNames.length; i < length; i++)
    self.validate(obj, attrNames[i], _asyncValidCb(attrNames[i]))
}

// Validates `attrName` of `obj` and calls `done(err, validationErrMsg)` is called.
Validator.prototype.validate = function(obj, attrName, done) {
  var self = this
    , val = obj[attrName]
    , validator = this.validators[attrName]

  var _asyncCb = function(err) {
    if (err) _handleError(err)
    else done()
  }

  var _handleError = function(err) {
    var returned = self.handleError(err)
    if (!returned) done(err)
    else done(null, returned)
  }

  // Both async and sync validation, in case calling the function directly throws an error.
  // For asynchronous validation, errors are returned as the first argument of the callback.
  if (validator.length === 2) {
    try { validator.call(obj, val, _asyncCb) }
    catch (err) { _handleError(err) }

  // Synchronous validation only
  } else {
    try { validator.call(obj, val) }
    catch (err) { return _handleError(err) }
    done()
  }
}
},{}]},{},[1])