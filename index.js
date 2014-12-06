var async = require('async')


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
  var asyncValidOps = []
  for (var i = 0, length = attrNames.length; i < length; i++) {
    asyncValidOps.push((function(attrName) {
      return function(next) { self.validate(obj, attrName, next) }
    })(attrNames[i]))
  }
  
  async.series(asyncValidOps, function(err, results) {
    if (err) return done(err)
    for (var i = 0, length = attrNames.length; i < length; i++) {
      if (results[i]) {
        validationErrors[(prefix || '') + '.' + attrNames[i]] = results[i]
        isValid = false
      }
    }
    _doFinally()
  })

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