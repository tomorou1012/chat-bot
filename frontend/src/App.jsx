import { useState } from "react";

const recognition = new (window.SpeechRecognition ||
  window.webkitSpeechRecognition)();
recognition.lang = "en-US";
recognition.interimResults = false;

const synth = window.speechSynthesis;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [turn, setTurn] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [translations, setTranslations] = useState({}); // 翻訳結果を保持
  // 翻訳API呼び出し関数
  const handleTranslate = async (msg, i) => {
    const res = await fetch("http://localhost:8000/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg.content, direction: "en2ja" }),
    });
    const data = await res.json();
    setTranslations((prev) => ({ ...prev, [i]: data.translated }));
  };

  const resetSession = () => {
    // 進行中の処理を止める（念のため）
    recognition.abort?.();
    window.speechSynthesis.cancel();

    // 初期状態に戻す
    setMessages([]);
    setTurn(0);
    setFeedback("");
    setIsListening(false);
  };

  const startListening = () => {
    recognition.start();
    setIsListening(true);
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    setIsListening(false);

    const userMessage = { role: "user", content: transcript };
    setMessages((prev) => [...prev, userMessage]);

    const res = await fetch("http://localhost:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "demo_user", text: transcript }),
    });
    const data = await res.json();

    if (data.end) {
      setFeedback(data.feedback);
      setTimeout(() => {
        resetSession(); // 初期状態に戻す
      }, 5000);
      return; // 終了なので返す
    }

    if (data.end) {
      setFeedback(data.feedback);
    } else {
      const assistantMessage = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, assistantMessage]);
      const utter = new SpeechSynthesisUtterance(data.reply);
      utter.lang = "en-US";
      synth.speak(utter);
    }

    setTurn((prev) => prev + 1);
  };

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "600px",
        margin: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h1>🎙️ 英会話ボット（10ターンで終了）</h1>
      <div style={{ marginBottom: "1rem", textAlign: "center" }}>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.role === "user" ? "あなた" : "AI"}:</strong>{" "}
            {msg.content}
            {msg.role === "assistant" && (
              <>
                <button
                  style={{ marginLeft: "1em" }}
                  onClick={() => handleTranslate(msg, i)}
                >
                  翻訳
                </button>
                {translations[i] && (
                  <span style={{ color: "gray", marginLeft: "1em" }}>
                    和訳: {translations[i]}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {feedback && (
        <div
          style={{
            background: "red",
            padding: "10px",
            borderLeft: "5px solid red",
          }}
        >
          <strong>💬 フィードバック:</strong> {feedback}
        </div>
      )}
      <button
        onClick={startListening}
        disabled={isListening || turn >= 10}
        style={{
          backgroundColor: isListening ? "#aaa" : "#007bff",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        {isListening ? "🎧 聞き取り中..." : "🎤 話す"}
      </button>
    </div>
  );
}
