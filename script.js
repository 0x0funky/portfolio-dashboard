class AssetTracker {
    constructor() {
        this.assets = this.loadAssets();
        this.chart = null;
        this.filteredAssets = [...this.assets];
        this.sortConfig = { column: null, direction: null };
        this.activeFilters = {
            date: { from: '', to: '', selected: new Set() },
            source: { search: '', selected: new Set() },
            amount: { min: '', max: '', selected: new Set() },
            currency: { search: '', selected: new Set() }
        };
        this.editingAssetId = null;
        this.currentCalendarDate = new Date();
        this.currentView = 'calendar';
        this.yAxisVisible = true;
        this.calendarDisplayMode = 'totalAssets'; // 'totalAssets', 'dailyChange', or 'both'
        this.darkMode = this.loadDarkModePreference();
        this.init();
    }

    init() {
        this.filteredAssets = [...this.assets];
        this.setupEventListeners();
        this.applyFilters(); // This will set default sorting (newest first)
        this.updateChart();
        this.updateTotalDisplay();
        this.setDefaultDate();
        this.initializeDarkMode();
    }

    setupEventListeners() {
        document.getElementById('assetForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('exportBtn').addEventListener('click', () => this.exportToExcel());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.handleImport(e));
        document.getElementById('clearBtn').addEventListener('click', () => this.clearAllData());
        document.getElementById('chartType').addEventListener('change', () => this.updateChart());
        document.getElementById('timeRange').addEventListener('change', () => this.updateChart());
        document.getElementById('toggleYAxis').addEventListener('click', () => this.toggleYAxis());
        document.getElementById('clearFilters').addEventListener('click', () => this.clearAllFilters());
        
        // Source dropdown event listeners
        document.getElementById('sourceDropdownBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleSourceDropdown();
        });
        
        // Close source dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.source-input-container')) {
                this.closeSourceDropdown();
                this.closeEditSourceDropdown();
            }
        });

        // Edit modal event listeners
        document.getElementById('editAssetForm').addEventListener('submit', (e) => this.handleEditSubmit(e));
        document.getElementById('cancelEditBtn').addEventListener('click', () => this.closeEditModal());
        
        // Edit source dropdown listeners
        document.getElementById('editSourceDropdownBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleEditSourceDropdown();
        });

        // Close edit modal when clicking outside
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeEditModal();
            }
        });

        // View toggle listeners
        document.getElementById('calendarViewBtn').addEventListener('click', () => this.switchView('calendar'));
        document.getElementById('tableViewBtn').addEventListener('click', () => this.switchView('table'));

        // Calendar navigation listeners
        document.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));

        // Calendar display mode toggle listeners
        document.getElementById('showTotalAssetsBtn').addEventListener('click', () => this.setCalendarDisplayMode('totalAssets'));
        document.getElementById('showDailyChangeBtn').addEventListener('click', () => this.setCalendarDisplayMode('dailyChange'));
        document.getElementById('showBothBtn').addEventListener('click', () => this.setCalendarDisplayMode('both'));

        // Dark mode toggle listener
        document.getElementById('darkModeToggle').addEventListener('click', () => this.toggleDarkMode());

        // Daily details modal listeners
        document.getElementById('closeDailyDetailsBtn').addEventListener('click', () => this.closeDailyDetailsModal());
        document.getElementById('dailyDetailsModal').addEventListener('click', (e) => {
            if (e.target.id === 'dailyDetailsModal') {
                this.closeDailyDetailsModal();
            }
        });
        
        // Filter dropdown event listeners
        document.querySelectorAll('.filter-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFilterDropdown(icon.dataset.filter);
            });
        });
        
        // Sorting event listeners (only on header text and sort icon, not on filter icons)
        document.querySelectorAll('.sortable').forEach(header => {
            const headerText = header.querySelector('.header-content span');
            const sortIcon = header.querySelector('.sort-icon');
            
            if (headerText) {
                headerText.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleSort(header.dataset.column);
                });
            }
            
            if (sortIcon) {
                sortIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleSort(header.dataset.column);
                });
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-dropdown')) {
                this.closeAllDropdowns();
            }
        });

        // Setup filter controls after initial load
        setTimeout(() => this.setupFilterControls(), 100);
        
        // Initialize source dropdown and calendar
        setTimeout(() => {
            this.updateSourceDropdown();
            this.renderCalendar();
        }, 100);
    }

    setDefaultDate() {
        const today = this.formatLocalDate(new Date());
        document.getElementById('date').value = today;
    }

    handleSubmit(e) {
        e.preventDefault();
        
        const asset = {
            id: Date.now(),
            date: document.getElementById('date').value,
            name: document.getElementById('assetName').value,
            amount: parseFloat(document.getElementById('amount').value),
            currency: document.getElementById('currency').value
        };

        this.assets.push(asset);
        this.saveAssets();
        this.applyFilters(); // This will update filteredAssets and table
        this.updateChart();
        this.updateTotalDisplay();
        this.updateSourceDropdown(); // Update source dropdown with new source
        if (this.currentView === 'calendar') {
            this.renderCalendar(); // Update calendar view
        }
        this.showMessage('資產數據已成功新增！', 'success');
        this.resetForm();
    }

    resetForm() {
        // Store the current date value before reset
        const currentDate = document.getElementById('date').value;
        
        document.getElementById('assetForm').reset();
        
        // Restore the date value
        document.getElementById('date').value = currentDate;
    }

    loadAssets() {
        const stored = localStorage.getItem('assetData');
        return stored ? JSON.parse(stored) : [];
    }

    saveAssets() {
        localStorage.setItem('assetData', JSON.stringify(this.assets));
    }

    updateTable() {
        const tbody = document.getElementById('assetTableBody');
        tbody.innerHTML = '';

        this.filteredAssets.forEach(asset => {
            const dailyChange = this.calculateDailyChange(asset);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${asset.date}</td>
                <td>${asset.name}</td>
                <td>${asset.amount.toLocaleString('zh-TW', { minimumFractionDigits: 2 })}</td>
                <td>${dailyChange}</td>
                <td>${asset.currency}</td>
                <td>
                    <button class="edit-btn" onclick="assetTracker.editAsset(${asset.id})">
                        編輯
                    </button>
                    <button class="delete-btn" onclick="assetTracker.deleteAsset(${asset.id})">
                        刪除
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    calculateDailyChange(asset) {
        // Find previous day's data for the same source
        const currentDate = new Date(asset.date);
        const previousDate = new Date(currentDate);
        previousDate.setDate(currentDate.getDate() - 1);
        const previousDateStr = this.formatLocalDate(previousDate);

        // Find all previous day assets for the same source
        const previousAssets = this.assets.filter(a => 
            a.date === previousDateStr && 
            a.name === asset.name && 
            a.currency === asset.currency
        );

        if (previousAssets.length === 0) {
            return '<span class="daily-change neutral">--</span>';
        }

        // Sum up all amounts for the same source on previous day
        const previousTotal = previousAssets.reduce((sum, a) => sum + a.amount, 0);
        
        // Sum up all amounts for the same source on current day
        const currentAssets = this.assets.filter(a => 
            a.date === asset.date && 
            a.name === asset.name && 
            a.currency === asset.currency
        );
        const currentTotal = currentAssets.reduce((sum, a) => sum + a.amount, 0);

        const change = currentTotal - previousTotal;
        const percentChange = previousTotal !== 0 ? ((change / previousTotal) * 100) : 0;

        if (change > 0) {
            return `<span class="daily-change positive">+${change.toLocaleString('zh-TW', { minimumFractionDigits: 2 })} (+${percentChange.toFixed(2)}%)</span>`;
        } else if (change < 0) {
            return `<span class="daily-change negative">${change.toLocaleString('zh-TW', { minimumFractionDigits: 2 })} (${percentChange.toFixed(2)}%)</span>`;
        } else {
            return '<span class="daily-change neutral">0.00 (0.00%)</span>';
        }
    }

    deleteAsset(id) {
        if (confirm('確定要刪除這筆資產數據嗎？')) {
            this.assets = this.assets.filter(asset => asset.id !== id);
            this.saveAssets();
            this.applyFilters(); // This will update filteredAssets and the table
            this.updateChart();
            this.updateTotalDisplay();
            if (this.currentView === 'calendar') {
                this.renderCalendar(); // Update calendar view
            }
            this.showMessage('資產數據已刪除', 'success');
        }
    }

    updateChart() {
        const chartType = document.getElementById('chartType').value;
        const timeRange = document.getElementById('timeRange').value;
        
        const filteredAssets = this.getFilteredAssets(timeRange);
        let chartData;
        let chartOptions;

        if (chartType === 'pie') {
            chartData = this.preparePieChartData(filteredAssets);
            chartOptions = this.getPieChartOptions();
        } else {
            chartData = this.prepareChartData(filteredAssets);
            chartOptions = this.getLineBarChartOptions();
        }

        if (this.chart) {
            this.chart.destroy();
        }

        const ctx = document.getElementById('assetChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: chartType === 'pie' ? 'pie' : chartType,
            data: chartData,
            options: chartOptions
        });
    }

    getFilteredAssets(timeRange) {
        if (timeRange === 'all') return this.assets;

        const days = parseInt(timeRange);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return this.assets.filter(asset => new Date(asset.date) >= cutoffDate);
    }

    prepareChartData(assets) {
        // Group assets by date and calculate daily totals
        const dailyTotals = {};

        assets.forEach(asset => {
            if (!dailyTotals[asset.date]) {
                dailyTotals[asset.date] = 0;
            }
            dailyTotals[asset.date] += asset.amount;
        });

        const dates = Object.keys(dailyTotals).sort();
        const totals = dates.map(date => dailyTotals[date]);

        // Calculate daily changes
        const changes = [];
        for (let i = 0; i < totals.length; i++) {
            if (i === 0) {
                changes.push(0); // First day has no change
            } else {
                changes.push(totals[i] - totals[i - 1]);
            }
        }

        return {
            labels: dates,
            datasets: [{
                label: '總資產',
                data: totals,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: '每日變化',
                data: changes,
                backgroundColor: changes.map(change => 
                    change > 0 ? 'rgba(40, 167, 69, 0.8)' : 
                    change < 0 ? 'rgba(220, 53, 69, 0.8)' : 
                    'rgba(108, 117, 125, 0.8)'
                ),
                borderColor: changes.map(change => 
                    change > 0 ? 'rgba(40, 167, 69, 1)' : 
                    change < 0 ? 'rgba(220, 53, 69, 1)' : 
                    'rgba(108, 117, 125, 1)'
                ),
                borderWidth: 2,
                type: 'bar',
                yAxisID: 'y1'
            }]
        };
    }

    preparePieChartData(assets) {
        // Get the latest date from assets
        if (assets.length === 0) {
            return {
                labels: ['無數據'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(200, 200, 200, 0.8)'],
                    borderColor: ['rgba(200, 200, 200, 1)'],
                    borderWidth: 2
                }]
            };
        }

        const latestDate = assets.reduce((latest, asset) => {
            return asset.date > latest ? asset.date : latest;
        }, '');

        // Get only assets from the latest date
        const latestAssets = assets.filter(asset => asset.date === latestDate);
        
        // Group assets by source and calculate totals for latest date
        const assetTotals = {};

        latestAssets.forEach(asset => {
            if (!assetTotals[asset.name]) {
                assetTotals[asset.name] = 0;
            }
            assetTotals[asset.name] += asset.amount;
        });

        const labels = Object.keys(assetTotals);
        const data = Object.values(assetTotals);
        
        const colors = [
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 205, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)'
        ];

        return {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: colors.slice(0, labels.length).map(color => color.replace('0.8', '1')),
                borderWidth: 2
            }]
        };
    }

    getLineBarChartOptions() {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#f0f0f0' : '#666';
        const gridColor = isDarkMode ? '#4a5568' : 'rgba(0,0,0,0.1)';
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: '每日總資產變化趨勢',
                    color: textColor,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: textColor,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: isDarkMode ? '#2d3748' : 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: isDarkMode ? '#4a5568' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `總資產: ${context.parsed.y.toLocaleString('zh-TW')} USDT`;
                            } else {
                                const change = context.parsed.y;
                                const sign = change >= 0 ? '+' : '';
                                return `每日變化: ${sign}${change.toLocaleString('zh-TW')} USDT`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '日期',
                        color: textColor,
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: this.yAxisVisible,
                        text: '總資產 (USDT)',
                        color: textColor,
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        display: this.yAxisVisible,
                        color: textColor,
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return value.toLocaleString('zh-TW');
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: this.yAxisVisible,
                        text: '每日變化 (USDT)',
                        color: textColor,
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                        color: gridColor
                    },
                    ticks: {
                        display: this.yAxisVisible,
                        color: textColor,
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            const sign = value >= 0 ? '+' : '';
                            return `${sign}${value.toLocaleString('zh-TW')}`;
                        }
                    }
                }
            }
        };
    }

    getPieChartOptions() {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#f0f0f0' : '#666';
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '最新資產來源分布',
                    color: textColor,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        color: textColor,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: isDarkMode ? '#2d3748' : 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: isDarkMode ? '#4a5568' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toLocaleString('zh-TW')} USDT (${percentage}%)`;
                        }
                    }
                }
            }
        };
    }

    updateTotalDisplay() {
        if (this.assets.length === 0) {
            document.getElementById('totalAssets').textContent = '0.00';
            return;
        }

        // Always use the latest available date
        const latestDate = this.assets.reduce((latest, asset) => {
            return asset.date > latest ? asset.date : latest;
        }, '');
        
        const latestAssets = this.assets.filter(asset => asset.date === latestDate);
        const total = latestAssets.reduce((sum, asset) => sum + asset.amount, 0);

        document.getElementById('totalAssets').textContent = total.toLocaleString('zh-TW', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
        });
    }

    exportToExcel() {
        if (this.assets.length === 0) {
            this.showMessage('沒有數據可以匯出', 'error');
            return;
        }

        const csvContent = this.convertToCSV(this.assets);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `asset_data_${this.formatLocalDate(new Date())}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showMessage('數據已成功匯出！', 'success');
    }

    convertToCSV(data) {
        const headers = ['日期', '來源', '金額', '計價幣種'];
        const csvRows = [headers.join(',')];

        data.forEach(asset => {
            const row = [
                asset.date,
                `"${asset.name}"`,
                asset.amount,
                asset.currency
            ];
            csvRows.push(row.join(','));
        });

        return '\uFEFF' + csvRows.join('\n');
    }

    parseCSV(content) {
        console.log('CSV content preview:', content.substring(0, 500));
        
        // Remove BOM if present
        const cleanContent = content.replace(/^\uFEFF/, '');
        const lines = cleanContent.split('\n').filter(line => line.trim());
        
        console.log('Lines count:', lines.length);
        console.log('First few lines:', lines.slice(0, 5));
        
        if (lines.length < 2) {
            throw new Error(`CSV 檔案內容不足，只有 ${lines.length} 行`);
        }
        
        // Detect delimiter (tab or comma)
        const firstDataLine = lines[1];
        const delimiter = firstDataLine.includes('\t') ? '\t' : ',';
        console.log('Detected delimiter:', delimiter === '\t' ? 'TAB' : 'COMMA');
        
        // Skip header line and parse data
        const dataLines = lines.slice(1);
        const assets = [];
        const errors = [];
        
        dataLines.forEach((line, index) => {
            try {
                const values = this.parseCSVLine(line, delimiter);
                console.log(`Line ${index + 2} values:`, values);
                
                if (values.length < 4) {
                    errors.push(`第 ${index + 2} 行欄位不足：只有 ${values.length} 個欄位，需要 4 個`);
                    return;
                }
                
                // Convert date format from 2025/8/20 to 2025-08-20
                const dateValue = values[0].trim();
                const formattedDate = this.formatDateString(dateValue);
                
                const asset = {
                    date: formattedDate,
                    name: values[1].replace(/^"(.*)"$/, '$1').trim(), // Remove quotes and trim
                    amount: parseFloat(values[2].trim()),
                    currency: values[3].trim()
                };
                
                console.log(`Parsed asset from line ${index + 2}:`, asset);
                
                // Validate data
                if (!asset.date) {
                    errors.push(`第 ${index + 2} 行日期無效：'${dateValue}'`);
                    return;
                }
                if (!asset.name) {
                    errors.push(`第 ${index + 2} 行來源名稱空白`);
                    return;
                }
                if (isNaN(asset.amount) || asset.amount <= 0) {
                    errors.push(`第 ${index + 2} 行金額無效：'${values[2].trim()}'`);
                    return;
                }
                if (!asset.currency) {
                    errors.push(`第 ${index + 2} 行幣種空白`);
                    return;
                }
                
                assets.push(asset);
            } catch (lineError) {
                errors.push(`第 ${index + 2} 行解析錯誤：${lineError.message}`);
            }
        });
        
        console.log('Successfully parsed assets:', assets.length);
        console.log('Parsing errors:', errors);
        
        if (assets.length === 0) {
            if (errors.length > 0) {
                throw new Error(`沒有有效的資產數據。錯誤：${errors.slice(0, 3).join('; ')}`);
            } else {
                throw new Error('沒有有效的資產數據');
            }
        }
        
        return assets;
    }

    parseCSVLine(line, delimiter = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    formatDateString(dateStr) {
        // Convert formats like "2025/8/20" to "2025-08-20"
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const year = parts[0];
                const month = parts[1].padStart(2, '0');
                const day = parts[2].padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        // If already in correct format or other format, return as is
        return dateStr;
    }

    formatLocalDate(date) {
        // Format date as YYYY-MM-DD in local timezone (not UTC)
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                console.log('File name:', file.name);
                console.log('File size:', file.size);
                console.log('File type:', file.type);
                
                let data;
                
                // Try to parse as JSON first
                if (file.name.endsWith('.json')) {
                    data = JSON.parse(content);
                } else if (file.name.endsWith('.csv')) {
                    // Parse CSV format
                    data = this.parseCSV(content);
                } else {
                    // Try to determine format by content
                    try {
                        data = JSON.parse(content);
                    } catch {
                        data = this.parseCSV(content);
                    }
                }
                
                if (Array.isArray(data) && data.length > 0) {
                    if (confirm(`要匯入 ${data.length} 筆資產數據嗎？這將會覆蓋現有數據。`)) {
                        this.assets = data.map(item => ({
                            ...item,
                            id: Date.now() + Math.random()
                        }));
                        this.saveAssets();
                        this.applyFilters();
                        this.updateChart();
                        this.updateTotalDisplay();
                        this.updateSourceDropdown();
                        if (this.currentView === 'calendar') {
                            this.renderCalendar();
                        }
                        this.showMessage(`成功匯入 ${data.length} 筆資產數據！`, 'success');
                    }
                } else {
                    throw new Error('無效的數據格式');
                }
            } catch (error) {
                console.error('Import error:', error);
                this.showMessage(`匯入失敗：${error.message}`, 'error');
            }
        };
        reader.readAsText(file, 'UTF-8');
    }

    clearAllData() {
        if (confirm('確定要清除所有資產數據嗎？此操作無法復原。')) {
            this.assets = [];
            this.saveAssets();
            this.clearAllFilters(); // This will reset filteredAssets and update table
            this.updateChart();
            this.updateTotalDisplay();
            this.showMessage('所有數據已清除', 'success');
        }
    }

    showMessage(message, type) {
        const existing = document.querySelector('.success, .error');
        if (existing) existing.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = type;
        messageDiv.textContent = message;
        
        const container = document.querySelector('.container');
        container.insertBefore(messageDiv, container.firstChild.nextSibling);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    generateSampleData() {
        const today = this.formatLocalDate(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = this.formatLocalDate(yesterday);
        
        const sampleAssets = [
            { id: 1, date: '2025-01-15', name: '幣安', amount: 50000, currency: 'USDT' },
            { id: 2, date: '2025-01-15', name: '現金', amount: 30000, currency: 'USDT' },
            { id: 3, date: '2025-01-16', name: '幣安', amount: 52000, currency: 'USDT' },
            { id: 4, date: '2025-01-16', name: '現金', amount: 28000, currency: 'USDT' },
            { id: 5, date: yesterdayStr, name: '幣安', amount: 48000, currency: 'USDT' },
            { id: 6, date: yesterdayStr, name: '現金', amount: 32000, currency: 'USDT' },
            { id: 7, date: today, name: '幣安', amount: 55000, currency: 'USDT' },
            { id: 8, date: today, name: '現金', amount: 25000, currency: 'USDT' },
            { id: 9, date: today, name: '投資', amount: 20000, currency: 'USDT' }
        ];

        if (this.assets.length === 0) {
            this.assets = sampleAssets;
            this.saveAssets();
            this.applyFilters(); // This will update filteredAssets and table
            this.updateChart();
            this.updateTotalDisplay();
            this.updateSourceDropdown();
            this.showMessage('已載入示例數據', 'success');
        }
    }

    toggleFilterDropdown(filterType) {
        const dropdown = document.getElementById(`${filterType}FilterDropdown`);
        const icon = document.querySelector(`[data-filter="${filterType}"]`);
        
        // Close other dropdowns first
        this.closeAllDropdowns();
        
        if (dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
            icon.classList.remove('active');
        } else {
            dropdown.classList.add('show');
            icon.classList.add('active');
            this.populateFilterOptions(filterType);
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        document.querySelectorAll('.filter-icon').forEach(icon => {
            icon.classList.remove('active');
        });
    }

    populateFilterOptions(filterType) {
        const optionsContainer = document.getElementById(`${filterType}Options`);
        const uniqueValues = new Set();
        
        // Get unique values for this column
        this.assets.forEach(asset => {
            let value;
            switch (filterType) {
                case 'date':
                    value = asset.date;
                    break;
                case 'source':
                    value = asset.name;
                    break;
                case 'amount':
                    value = asset.amount;
                    break;
                case 'currency':
                    value = asset.currency;
                    break;
            }
            uniqueValues.add(value);
        });

        // Clear and populate options
        optionsContainer.innerHTML = '<label><input type="checkbox" value="all" checked> 全選</label>';
        
        const sortedValues = Array.from(uniqueValues).sort();
        sortedValues.forEach(value => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = value;
            checkbox.checked = this.activeFilters[filterType].selected.size === 0 || this.activeFilters[filterType].selected.has(value);
            
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(' ' + (filterType === 'amount' ? value.toLocaleString('zh-TW') : value)));
            
            optionsContainer.appendChild(label);
            
            // Add event listener for individual checkbox
            checkbox.addEventListener('change', () => {
                this.handleFilterCheckboxChange(filterType, value, checkbox.checked);
            });
        });

        // Handle "Select All" checkbox
        const selectAllCheckbox = optionsContainer.querySelector('input[value="all"]');
        selectAllCheckbox.addEventListener('change', () => {
            this.handleSelectAllChange(filterType, selectAllCheckbox.checked);
        });
    }

    handleSelectAllChange(filterType, checked) {
        const optionsContainer = document.getElementById(`${filterType}Options`);
        const checkboxes = optionsContainer.querySelectorAll('input[type="checkbox"]:not([value="all"])');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });

        if (checked) {
            this.activeFilters[filterType].selected.clear();
        } else {
            this.activeFilters[filterType].selected = new Set(Array.from(checkboxes).map(cb => cb.value));
        }

        this.applyFilters();
    }

    handleFilterCheckboxChange(filterType, value, checked) {
        if (checked) {
            this.activeFilters[filterType].selected.delete(value);
        } else {
            this.activeFilters[filterType].selected.add(value);
        }

        // Update "Select All" checkbox
        const optionsContainer = document.getElementById(`${filterType}Options`);
        const selectAllCheckbox = optionsContainer.querySelector('input[value="all"]');
        const allCheckboxes = optionsContainer.querySelectorAll('input[type="checkbox"]:not([value="all"])');
        const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
        
        selectAllCheckbox.checked = checkedCount === allCheckboxes.length;

        this.applyFilters();
    }

    setupFilterControls() {
        // Date range filters
        const dateFromFilter = document.getElementById('dateFromFilter');
        const dateToFilter = document.getElementById('dateToFilter');
        
        if (dateFromFilter && dateToFilter) {
            dateFromFilter.addEventListener('change', () => {
                this.activeFilters.date.from = dateFromFilter.value;
                this.applyFilters();
            });
            
            dateToFilter.addEventListener('change', () => {
                this.activeFilters.date.to = dateToFilter.value;
                this.applyFilters();
            });
        }

        // Amount range filters
        const amountMinFilter = document.getElementById('amountMinFilter');
        const amountMaxFilter = document.getElementById('amountMaxFilter');
        
        if (amountMinFilter && amountMaxFilter) {
            amountMinFilter.addEventListener('input', () => {
                this.activeFilters.amount.min = amountMinFilter.value;
                this.applyFilters();
            });
            
            amountMaxFilter.addEventListener('input', () => {
                this.activeFilters.amount.max = amountMaxFilter.value;
                this.applyFilters();
            });
        }

        // Search filters
        const sourceSearchFilter = document.getElementById('sourceSearchFilter');
        const currencySearchFilter = document.getElementById('currencySearchFilter');
        
        if (sourceSearchFilter) {
            sourceSearchFilter.addEventListener('input', () => {
                this.activeFilters.source.search = sourceSearchFilter.value;
                this.filterSearchOptions('source');
            });
        }
        
        if (currencySearchFilter) {
            currencySearchFilter.addEventListener('input', () => {
                this.activeFilters.currency.search = currencySearchFilter.value;
                this.filterSearchOptions('currency');
            });
        }
    }

    filterSearchOptions(filterType) {
        const searchValue = this.activeFilters[filterType].search.toLowerCase();
        const optionsContainer = document.getElementById(`${filterType}Options`);
        const labels = optionsContainer.querySelectorAll('label:not(:first-child)');
        
        labels.forEach(label => {
            const text = label.textContent.toLowerCase();
            label.style.display = text.includes(searchValue) ? 'flex' : 'none';
        });
    }

    applyFilters() {
        this.filteredAssets = this.assets.filter(asset => {
            // Date filter
            if (this.activeFilters.date.from || this.activeFilters.date.to) {
                const assetDate = new Date(asset.date);
                if (this.activeFilters.date.from && assetDate < new Date(this.activeFilters.date.from)) {
                    return false;
                }
                if (this.activeFilters.date.to && assetDate > new Date(this.activeFilters.date.to)) {
                    return false;
                }
            }
            
            // Checkbox filters
            if (this.activeFilters.date.selected.size > 0 && !this.activeFilters.date.selected.has(asset.date)) {
                return false;
            }
            if (this.activeFilters.source.selected.size > 0 && !this.activeFilters.source.selected.has(asset.name)) {
                return false;
            }
            if (this.activeFilters.currency.selected.size > 0 && !this.activeFilters.currency.selected.has(asset.currency)) {
                return false;
            }
            
            // Amount range filter
            if (this.activeFilters.amount.min && asset.amount < parseFloat(this.activeFilters.amount.min)) {
                return false;
            }
            if (this.activeFilters.amount.max && asset.amount > parseFloat(this.activeFilters.amount.max)) {
                return false;
            }
            
            // Amount checkbox filter
            if (this.activeFilters.amount.selected.size > 0 && !this.activeFilters.amount.selected.has(asset.amount)) {
                return false;
            }

            return true;
        });

        // Apply current sorting if any
        if (this.sortConfig.column) {
            this.applySorting();
        } else {
            // Default sort by date (newest first)
            this.filteredAssets.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        this.updateTable();
        this.updateFilterIcons();
    }

    updateFilterIcons() {
        // Update filter icons to show active state
        Object.keys(this.activeFilters).forEach(filterType => {
            const icon = document.querySelector(`[data-filter="${filterType}"]`);
            const filter = this.activeFilters[filterType];
            
            let hasActiveFilter = false;
            if (filter.selected && filter.selected.size > 0) hasActiveFilter = true;
            if (filter.from || filter.to) hasActiveFilter = true;
            if (filter.min || filter.max) hasActiveFilter = true;
            if (filter.search) hasActiveFilter = true;
            
            if (hasActiveFilter) {
                icon.style.backgroundColor = '#667eea';
                icon.style.color = 'white';
            } else {
                icon.style.backgroundColor = '';
                icon.style.color = '';
            }
        });
    }

    clearAllFilters() {
        // Reset all filter states
        this.activeFilters = {
            date: { from: '', to: '', selected: new Set() },
            source: { search: '', selected: new Set() },
            amount: { min: '', max: '', selected: new Set() },
            currency: { search: '', selected: new Set() }
        };

        // Clear UI controls
        document.getElementById('dateFromFilter').value = '';
        document.getElementById('dateToFilter').value = '';
        document.getElementById('amountMinFilter').value = '';
        document.getElementById('amountMaxFilter').value = '';
        document.getElementById('sourceSearchFilter').value = '';
        document.getElementById('currencySearchFilter').value = '';

        this.filteredAssets = [...this.assets];
        
        // Apply current sorting if any
        if (this.sortConfig.column) {
            this.applySorting();
        } else {
            this.filteredAssets.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        this.updateTable();
        this.updateFilterIcons();
        this.closeAllDropdowns();
    }

    toggleSourceDropdown() {
        const dropdown = document.getElementById('sourceDropdown');
        const button = document.getElementById('sourceDropdownBtn');
        
        if (dropdown.classList.contains('show')) {
            this.closeSourceDropdown();
        } else {
            dropdown.classList.add('show');
            button.classList.add('active');
            this.populateSourceDropdown();
        }
    }

    closeSourceDropdown() {
        const dropdown = document.getElementById('sourceDropdown');
        const button = document.getElementById('sourceDropdownBtn');
        
        dropdown.classList.remove('show');
        button.classList.remove('active');
    }

    populateSourceDropdown() {
        const container = document.querySelector('.source-options');
        const uniqueSources = new Set();
        
        // Get all unique sources from assets
        this.assets.forEach(asset => {
            uniqueSources.add(asset.name);
        });

        container.innerHTML = '';
        
        if (uniqueSources.size === 0) {
            container.innerHTML = '<div class="no-sources">尚無歷史來源</div>';
            return;
        }

        // Sort sources alphabetically
        const sortedSources = Array.from(uniqueSources).sort();
        
        sortedSources.forEach(source => {
            const option = document.createElement('div');
            option.className = 'source-option';
            option.textContent = source;
            option.addEventListener('click', () => {
                this.selectSource(source);
            });
            container.appendChild(option);
        });
    }

    selectSource(source) {
        const input = document.getElementById('assetName');
        input.value = source;
        input.focus();
        this.closeSourceDropdown();
    }

    updateSourceDropdown() {
        // This method is called after adding new assets
        // It doesn't need to do anything special as populateSourceDropdown 
        // will get fresh data when dropdown is opened
    }

    editAsset(id) {
        const asset = this.assets.find(a => a.id === id);
        if (!asset) {
            this.showMessage('找不到要編輯的資產', 'error');
            return;
        }

        this.editingAssetId = id;
        
        // Populate the edit form
        document.getElementById('editDate').value = asset.date;
        document.getElementById('editAssetName').value = asset.name;
        document.getElementById('editAmount').value = asset.amount;
        document.getElementById('editCurrency').value = asset.currency;
        
        // Show the modal
        document.getElementById('editModal').classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    handleEditSubmit(e) {
        e.preventDefault();
        
        if (!this.editingAssetId) return;
        
        const updatedAsset = {
            id: this.editingAssetId,
            date: document.getElementById('editDate').value,
            name: document.getElementById('editAssetName').value,
            amount: parseFloat(document.getElementById('editAmount').value),
            currency: document.getElementById('editCurrency').value
        };

        // Find and update the asset
        const assetIndex = this.assets.findIndex(a => a.id === this.editingAssetId);
        if (assetIndex !== -1) {
            this.assets[assetIndex] = updatedAsset;
            this.saveAssets();
            this.applyFilters();
            this.updateChart();
            this.updateTotalDisplay();
            this.updateSourceDropdown();
            if (this.currentView === 'calendar') {
                this.renderCalendar(); // Update calendar view
            }
            this.showMessage('資產已成功更新！', 'success');
            this.closeEditModal();
        }
    }

    closeEditModal() {
        document.getElementById('editModal').classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
        this.editingAssetId = null;
        this.closeEditSourceDropdown();
    }

    toggleEditSourceDropdown() {
        const dropdown = document.getElementById('editSourceDropdown');
        const button = document.getElementById('editSourceDropdownBtn');
        
        if (dropdown.classList.contains('show')) {
            this.closeEditSourceDropdown();
        } else {
            dropdown.classList.add('show');
            button.classList.add('active');
            this.populateEditSourceDropdown();
        }
    }

    closeEditSourceDropdown() {
        const dropdown = document.getElementById('editSourceDropdown');
        const button = document.getElementById('editSourceDropdownBtn');
        
        if (dropdown && button) {
            dropdown.classList.remove('show');
            button.classList.remove('active');
        }
    }

    populateEditSourceDropdown() {
        const container = document.querySelector('#editSourceDropdown .source-options');
        const uniqueSources = new Set();
        
        // Get all unique sources from assets
        this.assets.forEach(asset => {
            uniqueSources.add(asset.name);
        });

        container.innerHTML = '';
        
        if (uniqueSources.size === 0) {
            container.innerHTML = '<div class="no-sources">尚無歷史來源</div>';
            return;
        }

        // Sort sources alphabetically
        const sortedSources = Array.from(uniqueSources).sort();
        
        sortedSources.forEach(source => {
            const option = document.createElement('div');
            option.className = 'source-option';
            option.textContent = source;
            option.addEventListener('click', () => {
                this.selectEditSource(source);
            });
            container.appendChild(option);
        });
    }

    selectEditSource(source) {
        const input = document.getElementById('editAssetName');
        input.value = source;
        input.focus();
        this.closeEditSourceDropdown();
    }

    switchView(view) {
        this.currentView = view;
        
        if (view === 'calendar') {
            document.getElementById('calendarView').style.display = 'block';
            document.getElementById('tableView').style.display = 'none';
            document.getElementById('calendarViewBtn').classList.add('active');
            document.getElementById('tableViewBtn').classList.remove('active');
            this.renderCalendar();
        } else {
            document.getElementById('calendarView').style.display = 'none';
            document.getElementById('tableView').style.display = 'block';
            document.getElementById('calendarViewBtn').classList.remove('active');
            document.getElementById('tableViewBtn').classList.add('active');
        }
    }

    navigateMonth(direction) {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + direction);
        this.renderCalendar();
    }

    setCalendarDisplayMode(mode) {
        this.calendarDisplayMode = mode;
        
        // Update button states
        const totalAssetsBtn = document.getElementById('showTotalAssetsBtn');
        const dailyChangeBtn = document.getElementById('showDailyChangeBtn');
        const bothBtn = document.getElementById('showBothBtn');
        
        // Remove active class from all buttons
        totalAssetsBtn.classList.remove('active');
        dailyChangeBtn.classList.remove('active');
        bothBtn.classList.remove('active');
        
        // Add active class to selected button
        if (mode === 'totalAssets') {
            totalAssetsBtn.classList.add('active');
        } else if (mode === 'dailyChange') {
            dailyChangeBtn.classList.add('active');
        } else if (mode === 'both') {
            bothBtn.classList.add('active');
        }
        
        // Re-render calendar with new display mode
        this.renderCalendar();
    }

    renderCalendar() {
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        // Update header
        const monthNames = [
            '1月', '2月', '3月', '4月', '5月', '6月',
            '7月', '8月', '9月', '10月', '11月', '12月'
        ];
        document.getElementById('currentMonth').textContent = `${year}年 ${monthNames[month]}`;
        
        // Get calendar data
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const calendarDays = document.getElementById('calendarDays');
        calendarDays.innerHTML = '';
        
        // Generate calendar days
        for (let i = 0; i < 42; i++) { // 6 weeks
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = this.createCalendarDay(date, month);
            calendarDays.appendChild(dayElement);
        }
    }

    createCalendarDay(date, currentMonth) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        const isCurrentMonth = date.getMonth() === currentMonth;
        const isToday = this.isToday(date);
        const dateString = this.formatLocalDate(date);
        const dayAssets = this.assets.filter(asset => asset.date === dateString);
        
        // Add classes
        if (!isCurrentMonth) {
            dayDiv.classList.add('other-month');
        }
        if (isToday) {
            dayDiv.classList.add('today');
        }
        if (dayAssets.length > 0) {
            dayDiv.classList.add('has-data');
            
            // Calculate daily change for color coding
            const currentTotal = dayAssets.reduce((sum, asset) => sum + asset.amount, 0);
            const previousDate = new Date(date);
            previousDate.setDate(date.getDate() - 1);
            const previousDateString = this.formatLocalDate(previousDate);
            const previousAssets = this.assets.filter(asset => asset.date === previousDateString);
            
            if (previousAssets.length > 0) {
                const previousTotal = previousAssets.reduce((sum, asset) => sum + asset.amount, 0);
                const change = currentTotal - previousTotal;
                
                if (change > 0) {
                    dayDiv.classList.add('has-gain');
                } else if (change < 0) {
                    dayDiv.classList.add('has-loss');
                }
            }
        }
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        dayDiv.appendChild(dayNumber);
        
        // Assets info
        if (dayAssets.length > 0 && isCurrentMonth) {
            const dayAssetsDiv = document.createElement('div');
            dayAssetsDiv.className = 'day-assets';
            
            if (this.calendarDisplayMode === 'totalAssets') {
                // Asset count
                const assetCount = document.createElement('div');
                assetCount.className = 'asset-count';
                assetCount.textContent = `${dayAssets.length}筆`;
                dayAssetsDiv.appendChild(assetCount);
                
                // Total amount
                const totalAmount = dayAssets.reduce((sum, asset) => sum + asset.amount, 0);
                const totalDiv = document.createElement('div');
                totalDiv.className = 'total-amount';
                totalDiv.textContent = `${totalAmount.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
                dayAssetsDiv.appendChild(totalDiv);
            } else if (this.calendarDisplayMode === 'dailyChange') {
                // Calculate daily change for this day
                const currentTotal = dayAssets.reduce((sum, asset) => sum + asset.amount, 0);
                const previousDate = new Date(date);
                previousDate.setDate(date.getDate() - 1);
                const previousDateString = this.formatLocalDate(previousDate);
                const previousAssets = this.assets.filter(asset => asset.date === previousDateString);
                const previousTotal = previousAssets.reduce((sum, asset) => sum + asset.amount, 0);
                
                const changeDiv = document.createElement('div');
                changeDiv.className = 'daily-change-display';
                
                if (previousAssets.length > 0) {
                    const change = currentTotal - previousTotal;
                    const changePercent = previousTotal !== 0 ? ((change / previousTotal) * 100) : 0;
                    
                    if (change > 0) {
                        changeDiv.classList.add('positive');
                        changeDiv.innerHTML = `<div class="change-label">增加</div><div class="change-amount">+${change.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</div><div class="change-percent">+${changePercent.toFixed(1)}%</div>`;
                    } else if (change < 0) {
                        changeDiv.classList.add('negative');
                        changeDiv.innerHTML = `<div class="change-label">減少</div><div class="change-amount">${change.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</div><div class="change-percent">${changePercent.toFixed(1)}%</div>`;
                    } else {
                        changeDiv.classList.add('neutral');
                        changeDiv.innerHTML = `<div class="change-label">無變化</div><div class="change-amount">0</div>`;
                    }
                } else {
                    changeDiv.classList.add('neutral');
                    changeDiv.innerHTML = `<div class="change-label">首日</div><div class="change-amount">--</div>`;
                }
                
                dayAssetsDiv.appendChild(changeDiv);
            } else if (this.calendarDisplayMode === 'both') {
                // Show both total assets and daily change
                dayAssetsDiv.classList.add('both-mode');
                
                // Total assets section
                const totalSection = document.createElement('div');
                totalSection.className = 'total-section';
                
                const assetCount = document.createElement('div');
                assetCount.className = 'asset-count';
                assetCount.textContent = `${dayAssets.length}筆`;
                totalSection.appendChild(assetCount);
                
                const totalAmount = dayAssets.reduce((sum, asset) => sum + asset.amount, 0);
                const totalDiv = document.createElement('div');
                totalDiv.className = 'total-amount';
                totalDiv.textContent = `${totalAmount.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
                totalSection.appendChild(totalDiv);
                
                dayAssetsDiv.appendChild(totalSection);
                
                // Daily change section
                const currentTotal = dayAssets.reduce((sum, asset) => sum + asset.amount, 0);
                const previousDate = new Date(date);
                previousDate.setDate(date.getDate() - 1);
                const previousDateString = this.formatLocalDate(previousDate);
                const previousAssets = this.assets.filter(asset => asset.date === previousDateString);
                const previousTotal = previousAssets.reduce((sum, asset) => sum + asset.amount, 0);
                
                const changeSection = document.createElement('div');
                changeSection.className = 'change-section';
                
                if (previousAssets.length > 0) {
                    const change = currentTotal - previousTotal;
                    const changePercent = previousTotal !== 0 ? ((change / previousTotal) * 100) : 0;
                    
                    if (change > 0) {
                        changeSection.classList.add('positive');
                        changeSection.innerHTML = `<div class="change-indicator">+${change.toLocaleString('zh-TW', { maximumFractionDigits: 0 })} (+${changePercent.toFixed(1)}%)</div>`;
                    } else if (change < 0) {
                        changeSection.classList.add('negative');
                        changeSection.innerHTML = `<div class="change-indicator">${change.toLocaleString('zh-TW', { maximumFractionDigits: 0 })} (${changePercent.toFixed(1)}%)</div>`;
                    } else {
                        changeSection.classList.add('neutral');
                        changeSection.innerHTML = `<div class="change-indicator">無變化</div>`;
                    }
                } else {
                    changeSection.classList.add('neutral');
                    changeSection.innerHTML = `<div class="change-indicator">首日</div>`;
                }
                
                dayAssetsDiv.appendChild(changeSection);
            }
            
            dayDiv.appendChild(dayAssetsDiv);
        }
        
        // Click handler
        if (dayAssets.length > 0 && isCurrentMonth) {
            dayDiv.addEventListener('click', () => {
                this.showDailyDetails(dateString, dayAssets);
            });
        }
        
        return dayDiv;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    showDailyDetails(dateString, assets) {
        const date = new Date(dateString);
        const formattedDate = date.toLocaleDateString('zh-TW', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Update modal title
        document.getElementById('dailyDetailsTitle').textContent = `${formattedDate} 資產詳情`;
        
        // Calculate totals
        const totalAmount = assets.reduce((sum, asset) => sum + asset.amount, 0);
        document.getElementById('dailyTotal').textContent = `${totalAmount.toLocaleString('zh-TW')} USDT`;
        
        // Calculate daily change
        const previousDate = new Date(date);
        previousDate.setDate(date.getDate() - 1);
        const previousDateString = this.formatLocalDate(previousDate);
        const previousAssets = this.assets.filter(asset => asset.date === previousDateString);
        const previousTotal = previousAssets.reduce((sum, asset) => sum + asset.amount, 0);
        
        const dailyChangeElement = document.getElementById('dailyChange');
        if (previousAssets.length > 0) {
            const change = totalAmount - previousTotal;
            const changePercent = previousTotal !== 0 ? ((change / previousTotal) * 100) : 0;
            const changeText = change >= 0 ? 
                `+${change.toLocaleString('zh-TW')} (+${changePercent.toFixed(2)}%)` :
                `${change.toLocaleString('zh-TW')} (${changePercent.toFixed(2)}%)`;
            
            dailyChangeElement.textContent = changeText;
            if (change > 0) {
                dailyChangeElement.className = 'value daily-change positive';
            } else if (change < 0) {
                dailyChangeElement.className = 'value daily-change negative';
            } else {
                dailyChangeElement.className = 'value daily-change neutral';
            }
        } else {
            dailyChangeElement.textContent = '--';
            dailyChangeElement.className = 'value daily-change neutral';
        }
        
        // Populate assets list
        const assetsList = document.getElementById('dailyAssetsList');
        assetsList.innerHTML = '';
        
        assets.forEach(asset => {
            const assetItem = document.createElement('div');
            assetItem.className = 'asset-item';
            
            const assetChange = this.calculateDailyChange(asset);
            
            assetItem.innerHTML = `
                <div class="asset-info">
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-details">${asset.currency}</div>
                </div>
                <div class="asset-amount">
                    ${asset.amount.toLocaleString('zh-TW')} USDT
                    <div class="asset-change">${assetChange}</div>
                </div>
                <div class="asset-actions">
                    <button class="edit-btn" onclick="assetTracker.editAsset(${asset.id})">編輯</button>
                    <button class="delete-btn" onclick="assetTracker.deleteAsset(${asset.id})">刪除</button>
                </div>
            `;
            
            assetsList.appendChild(assetItem);
        });
        
        // Show modal
        document.getElementById('dailyDetailsModal').classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeDailyDetailsModal() {
        document.getElementById('dailyDetailsModal').classList.remove('show');
        document.body.style.overflow = '';
    }

    toggleYAxis() {
        this.yAxisVisible = !this.yAxisVisible;
        const button = document.getElementById('toggleYAxis');
        
        if (this.yAxisVisible) {
            button.textContent = '隱藏Y軸數字';
            button.classList.remove('active');
        } else {
            button.textContent = '顯示Y軸數字';
            button.classList.add('active');
        }
        
        this.updateChart();
    }

    handleSort(column) {
        // Toggle sort direction
        if (this.sortConfig.column === column) {
            if (this.sortConfig.direction === 'asc') {
                this.sortConfig.direction = 'desc';
            } else if (this.sortConfig.direction === 'desc') {
                this.sortConfig.direction = null;
                this.sortConfig.column = null;
            } else {
                this.sortConfig.direction = 'asc';
            }
        } else {
            this.sortConfig.column = column;
            this.sortConfig.direction = 'asc';
        }

        // Update sort icons
        this.updateSortIcons();

        // Apply sorting or reset to default
        if (this.sortConfig.column) {
            this.applySorting();
        } else {
            // Reset to default sort (newest first)
            this.filteredAssets.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        this.updateTable();
    }

    applySorting() {
        if (!this.sortConfig.column || !this.sortConfig.direction) return;

        const { column, direction } = this.sortConfig;
        
        this.filteredAssets.sort((a, b) => {
            let aValue, bValue;
            
            switch (column) {
                case 'date':
                    aValue = new Date(a.date);
                    bValue = new Date(b.date);
                    break;
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'amount':
                    aValue = parseFloat(a.amount);
                    bValue = parseFloat(b.amount);
                    break;
                case 'currency':
                    aValue = a.currency.toLowerCase();
                    bValue = b.currency.toLowerCase();
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) {
                return direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    updateSortIcons() {
        // Remove all sort classes
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });

        // Add appropriate class to current sort column
        if (this.sortConfig.column) {
            const header = document.querySelector(`[data-column="${this.sortConfig.column}"]`);
            if (header && this.sortConfig.direction) {
                header.classList.add(`sort-${this.sortConfig.direction}`);
            }
        }
    }

    loadDarkModePreference() {
        const saved = localStorage.getItem('darkMode');
        return saved ? JSON.parse(saved) : false;
    }

    saveDarkModePreference() {
        localStorage.setItem('darkMode', JSON.stringify(this.darkMode));
    }

    initializeDarkMode() {
        if (this.darkMode) {
            document.body.classList.add('dark-mode');
        }
        this.updateDarkModeIcon();
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        this.saveDarkModePreference();
        
        if (this.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        this.updateDarkModeIcon();
        
        // Update chart colors after theme change
        this.updateChart();
    }

    updateDarkModeIcon() {
        const icon = document.querySelector('.toggle-icon');
        if (this.darkMode) {
            icon.textContent = '☀️';
        } else {
            icon.textContent = '🌙';
        }
    }
}

let assetTracker;

document.addEventListener('DOMContentLoaded', () => {
    assetTracker = new AssetTracker();
    
    if (assetTracker.assets.length === 0) {
        setTimeout(() => {
            if (confirm('是否要載入示例數據來體驗功能？')) {
                assetTracker.generateSampleData();
            }
        }, 1000);
    }
});