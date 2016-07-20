var isObject = require('lodash.isobject')
  , isString = require('lodash.isstring')

var Validator = exports.Validator = function(validators, beforeAfter) {
  this.validators = validators
  beforeAfter = beforeAfter || {}
  this.before = beforeAfter.before
  this.after = beforeAfter.after
}

// If `err` is a validation error and should be handled gracefully,
// this should return a string corresponding to the validation error.
// Otherwise, this should return `false` or nothing, and `err` will be thrown or bubbled up. 
Validator.prototype.handleError = function(err) {}

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

  // Returns true if `err` was handled as a validation error, false otherwise
  var _handleError = function(err) {
    var validationErrMsg = self.handleError(err)
    if (!validationErrMsg) return false
    else { 
      self._merge(validationErrors, validationErrMsg, prefix)
      isValid = false
      return true
    }
  }

  // ====== (step III) ====== Final validations, run the `after` hook, etc ...
  var _runAfter = function() {
    // Check for unknown attributes
    var key, unknownAttrs = []
    for (key in obj) {
      if (!self.validators.hasOwnProperty(key))
        unknownAttrs.push(key)
    }
    if (unknownAttrs.length)
      self._merge(validationErrors, 'unknown attributes [' + unknownAttrs.join(', ') + ']', prefix)
      //validationErrors[prefix || '.'] = 'unknown attributes [' + unknownAttrs.join(', ') + ']'

    // Run the `after` hook only if there is no validation error.
    if (isValid && self.after) {
      try {
        self.after.call(obj)
      } catch (err) {
        if(!_handleError(err)) return done(err)
      }
    }
    done(null, validationErrors)
  }

  // ====== (step I) ====== Run the `before` hook
  if (this.before) {
    try {
      this.before.call(obj)
    } catch (err) {
      if (!_handleError(err)) done(err)
      else _runAfter()
      return
    }
  }

  // ====== (step II) ====== Run validators for all attributes, and collect validation errors
  var _attrValidationCb = function(attrName) {
    return function(err, validationErrMsg) {
      ranCount++
      if (returned) return

      // If error, return, and set `returned` to true.
      if (err) {
        returned = true
        return done(err)
      }

      // Add the validation error to the object `validationErrors`
      if (validationErrMsg) {
        self._merge(validationErrors, validationErrMsg, (prefix || '') + '.' + attrName)
        isValid = false
      }

      if (ranCount === attrNames.length) _runAfter()
    }
  }, ranCount = 0, returned = false

  for (var i = 0, length = attrNames.length; i < length; i++)
    self.validate(obj, attrNames[i], _attrValidationCb(attrNames[i]))
}

// Validates `attrName` of `obj` and calls `done(err, validationErrMsg)` is called.
Validator.prototype.validate = function(obj, attrName, done) {
  var self = this
    , val = obj[attrName]
    , validator = this.validators[attrName]

  var _handleError = function(err) {
    var validationErrMsg = self.handleError(err)
    if (!validationErrMsg) done(err)
    else done(null, validationErrMsg)
  }

  var _asyncCb = function(err, validationErrMsg) {
    if (err) _handleError(err)
    else if (validationErrMsg) done(null, validationErrMsg)
    else done()
  }
  
  // Both async and sync validation, in case calling the function directly throws an error.
  // For asynchronous validation, errors are returned as the first argument of the callback.
  if (validator.length === 2) {
    try { validator.call(obj, val, _asyncCb) }
    catch (err) { return _handleError(err) }

  // Synchronous validation only
  } else {
    try { var validationErrMsg = validator.call(obj, val) }
    catch (err) { return _handleError(err) }
    done(null, validationErrMsg)
  }
}

Validator.prototype._merge = function(allValidationErrors, newValidationError, prefix) {
  if (isString(newValidationError))
    allValidationErrors[prefix || '.'] = newValidationError
  
  else if (isObject(newValidationError)) {
    for (var key in newValidationError)
      allValidationErrors[(prefix || '.') + key] = newValidationError[key]

  } else throw new Error('unvalid handleError return : ' + returned)
}