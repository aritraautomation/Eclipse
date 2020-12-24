//ECMAScript 5 stuff 
var global = this;

Object.keys = function (object) {
	var result = [];
	for (var i in object) {
	  if (object.hasOwnProperty(i)) {
		  result.push(i);
	  }
	}
	return result;
}

Array.isArray = function (array) {
	return array instanceof Array;
}

Function.prototype.bind = function(thisArg) {
	var fn = this;
	var slice = Array.prototype.slice;
	var bindArgs = slice.call(arguments, 1);
	return function() {
		return fn.apply(thisArg, bindArgs.concat(slice.call(arguments)));
	}
}