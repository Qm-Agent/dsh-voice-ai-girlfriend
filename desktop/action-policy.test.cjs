const {test}=require('node:test');
const assert=require('node:assert/strict');
const {requestedAction,conversationAction}=require('../dsh-plugin/src/client/voice/action-policy.ts');
test('recognizes requested actions without a model call',()=>{
  for(const [text,id] of [['拨一下头发','hair'],['笑一个','smile'],['卖萌一下','cute'],['吃一口西瓜','watermelon']])assert.equal(requestedAction(text),id);
});
test('does not act on negated requests or ordinary conversation',()=>{
  for(const text of ['不要吃西瓜','别拨头发','不用卖萌了','今天天气很好'])assert.equal(requestedAction(text),null);
});
test('conversation gestures are intentional, with no random selection',()=>{
  assert.deepEqual(conversationAction('拨一下头发'),{id:'hair',explicit:true});
  assert.deepEqual(conversationAction('谢谢你'),{id:'smile',explicit:false});
  assert.equal(conversationAction('帮我分析这个问题'),null);
  assert.equal(conversationAction('不要微笑'),null);
});
