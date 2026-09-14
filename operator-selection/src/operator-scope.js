export const defaultScope=Object.freeze({alt:true,diy:true});
export function inScope(operator,scope){
  const version=(operator.version??'off').toLowerCase();
  return !Object.hasOwn(defaultScope,version)||scope[version]===true;
}
