var _ = require('underscore')
  , async = require('async')


var Validator = exports.Validator = function(validators, beforeAfter) {
  this.validators = validators
  beforeAfter = beforeAfter || {}
  this.before = beforeAfter.before
  this.after = beforeAfter.after
}


_.extend(Validator.prototype, {

  // !!! Subclasses must implement this.
  // If `err` is a validation error and should be handled gracefully,
  // this should return a message.
  // Otherwise, this should return `false` or nothing, and `err` will be thrown. 
  //handleError: function(err) {},

  run: function(obj, opts, done) {
    // Handling variable number of arguments and options
    var defaults = {validationErrors: {}, prefix: null}
    if (arguments.length === 3)
      _.defaults(opts, defaults)
    else if (arguments.length === 2) {
      done = opts
      opts = defaults
    } else throw new Error('unvalid arguments')

    var self = this
      , attrNames = _.keys(this.validators)
      , validationErrors = opts.validationErrors
      , prefix = opts.prefix
      , isValid = true

    var _doFinally = function() {
      // Check for unknown attributes
      var unknownAttrs = _.difference(_.keys(obj), _.keys(self.validators))
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
    async.series(_.map(attrNames, function(attrName) {
      return _.bind(self.validate, self, obj, attrName)
    }), function(err, results) {
      if (err) return done(err)
      _.forEach(_.zip(attrNames, results), function(p) {
        if (p[1]) {
          validationErrors[(prefix || '') + '.' + p[0]] = p[1]
          isValid = false
        }
      })
      _doFinally()
    })

  },

  // Validates `attrName` of `obj` and calls `done(err, validationErrMsg)` is called.
  validate: function(obj, attrName, done) {
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

})