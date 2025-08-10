from fastapi import FastAPI, HTTPException
from openai.error import RateLimitError, AuthenticationError, OpenAIError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import traceback

# .env 読み込み
load_dotenv()

import openai  # ※ いまは openai==0.28 を使う前提
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# ★CORS: 開発中は完全開放＋localhost/127.0.0.1 両方許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*","http://localhost:5173","http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Msg(BaseModel):
    user_id: str
    text: str

conversations = {}

SYSTEM_PROMPT = (
    "You are an English-only conversation partner for language practice. "
    "Always reply in English, keep responses concise (1–3 sentences), "
    "ask a simple follow-up question, and avoid using Japanese. "
    "If the user speaks non-English, gently remind them to use English."
)

@app.get("/")
def root():
    return {"ok": True, "endpoints": ["/chat", "/docs"]}

@app.post("/chat")
def chat(m: Msg):
    try:
        uid = m.user_id
        if uid not in conversations or not conversations[uid]:
            conversations[uid] = [{"role": "system", "content": SYSTEM_PROMPT}]

        # ユーザー発言を追加
        conversations[uid].append({"role": "user", "content": m.text})


        # 直近だけ送る（systemは必ず含める）
        base = [conversations[uid][0]]    # system
        recent = conversations[uid][-8:] # user/assistant混在の直近
        history = base + recent

        # OpenAI API 呼び出し
        r = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=history,
            max_tokens=256,
            temperature=0.7,
            presence_penalty=0.0,
            frequency_penalty=0.2
        )
        reply = r["choices"][0]["message"]["content"]

        conversations[uid].append({"role": "assistant", "content": reply})
        return {"end": False, "reply": reply}

    except RateLimitError:
        # ★ 429で明示的に返す → フロントで分かりやすい
        raise HTTPException(status_code=429, detail="OpenAI: quota exceeded. Check plan & billing.")
    except AuthenticationError:
        raise HTTPException(status_code=401, detail="OpenAI: invalid API key.")
    except OpenAIError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {str(e)}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/end")
def end_session(m: Msg):
    uid = m.user_id
    # これまでのユーザー発話を取得
    hist = conversations.get(uid, [])
    user_msgs = [x["content"] for x in hist if x.get("role") == "user"]
    total_turns = len(user_msgs)

    # かんたんフィードバック（必要に応じて自由に改善OK）
    avg_len = (sum(len(t.split()) for t in user_msgs) / total_turns) if total_turns else 0
    tips = []
    if avg_len < 6:
        tips.append("Try forming slightly longer sentences.")
    if total_turns < 5:
        tips.append("Practice a bit more to build fluency.")
    if not tips:
        tips.append("Great pacing and clarity!")

    feedback = (
        f"📝 Session summary: You spoke {total_turns} turns in English. "
        f"Avg. sentence length ≈ {avg_len:.1f} words. " + " ".join(tips)
    )

    # サーバー側の履歴をリセット
    conversations[uid] = []

    return {"feedback": feedback}
