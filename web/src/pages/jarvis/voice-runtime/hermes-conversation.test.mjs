import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HermesVoiceConversation } from './hermes-conversation.ts'

const settle = () => new Promise(resolve => setImmediate(resolve))
class MockGateway {
  handlers = new Set()
  questions = new Set()
  states = new Set()
  calls = []
  closed = false
  async connect() {}
  close() { this.closed = true }
  onAny(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn) }
  onRequest(fn) { this.questions.add(fn); return () => this.questions.delete(fn) }
  onState(fn) { this.states.add(fn); return () => this.states.delete(fn) }
  emit(type, payload={}, session_id='s-42') { for (const fn of this.handlers) fn({ type, payload, session_id }) }
  state(value) { for (const fn of this.states) fn(value) }
  question({ method='approval', session_id='s-42', id='req-1', choices=['once','session','always','deny'], ...args }={}) {
    const outcome = { answered: [], failed: [] }
    const req = {
      id, method,
      params: {session_id,choices,request_id:'approval-1',command:'echo hello',description:'Test approval',tool_name:'terminal', ...args},
      respond: result => outcome.answered.push(result),
      fail: (code,message) => outcome.failed.push({code,message}),
    }
    for (const fn of this.questions) fn(req)
    return outcome
  }
  async request(method,params) {
    this.calls.push({method,params})
    if(method==='session.create')return {session_id:'s-42',stored_session_id:'db-42'}
    if(method==='session.interrupt')return {status:'interrupted'}
    if(method==='prompt.submit')return {status:'streaming'}
    throw Error(`Unknown gateway method ${method}`)
  }
}
function fresh() {
  const gateway = new MockGateway()
  const approvals = []
  const session = new HermesVoiceConversation('default', () => gateway, approval => approvals.push(approval))
  return {gateway, session, approvals}
}

// Native voice conversations: still no model/backend call in these tests.
test('real gateway stream returns authoritative text', async () => {
  const {gateway:g,session}=fresh()
  const turn=session.submit('Wie geht es dir?')
  await settle();g.emit('message.delta',{text:'Guten '});g.emit('message.complete',{text:'Guten Tag!',status:'complete'})
  assert.deepEqual(await turn,{text:'Guten Tag!',sessionId:'s-42',storedSessionId:'db-42'})
  assert.equal(g.calls[0].method,'session.create')
  assert.equal(g.calls[0].params.profile,'default')
  assert.equal(g.calls[1].params.voice_turn,true)
  assert.equal(g.handlers.size,0);session.close()
})
test('followup reuses model conversation and profile', async () => {
  const {gateway:g,session}=fresh()
  const a=session.submit('Hallo');await settle();g.emit('message.complete',{text:'Hallo',status:'complete'});await a
  const b=session.submit('Und dann?');await settle();g.emit('message.complete',{text:'Erzähl',status:'complete'});await b
  assert.equal(g.calls.filter(x=>x.method==='session.create').length,1);session.close()
})
test('cross-session message cannot complete our turn', async () => {
  const {gateway:g,session}=fresh();const turn=session.submit('Frage');await settle()
  g.emit('message.complete',{text:'wrong',status:'complete'},'foreign')
  g.emit('message.complete',{text:'right',status:'complete'})
  assert.equal((await turn).text,'right');session.close()
})
test('native approval shows only sanitized metadata, NEVER approves on reception', async () => {
  const {gateway:g,session,approvals}=fresh()
  const turn=session.submit('Bitte führe den Auftrag aus');await settle()
  const req=g.question({description:'D'.repeat(1400)})
  assert.equal(req.answered.length,0)
  assert.equal(approvals.at(-1).id,'req-1')
  assert.equal(approvals.at(-1).allowOnce,true)
  assert.equal(approvals.at(-1).description.length,1200)
  assert.equal(session.decideApproval('wrong', 'once'),false)
  assert.equal(req.answered.length,0)
  assert.equal(session.decideApproval('req-1', 'once'),true)
  assert.deepEqual(req.answered,[{choice:'once',all:false}])
  assert.equal(approvals.at(-1),null)
  g.emit('message.complete',{text:'Ausgeführt',status:'complete'})
  assert.equal((await turn).text,'Ausgeführt')
  session.close()
})
test('deny responds once and no extra permissions', async () => {
  const {gateway:g,session}=fresh();const turn=session.submit('Aktion');await settle()
  const req=g.question()
  assert.equal(session.decideApproval('req-1','deny'),true)
  assert.equal(session.decideApproval('req-1','once'),false)
  assert.deepEqual(req.answered,[{choice:'deny',all:false}])
  g.emit('message.complete',{text:'Nicht ausgeführt',status:'complete'})
  assert.equal((await turn).text,'Nicht ausgeführt');session.close()
})
test('permanent or session-level grants are never recognized', async () => {
  const {gateway:g,session}=fresh();const turn=session.submit('Aktion');await settle();const req=g.question()
  assert.equal(session.decideApproval('req-1','always'),false)
  assert.equal(session.decideApproval('req-1','session'),false)
  assert.equal(req.answered.length,0)
  session.decideApproval('req-1','deny');g.emit('message.complete',{text:'No',status:'complete'});await turn
})
test('server only advertising deny does not create allow action', async () => {
  const {gateway:g,session,approvals}=fresh();const turn=session.submit('Aktion');await settle()
  const req=g.question({choices:['deny']})
  assert.equal(approvals.at(-1).allowOnce,false)
  assert.equal(session.decideApproval('req-1','once'),false)
  assert.equal(session.decideApproval('req-1','deny'),true)
  assert.deepEqual(req.answered,[{choice:'deny',all:false}])
  g.emit('message.complete',{text:'Not allowed',status:'complete'});await turn
})
test('approval without deny or malformed choice list fails closed', async () => {
  const {gateway:g,session}=fresh();const turn=session.submit('Aktion');await settle()
  const req=g.question({choices:['once','always']});assert.equal(req.failed[0].code,403)
  g.emit('message.complete',{text:'Pretend success',status:'complete'})
  await assert.rejects(turn,/nicht unterstützte Eingabe/)
})
test('unsupported interactive prompt fails closed without fabricated success', async () => {
  const {gateway:g,session}=fresh();const turn=session.submit('Frage');await settle()
  const req=g.question({method:'secret'});assert.equal(req.failed[0].code,403)
  g.emit('message.complete',{text:'I did it',status:'complete'})
  await assert.rejects(turn,/nicht unterstützte Eingabe/)
})
test('foreign tool question is unclaimed and cannot trigger a decision', async () => {
  const {gateway:g,session,approvals}=fresh();const turn=session.submit('Frage');await settle()
  const req=g.question({session_id:'foreign'})
  assert.equal(req.answered.length,0);assert.equal(req.failed.length,0);assert.deepEqual(approvals,[])
  assert.equal(session.decideApproval('req-1','once'),false)
  g.emit('message.complete',{text:'Okay',status:'complete'});await turn
})
test('server request cancel removes the approval without approving', async () => {
  const {gateway:g,session,approvals}=fresh();const turn=session.submit('Frage');await settle()
  const req=g.question();g.emit('request.cancel',{id:'req-1'})
  assert.equal(approvals.at(-1),null)
  assert.equal(session.decideApproval('req-1','once'),false)
  assert.equal(req.answered.length,0)
  g.emit('message.complete',{text:'Cancelled',status:'complete'});await turn
})
test('only one pending tool authorization can be handled', async () => {
  const {gateway:g,session}=fresh();const turn=session.submit('Frage');await settle()
  const first=g.question({id:'first'});const second=g.question({id:'second'});assert.equal(second.failed[0].code,403)
  assert.deepEqual(first.answered,[])
  session.decideApproval('first','deny')
  g.emit('message.complete',{text:'No',status:'complete'})
  await assert.rejects(turn,/nicht unterstützte Eingabe/)
})
test('abort denies pending action and calls session.interrupt', async () => {
  const {gateway:g,session,approvals}=fresh();const controller=new AbortController()
  const turn=session.submit('Aktion',controller.signal);await settle();const req=g.question()
  controller.abort()
  await assert.rejects(turn,/abgebrochen/)
  assert.deepEqual(req.answered,[{choice:'deny'}])
  assert.equal(approvals.at(-1),null)
  assert.equal(g.calls.some(c=>c.method==='session.interrupt'),true)
  assert.equal(session.decideApproval('req-1','once'),false)
})
test('explicit close denies action, then no further grant',async()=>{
  const {gateway:g,session}=fresh();const turn=session.submit('Aktion');await settle();const req=g.question()
  session.close();assert.deepEqual(req.answered,[{choice:'deny'}]);assert.equal(session.decideApproval('req-1','once'),false)
  g.emit('message.complete',{text:'Result',status:'complete'})
  await assert.rejects(turn,/abgebrochen/)
})
test('turn cannot accept two spoken requests in parallel',async()=>{
  const {gateway:g,session}=fresh();const turn=session.submit('A');await settle()
  await assert.rejects(session.submit('B'),/bereits/)
  assert.equal(g.calls.filter(c=>c.method==='prompt.submit').length,1)
  g.emit('message.complete',{text:'A',status:'complete'});await turn
})
test('provider failure is not converted to success',async()=>{
  const {gateway:g,session}=fresh();const turn=session.submit('A');await settle()
  g.emit('message.complete',{text:'',status:'error',error:'Provider unavailable'})
  await assert.rejects(turn,error => /Provider und Verbindung/.test(error.message) && !error.message.includes('Provider unavailable'))
})
test('disconnect aborts without repeating an admitted request',async()=>{
  const {gateway:g,session}=fresh();const turn=session.submit('A');await settle()
  g.state('closed');await assert.rejects(turn,/Verbindung/)
  assert.equal(g.calls.filter(c=>c.method==='prompt.submit').length,1)
})
test('invalid content and invalid profile are rejected',async()=>{
  const {session}=fresh()
  for(const text of ['', 'Z'.repeat(8001), 'a\u001b[0m']) await assert.rejects(session.submit(text))
  assert.throws(()=>new HermesVoiceConversation('../other',()=>new MockGateway()),/Profil/)
})
test('completion delta fallback still works',async()=>{
  const {gateway:g,session}=fresh();const turn=session.submit('A');await settle()
  g.emit('message.delta',{text:'Buffered'});g.emit('message.complete',{status:'complete'})
  assert.equal((await turn).text,'Buffered')
})

test('streams only text for our session and ignores late events after cancellation', async () => {
  const {gateway:g,session}=fresh();const controller=new AbortController();const text=[]
  const turn=session.submit('Hallo',controller.signal,value=>text.push(value));await settle()
  g.emit('message.delta',{text:'foreign'},'other')
  g.emit('message.delta',{reasoning:'not public'})
  g.emit('message.delta',{text:'Guten '});g.emit('message.delta',{text:'Tag'})
  assert.deepEqual(text,['Guten ','Guten Tag'])
  controller.abort();await assert.rejects(turn,/abgebrochen/)
  g.emit('message.delta',{text:'late'});assert.equal(text.length,2)
})

test('close settles a pending turn without requiring another server event', async () => {
  const {gateway:g,session}=fresh();const turn=session.submit('Hallo');await settle()
  session.close();await assert.rejects(turn,/abgebrochen/)
  assert.equal(g.handlers.size,0);assert.equal(g.questions.size,0)
})

test('next explicit turn resumes only its own stored session after disconnect', async () => {
  const {gateway:g,session}=fresh();const request=g.request.bind(g)
  g.request=async(method,params)=>method==='session.resume'
    ? (g.calls.push({method,params}),{session_id:'s-43',stored_session_id:'db-42'}) : request(method,params)
  const first=session.submit('Hallo');await settle();g.state('closed');await assert.rejects(first,/Verbindung/)
  assert.equal(g.calls.filter(x=>x.method==='prompt.submit').length,1)
  const next=session.submit('Neue Frage');await settle()
  assert.equal(g.calls.find(x=>x.method==='session.resume').params.session_id,'db-42')
  g.emit('message.complete',{text:'wrong'},'s-42');g.emit('message.complete',{text:'Neu'},'s-43')
  assert.equal((await next).text,'Neu');session.close()
})
