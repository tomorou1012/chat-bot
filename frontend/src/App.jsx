import { useState } from "react";

const recognition = new (window.SpeechRecognition ||
  window.webkitSpeechRecognition)();
recognition.lang = "en-US";
recognition.interimResults = false;

const synth = window.speechSynthesis;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showResetButton, setShowResetButton] = useState(false);

  const resetSession = () => {
    // 進行中の処理を止める（念のため）
    recognition.abort?.();
    window.speechSynthesis.cancel();

    // 初期状態に戻す
    setMessages([]);
    setFeedback("");
    setIsListening(false);
  };

  const endSession = async () => {
    if (!confirm("End the session now?")) return;

    try {
      const res = await fetch("http://localhost:8000/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "demo_user", text: "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || `Error ${res.status}`);
        return;
      }
      const data = await res.json();

      // フィードバックを表示（自動リセットはしない）
      setFeedback(data.feedback);
      setShowResetButton(true);  // 「Start over」ボタンを出す

      // マイクと読み上げは停止（任意）
      recognitionRef.current?.abort?.();
      window.speechSynthesis.cancel();
    } catch (e) {
      alert(`Failed to end session: ${e.message}`);
    }
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
    } else {
      const assistantMessage = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, assistantMessage]);
      const utter = new SpeechSynthesisUtterance(data.reply);
      utter.lang = "en-US";
      synth.speak(utter);
    }

  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
      {/* タイトル＋End sessionボタン */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🎙️ 英会話ボット</h1>
        <button
          onClick={endSession}
          disabled={isListening}
          style={{ padding: "6px 10px" }}
        >
          End session
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.role === "user" ? "あなた" : "AI"}:</strong>{" "}
            {msg.content}
          </div>
        ))}
      </div>

      {feedback && (
        <div
          style={{
            background: "red",
            padding: "10px",
            borderLeft: "5px solid red",
            marginTop: 12,
          }}
        >
          <strong>💬 フィードバック:</strong> {feedback}
          {showResetButton && (
            <button
              onClick={resetSession}
              style={{ marginTop: 10, padding: "8px 12px" }}
            >
              Start over
            </button>
          )}
        </div>
      )}

      <button
        onClick={startListening}
        disabled={isListening}
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
