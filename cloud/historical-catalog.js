// Historical identities stay separate from the live draft roster and ALT versions.
const sides={skopos:'defense',extachanka:'defense',striker:'attack',sentry:'defense',deimos:'attack',tubarao:'defense',rauora:'attack',denari:'defense'};
export const historicalCatalog=Object.entries(sides).map(([name,side])=>({id:'historical_'+name,name:name.toUpperCase(),side,version:'legacy',avatar:'',historicalOnly:true}));
