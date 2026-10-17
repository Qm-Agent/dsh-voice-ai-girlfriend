const { app, BrowserWindow, WebContentsView, Tray, Menu, nativeImage, globalShortcut, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const local = path.join(root, '.local', 'desktop');
fs.mkdirSync(local, { recursive: true });
app.setPath('userData', local);
app.setName('小雅桌面陪伴');
const selfTest = process.argv.includes('--self-test');
const server = 'http://127.0.0.1:3080';
const bridge = 'http://127.0.0.1:8765';
const shortcut = 'Control+Alt+Space';
const stateFile = path.join(local, 'window.json');
let win, view, tray, cssKey, quitting = false, heartbeat, loaded = false;
let saved = {};
try { saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
let mode = saved.mode === 'pet' ? 'pet' : 'chat';
let pinned = saved.pinned !== false;
let shortcutAvailable = true;
let message = 'Ctrl+Alt+Space 聊天 · 拖动标题栏移动 · 拖动边缘缩放';
const petCSS = `body { background:#18181e!important; } body * { visibility:hidden!important; }
[data-desktop-companion], [data-desktop-companion] * { visibility:visible!important; }
[data-desktop-companion] { display:block!important; position:fixed!important; inset:0!important; width:100vw!important; height:100vh!important; border-radius:0!important; border:0!important; cursor:default!important; }
[data-desktop-companion] video { object-fit:cover!important; }`;
const chatCSS = '[data-desktop-companion] { width:180px!important;height:270px!important;left:auto!important;right:16px!important;top:80px!important; }';
function state() { win?.webContents.send('companion:state', { mode, pinned, message }); }
function persist() {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getNormalBounds();
  saved[mode] = bounds;
  fs.writeFileSync(stateFile, JSON.stringify({ ...saved, mode, pinned }, null, 2));
}
function layout() {
  if (!win || !view) return;
  const [width, height] = win.getContentSize();
  view.setBounds({ x:0, y:44, width, height:Math.max(100,height-74) });
}
async function lease(active = Boolean(win?.isVisible() && !win?.isMinimized())) {
  try { await fetch(`${bridge}/api/desktop/lease`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ active }), signal:AbortSignal.timeout(1500) }); } catch {}
}
async function style() {
  if (!loaded) return;
  if (cssKey) await view.webContents.removeInsertedCSS(cssKey).catch(() => {});
  cssKey = await view.webContents.insertCSS(mode === 'pet' ? petCSS : chatCSS);
}
function fit(bounds, fallback) {
  const area = screen.getDisplayMatching(bounds || fallback).workArea;
  const b = { ...fallback, ...bounds };
  b.width = Math.min(Math.max(360,b.width),area.width);
  b.height = Math.min(Math.max(480,b.height),area.height);
  b.x = Math.max(area.x,Math.min(b.x,area.x+area.width-b.width));
  b.y = Math.max(area.y,Math.min(b.y,area.y+area.height-b.height));
  return b;
}
async function show(next = mode) {
  if (mode !== next) { persist(); mode = next; win.setBounds(fit(saved[next], next === 'pet' ? {x:1100,y:100,width:400,height:680} : {x:250,y:100,width:1080,height:800})); }
  win.show(); win.restore(); win.focus();
  await lease(true);
  await style(); state(); updateTray();
  if (next === 'chat' && loaded) {
    // Product behavior: keyboard shortcut focuses DSH's existing composer.
    view.webContents.focus();
    await view.webContents.executeJavaScript("document.querySelector('[contenteditable=\"true\"][role=\"textbox\"]')?.focus()").catch(() => {});
  }
}
function hide() { persist(); win.hide(); void lease(false); }
function updateTray() {
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'打开聊天  Ctrl+Alt+Space',click:()=>void show('chat')},
    {label:'显示陪伴窗',click:()=>void show('pet')},
    {label:'始终置顶',type:'checkbox',checked:pinned,click:()=>togglePin()},
    {label:'收进托盘',click:hide}, {type:'separator'},
    {label:'退出桌面陪伴',click:()=>app.quit()}
  ]));
}
function togglePin() { pinned = !pinned; win.setAlwaysOnTop(pinned); state(); updateTray(); persist(); }
function loginURL() {
  // Read the local startup URL in memory; never log or commit its token.
  try {
    const log = fs.readFileSync(path.join(root,'.local','dsh.stdout.log'),'utf8');
    const matches = [...log.matchAll(/http:\/\/(?:127\.0\.0\.1|localhost):3080\/[^\s\x1b]*token=[A-Za-z0-9_-]+/g)];
    if (matches.length) return matches.at(-1)[0];
  } catch {}
  return server;
}
async function connect() {
  loaded = false;
  message = '正在连接本地服务…'; state();
  view.setVisible(true);
  try { await view.webContents.loadURL(loginURL()); }
  catch { view.setVisible(false); message = '本地服务尚未启动：运行 bridge/start-local.ps1 后点击重新连接'; state(); }
}
function icon() {
  // Small native tray icon; no remote asset or image download is needed.
  const size=32, pixels=Buffer.alloc(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=(y*size+x)*4, inside=(x-15.5)**2+(y-15.5)**2<220;
    pixels[i]=170; pixels[i+1]=125; pixels[i+2]=220; pixels[i+3]=inside?255:0;
    if(inside && (Math.abs(x-15.5)<2 || Math.abs(y-15.5)<2) && Math.abs(x-15.5)+Math.abs(y-15.5)<11) {pixels[i]=240;pixels[i+1]=240;pixels[i+2]=255;}
  }
  return nativeImage.createFromBitmap(pixels,{width:size,height:size});
}
async function checkNativeBehavior() {
  const assert=require('node:assert/strict');
  assert(globalShortcut.isRegistered(shortcut),'global shortcut registered');
  assert(!tray.isDestroyed(),'tray exists');
  const oldPin=pinned; togglePin();
  for(let i=0;i<20 && win.isAlwaysOnTop()!==pinned;i++) await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(win.isAlwaysOnTop(),pinned); togglePin(); assert.equal(pinned,oldPin);
  const bounds=win.getBounds(); win.setBounds({...bounds,x:bounds.x+12,y:bounds.y+12,width:bounds.width-20});
  assert(Math.abs(win.getBounds().width-(bounds.width-20))<=4, 'resize applied with DPI rounding'); win.setBounds(bounds);
  win.close(); assert(!win.isDestroyed()&&!win.isVisible(),'close hides to tray');
  await show('chat'); assert(win.isVisible(),'restore shows window');
  await show('pet'); assert.equal(mode,'pet'); await show('chat');
  // Wait for the existing DSH plugin to mount, then verify its real media surface.
  for (let i=0;i<40;i++) {
    const ready=await view.webContents.executeJavaScript("!!document.querySelector('[data-desktop-companion] video')");
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  await show('chat');
  const dom = await view.webContents.executeJavaScript("({composer:!!document.querySelector('[contenteditable=true][role=textbox]'), focused:document.activeElement?.getAttribute('role'), videos:document.querySelectorAll('[data-desktop-companion] video').length})");
  assert(dom.composer && dom.videos >= 2, 'DSH composer and companion mounted');
  fs.writeFileSync(path.join(local,'dom-test.json'),JSON.stringify(dom,null,2));
  fs.writeFileSync(path.join(local,'chat.png'),(await win.webContents.capturePage()).toPNG());
  await show('pet');
  await new Promise(resolve=>setTimeout(resolve,500));
  fs.writeFileSync(path.join(local,'companion.png'),(await view.webContents.capturePage()).toPNG());
  persist();
  // Test-only read-only playback trace: proves the actual renderer advances.
  let samples = [], ticks = 0, captured = false;
  const probe = setInterval(async () => {
    if(view.webContents.isDestroyed() || ++ticks > 180) { clearInterval(probe); return; }
    const video = await view.webContents.executeJavaScript("Array.from(document.querySelectorAll('video')).filter(v=>v.currentSrc.includes('/media/dh/')).map(v=>({file:v.currentSrc.split('/').pop(),time:v.currentTime,duration:v.duration,paused:v.paused,ended:v.ended,error:v.error?.code||null}))").catch(()=>[]);
    if(video.length) {
      samples.push({at:Date.now(),video}); samples=samples.slice(-90);
      fs.writeFileSync(path.join(local,'playback.json'),JSON.stringify(samples,null,2));
      if(!captured && video.some(v=>v.time>0 && !v.paused)) { captured=true; fs.writeFileSync(path.join(local,'speaking.png'),(await view.webContents.capturePage()).toPNG()); }
    }
  },1000);
  fs.writeFileSync(path.join(local,'self-test.json'),JSON.stringify({ok:true,checks:['shortcut registered','tray created','pin toggles','move and resize','close hides','restore','view switching'],at:new Date().toISOString()},null,2));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>void show('chat'));
  app.whenReady().then(async()=>{
    win=new BrowserWindow({...fit(saved[mode],{x:250,y:100,width:1080,height:800}),minWidth:360,minHeight:480,title:'小雅 · 桌面陪伴',icon:icon(),show:false,alwaysOnTop:pinned,backgroundColor:'#18181e',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    win.removeMenu();
    view=new WebContentsView({webPreferences:{partition:'persist:companion',contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    view.webContents.setUserAgent(view.webContents.getUserAgent()+' DSHDesktop/0.1');
    win.contentView.addChildView(view); layout();
    view.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    view.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==server)event.preventDefault();});
    view.webContents.session.setPermissionRequestHandler((_wc,permission,callback,details)=>callback(permission==='media'&&new URL(details.requestingUrl||server).origin===server));
    view.webContents.on('did-finish-load',async()=>{
      loaded=true; cssKey=undefined;
      await style(); message=shortcutAvailable ? 'Ctrl+Alt+Space 聊天 · 关闭窗口收进托盘' : '快捷键被占用，请双击托盘图标打开聊天'; state();
    });
    ipcMain.handle('companion:command',async(event,action)=>{
      if(event.sender!==win.webContents)return;
      if(action==='chat'||action==='pet')await show(action);
      else if(action==='pin')togglePin(); else if(action==='hide')hide(); else if(action==='retry')await connect();
    });
    win.on('resize',layout);
    win.on('close',event=>{if(!quitting){event.preventDefault();hide();}});
    win.on('minimize',()=>void lease(false));
    win.on('restore',()=>void lease());
    tray=new Tray(icon()); tray.setToolTip('小雅桌面陪伴 · Ctrl+Alt+Space 聊天'); tray.on('double-click',()=>void show('chat')); updateTray();
    await win.loadFile(path.join(__dirname,'shell.html'));
    const registered=globalShortcut.register(shortcut,()=>void show('chat'));
    shortcutAvailable=registered;
    if(!registered)message='快捷键被其他程序占用；请从托盘打开聊天';
    win.show(); state(); await lease();
    heartbeat=setInterval(()=>void lease(),2000);
    await connect();
    if(process.argv.includes('--all-avatar-continuity-test'))await require('./avatar-continuity-test.cjs')({win,view,root,bridge,show});
    if(selfTest) await checkNativeBehavior();
  }).catch(error=>{fs.writeFileSync(path.join(local,'error.log'),String(error.stack));app.quit();});
  app.on('before-quit',()=>{quitting=true;persist();clearInterval(heartbeat);globalShortcut.unregisterAll();void lease(false);view?.webContents.close();});
  app.on('window-all-closed',()=>{if(quitting)app.quit();});
}
