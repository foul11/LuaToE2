// From gist https://gist.github.com/trusktr/05b9c763ac70d7086fe3a08c2c4fb4bf
// Added instanceOf operator

let propCacheSymbol = Symbol()
let oldHasInstance = Symbol()

function isInstanceOf(obj) {
    let testClass = this;
    
    // if (obj instanceof Function)
    //     return false;
    
    if (!obj)
        return false;
    
    let proto = Object.getPrototypeOf(obj)
    
    // if (proto === Object.getPrototypeOf(testClass))
    //     return true;
    
    if (testClass[oldHasInstance](obj))
        return true;
    
    // if obj contains the MultiClassPrototype in it's proto chain.
    if (obj instanceof MultiClassPrototype) {
        let {classes} = proto[propCacheSymbol]
        
        if (classes.includes(testClass)) {
            return true
        }
        
        for (let i=0, l=classes.length; i<l; i+=1) {
            let ctor = classes[i]
            if (ctor.prototype instanceof testClass) {
                return true
            }
        }
    }
    
    return false
}

function getBaseClass(targetClass){
    if(targetClass instanceof Function){
        let baseClass = targetClass;

        while (baseClass){
            const newBaseClass = Object.getPrototypeOf(baseClass);

            if(newBaseClass && newBaseClass !== Object && newBaseClass.name){
                baseClass = newBaseClass;
            }else{
                break;
            }
        }

        return baseClass;
    }
}

class MultiClassPrototype {
    constructor(propCache) {
        this[propCacheSymbol] = propCache;
    }
    
    // [Symbol.hasInstance] = isInstanceOf;
}

// Just an idea: multiple inheritance...
// IMPORTANT NOTE: This assumes that the prototype of the classes are not
// modified after definition, otherwise the multi-inheritance won't work (not
// with this implementation at least, but could be possible to implement).
/** @return {any} */
function multiple(...classes) {
    let constructorName = ''
    let multiClassPrototype = new (class extends MultiClassPrototype {})({classes});
    let multiClassPropsInitialized = false

    let protoPropsFlattenedForEachConstructor = [] // in same order as `classes`
    let allProps = []
    
    for (let [index, constructor] of classes.entries()) {
        constructorName += constructor.name + (index == classes.length-1 ? '' : '+')
        // f.e. SomeClass+OtherClass+FooBar
        
        let props = SimplePropertyRetriever.getOwnAndPrototypeEnumerablesAndNonenumerables(constructor.prototype)
        protoPropsFlattenedForEachConstructor.push(props)
        
        for (let prop of props) {
            if (!allProps.includes(prop))
                allProps.push(prop)
        }
        
        let proto = getBaseClass(constructor);
        
        if (!proto.hasOwnProperty(oldHasInstance)) {
            Object.defineProperty(proto, oldHasInstance, {
                value: proto[Symbol.hasInstance],
            });
            
            Object.defineProperty(proto, Symbol.hasInstance, {
                value: isInstanceOf,
            });
        }
    }
    
    Object.defineProperty(multiClassPrototype.constructor, 'name', {
        value: constructorName,
    });
    // multiClassPrototype.constructor.name = constructorName;

    // This constructor doesn't call super constructors, do that manually
    // with this.callSuperConstructor(Class, ...args).
    
    function MultiClass() {
        if (multiClassPropsInitialized) return

        for (let i=0, l=allProps.length; i<l; i+=1) {
            const prop = allProps[i]

            for (let i=0, l=classes.length; i<l; i+=1) {
                const ctorProps = protoPropsFlattenedForEachConstructor[i]
                const ctor = classes[i]
                
                if (ctorProps.includes(prop)) {
                    // check if the prop is a getter or setter. If so, we
                    // copy the getter to MultiClass.prototype. Basically
                    // we're just mixing the getters/setters onto the
                    // MultiClass.prototype the old mixin-way without
                    // prototype inheritance, which is not ideal, but seems
                    // to be the only option for now (I believe we can
                    // change this when we update to use Proxy).
                    let owner = ctor.prototype
                    while (!owner.hasOwnProperty(prop)) {
                        owner = Object.getPrototypeOf(owner)
                    }
                    let descriptor = Object.getOwnPropertyDescriptor(owner, prop)
                    if (typeof descriptor.set != 'undefined' || typeof descriptor.get != 'undefined') {
                        Object.defineProperty(multiClassPrototype, prop, descriptor)
                    }
                    
                    // Otherwise, we make a new getter/setter.
                    else {
                        Object.defineProperty(multiClassPrototype, prop, {
                            get() {
                                let value = null

                                if (multiClassPrototype[propCacheSymbol].hasOwnProperty(prop)) {
                                    value = multiClassPrototype[propCacheSymbol][prop]
                                }
                                else {
                                    value = ctor.prototype[prop]
                                }

                                if (typeof value == 'function') {
                                    return value.bind(this)
                                }
                                return value
                            },
                            set(value) { multiClassPrototype[propCacheSymbol][prop] = value },
                        })
                    }

                    // break because we found the constructor with the
                    // property we're looking for (it has "highest
                    // precedence"), so we don't need to continue looking.
                    break
                }
            }

        }

        multiClassPropsInitialized = true
    }

    MultiClass.prototype = multiClassPrototype

    Object.assign(multiClassPrototype, {
        // we add this helper method because ES6 class constructors aren't manually callable.
        // f.e., We can't do `Foo.call(this, ...args)` in the subclass that extends
        // this multi-class, so we use this helper instead:
        // `this.callSuperConstructor(Foo, ...args)`.
        callSuperConstructor(nameOrRef, ...args) {
            let ctor = classes.find(ctor => ctor === nameOrRef || ctor.name == nameOrRef)
            if (!ctor) throw new Error('Unknown constructor specified to this.callSuperConstructor()')
            
            let obj = new ctor(...args)
            Object.assign(this, obj) // TODO: copy descriptors, as the constructor might possibly make those.
        }
    })

    return MultiClass
}

// borrowed from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
var SimplePropertyRetriever = {
    getOwnAndPrototypeEnumerablesAndNonenumerables: function (obj) {
        return this._getPropertyNames(obj, true, true, this._enumerableAndNotEnumerable);
    },
    // Private static property checker callbacks
    _enumerableAndNotEnumerable : function () {
        return true;
    },
    // Inspired by http://stackoverflow.com/a/8024294/271577
    _getPropertyNames : function getAllPropertyNames(obj, iterateSelfBool, iteratePrototypeBool, includePropCb) {
        var props = [];

        do {
            if (iterateSelfBool) {
                Object.getOwnPropertyNames(obj).forEach(function (prop) {
                    if (props.indexOf(prop) === -1 && includePropCb(obj, prop)) {
                        props.push(prop);
                    }
                });
            }
            if (!iteratePrototypeBool) {
                break;
            }
            iterateSelfBool = true;
        } while (obj = Object.getPrototypeOf(obj));

        return props;
    }
}

export { multiple as default }