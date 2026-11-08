import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceKm,withinLocalRadius,compareLocalBasket,budgetBreakdown} from '../fitgoin-ai-local-budget.mjs';
const center={lat:43.6045,lon:1.444};
test('15 km uses actual coordinates, not name-only matches',()=>{
 assert.equal(distanceKm(center,center),0);
 assert.equal(withinLocalRadius(center,{lat:43.67,lon:1.48}),true);
 assert.equal(withinLocalRadius(center,{lat:43.85,lon:1.44}),false);
 assert.equal(withinLocalRadius(center,{lat:NaN,lon:1.44}),false);
 assert.equal(withinLocalRadius(center,{}),false);
});
test('basket prices only cited compatible available units and does not invent missing prices',()=>{
 const q={origin:center,requirements:[{sku:'rice',quantity:2,unit:'kg'},{sku:'eggs',quantity:12,unit:'each'}],offers:[
 {place:'Near store',coordinates:{lat:43.605,lon:1.45},currency:'EUR',items:[{sku:'rice',price:2.5,quantity:1,unit:'kg',url:'https://shop.example/rice',checked_at:'2026-11-08T10:00:00Z'},{sku:'eggs',price:3.2,quantity:6,unit:'each',url:'https://shop.example/eggs',checked_at:'2026-11-08T10:00:00Z'}]},
 {place:'No egg prices',coordinates:{lat:43.606,lon:1.46},currency:'EUR',items:[{sku:'rice',price:1,quantity:1,unit:'kg',url:'https://shop.example/rice',checked_at:'2026-11-08T10:00:00Z'}]},
 {place:'Outside radius',coordinates:{lat:44.1,lon:1.44},currency:'EUR',items:[{sku:'rice',price:.01,quantity:1,unit:'kg',url:'https://shop.example/rice',checked_at:'2026-11-08T10:00:00Z'}]}]};
 const offers=compareLocalBasket(q);
 assert.equal(offers.length,2);
 assert.deepEqual(offers.map(x=>x.complete),[true,false]);
 assert.equal(offers[0].total,11.4);
 assert.equal(offers[1].total,null);
 assert.equal(offers[1].items[1].status,'unpriced');
});
test('monthly costs separate food, memberships and one-time inventory',()=>{
 const a=budgetBreakdown({weeklyFood:60,gymMonthly:30,equipmentOnce:75});
 assert.equal(a.monthly_food,260);
 assert.equal(a.monthly_recurring,290);
 assert.equal(a.first_month_with_equipment,365);
 assert.throws(()=>budgetBreakdown({weeklyFood:-1}),/invalid_price/);
});
