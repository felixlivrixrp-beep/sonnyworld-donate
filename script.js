// Глобальные переменные
let selectedDonate = null;
let selectedPrice = 0;

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Проверка авторизации
    checkAuth();
    
    // Загрузка статистики
    loadStats();
    
    // Обработчики форм
    document.getElementById('donateForm').addEventListener('submit', processPayment);
    document.getElementById('freeForm').addEventListener('submit', processFreeDonate);
    
    // Обновление статистики каждые 30 секунд
    setInterval(loadStats, 30000);
    
    // Закрытие модального окна
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('freeModal').style.display = 'none';
    });
});

// Выбор доната
function selectDonate(name, price) {
    selectedDonate = name;
    selectedPrice = price;
    
    const infoDiv = document.getElementById('selectedDonateInfo');
    const payButton = document.getElementById('payButton');
    
    if (price === 0) {
        // Бесплатный донат
        showNotification('Вы выбрали бесплатный донат D.Helper');
        document.getElementById('freeModal').style.display = 'flex';
        return;
    }
    
    infoDiv.innerHTML = `
        <h3>${name}</h3>
        <p>Стоимость: <strong>${price} ₽</strong></p>
        <p>После оплаты привилегия выдаётся автоматически</p>
    `;
    
    payButton.innerHTML = `<i class="fas fa-lock"></i> Оплатить ${price} ₽`;
    
    // Прокрутка к форме
    document.querySelector('.payment-section').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// Обработка бесплатного доната
async function processFreeDonate(e) {
    e.preventDefault();
    
    const nickname = document.getElementById('freeNickname').value;
    const email = document.getElementById('freeEmail').value;
    
    if (!nickname || !email) {
        showSweetAlert('error', 'Ошибка', 'Заполните все поля!');
        return;
    }
    
    // Показываем красивое уведомление
    Swal.fire({
        title: 'Отправка заявки...',
        text: 'Пожалуйста, подождите',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        // Сохраняем в Firebase
        await db.collection('free_donates').add({
            nickname: nickname,
            email: email,
            donate: 'D.Helper',
            price: 0,
            status: 'pending',
            timestamp: new Date().toISOString(),
            ip: await getIP()
        });
        
        // Отправляем в Discord
        await sendToDiscord(`📝 Новая заявка на D.Helper\n👤 Игрок: ${nickname}\n📧 Email: ${email}`);
        
        // Закрываем модальное окно
        document.getElementById('freeModal').style.display = 'none';
        
        // Показываем успешное уведомление
        Swal.fire({
            icon: 'success',
            title: 'Заявка отправлена!',
            html: `✅ Заявка на D.Helper для <b>${nickname}</b> принята!<br><br>
                   Привилегия будет выдана в течение 24 часов после проверки.<br>
                   На ${email} придет подтверждение.`,
            confirmButtonText: 'ОК',
            confirmButtonColor: '#FF6B35'
        });
        
        // Обновляем статистику
        updateDonateCount();
        
        // Сбрасываем форму
        document.getElementById('freeForm').reset();
        
    } catch (error) {
        console.error('Ошибка:', error);
        showSweetAlert('error', 'Ошибка', 'Не удалось отправить заявку. Попробуйте позже.');
    }
}

// Обработка оплаты
async function processPayment(e) {
    e.preventDefault();
    
    const nickname = document.getElementById('nickname').value;
    const email = document.getElementById('email').value;
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    
    if (!nickname || !email) {
        showSweetAlert('error', 'Ошибка', 'Заполните все поля!');
        return;
    }
    
    if (!selectedDonate || selectedPrice === 0) {
        showSweetAlert('warning', 'Внимание', 'Выберите привилегию для покупки!');
        return;
    }
    
    // Показываем окно подтверждения
    const { value: accept } = await Swal.fire({
        title: 'Подтверждение покупки',
        html: `<div style="text-align: left; padding: 10px;">
                  <p><b>Привилегия:</b> ${selectedDonate}</p>
                  <p><b>Игрок:</b> ${nickname}</p>
                  <p><b>Сумма:</b> ${selectedPrice} ₽</p>
                  <p><b>Способ оплаты:</b> ${getPaymentMethodName(paymentMethod)}</p>
                  <hr>
                  <p style="color: #888; font-size: 14px;">
                      После оплаты привилегия будет выдана автоматически в течение 5 минут.
                  </p>
              </div>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Перейти к оплате',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#FF6B35',
        cancelButtonColor: '#6c757d'
    });
    
    if (!accept) return;
    
    // Сохраняем заказ в Firebase
    const orderId = generateOrderId();
    
    try {
        await db.collection('orders').doc(orderId).set({
            nickname: nickname,
            email: email,
            donate: selectedDonate,
            price: selectedPrice,
            payment_method: paymentMethod,
            status: 'pending',
            order_id: orderId,
            timestamp: new Date().toISOString(),
            ip: await getIP()
        });
        
        // Перенаправляем на оплату
        if (paymentMethod === 'yoomoney') {
            redirectToYooMoney(selectedPrice, orderId, nickname);
        } else if (paymentMethod === 'card') {
            // Интеграция с другой платежной системой
            showPaymentForm(orderId, selectedPrice);
        } else {
            // QIWI или другая система
            showSweetAlert('info', 'Информация', 
                'Для этого способа оплаты свяжитесь с администратором.');
        }
        
    } catch (error) {
        console.error('Ошибка создания заказа:', error);
        showSweetAlert('error', 'Ошибка', 'Не удалось создать заказ. Попробуйте позже.');
    }
}

// Генерация ID заказа
function generateOrderId() {
    return 'SW' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Перенаправление на ЮMoney
function redirectToYooMoney(amount, orderId, nickname) {
    const yoomoneyUrl = `https://yoomoney.ru/quickpay/confirm.xml?receiver=${SERVER_CONFIG.yoomoneyWallet}&quickpay-form=shop&sum=${amount}&label=${orderId}&successURL=${window.location.origin}/success.html?order=${orderId}&failURL=${window.location.origin}/fail.html?order=${orderId}&targets=Донат+${selectedDonate}+для+${nickname}`;
    
    Swal.fire({
        title: 'Перенаправление на оплату...',
        html: `Вы будете перенаправлены на страницу оплаты ЮMoney.<br>
               <b>Сумма:</b> ${amount} ₽<br>
               <b>Номер заказа:</b> ${orderId}`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Перейти',
        cancelButtonText: 'Отмена',
        confirmButtonColor: '#FF6B35'
    }).then((result) => {
        if (result.isConfirmed) {
            window.open(yoomoneyUrl, '_blank');
            
            // Отслеживание статуса оплаты
            checkPaymentStatus(orderId);
        }
    });
}

// Проверка статуса оплаты
async function checkPaymentStatus(orderId) {
    // Здесь должна быть интеграция с API платежной системы
    // Для демо используем Firebase
    const docRef = db.collection('orders').doc(orderId);
    
    // Слушаем изменения статуса
    docRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (data.status === 'completed') {
                // Выдаем привилегию
                issueDonate(data.nickname, data.donate, orderId);
                
                // Показываем уведомление
                showNotification('Донат успешно оплачен! Привилегия выдается...');
                
                // Отправляем в Discord
                sendToDiscord(`💰 Новый донат!\n👤 Игрок: ${data.nickname}\n🎁 Привилегия: ${data.donate}\n💵 Сумма: ${data.price} ₽\n📝 Order: ${orderId}`);
            }
        }
    });
}

// Выдача привилегии через LuckPerms
async function issueDonate(nickname, donate, orderId) {
    try {
        // Получаем команды для LuckPerms
        const commands = LUCKPERMS_COMMANDS[donate];
        
        if (!commands) {
            throw new Error(`Не найдены команды для привилегии ${donate}`);
        }
        
        // Отправляем команды на сервер через RCON
        for (const cmd of commands) {
            const formattedCmd = cmd.replace('{nickname}', nickname);
            await sendRconCommand(formattedCmd);
        }
        
        // Обновляем статус заказа
        await db.collection('orders').doc(orderId).update({
            status: 'issued',
            issued_at: new Date().toISOString()
        });
        
        // Отправляем уведомление в игре
        await sendRconCommand(`broadcast &a🎉 Игрок &6${nickname} &aкупил привилегию &6${donate}!`);
        
        // Отправляем email
        await sendEmailConfirmation(nickname, donate, orderId);
        
        // Показываем красивое уведомление
        showSuccessNotification(nickname, donate);
        
        console.log(`Привилегия ${donate} выдана игроку ${nickname}`);
        
    } catch (error) {
        console.error('Ошибка выдачи привилегии:', error);
        
        // Помечаем заказ как ошибочный
        await db.collection('orders').doc(orderId).update({
            status: 'error',
            error: error.message
        });
        
        // Отправляем в Discord об ошибке
        sendToDiscord(`❌ Ошибка выдачи доната!\n👤 Игрок: ${nickname}\n🎁 Привилегия: ${donname}\n📝 Order: ${orderId}\n💥 Ошибка: ${error.message}`);
    }
}

// Отправка RCON команды
async function sendRconCommand(command) {
    // В реальном проекте используйте библиотеку для RCON
    // Например: https://www.npmjs.com/package/rcon-client
    
    // Для демо просто логируем
    console.log(`[RCON] ${command}`);
    
    // В реальном проекте:
    // const Rcon = require('rcon-client');
    // const rcon = new Rcon.Rcon({
    //     host: SERVER_CONFIG.rcon.host,
    //     port: SERVER_CONFIG.rcon.port,
    //     password: SERVER_CONFIG.rcon.password
    // });
    // await rcon.connect();
    // await rcon.send(command);
    // await rcon.end();
}

// Отправка в Discord
async function sendToDiscord(message) {
    if (!SERVER_CONFIG.discordWebhook) return;
    
    try {
        await fetch(SERVER_CONFIG.discordWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message })
        });
    } catch (error) {
        console.error('Ошибка отправки в Discord:', error);
    }
}

// Загрузка статистики
async function loadStats() {
    try {
        // Онлайн игроков (можно получать с API сервера)
        const onlineResponse = await fetch('https://api.mcsrvstat.us/2/play.sonnyworld.net');
        const onlineData = await onlineResponse.json();
        
        if (onlineData.online) {
            document.getElementById('onlineCount').textContent = onlineData.players.online;
        }
        
        // Количество донатов
        const donatesSnapshot = await db.collection('orders')
            .where('status', 'in', ['completed', 'issued'])
            .get();
        
        document.getElementById('totalDonates').textContent = donatesSnapshot.size;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Обновление счетчика донатов
async function updateDonateCount() {
    const snapshot = await db.collection('orders')
        .where('status', 'in', ['completed', 'issued'])
        .get();
    
    document.getElementById('totalDonates').textContent = snapshot.size;
}

// Красивые уведомления
function showSweetAlert(icon, title, text) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        confirmButtonText: 'OK',
        confirmButtonColor: '#FF6B35'
    });
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.querySelector('span').textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function showSuccessNotification(nickname, donate) {
    Swal.fire({
        title: '🎉 Успешно!',
        html: `<div style="text-align: center; padding: 20px;">
                  <i class="fas fa-check-circle" style="font-size: 60px; color: #28a745;"></i>
                  <h3>Донат успешно обработан!</h3>
                  <p><b>Игрок:</b> ${nickname}</p>
                  <p><b>Привилегия:</b> ${donate}</p>
                  <p style="color: #888; margin-top: 20px;">
                      Привилегия выдана в игре. Перезайдите на сервер!
                  </p>
              </div>`,
        confirmButtonText: 'Отлично!',
        confirmButtonColor: '#28a745',
        showCloseButton: true
    });
}

// Вспомогательные функции
function getPaymentMethodName(method) {
    const names = {
        'yoomoney': 'ЮMoney',
        'card': 'Банковская карта',
        'qiwi': 'QIWI Кошелек'
    };
    return names[method] || method;
}

async function getIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'unknown';
    }
}

// Проверка авторизации (для админ панели)
function checkAuth() {
    const isAdminPage = window.location.pathname.includes('admin.html');
    
    if (isAdminPage) {
        const adminPass = localStorage.getItem('admin_password');
        if (adminPass !== SERVER_CONFIG.adminPassword) {
            window.location.href = 'index.html';
        }
    }
}
