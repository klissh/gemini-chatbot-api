const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const sendButton = form.querySelector('button');

// Variabel untuk menyimpan riwayat percakapan sesuai format Gemini
let conversationHistory = [];

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Tampilkan pesan pengguna di UI
  appendMessage('user', userMessage);
  input.value = '';
  
  // Nonaktifkan form saat menunggu respons
  setLoading(true);

  try {
    // Kirim pesan dan riwayat ke backend
    const response = await fetch('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        history: conversationHistory,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Something went wrong');
    }

    const data = await response.json();
    const botMessage = data.output;
    
    // Tampilkan respons bot di UI
    appendMessage('bot', botMessage);
    
    // Perbarui riwayat percakapan dengan data dari backend
    conversationHistory = data.history;

  } catch (error) {
    console.error('Error:', error);
    appendMessage('bot', `Error: ${error.message}`);
  } finally {
    // Aktifkan kembali form
    setLoading(false);
  }
});

function appendMessage(sender, text) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', sender);
  
  // Sanitasi sederhana untuk mencegah rendering HTML dari respons
  const textNode = document.createTextNode(text);
  msgDiv.appendChild(textNode);
  
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setLoading(isLoading) {
    input.disabled = isLoading;
    sendButton.disabled = isLoading;
    if (isLoading) {
        sendButton.textContent = '...';
    } else {
        sendButton.textContent = 'Send';
        input.focus(); // Fokus kembali ke input setelah selesai
    }
}