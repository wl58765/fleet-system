/**
 * 车辆单车核算 - 云端实时同步服务�? * 零依赖！仅用Node.js内置模块 + 文件存储 + SSE实时推�? *
 * 启动: node server.js
 * 访问: http://你的IP:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const PUB_DIR = path.join(__dirname, 'public');
const ADMIN_PASSWORD = '585858';

// ============ 数据存储（JSON文件�?============

let db = { vehicles: [], mileageRecords: [], fuelRecords: [], repairRecords: [], violationRecords: [], operationLogs: [], nextId: 500 };

function loadDb() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch(e) { console.error('加载数据失败:', e.message); }
  ensureDefaults();
}

function saveDb() {
  try {
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch(e) { console.error('保存失败:', e.message); }
}

function ensureDefaults() {
  if (!db.vehicles) db.vehicles = [];
  if (!db.mileageRecords) db.mileageRecords = [];
  if (!db.fuelRecords) db.fuelRecords = [];
  if (!db.repairRecords) db.repairRecords = [];
  if (!db.violationRecords) db.violationRecords = [];
  if (!db.operationLogs) db.operationLogs = [];
  if (!db.nextId || db.nextId < 500) db.nextId = 500;
}

// 预置车辆
const PRESET_VEHICLES = [
  { id:1, plateNumber:'闽DFC8628', brandModel:'比亚迪汉', engineNumber:'L24381095', vin:'LC0C76C48R7052867', manufacturer:'比亚迪汽�?, purchaseDate:'2024-07-15', condition:'良好', currentMileage:59546, unitOwner:'厦门建设', department:'抚州经营网点', driver:'辜庆�?, phone:'', insuranceExpiry:'2026-07-04', annualInspection:'2030-07-15' },
  { id:2, plateNumber:'鄂AA8F56', brandModel:'别克GL8', engineNumber:'182116658', vin:'LSGUA8378JF121920', manufacturer:'上汽通用', purchaseDate:'2018-10-16', condition:'良好', currentMileage:106201, unitOwner:'集团公司', department:'南昌经营�?, driver:'吴少�?, phone:'', insuranceExpiry:'2026-12-07', annualInspection:'2026-10-31', displacement:'2.5' },
  { id:3, plateNumber:'鄂AF99752', brandModel:'腾势D9', engineNumber:'L24448381', vin:'LC0D74C40R0431315', manufacturer:'比亚迪汽�?, purchaseDate:'2025-01-03', condition:'良好', currentMileage:8421, unitOwner:'集团公司', department:'南昌经营�?, driver:'王贵�?, phone:'', insuranceExpiry:'2027-01-02', annualInspection:'2027-01-31', displacement:'1.5' },
  { id:4, plateNumber:'鄂A6S96M', brandModel:'别克GL8', engineNumber:'192875446', vin:'LSGUA83L4KF071869', manufacturer:'上汽通用', purchaseDate:'2020-04-28', condition:'良好', currentMileage:230293, unitOwner:'集团公司', department:'景德镇经营部', driver:'占宁�?, phone:'', insuranceExpiry:'2027-04-26', annualInspection:'2027-04-30', displacement:'2.0' },
  { id:5, plateNumber:'鄂A9V22F', brandModel:'别克GL8', engineNumber:'192475788', vin:'LSGUA83L4KF061150', manufacturer:'上汽通用', purchaseDate:'2020-04-28', condition:'良好', currentMileage:95675, unitOwner:'集团公司', department:'赣州经营�?, driver:'孙祺�?, phone:'', insuranceExpiry:'2027-04-26', annualInspection:'2027-04-30', displacement:'2.0' },
  { id:6, plateNumber:'鄂AW267Q', brandModel:'别克牌SGM6522UBA6', engineNumber:'210543166', vin:'LSGUL83L4MA146547', manufacturer:'上汽通用', purchaseDate:'2021-04-02', condition:'良好', currentMileage:109507, unitOwner:'集团公司', department:'九江经营网点', driver:'周安�?, phone:'', insuranceExpiry:'2027-04-02', annualInspection:'2027-04-30', displacement:'2.0' },
  { id:7, plateNumber:'鄂AF73087', brandModel:'腾势', engineNumber:'L23396837', vin:'LC0DD4C47P0340418', manufacturer:'比亚迪汽�?, purchaseDate:'2023-09-08', condition:'良好', currentMileage:150288, unitOwner:'集团公司', department:'福州经营网点', driver:'李帅�?, phone:'', insuranceExpiry:'2026-09-07', annualInspection:'2029-09-08', displacement:'1.5' },
  { id:8, plateNumber:'鄂AL5J17', brandModel:'别克牌SGM6522UBB2', engineNumber:'220710062', vin:'LSGUL83L8NA042161', manufacturer:'上汽通用', purchaseDate:'2022-05-16', condition:'良好', currentMileage:137575, unitOwner:'集团公司', department:'泉州经营网点', driver:'陈林�?, phone:'', insuranceExpiry:'2027-05-16', annualInspection:'2027-05-01', displacement:'2.0' },
  { id:9, plateNumber:'鄂A2N6V0', brandModel:'别克牌SGM6531UAAF', engineNumber:'172736426', vin:'LSGUA8377JE008398', manufacturer:'上汽通用', purchaseDate:'2018-03-13', condition:'良好', currentMileage:216505, unitOwner:'集团公司', department:'厦门经营�?, driver:'胡国�?, phone:'', insuranceExpiry:'2027-04-12', annualInspection:'2027-03-01', displacement:'2.0' },
  { id:10, plateNumber:'鄂AFG9906', brandModel:'腾势D9', engineNumber:'L23363956', vin:'LC0D74C40P02755080', manufacturer:'比亚迪汽�?, purchaseDate:'2023-05-31', condition:'良好', currentMileage:96061, unitOwner:'集团公司', department:'漳州经营�?, driver:'翁方�?, phone:'', insuranceExpiry:'2027-05-30', annualInspection:'2027-05-31', displacement:'1.5' }
];

function initPresetData() {
  if (db.vehicles.length === 0) {
    db.vehicles = PRESET_VEHICLES;
    db.nextId = PRESET_VEHICLES.length + 1;
    saveDb();
    console.log('�?已初始化10台预置车�?);
  }
}

function addOperationLog(vehiclePlate, action, details, vehicleId = 0) {
  const log = { time: new Date().toLocaleString('zh-CN', { hour12: false }), vehiclePlate, action, details, vehicleId };
  db.operationLogs.unshift(log);
  if (db.operationLogs.length > 1000) db.operationLogs = db.operationLogs.slice(0, 1000);
  saveDb();
}

// ============ SSE 实时推�?============

const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch(e) { sseClients.delete(res); }
  }
}

// ============ 请求解析 ============

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch(e) { resolve({}); }
    });
  });
}

function parseUrl(url) {
  const p = url.split('?')[0].replace(/\/+/g, '/');
  const parts = p.split('/').filter(Boolean);
  return { path: p, parts };
}

function jsonResponse(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// ============ API 路由 ============

async function handleAPI(req, res) {
  const { method, url } = req;
  const { path: p, parts } = parseUrl(url);

  // CORS headers
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // SSE - 实时推�?  if (p === '/api/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 初始化数�?  if (p === '/api/init') {
    return jsonResponse(res, 200, { success: true, data: db });
  }

  // 验证密码
  if (p === '/api/verify-password' && method === 'POST') {
    const body = await parseBody(req);
    return jsonResponse(res, 200, { success: body.password === ADMIN_PASSWORD || body.password === getSetting('admin_password') });
  }

  // 修改密码
  if (p === '/api/password' && method === 'PUT') {
    const body = await parseBody(req);
    if (body.oldPwd !== ADMIN_PASSWORD && body.oldPwd !== getSetting('admin_password')) {
      return jsonResponse(res, 200, { success: false, message: '原密码错�? });
    }
    if (!body.newPwd || body.newPwd.length < 4) {
      return jsonResponse(res, 200, { success: false, message: '密码至少4�? });
    }
    setSetting('admin_password', body.newPwd);
    addOperationLog('系统', '修改密码', '管理员修改了登录密码');
    return jsonResponse(res, 200, { success: true });
  }

  // 车辆管理
  if (parts[0] === 'api' && parts[1] === 'vehicles') {
    if (method === 'POST') {
      const body = await parseBody(req);
      if (db.vehicles.find(v => v.plateNumber === body.plateNumber)) {
        return jsonResponse(res, 200, { success: false, message: '车牌号已存在' });
      }
      body.id = db.nextId++;
      db.vehicles.push(body);
      saveDb();
      addOperationLog(body.plateNumber, '添加车辆', `新车: ${body.plateNumber}, 司机: ${body.driver}`, body.id);
      broadcast('data:update', { type: 'vehicle', action: 'add', data: body });
      return jsonResponse(res, 200, { success: true, data: body });
    }
    if (method === 'PUT' && parts.length >= 3) {
      const id = parseInt(parts[2]);
      const body = await parseBody(req);
      const idx = db.vehicles.findIndex(v => v.id === id);
      if (idx >= 0) {
        db.vehicles[idx] = { ...db.vehicles[idx], ...body, id };
        saveDb();
        addOperationLog(body.plateNumber, '编辑车辆', `编辑: ${body.plateNumber}`, id);
        broadcast('data:update', { type: 'vehicle', action: 'update', data: db.vehicles[idx] });
      }
      return jsonResponse(res, 200, { success: true });
    }
    if (method === 'DELETE' && parts.length >= 3) {
      const id = parseInt(parts[2]);
      const v = db.vehicles.find(x => x.id === id);
      db.vehicles = db.vehicles.filter(x => x.id !== id);
      db.mileageRecords = db.mileageRecords.filter(r => r.vehicleId !== id);
      db.fuelRecords = db.fuelRecords.filter(r => r.vehicleId !== id);
      db.repairRecords = db.repairRecords.filter(r => r.vehicleId !== id);
      db.violationRecords = db.violationRecords.filter(r => r.vehicleId !== id);
      saveDb();
      if (v) addOperationLog(v.plateNumber, '删除车辆', `删除: ${v.plateNumber}`, id);
      broadcast('data:update', { type: 'vehicle', action: 'delete', data: { id } });
      return jsonResponse(res, 200, { success: true });
    }
  }

  // 通用CRUD
  const crudTables = { 'mileage_records': 'mileageRecords', 'fuel_records': 'fuelRecords', 'repair_records': 'repairRecords', 'violation_records': 'violationRecords' };
  const tableName = crudTables[parts[1]];
  if (parts[0] === 'api' && tableName) {
    const logNames = { 'mileage_records':'里程', 'fuel_records':'加油', 'repair_records':'费用', 'violation_records':'违章' };
    const logName = logNames[parts[1]] || parts[1];

    if (method === 'GET') {
      return jsonResponse(res, 200, { success: true, data: db[tableName] || [] });
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      body.id = Date.now();
      db[tableName].push(body);
      saveDb();
      const v = db.vehicles.find(x => x.id === body.vehicleId);
      addOperationLog(v?.plateNumber||'', `添加${logName}`, JSON.stringify(body).substring(0,100), body.vehicleId);
      broadcast('data:update', { type: parts[1], action: 'add', data: body });
      return jsonResponse(res, 200, { success: true, data: body });
    }
    if (method === 'PUT' && parts.length >= 3) {
      const id = parseInt(parts[2]);
      const body = await parseBody(req);
      const idx = db[tableName].findIndex(r => String(r.id) === String(id));
      if (idx >= 0) {
        db[tableName][idx] = { ...db[tableName][idx], ...body, id };
        saveDb();
        const v = db.vehicles.find(x => x.id === db[tableName][idx].vehicleId);
        addOperationLog(v?.plateNumber||'', `编辑${logName}`, `ID:${id}`, db[tableName][idx].vehicleId);
        broadcast('data:update', { type: parts[1], action: 'update', data: db[tableName][idx] });
      }
      return jsonResponse(res, 200, { success: true });
    }
    if (method === 'DELETE' && parts.length >= 3) {
      const id = parseInt(parts[2]);
      const record = db[tableName].find(r => String(r.id) === String(id));
      db[tableName] = db[tableName].filter(r => String(r.id) !== String(id));
      saveDb();
      if (record) {
        const v = db.vehicles.find(x => x.id === record.vehicleId);
        addOperationLog(v?.plateNumber||'', `删除${logName}`, `ID:${id}`, record.vehicleId);
      }
      broadcast('data:update', { type: parts[1], action: 'delete', data: { id } });
      return jsonResponse(res, 200, { success: true });
    }
  }

  // 操作日志
  if (p === '/api/logs') {
    return jsonResponse(res, 200, { success: true, data: db.operationLogs });
  }

  jsonResponse(res, 404, { success: false, message: 'Not found' });
}

function getSetting(key) {
  // 简化的设置管理
  return null;
}
function setSetting(key, value) {
  // 简化的设置管理
}

// ============ 静态文件服�?============

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch(e) {
    jsonResponse(res, 404, { error: 'Not Found' });
  }
}

// ============ 启动服务�?============

loadDb();
initPresetData();

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // API 路由
  if (url.startsWith('/api/')) {
    return handleAPI(req, res);
  }

  // SSE 路由
  if (url === '/api/sse') {
    return handleAPI(req, res);
  }

  // 静态文�?  let filePath = path.join(PUB_DIR, url === '/' ? 'index.html' : url);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUB_DIR, 'index.html');
  }
  serveStatic(req, res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('=================================');
  console.log('   🚐 车辆核算云端同步系统');
  console.log('=================================');
  console.log(`   本地:  http://localhost:${PORT}`);
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   网络:  http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log('=================================');
  console.log('   📡 SSE 实时推送已开�?);
  console.log('   🔑 默认密码: 585858');
  console.log('   ℹ️  零依赖，纯Node.js运行');
  console.log('=================================');
  console.log('');
});
