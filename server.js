// server.js - Simple logging server with real-time web dashboard
import express from "express";
import { createServer } from "http";
import { Server as socketIO } from "socket.io";
import cors from "cors";
import { existsSync, readFileSync, writeFileSync } from "fs";

const app = express();
const server = createServer(app);
const io = new socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

// Store logs in memory (last 1000 logs)
const MAX_LOGS = 1000;
let logs = [];

// Also write to file for persistence
const LOG_FILE = "api_logs.json";

// Load existing logs on startup
try {
  if (existsSync(LOG_FILE)) {
    const data = readFileSync(LOG_FILE, "utf8");
    logs = JSON.parse(data).slice(-MAX_LOGS);
    console.log(`Loaded ${logs.length} existing logs`);
  }
} catch (error) {
  console.log("No existing logs found, starting fresh");
}

// Helper to save logs to file
function saveLogs() {
  try {
    writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error("Error saving logs:", error);
  }
}

// API endpoint to receive logs
app.post("/log", (req, res) => {
  const log = {
    id: Date.now(),
    ...req.body,
    receivedAt: new Date().toISOString(),
  };

  // Add to memory
  logs.push(log);
  if (logs.length > MAX_LOGS) {
    logs.shift(); // Remove oldest
  }

  // Save to file every 10 logs
  if (logs.length % 10 === 0) {
    saveLogs();
  }

  // Emit to all connected clients for real-time updates
  io.emit("newLog", log);

  // Also console log for server monitoring
  console.log(
    `[${log.type}] ${log.method} ${log.url} - Status: ${
      log.status || "N/A"
    } - Duration: ${log.duration || "N/A"}ms`
  );

  res.json({ success: true });
});

// API to get all logs
app.get("/api/logs", (req, res) => {
  res.json(logs);
});

// API to clear logs
app.delete("/api/logs", (req, res) => {
  logs = [];
  saveLogs();
  io.emit("logsCleared");
  res.json({ success: true });
});

// API to export logs
app.get("/api/export", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=logs_${Date.now()}.json`
  );
  res.send(JSON.stringify(logs, null, 2));
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Dashboard connected");

  // Send existing logs to new client
  socket.emit("initialLogs", logs);

  socket.on("disconnect", () => {
    console.log("Dashboard disconnected");
  });
});

// Serve the dashboard HTML
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Logs Dashboard</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0a0a;
            color: #e0e0e0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background: #1a1a1a;
            padding: 15px 20px;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            font-size: 24px;
            color: #4CAF50;
        }
        
        .controls {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 8px 16px;
            background: #333;
            border: 1px solid #555;
            color: #fff;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
        }
        
        .btn:hover {
            background: #444;
            border-color: #666;
        }
        
        .btn-danger {
            background: #d32f2f;
            border-color: #f44336;
        }
        
        .btn-danger:hover {
            background: #f44336;
        }
        
        .filters {
            background: #1a1a1a;
            padding: 15px 20px;
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
            border-bottom: 1px solid #333;
        }
        
        .filter-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .filter-group label {
            color: #888;
            font-size: 14px;
        }
        
        .filter-group input, .filter-group select {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #fff;
            padding: 5px 10px;
            border-radius: 4px;
        }
        
        .stats {
            background: #1a1a1a;
            padding: 10px 20px;
            display: flex;
            gap: 30px;
            border-bottom: 1px solid #333;
            font-size: 14px;
        }
        
        .stat {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .stat-label {
            color: #888;
        }
        
        .stat-value {
            color: #4CAF50;
            font-weight: bold;
        }
        
        .logs-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        
        .log-entry {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
            margin-bottom: 10px;
            padding: 15px;
            transition: all 0.2s;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .log-entry:hover {
            border-color: #4CAF50;
            background: #1f1f1f;
        }
        
        .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .log-type {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .type-request { background: #2196F3; }
        .type-response { background: #4CAF50; }
        .type-error { background: #f44336; }
        .type-request_error { background: #ff9800; }
        .type-response_error { background: #d32f2f; }
        .type-business_error { background: #9c27b0; }
        .type-token_refresh_error { background: #ff5722; }
        
        .log-method {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            background: #333;
            color: #fff;
        }
        
        .method-get { background: #4CAF50; }
        .method-post { background: #2196F3; }
        .method-put { background: #FF9800; }
        .method-delete { background: #f44336; }
        .method-patch { background: #9C27B0; }
        
        .log-url {
            color: #888;
            font-family: monospace;
            font-size: 13px;
            margin: 5px 0;
        }
        
        .log-details {
            display: flex;
            gap: 20px;
            font-size: 13px;
            color: #666;
        }
        
        .log-detail {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .detail-label {
            color: #888;
        }
        
        .status-success { color: #4CAF50; }
        .status-error { color: #f44336; }
        
        .log-data {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #333;
            font-family: monospace;
            font-size: 12px;
            color: #888;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .log-data pre {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .toggle-data {
            cursor: pointer;
            color: #4CAF50;
            font-size: 12px;
            margin-top: 5px;
        }
        
        .live-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #4CAF50;
            border-radius: 50%;
            margin-right: 5px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .no-logs {
            text-align: center;
            color: #666;
            padding: 50px;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1><span class="live-indicator"></span>API Logs Dashboard</h1>
        <div class="controls">
            <span id="connectionStatus" style="margin-right: 15px; color: #4CAF50;">● Connected</span>
            <button class="btn" onclick="exportLogs()">Export JSON</button>
            <button class="btn btn-danger" onclick="clearLogs()">Clear All</button>
        </div>
    </div>
    
    <div class="filters">
        <div class="filter-group">
            <label>Search:</label>
            <input type="text" id="searchFilter" placeholder="URL, method, or data..." style="width: 200px;">
        </div>
        <div class="filter-group">
            <label>Type:</label>
            <select id="typeFilter">
                <option value="">All Types</option>
                <option value="REQUEST">Requests</option>
                <option value="RESPONSE">Responses</option>
                <option value="ERROR">Errors</option>
            </select>
        </div>
        <div class="filter-group">
            <label>Method:</label>
            <select id="methodFilter">
                <option value="">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
            </select>
        </div>
        <div class="filter-group">
            <label>Status:</label>
            <select id="statusFilter">
                <option value="">All Status</option>
                <option value="2xx">Success (2xx)</option>
                <option value="4xx">Client Error (4xx)</option>
                <option value="5xx">Server Error (5xx)</option>
            </select>
        </div>
        <div class="filter-group">
            <label>
                <input type="checkbox" id="autoScroll" checked> Auto-scroll
            </label>
        </div>
    </div>
    
    <div class="stats">
        <div class="stat">
            <span class="stat-label">Total Logs:</span>
            <span class="stat-value" id="totalLogs">0</span>
        </div>
        <div class="stat">
            <span class="stat-label">Requests:</span>
            <span class="stat-value" id="totalRequests">0</span>
        </div>
        <div class="stat">
            <span class="stat-label">Errors:</span>
            <span class="stat-value" id="totalErrors">0</span>
        </div>
        <div class="stat">
            <span class="stat-label">Avg Response Time:</span>
            <span class="stat-value" id="avgResponseTime">0ms</span>
        </div>
    </div>
    
    <div class="logs-container" id="logsContainer">
        <div class="no-logs">Waiting for logs...</div>
    </div>

    <script>
        const socket = io();
        let allLogs = [];
        let filteredLogs = [];
        
        // Connection status
        socket.on('connect', () => {
            document.getElementById('connectionStatus').innerHTML = '● Connected';
            document.getElementById('connectionStatus').style.color = '#4CAF50';
        });
        
        socket.on('disconnect', () => {
            document.getElementById('connectionStatus').innerHTML = '● Disconnected';
            document.getElementById('connectionStatus').style.color = '#f44336';
        });
        
        // Receive initial logs
        socket.on('initialLogs', (logs) => {
            allLogs = logs;
            applyFilters();
            updateStats();
        });
        
        // Receive new log
        socket.on('newLog', (log) => {
            allLogs.push(log);
            if (allLogs.length > 1000) {
                allLogs.shift();
            }
            applyFilters();
            updateStats();
            
            if (document.getElementById('autoScroll').checked) {
                const container = document.getElementById('logsContainer');
                container.scrollTop = container.scrollHeight;
            }
        });
        
        // Logs cleared
        socket.on('logsCleared', () => {
            allLogs = [];
            applyFilters();
            updateStats();
        });
        
        // Apply filters
        function applyFilters() {
            const searchTerm = document.getElementById('searchFilter').value.toLowerCase();
            const typeFilter = document.getElementById('typeFilter').value;
            const methodFilter = document.getElementById('methodFilter').value;
            const statusFilter = document.getElementById('statusFilter').value;
            
            filteredLogs = allLogs.filter(log => {
                // Search filter
                if (searchTerm) {
                    const searchableText = JSON.stringify(log).toLowerCase();
                    if (!searchableText.includes(searchTerm)) return false;
                }
                
                // Type filter
                if (typeFilter) {
                    if (!log.type || !log.type.includes(typeFilter)) return false;
                }
                
                // Method filter
                if (methodFilter && log.method !== methodFilter) return false;
                
                // Status filter
                if (statusFilter && log.status) {
                    const statusCode = log.status.toString();
                    if (statusFilter === '2xx' && !statusCode.startsWith('2')) return false;
                    if (statusFilter === '4xx' && !statusCode.startsWith('4')) return false;
                    if (statusFilter === '5xx' && !statusCode.startsWith('5')) return false;
                }
                
                return true;
            });
            
            renderLogs();
        }
        
        // Render logs
        function renderLogs() {
            const container = document.getElementById('logsContainer');
            
            if (filteredLogs.length === 0) {
                container.innerHTML = '<div class="no-logs">No logs to display</div>';
                return;
            }
            
            container.innerHTML = filteredLogs.map(log => {
                const typeClass = 'type-' + (log.type || 'unknown').toLowerCase().replace(/_/g, '_');
                const methodClass = log.method ? 'method-' + log.method.toLowerCase() : '';
                const statusClass = log.status >= 200 && log.status < 300 ? 'status-success' : 'status-error';
                
                let dataHtml = '';
                if (log.data || log.error) {
                    const dataToShow = log.data || log.error;
                    dataHtml = \`
                        <div class="toggle-data" onclick="toggleData(this)">▶ Show Data</div>
                        <div class="log-data" style="display: none;">
                            <pre>\${JSON.stringify(dataToShow, null, 2)}</pre>
                        </div>
                    \`;
                }
                
                return \`
                    <div class="log-entry">
                        <div class="log-header">
                            <div>
                                <span class="log-type \${typeClass}">\${log.type || 'LOG'}</span>
                                \${log.method ? \`<span class="log-method \${methodClass}">\${log.method}</span>\` : ''}
                            </div>
                            <div style="color: #666; font-size: 12px;">\${new Date(log.timestamp).toLocaleTimeString()}</div>
                        </div>
                        <div class="log-url">\${log.url || 'N/A'}</div>
                        <div class="log-details">
                            \${log.status ? \`<div class="log-detail"><span class="detail-label">Status:</span> <span class="\${statusClass}">\${log.status}</span></div>\` : ''}
                            \${log.duration ? \`<div class="log-detail"><span class="detail-label">Duration:</span> \${log.duration}ms</div>\` : ''}
                            \${log.platform ? \`<div class="log-detail"><span class="detail-label">Platform:</span> \${log.platform}</div>\` : ''}
                            \${log.requestId ? \`<div class="log-detail"><span class="detail-label">Request ID:</span> \${log.requestId}</div>\` : ''}
                        </div>
                        \${dataHtml}
                    </div>
                \`;
            }).join('');
        }
        
        // Toggle data visibility
        function toggleData(element) {
            const dataDiv = element.nextElementSibling;
            if (dataDiv.style.display === 'none') {
                dataDiv.style.display = 'block';
                element.innerHTML = '▼ Hide Data';
            } else {
                dataDiv.style.display = 'none';
                element.innerHTML = '▶ Show Data';
            }
        }
        
        // Update statistics
        function updateStats() {
            document.getElementById('totalLogs').textContent = allLogs.length;
            
            const requests = allLogs.filter(l => l.type === 'REQUEST').length;
            document.getElementById('totalRequests').textContent = requests;
            
            const errors = allLogs.filter(l => l.type && l.type.includes('ERROR')).length;
            document.getElementById('totalErrors').textContent = errors;
            
            const responsesWithDuration = allLogs.filter(l => l.duration);
            if (responsesWithDuration.length > 0) {
                const avgTime = responsesWithDuration.reduce((sum, l) => sum + l.duration, 0) / responsesWithDuration.length;
                document.getElementById('avgResponseTime').textContent = avgTime.toFixed(0) + 'ms';
            }
        }
        
        // Clear logs
        function clearLogs() {
            if (confirm('Clear all logs?')) {
                fetch('/api/logs', { method: 'DELETE' })
                    .then(() => console.log('Logs cleared'));
            }
        }
        
        // Export logs
        function exportLogs() {
            window.location.href = '/api/export';
        }
        
        // Event listeners
        document.getElementById('searchFilter').addEventListener('input', applyFilters);
        document.getElementById('typeFilter').addEventListener('change', applyFilters);
        document.getElementById('methodFilter').addEventListener('change', applyFilters);
        document.getElementById('statusFilter').addEventListener('change', applyFilters);
    </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     🚀 Logging Server Started Successfully!       ║
║                                                   ║
║     Dashboard: http://localhost:${PORT}           ║
║     Log Endpoint: http://localhost:${PORT}/log    ║
║                                                   ║
║     Logs are saved to: api_logs.json              ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});
