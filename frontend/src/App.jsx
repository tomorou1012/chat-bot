import { useEffect, useRef, useState } from "react";
import "./style.css";

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

export default function App() {
  const [messages, setMessages] = useState([]);           // {role:'user'|'assistant', content:string}[]
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showResetButton, setShowResetButton] = useState(false);
  const [translations, setTranslations] = useState({});   // { [index]: "和訳" }

  const recognitionRef = useRef(null);

  // 音声認識の初期化
  useEffect(() => {
    if (!SpeechRecognition) return;
    const recog = new SpeechRecognition();
    recog.lang = "en-US";
    recog.interimResults = false;
    recog.onstart = () => setIsListening(true);
    recog.onend = () => setIsListening(false);

    recog.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setMessages((prev) => [...prev, { role: "user", content: transcript }]);

      // API 呼び出し
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "demo_user", text: transcript }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || `Error ${res.status}`);
        return;
      }
      const data = await res.json(); // { reply } を想定

      const assistantMessage = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, assistantMessage]);

      const utter = new SpeechSynthesisUtterance(data.reply);
      utter.lang = "en-US";
      window.speechSynthesis.speak(utter);
    };

    recognitionRef.current = recog;

    // クリーンアップ
    return () => {
      try { recog.abort(); } catch {}
      window.speechSynthesis.cancel();
    };
  }, []);

  // 翻訳
  const handleTranslate = async (msg, i) => {
    try {
      const res = await fetch("http://localhost:8000/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content, direction: "en2ja" }),
      });
      const data = await res.json();
      setTranslations((prev) => ({ ...prev, [i]: data.translated }));
    } catch (e) {
      alert("翻訳に失敗しました");
    }
  };

  // セッション初期化
  const resetSession = () => {
    try { recognitionRef.current?.abort(); } catch {}
    window.speechSynthesis.cancel();
    setMessages([]);
    setFeedback("");
    setShowResetButton(false);
    setIsListening(false);
    setTranslations({});
  };

  // 終了（サーバでフィードバック生成→表示）
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
      setFeedback(data.feedback);
      setShowResetButton(true);

      recognitionRef.current?.abort?.();
      window.speechSynthesis.cancel();
    } catch (e) {
      alert(`Failed to end session: ${e.message}`);
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      alert("SpeechRecognition not supported in this browser.");
      return;
    }
    recognitionRef.current.start();
  };

  return (
    <div className="app">
      {/* ヘッダー */}
      <header className="app-header">
        <div className="app-title">
          <span className="logo">🤖</span>
          <span>English Conversation Bot</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-danger" onClick={endSession} disabled={isListening}>
            End session
          </button>
        </div>
      </header>

      {/* チャットバブル */}
      <main className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "user" : "ai"}`}>
            <div className="avatar">{m.role === "user" ? "🧑" : "🤖"}</div>
            <div className="bubble">
              <div>{m.content}</div>

              {/* AIメッセージに翻訳ボタン */}
              {m.role === "assistant" && (
                <div className="bubble-actions">
                  <button className="btn btn-ghost" onClick={() => handleTranslate(m, i)}>
                    翻訳
                  </button>
                  {translations[i] && <span className="tag">和訳: {translations[i]}</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 終了後のフィードバック */}
        {feedback && (
          <div className="feedback">
            <strong>💬 Feedback:</strong> {feedback}
            {showResetButton && (
              <div className="actions">
                <button className="btn btn-primary" onClick={resetSession}>
                  Start over
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* フッター操作バー */}
      <footer className="footer">
        <button className="btn btn-primary" onClick={startListening} disabled={isListening}>
          {isListening ? "Listening..." : "🎤 Speak"}
        </button>
      </footer>
    </div>
  );
}
