node-validation-pod
=====================

All object validation libraries come bundled with their own *assertion / sanitization* primitives. Which is kind of dumb. There is a lot of great libraries such as [chai.js](http://chaijs.com) or [validator.js](https://github.com/chriso/validator.js) which could and should be used instead.

**node-validation-pod** is just an empty shell for running **synchronous / asynchronous** validation on objects. It doesn't come with any functionality for validating data. Only the validation logic. This way, you can plug-in any validation library you want.


The validation logic
----------------------

Implements 3 steps :

1. **before** : prepare your data for validation. If some fields validity depend on each other, you can check it here. If a validation error occurs, go directly to `after` step.
2. **attributes validators** : for each attribute in your object, run the corresponding validator. Gathers all errors in one object.
3. **after** : check for unknown attributes. Add errors to the errors found in previous step.


Example 1 : object validation using validator.js
---------------------------------------------------

Here is a simple example on how to use **validator.js** to validate the data submitted in a user sign-up form.

```javascript
var chai = require('validator')
  , vpod = require('validation-pod')

userRegisterValidator = new vpod.Validator({
  email: function(val) { 
    if (!validator.isEmail(val)) return 'Invalid email' 
  },
  password: function(val) { 
    if (!isLength(password, 8)) return 'Password must be at least 8 characters!'
    // ... more validation rules  
  },
  confirmPassword: function(val) { 
    if (this.password !== val) return 'Passwords do not match'
  }
})

```


Example 2 : object validation using chai.js
----------------------------------------------

First you need to create a subclass of `Validator`:

```javascript
var chai = require('chai')
  , vpod = require('validation-pod')
  , inherits = require('util').inherits

var ChaiValidator = function() {
  vpod.Validator.apply(this, arguments)
}

inherits(ChaiValidator, vpod.Validator)

// This hooks allows to catch errors that occur during any of the 3 steps
// of the validation process.
// Return a message if the error is a validation error and should be handled,
// return nothing or `false` if the error has not been handled and should be thrown. 
ChaiValidator.prototype.handleError = function(err) {
  if (err instanceof chai.AssertionError) {
    return err.message
  }
}
```

`ChaiValidator` will allow us to validate data using chai assertions. Let's now create a validator for some boring `Animal` object :

```javascript
var fs = require('fs')
  , chai = require('chai')
  , expect = chai.expect

var animalValidator = new ChaiValidator({
  
  // Example of synchronous validation
  species: function(val) { expect(val).to.be.a('string') },
  color: function(val) { expect(val).to.be.a('string') },
  age: function(val) { expect(val).to.be.a('number') },

  // Example of asynchronous validation (note the second argument is a `done` callback)
  // We want to validate that the folder where we put our animal's pictures exists.
  pictureFolder: function(val, done) {
    fs.open(val, 'r', function(err) {
      if (err && err.code === 'ENOENT')
        err = new chai.AssertionError('path \'' + val + '\' does not exist')
      done(err)
    })
  }
})
```

Now let's validate some stuff :

```javascript
// A valid animal
var aDog = {
  species: 'dog',
  color: 'blue',
  age: 12,
  pictureFolder: '/tmp'
}

animalValidator.run(aDog, function(err, validationErrors) {
  if (err) throw err // this is real errors coming here.
  console.log(validationErrors) // -> {}
})
```

```javascript
// An unvalid animal
var anotherDog = {
  species: 'dog',
  color: 1,
  age: 12,
  pictureFolder: '/waf waf',
  unknownAttribute: '???'
}

animalValidator.run(anotherDog, function(err, validationErrors) {
  if (err) throw err // this is real errors coming here.
  console.log(validationErrors) // -> {'.color': 'expected ...', '.': 'unknownAttribute': '...', ...}
})
```


API
-----

### class Validator(validators, beforeAfter)

Builds a new validator.


#### Validator.run(obj, [opts,] done)

Run the validation on `obj`. Options can be :

  - `prefix` : the prefix to add to the validation error keys
  - `validationErrors`: an object to populate with validation errors  
