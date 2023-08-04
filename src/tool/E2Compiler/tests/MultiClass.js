import MultiClass from '../src/MultiClass.js';

class A {
    test1(){
        console.log('A', this);
    }
}

class B {
    test2(){
        console.log('B', this);
    }
}

class C extends MultiClass(A, B) {
    test1(){
        console.log('C', this);
    }
}

class D extends MultiClass(C, B) {
    test2(){
        console.log('D', this);
    }
}

let c = new C();
let a = new A();
let b = new B();
let d = new D();

console.log(C.prototype); // A + B
console.log(D.prototype); // C + B

console.log(A instanceof B); // false
console.log(B instanceof A); // false
console.log(C.prototype, C.prototype instanceof A); // true/false
console.log(C.prototype, C.prototype instanceof B); // true/false
console.log(C instanceof A); // false
console.log(a instanceof A); // true
console.log(b instanceof A); // false
console.log();
console.log(c instanceof C); // true
console.log(c instanceof A); // true
console.log(c instanceof B); // true

c.test1(); // C C
c.test2(); // B C
d.test2(); // D D
