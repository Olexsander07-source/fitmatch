import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingRequirements,localBasketQuote} from '../fitgoin-ai-local-pricing.mjs';

const NOW=Date.parse('2026-11-08T10:00:00Z');
const plan={schema_version:3,meals:[{items:[
 {food_id:'rice',name:'Рис',quantity_g:100,weight_basis:'сухая крупа'},
 {food_id:'egg',name:'Яйца',quantity_g:100,weight_basis:'съедобная часть'}
]}]};
const offer=(food_id,price_eur,pack_grams,distance_km=2)=>({
 food_id,price_eur,pack_grams,distance_km,store:'Example Shop',
 source_url:'https://example.com/product/'+food_id,checked_at:'2026-11-08T09:00:00Z',available:true
});

test('structured food amounts scale to a shopping week without inventing products',()=>{
 const needed=shoppingRequirements(plan,7);
 assert.equal(needed.find(x=>x.food_id==='rice').quantity_g,700);
 assert.equal(needed.find(x=>x.food_id==='egg').quantity_g,700);
 assert.equal(shoppingRequirements({shopping_list:['Rice — 100 g']},7),null);
});
test('no sourced offers means no invented total',()=>{
 const q=localBasketQuote({document:plan,city:'Toulouse',now:NOW});
 assert.equal(q.status,'no_sourced_prices');
 assert.equal(q.quotes[0].total_eur,null);
 assert.equal(q.quotes[0].missing.length,2);
});
test('valid sourced local offers produce pack-rounded weekly and monthly totals',()=>{
 const q=localBasketQuote({document:plan,city:'Toulouse',now:NOW,
  offers:[offer('rice',2,500),offer('egg',3,600)]});
 assert.equal(q.status,'priced');
 assert.equal(q.radius_km,15);
 assert.equal(q.quotes[0].total_eur,10);
 assert.equal(q.quotes[1].total_eur,27);
 assert.equal(q.quotes[0].items[0].offer.packs,2);
 assert.equal(q.quotes[1].items[0].offer.packs,6);
});
test('exclude out-of-radius, stale, insecure and unavailable offers',()=>{
 const q=localBasketQuote({document:plan,city:'Toulouse',now:NOW,offers:[
  offer('rice',2,500,16),{...offer('rice',1,500),checked_at:'2026-10-01T00:00:00Z'},
  {...offer('rice',1,500),source_url:'http://example.com/offer'},
  {...offer('rice',1,500),available:false},offer('egg',3,600)
 ]});
 assert.equal(q.quotes[0].complete,false);
 assert.equal(q.quotes[0].total_eur,null);
 assert.equal(q.quotes[0].subtotal_eur,6);
 assert(q.quotes[0].missing.includes('Рис'));
});
test('invalid location or legacy plan cannot produce a price estimate',()=>{
 assert.equal(localBasketQuote({document:plan,city:'',now:NOW}).status,'invalid_location');
 assert.equal(localBasketQuote({document:plan,city:'Toulouse',radius_km:20,now:NOW}).status,'invalid_location');
 assert.equal(localBasketQuote({document:{meals:[{ingredients:['Рис 100г']}]},city:'Toulouse',now:NOW}).status,'unsupported_plan');
});
