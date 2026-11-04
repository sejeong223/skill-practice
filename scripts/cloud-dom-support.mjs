import { JSDOM } from "jsdom";
export function installDom(url="http://localhost:3000/") {
 const dom=new JSDOM("<!doctype html><html><body></body></html>",{url,pretendToBeVisual:true});
 for(const key of ["window","document","navigator","HTMLElement","Element","Node","Event","MouseEvent","KeyboardEvent","MutationObserver","getComputedStyle"])
  Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:dom.window[key]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 return dom;
}
