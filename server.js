// server.js - Simple logging server with web dashboard (no Socket.IO)
import express from "express";
import cors from "cors";
import { existsSync, readFileSync, writeFileSync } from "fs";

const app = express();

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

  // Console log for server monitoring
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

// API to get logs count (for quick polling)
app.get("/api/logs/count", (req, res) => {
  res.json({ count: logs.length });
});

// API to clear logs
app.delete("/api/logs", (req, res) => {
  logs = [];
  saveLogs();
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

// Serve the dashboard HTML
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Logs Dashboard</title>
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
            align-items: center;
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
        
        .btn-primary {
            background: #2196F3;
            border-color: #1976D2;
        }
        
        .btn-primary:hover {
            background: #1976D2;
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
        }
        
        .log-entry:hover {
            border-color: #4CAF50;
            background: #1f1f1f;
        }
        
        .log-entry.new {
            animation: highlight 1s ease;
        }
        
        @keyframes highlight {
            0% {
                background: #2a3a2a;
                border-color: #4CAF50;
            }
            100% {
                background: #1a1a1a;
                border-color: #333;
            }
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
            margin-left: 8px;
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
        
        .no-logs {
            text-align: center;
            color: #666;
            padding: 50px;
            font-size: 18px;
        }
        
        .refresh-indicator {
            color: #666;
            font-size: 12px;
        }
        
        .loading {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid #333;
            border-top-color: #4CAF50;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 10px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>API Logs Dashboard</h1>
        <div class="controls">
            <span id="lastRefresh" class="refresh-indicator">Never refreshed</span>
            <button class="btn btn-primary" onclick="refreshLogs()">🔄 Refresh</button>
            <button class="btn" onclick="exportLogs()">📥 Export JSON</button>
            <button class="btn btn-danger" onclick="clearLogs()">🗑️ Clear All</button>
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
                <input type="checkbox" id="autoRefresh"> Auto-refresh (5s)
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
        <div class="no-logs">Loading logs...</div>
    </div>

    <script>
        let allLogs = [];
        let filteredLogs = [];
        let lastLogCount = 0;
        let autoRefreshInterval = null;
        
        // Load logs from server
        async function loadLogs() {
            try {
                const response = await fetch('/api/logs');
                const logs = await response.json();
                
                // Check if there are new logs
                const hasNewLogs = logs.length > lastLogCount;
                lastLogCount = logs.length;
                
                allLogs = logs;
                applyFilters(hasNewLogs);
                updateStats();
                updateLastRefreshTime();
            } catch (error) {
                console.error('Error loading logs:', error);
            }
        }
        
        // Refresh logs
        async function refreshLogs() {
            const button = event?.target;
            if (button) {
                button.disabled = true;
                button.innerHTML = '⏳ Loading...';
            }
            
            await loadLogs();
            
            if (button) {
                button.disabled = false;
                button.innerHTML = '🔄 Refresh';
            }
        }
        
        // Update last refresh time
        function updateLastRefreshTime() {
            const now = new Date();
            document.getElementById('lastRefresh').textContent = 
                'Last refresh: ' + now.toLocaleTimeString();
        }
        
        // Apply filters
        function applyFilters(hasNewLogs = false) {
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
            
            renderLogs(hasNewLogs);
        }
        
        // Render logs
        function renderLogs(hasNewLogs = false) {
            const container = document.getElementById('logsContainer');
            
            if (filteredLogs.length === 0) {
                container.innerHTML = '<div class="no-logs">No logs to display</div>';
                return;
            }
            
            // Reverse to show newest first
            const reversedLogs = [...filteredLogs].reverse();
            
            container.innerHTML = reversedLogs.map((log, index) => {
                const typeClass = 'type-' + (log.type || 'unknown').toLowerCase().replace(/_/g, '_');
                const methodClass = log.method ? 'method-' + log.method.toLowerCase() : '';
                const statusClass = log.status >= 200 && log.status < 300 ? 'status-success' : 'status-error';
                const newClass = hasNewLogs && index === 0 ? 'new' : '';
                
                let dataHtml = '';
                
                // Enhanced data display based on log type
                if (log.type === 'REQUEST') {
                    dataHtml = \`
                        <div class="toggle-data" onclick="toggleData(this)">▶ Show Request Details</div>
                        <div class="log-data" style="display: none;">
                            \${log.fullUrl ? \`<div class="log-section">
                                <div class="log-section-title">🌐 URL Details</div>
                                <div class="log-section-content">
                                    <div><strong>Full URL:</strong> \${log.fullUrl}</div>
                                    \${log.urlDetails ? \`
                                        <div><strong>Base URL:</strong> \${log.urlDetails.baseURL || 'N/A'}</div>
                                        <div><strong>Path:</strong> \${log.urlDetails.path || 'N/A'}</div>
                                        \${log.urlDetails.queryParams ? \`<div><strong>Query Params:</strong><pre>\${JSON.stringify(log.urlDetails.queryParams, null, 2)}</pre></div>\` : ''}
                                        \${log.urlDetails.signatureParams ? \`<div><strong>Signature:</strong><pre>\${JSON.stringify(log.urlDetails.signatureParams, null, 2)}</pre></div>\` : ''}
                                    \` : ''}
                                </div>
                            </div>\` : ''}
                            
                            \${log.headers ? \`<div class="log-section">
                                <div class="log-section-title">📋 Headers</div>
                                <div class="log-section-content">
                                    <div><strong>Authorization:</strong> \${log.headers.authorization || 'None'}</div>
                                    <div><strong>Content-Type:</strong> \${log.headers.contentType || 'Not Set'}</div>
                                    <details>
                                        <summary style="cursor: pointer; color: #4CAF50;">All Headers</summary>
                                        <pre>\${JSON.stringify(log.headers.all, null, 2)}</pre>
                                    </details>
                                </div>
                            </div>\` : ''}
                            
                            \${log.payload ? \`<div class="log-section">
                                <div class="log-section-title">📤 Request Payload</div>
                                <div class="log-section-content">
                                    <div><strong>Data Type:</strong> \${log.payload.dataType}</div>
                                    <div><strong>Data Size:</strong> \${log.payload.dataSize} bytes</div>
                                    \${log.payload.data ? \`<div><strong>Data:</strong><pre>\${JSON.stringify(log.payload.data, null, 2)}</pre></div>\` : '<div>No payload data</div>'}
                                </div>
                            </div>\` : ''}
                            
                            \${log.axiosConfig ? \`<div class="log-section">
                                <div class="log-section-title">⚙️ Config</div>
                                <div class="log-section-content">
                                    <pre>\${JSON.stringify(log.axiosConfig, null, 2)}</pre>
                                </div>
                            </div>\` : ''}
                        </div>
                    \`;
                } else if (log.type === 'RESPONSE') {
                    dataHtml = \`
                        <div class="toggle-data" onclick="toggleData(this)">▶ Show Response Details</div>
                        <div class="log-data" style="display: none;">
                            \${log.responseData ? \`<div class="log-section">
                                <div class="log-section-title">📥 Response Data</div>
                                <div class="log-section-content">
                                    <div><strong>Success:</strong> \${log.responseData.isSuccess !== undefined ? log.responseData.isSuccess : 'N/A'}</div>
                                    <div><strong>Message:</strong> \${log.responseData.message || 'None'}</div>
                                    <div><strong>Data Type:</strong> \${log.responseData.dataType}</div>
                                    <div><strong>Data Size:</strong> \${log.responseData.dataSize} bytes</div>
                                    \${log.responseData.truncated ? '<div style="color: #ff9800;">⚠️ Large response truncated</div>' : ''}
                                    \${log.responseData.full ? \`<details>
                                        <summary style="cursor: pointer; color: #4CAF50;">Response Body</summary>
                                        <pre>\${typeof log.responseData.full === 'string' ? log.responseData.full : JSON.stringify(log.responseData.full, null, 2)}</pre>
                                    </details>\` : ''}
                                </div>
                            </div>\` : ''}
                            
                            \${log.responseHeaders ? \`<div class="log-section">
                                <div class="log-section-title">📋 Response Headers</div>
                                <div class="log-section-content">
                                    <pre>\${JSON.stringify(log.responseHeaders, null, 2)}</pre>
                                </div>
                            </div>\` : ''}
                            
                            \${log.requestDetails ? \`<div class="log-section">
                                <div class="log-section-title">🔄 Original Request</div>
                                <div class="log-section-content">
                                    <details>
                                        <summary style="cursor: pointer; color: #888;">View Request Details</summary>
                                        <pre>\${JSON.stringify(log.requestDetails, null, 2)}</pre>
                                    </details>
                                </div>
                            </div>\` : ''}
                        </div>
                    \`;
                } else if (log.type && log.type.includes('ERROR')) {
                    dataHtml = \`
                        <div class="toggle-data" onclick="toggleData(this)">▶ Show Error Details</div>
                        <div class="log-data" style="display: none;">
                            \${log.error ? \`<div class="log-section">
                                <div class="log-section-title">❌ Error Information</div>
                                <div class="log-section-content">
                                    <div><strong>Message:</strong> \${log.error.message || 'Unknown error'}</div>
                                    <div><strong>Code:</strong> \${log.error.code || 'N/A'}</div>
                                    \${log.error.isNetworkError !== undefined ? \`<div><strong>Network Error:</strong> \${log.error.isNetworkError}</div>\` : ''}
                                    \${log.error.isTimeout !== undefined ? \`<div><strong>Timeout:</strong> \${log.error.isTimeout}</div>\` : ''}
                                    \${log.error.responseData ? \`<div><strong>Response Data:</strong><pre>\${JSON.stringify(log.error.responseData, null, 2)}</pre></div>\` : ''}
                                    \${log.error.stack ? \`<details>
                                        <summary style="cursor: pointer; color: #f44336;">Stack Trace</summary>
                                        <pre style="color: #f44336;">\${log.error.stack}</pre>
                                    </details>\` : ''}
                                </div>
                            </div>\` : ''}
                        </div>
                    \`;
                } else if (log.data || log.error) {
                    // Fallback for other log types
                    const dataToShow = log.data || log.error;
                    dataHtml = \`
                        <div class="toggle-data" onclick="toggleData(this)">▶ Show Data</div>
                        <div class="log-data" style="display: none;">
                            <pre>\${JSON.stringify(dataToShow, null, 2)}</pre>
                        </div>
                    \`;
                }
                
                // Main log entry with enhanced metadata
                return \`
                    <div class="log-entry \${newClass}">
                        <div class="log-header">
                            <div>
                                <span class="log-type \${typeClass}">\${log.type || 'LOG'}</span>
                                \${log.method ? \`<span class="log-method \${methodClass}">\${log.method}</span>\` : ''}
                                \${log.requestId ? \`<span style="color: #666; font-size: 10px; margin-left: 10px;">ID: \${log.requestId}</span>\` : ''}
                            </div>
                            <div style="color: #666; font-size: 12px;">\${new Date(log.timestamp || log.receivedAt).toLocaleString()}</div>
                        </div>
                        <div class="log-url">\${log.fullUrl || log.url || 'N/A'}</div>
                        <div class="log-details">
                            \${log.status ? \`<div class="log-detail"><span class="detail-label">Status:</span> <span class="\${statusClass}">\${log.status}</span></div>\` : ''}
                            \${log.duration ? \`<div class="log-detail"><span class="detail-label">Duration:</span> <span style="color: \${log.duration > 1000 ? '#ff9800' : '#4CAF50'};">\${log.duration}ms</span></div>\` : ''}
                            \${log.platform ? \`<div class="log-detail"><span class="detail-label">Platform:</span> \${log.platform}</div>\` : ''}
                            \${log.environment ? \`<div class="log-detail"><span class="detail-label">Environment:</span> \${log.environment}</div>\` : ''}
                            \${log.fromCache ? \`<div class="log-detail"><span class="detail-label" style="color: #2196F3;">📦 From Cache</span></div>\` : ''}
                            \${log.isRetry ? \`<div class="log-detail"><span class="detail-label" style="color: #ff9800;">🔄 Retry Request</span></div>\` : ''}
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
        async function clearLogs() {
            if (confirm('Are you sure you want to clear all logs?')) {
                try {
                    await fetch('/api/logs', { method: 'DELETE' });
                    await loadLogs();
                } catch (error) {
                    console.error('Error clearing logs:', error);
                }
            }
        }
        
        // Export logs
        function exportLogs() {
            window.location.href = '/api/export';
        }
        
        // Handle auto-refresh
        function toggleAutoRefresh() {
            const checkbox = document.getElementById('autoRefresh');
            if (checkbox.checked) {
                autoRefreshInterval = setInterval(loadLogs, 5000);
            } else {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }
        
        // Event listeners
        document.getElementById('searchFilter').addEventListener('input', () => applyFilters());
        document.getElementById('typeFilter').addEventListener('change', () => applyFilters());
        document.getElementById('methodFilter').addEventListener('change', () => applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => applyFilters());
        document.getElementById('autoRefresh').addEventListener('change', toggleAutoRefresh);
        
        // Initial load
        loadLogs();
    </script>
</body>
</html>
  `);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║     🚀 Logging Server Started Successfully!       ║
║                                                   ║
║     Dashboard: http://localhost:${PORT}              ║
║     Log Endpoint: http://localhost:${PORT}/log       ║
║                                                   ║
║     Logs are saved to: api_logs.json              ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});
