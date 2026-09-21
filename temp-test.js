const GameStateModel=require('./src/js/game-state.js');
const state={};
const decks={p1:[{id:'card',cost:1}],p2:[{id:'card',cost:1}]};
try{
  GameStateModel.resetMatchState(state,decks,{localPlayerId:'p1'});
  console.log('ok');
} catch(e){
  console.error('err',e.message);
}