const handler = {
  defineProperty(target, key, desc) {
    console.log('define', key, desc);
    return Reflect.defineProperty(target, key, desc);
  },
  
  set(target, key, value) {
    console.log('set', key, value);
    return Reflect.set(target, key, value);
  }
  
}

const proxy = new Proxy({}, handler);
proxy.a = 5;
proxy.a = 6;