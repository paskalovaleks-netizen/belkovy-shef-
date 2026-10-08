import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createPhotoHandler, validatePhoto } from '../server/food-photo.js';
import { calculatePhotoNutrition } from '../src/photo-foods.js';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
async function serverTest(options, callback) {
 const server = createServer(createPhotoHandler(options));
 await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
 try { await callback(`http://127.0.0.1:${server.address().port}`); }
 finally { await new Promise(resolve => server.close(resolve)); }
}
const sendPhoto = (base, body) => fetch(base+'/api/food-photo', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
test('photo calculator uses ready-to-eat weight, not raw meat or dry grain values', () => {
 const result=calculatePhotoNutrition([{foodId:'cooked-chicken',grams:150},{foodId:'cooked-rice',grams:200}]);
 assert.deepEqual(result,{protein:51.9,fat:6,carbs:56,kcal:485.6});
 assert.notDeepEqual(result,calculatePhotoNutrition([{foodId:'chicken',grams:150},{foodId:'rice',grams:200}]));
});
test('photo nutrition requires every ingredient and positive finite weights', () => {
 for(const entries of [[],[{foodId:'unknown',grams:100}],[{foodId:'cooked-chicken',grams:0}],[{foodId:'cooked-chicken',grams:'abc'}],[{foodId:'cooked-chicken',grams:0.01}]])assert.throws(()=>calculatePhotoNutrition(entries));
 assert.throws(()=>validatePhoto('data:image/svg+xml;base64,AAAA'));
 assert.throws(()=>validatePhoto('data:image/png;base64,AAAA'));
});
test('photo API sends image to vision model and returns editable ingredients, not model-invented macros', async () => {
 await serverTest({apiKey:'test-key',fetchImpl:async (_,options)=>{
  const body=JSON.parse(options.body);
  assert.equal(body.messages[1].content[1].image_url.url,image);
  assert.match(body.messages[1].content[0].text,/350/);
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({message:'Проверьте массы и масло.',ingredients:[{name:'Курица',foodId:'cooked-chicken',gramsEstimate:150,uncertainty:'medium'},{name:'Рис',foodId:'cooked-rice',gramsEstimate:200,uncertainty:'high'}]})}}]})};
 }},async base=>{
  const response=await sendPhoto(base,{image,totalWeight:350});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.ingredients.length,2);
  assert.equal(result.ingredients[0].foodId,'cooked-chicken');
  assert.equal(result.protein,undefined);
  assert.ok(!JSON.stringify(result).includes('test-key'));
 });
});
test('photo API fails safely for missing credentials, invalid image and rejected upstream key', async () => {
 await serverTest({apiKey:''},async base=>assert.equal((await sendPhoto(base,{image})).status,503));
 await serverTest({apiKey:'test-key',fetchImpl:async()=>({ok:false,status:401})},async base=>{
  assert.equal((await sendPhoto(base,{image:'invalid'})).status,400);
  const response=await sendPhoto(base,{image});
  assert.equal(response.status,503);
  assert.equal((await response.json()).code,'ai_key_rejected');
 });
});
test('unclear photos can return no food and unrecognized products must not silently map to another food',async()=>{
 for(const result of [{message:'Еды не видно.',ingredients:[]},{message:'Неизвестный продукт.',ingredients:[{name:'Неизвестное блюдо',foodId:null,gramsEstimate:150,uncertainty:'high'}]}]) {
  await serverTest({apiKey:'test-key',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(result)}}]})})},async base=>{
   const response=await sendPhoto(base,{image});assert.equal(response.status,200);assert.deepEqual((await response.json()).ingredients,result.ingredients);
  });
 }
});
