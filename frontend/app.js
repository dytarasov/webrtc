// Определяем элементы интерфейса
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const loginButton = document.getElementById('login-button');
const stopButton = document.getElementById('stop-button');

// Переменные для работы с WebRTC и WebSocket
let websocket = null;
let peerConnection = null;
let localStream = null;

// Настройки ICE-сервера, включающего TURN-сервер
const iceServers = {
    iceServers: [
        {
            urls: 'turn:212.237.217.86:3478',
            username: '<YOUR_USERNAME>',
            credential: '<YOUR_PASSWORD>'
        }
    ]
};

// Показ и скрытие экранов
function showScreen(screen) {
    loginScreen.classList.add('hidden');
    chatScreen.classList.add('hidden');
    screen.classList.remove('hidden');
}

// Обработка входа пользователя
loginButton.addEventListener('click', () => {
    // Переводим пользователя на экран видеочата
    showScreen(chatScreen);
    // Начинаем видеочат
    startChat();
});

// Функция для старта видеочата
async function startChat() {
    // Получение видеопотока с камеры
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Ошибка доступа к камере и микрофону:', error);
        return;
    }

    // Устанавливаем WebSocket соединение с сигнальным сервером
    websocket = new WebSocket('ws://localhost:450/ws');

    websocket.onopen = () => {
        console.log('WebSocket соединение установлено');
    };

    websocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'offer') {
            await handleOffer(message);
        } else if (message.type === 'answer') {
            await handleAnswer(message);
        } else if (message.type === 'candidate') {
            await handleCandidate(message);
        }
    };

    websocket.onclose = () => {
        console.log('WebSocket соединение закрыто');
    };

    createPeerConnection();
}

// Функция для создания RTCPeerConnection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(iceServers);

    // Добавляем треки локального потока
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Обработка получения удаленного трека
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Обработка ICE кандидатов
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            websocket.send(JSON.stringify({
                type: 'candidate',
                candidate: event.candidate
            }));
        }
    };

    // Создание предложения для установления соединения
    peerConnection.onnegotiationneeded = async () => {
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            websocket.send(JSON.stringify({ type: 'offer', offer: offer }));
        } catch (error) {
            console.error('Ошибка при создании предложения:', error);
        }
    };
}

// Обработка предложения (SDP Offer) от другого клиента
async function handleOffer(message) {
    if (!peerConnection) {
        createPeerConnection();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    websocket.send(JSON.stringify({ type: 'answer', answer: answer }));
}

// Обработка ответа (SDP Answer) от другого клиента
async function handleAnswer(message) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
}

// Обработка ICE-кандидатов, полученных от другого клиента
async function handleCandidate(message) {
    try {
        await peerConnection.addIceCandidate(message.candidate);
    } catch (error) {
        console.error('Ошибка при добавлении ICE кандидата:', error);
    }
}

// Обработка нажатия кнопки "Стоп"
stopButton.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
});
