// Инициализация админ панели
document.addEventListener('DOMContentLoaded', function() {
    // Проверка пароля
    checkAdminAuth();
    
    // Загрузка данных
    loadDashboard();
    loadOrders();
    loadPlayers();
    loadLogs();
    
    // Навигация
    setupNavigation();
    
    // Загружаем график
    setTimeout(loadChart, 1000);
});

// Проверка авторизации
function checkAdminAuth() {
    const password = prompt('Введите пароль админ панели:');
    
    if (password !== SERVER_CONFIG.adminPassword) {
        alert('Неверный пароль!');
        window.location.href = 'index.html';
    } else {
        localStorage.setItem('admin_password', password);
    }
}

// Навигация
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Убираем активный класс у всех
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Добавляем активный класс текущему
            this.classList.add('active');
            
            // Показываем нужную секцию
            const targetId = this.getAttribute('href').substring(1);
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// Загрузка дашборда
async function loadDashboard() {
    try {
        // Загрузка статистики
        const ordersSnapshot = await db.collection('orders').get();
        const playersSet = new Set();
        let totalIncome = 0;
        let todayIncome = 0;
        const today = new Date().toDateString();
        
        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            
            if (data.status === 'completed' || data.status === 'issued') {
                totalIncome += data.price;
                playersSet.add(data.nickname);
                
                const orderDate = new Date(data.timestamp).toDateString();
                if (orderDate === today) {
                    todayIncome += data.price;
                }
            }
        });
        
        // Обновляем статистику
        document.getElementById('totalIncome').textContent = totalIncome + ' ₽';
        document.getElementById('totalOrders').textContent = ordersSnapshot.size;
        document.getElementById('totalPlayers').textContent = playersSet.size;
        document.getElementById('todayIncome').textContent = todayIncome + ' ₽';
        
    } catch (error) {
        console.error('Ошибка загрузки дашборда:', error);
    }
}

// Загрузка заказов
async function loadOrders() {
    try {
        const ordersSnapshot = await db.collection('orders')
            .orderBy('timestamp', 'desc')
            .get();
        
        const ordersTable = document.getElementById('ordersTable');
        ordersTable.innerHTML = '';
        
        if (ordersSnapshot.empty) {
            ordersTable.innerHTML = '<tr><td colspan="7">Заказов нет</td></tr>';
            return;
        }
        
        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            const row = createOrderRow(doc.id, data);
            ordersTable.appendChild(row);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        document.getElementById('ordersTable').innerHTML = 
            '<tr><td colspan="7" class="error">Ошибка загрузки</td></tr>';
    }
}

// Создание строки заказа
function createOrderRow(id, data) {
    const row = document.createElement('tr');
    
    // Форматирование даты
    const date = new Date(data.timestamp);
    const formattedDate = date.toLocaleString('ru-RU');
    
    // Статус
    let statusClass = '';
    let statusText = '';
    
    switch(data.status) {
        case 'pending':
            statusClass = 'status-pending';
            statusText = 'Ожидание';
            break;
        case 'completed':
            statusClass = 'status-completed';
            statusText = 'Оплачено';
            break;
        case 'issued':
            statusClass = 'status-issued';
            statusText = 'Выдано';
            break;
        case 'error':
            statusClass = 'status-error';
            statusText = 'Ошибка';
            break;
        default:
            statusClass = 'status-pending';
            statusText = data.status;
    }
    
    row.innerHTML = `
        <td>${id}</td>
        <td>${data.nickname}</td>
        <td>${data.donate}</td>
        <td>${data.price} ₽</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${formattedDate}</td>
        <td>
            ${data.status === 'completed' ? 
                `<button class="btn-action btn-issue" onclick="issueDonateManual('${id}')">
                    <i class="fas fa-check"></i> Выдать
                </button>` : ''}
            ${data.status === 'pending' ? 
                `<button class="btn-action btn-cancel" onclick="cancelOrder('${id}')">
                    <i class="fas fa-times"></i> Отменить
                </button>` : ''}
            <button class="btn-action btn-view" onclick="viewOrder('${id}')">
                <i class="fas fa-eye"></i> Подробно
            </button>
        </td>
    `;
    
    return row;
}

// Фильтрация заказов
async function filterOrders() {
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    let query = db.collection('orders').orderBy('timestamp', 'desc');
    
    if (statusFilter !== 'all') {
        query = query.where('status', '==', statusFilter);
    }
    
    const snapshot = await query.get();
    const ordersTable = document.getElementById('ordersTable');
    ordersTable.innerHTML = '';
    
    snapshot.forEach(doc => {
        const data = doc.data();
        
        // Фильтрация по дате
        if (dateFilter) {
            const orderDate = new Date(data.timestamp).toISOString().split('T')[0];
            if (orderDate !== dateFilter) return;
        }
        
        const row = createOrderRow(doc.id, data);
        ordersTable.appendChild(row);
    });
}

// Ручная выдача доната
async function issueDonateManual(orderId) {
    const confirm = await Swal.fire({
        title: 'Выдача привилегии',
        text: 'Вы уверены, что хотите выдать привилегию вручную?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Выдать',
        cancelButtonText: 'Отмена'
    });
    
    if (!confirm.isConfirmed) return;
    
    try {
        // Получаем данные заказа
        const orderDoc = await db.collection('orders').doc(orderId).get();
        const orderData = orderDoc.data();
        
        // Выдаем привилегию
        await issueDonate(orderData.nickname, orderData.donate, orderId);
        
        // Обновляем статус
        await db.collection('orders').doc(orderId).update({
            status: 'issued',
            issued_at: new Date().toISOString(),
            issued_by: 'admin_manual'
        });
        
        Swal.fire('Успешно!', 'Привилегия выдана вручную', 'success');
        loadOrders();
        
    } catch (error) {
        console.error('Ошибка ручной выдачи:', error);
        Swal.fire('Ошибка!', error.message, 'error');
    }
}

// Просмотр заказа
async function viewOrder(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        const orderData = orderDoc.data();
        
        Swal.fire({
            title: `Заказ ${orderId}`,
            html: `
                <div style="text-align: left;">
                    <p><b>Игрок:</b> ${orderData.nickname}</p>
                    <p><b>Привилегия:</b> ${orderData.donate}</p>
                    <p><b>Сумма:</b> ${orderData.price} ₽</p>
                    <p><b>Статус:</b> ${orderData.status}</p>
                    <p><b>Дата:</b> ${new Date(orderData.timestamp).toLocaleString()}</p>
                    <p><b>Email:</b> ${orderData.email || 'Не указан'}</p>
                    <p><b>IP:</b> ${orderData.ip || 'Неизвестен'}</p>
                    ${orderData.error ? `<p><b>Ошибка:</b> ${orderData.error}</p>` : ''}
                    ${orderData.issued_at ? `<p><b>Выдано:</b> ${new Date(orderData.issued_at).toLocaleString()}</p>` : ''}
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'Закрыть'
        });
        
    } catch (error) {
        console.error('Ошибка просмотра заказа:', error);
        Swal.fire('Ошибка!', 'Не удалось загрузить данные заказа', 'error');
    }
}

// Отмена заказа
async function cancelOrder(orderId) {
    const confirm = await Swal.fire({
        title: 'Отмена заказа',
        text: 'Вы уверены, что хотите отменить этот заказ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Отменить',
        cancelButtonText: 'Оставить',
        confirmButtonColor: '#dc3545'
    });
    
    if (!confirm.isConfirmed) return;
    
    try {
        await db.collection('orders').doc(orderId).update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: 'admin'
        });
        
        Swal.fire('Отменено!', 'Заказ успешно отменен', 'success');
        loadOrders();
        
    } catch (error) {
        console.error('Ошибка отмены заказа:', error);
        Swal.fire('Ошибка!', error.message, 'error');
    }
}

// Загрузка игроков
async function loadPlayers() {
    try {
        const snapshot = await db.collection('orders')
            .where('status', 'in', ['completed', 'issued'])
            .get();
        
        const playersList = document.getElementById('playersList');
        const playersMap = new Map(); // Для уникальных игроков
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!playersMap.has(data.nickname) || 
                new Date(data.timestamp) > new Date(playersMap.get(data.nickname).timestamp)) {
                playersMap.set(data.nickname, data);
            }
        });
        
        playersList.innerHTML = '';
        
        playersMap.forEach((data, nickname) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            const date = new Date(data.timestamp);
            const formattedDate = date.toLocaleDateString('ru-RU');
            
            playerCard.innerHTML = `
                <div class="player-name">${nickname}</div>
                <div class="player-donate">${data.donate}</div>
                <div class="player-date">Куплено: ${formattedDate}</div>
                <div class="player-price">${data.price} ₽</div>
            `;
            
            playersList.appendChild(playerCard);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки игроков:', error);
    }
}

// Загрузка логов
async function loadLogs() {
    // Логи могут храниться в отдельной коллекции
    // или добавляться при каждом действии
    try {
        const snapshot = await db.collection('logs')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        
        const logList = document.getElementById('logList');
        logList.innerHTML = '';
        
        if (snapshot.empty) {
            logList.innerHTML = '<div class="log-entry">Логов нет</div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            
            const time = new Date(data.timestamp).toLocaleTimeString();
            
            let typeClass = '';
            switch(data.type) {
                case 'error': typeClass = 'error'; break;
                case 'success': typeClass = 'success'; break;
                case 'warning': typeClass = 'warning'; break;
                default: typeClass = 'info';
            }
            
            logEntry.innerHTML = `
                <span class="log-time">[${time}]</span>
                <span class="log-type ${typeClass}">[${data.type.toUpperCase()}]</span>
                <span class="log-message">${data.message}</span>
            `;
            
            logList.appendChild(logEntry);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки логов:', error);
    }
}

// Добавление лога
async function addLog(type, message) {
    try {
        await db.collection('logs').add({
            type: type,
            message: message,
            timestamp: new Date().toISOString()
        });
        
        // Обновляем список логов
        loadLogs();
        
    } catch (error) {
        console.error('Ошибка добавления лога:', error);
    }
}

// График дохода
function loadChart() {
    const ctx = document.getElementById('incomeChart').getContext('2d');
    
    // Пример данных за 7 дней
    const data = {
        labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        datasets: [{
            label: 'Доход, ₽',
            data: [1200, 1900, 3000, 5000, 2000, 3000, 4500],
            backgroundColor: 'rgba(255, 107, 53, 0.2)',
            borderColor: '#FF6B35',
            borderWidth: 2,
            tension: 0.4
        }]
    };
    
    new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' ₽';
                        }
                    }
                }
            }
        }
    });
}

// Сохранение настроек
async function savePaymentSettings() {
    const yoomoneyWallet = document.getElementById('yoomoneyWallet').value;
    const qiwiToken = document.getElementById('qiwiToken').value;
    
    // Сохраняем в Firebase или localStorage
    localStorage.setItem('yoomoney_wallet', yoomoneyWallet);
    localStorage.setItem('qiwi_token', qiwiToken);
    
    addLog('success', 'Настройки платежей сохранены');
    Swal.fire('Сохранено!', 'Настройки платежей обновлены', 'success');
}

// Тест RCON подключения
async function testRcon() {
    Swal.fire({
        title: 'Тест подключения...',
        text: 'Проверка соединения с сервером',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        // Тестовая команда
        await sendRconCommand('list');
        
        Swal.fire('Успешно!', 'Подключение к RCON установлено', 'success');
        addLog('success', 'RCON подключение успешно');
        
    } catch (error) {
        Swal.fire('Ошибка!', 'Не удалось подключиться к RCON: ' + error.message, 'error');
        addLog('error', 'Ошибка RCON: ' + error.message);
    }
}

// Тест Discord Webhook
async function testDiscord() {
    const webhookUrl = document.getElementById('discordWebhook').value;
    
    if (!webhookUrl) {
        Swal.fire('Ошибка!', 'Введите URL webhook', 'warning');
        return;
    }
    
    try {
        await sendToDiscord('🔧 Тестовое сообщение от админ панели SonnyWorld');
        Swal.fire('Отправлено!', 'Тестовое сообщение отправлено в Discord', 'success');
        addLog('success', 'Discord webhook протестирован');
        
    } catch (error) {
        Swal.fire('Ошибка!', 'Не удалось отправить сообщение: ' + error.message, 'error');
        addLog('error', 'Ошибка Discord: ' + error.message);
    }
}

// Сохранение настроек безопасности
function saveSecuritySettings() {
    const adminPassword = document.getElementById('adminPassword').value;
    const ipWhitelist = document.getElementById('ipWhitelist').value;
    
    if (adminPassword) {
        localStorage.setItem('admin_password', adminPassword);
    }
    
    localStorage.setItem('ip_whitelist', ipWhitelist);
    
    addLog('success', 'Настройки безопасности сохранены');
    Swal.fire('Сохранено!', 'Настройки безопасности обновлены', 'success');
}

// Выход из админки
function logout() {
    localStorage.removeItem('admin_password');
    window.location.href = 'index.html';
}

// Загрузка последних заказов для дашборда
async function loadRecentOrders() {
    try {
        const snapshot = await db.collection('orders')
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();
        
        const recentOrdersDiv = document.getElementById('recentOrders');
        recentOrdersDiv.innerHTML = '';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const orderDiv = document.createElement('div');
            orderDiv.className = 'order-item';
            
            const time = new Date(data.timestamp).toLocaleTimeString();
            
            orderDiv.innerHTML = `
                <div class="order-player">${data.nickname}</div>
                <div class="order-donate">${data.donate} - ${data.price} ₽</div>
                <div class="order-time">${time}</div>
                <span class="status-badge status-${data.status}">${data.status}</span>
            `;
            
            recentOrdersDiv.appendChild(orderDiv);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки последних заказов:', error);
    }
}
