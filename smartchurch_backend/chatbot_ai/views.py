import uuid
import json
import os
from urllib.parse import quote_plus

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from cachetools import TTLCache
from langchain.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.messages import BaseMessage
from langchain_core.tools import tool
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain_openrouter import ChatOpenRouter
from sqlalchemy import create_engine, text


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CHAT_CACHE_TTL_SECONDS = 3600
MAX_TOOL_CALL_ROUNDS = 5
MAX_TOOL_ROWS = 100
TOOL_MESSAGES = {
    "ask_database": "Mengambil data dari database...",
    "create_visualization": "Membuat plot yang diminta...",
}


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def get_ai_database_connection_string() -> str:
    db_settings = settings.DATABASES["default"]
    user = os.getenv("AI_DB_USER", db_settings.get("USER") or "")
    password = os.getenv("AI_DB_PASSWORD", db_settings.get("PASSWORD") or "")
    host = db_settings.get("HOST", "localhost")
    port = db_settings.get("PORT", "5432")
    database = db_settings.get("NAME")
    return (
        f"postgresql://{quote_plus(str(user))}:{quote_plus(str(password))}"
        f"@{host}:{port}/{database}"
    )


def get_database_connection_string() -> str:
    db_settings = settings.DATABASES["default"]
    return (
        f"postgresql://{db_settings.get('USER')}:{db_settings.get('PASSWORD')}"
        f"@{db_settings.get('HOST', 'localhost')}:{db_settings.get('PORT', '5432')}"
        f"/{db_settings.get('NAME')}"
    )


def _is_read_only_query(query: str) -> bool:
    compact = " ".join(query.lower().split())
    if compact.endswith(";"):
        compact = compact[:-1].strip()
    if ";" in compact:
        return False
    if not (compact.startswith("select ") or compact.startswith("with ")):
        return False
    blocked_tokens = (
        " insert ",
        " update ",
        " delete ",
        " drop ",
        " alter ",
        " truncate ",
        " create ",
        " grant ",
        " revoke ",
    )
    return not any(token in f" {compact} " for token in blocked_tokens)


# ---------------------------------------------------------------------------
# Tool definition
# ---------------------------------------------------------------------------


@tool("query_postgres")
def query_postgres(query: str) -> str:
    """Run a read-only PostgreSQL query and return rows as JSON.
        Here is the schema:
    {
      "tables": {
        "tm_member": {
          "description": "Menyimpan data anggota sistem yang terdaftar",
          "primary_key": "id",
          "columns": {
            "id": "bigint (PK)",
            "full_name": "varchar (required)",
            "gender": "varchar (required)",
            "birth_date": "date (nullable)",
            "member_status": "varchar (required)",
            "phone": "varchar (nullable)",
            "email": "varchar (nullable)",
            "address": "text (nullable)",
            "nickname": "varchar (nullable)",
            "created_at": "timestamp with time zone (required)",
            "updated_at": "timestamp with time zone (required)"
          }
        },
        "t_guest": {
          "description": "Menyimpan data pengunjung tamu dan opsional menghubungkannya ke anggota setelah konversi",
          "primary_key": "id",
          "foreign_keys": {
            "converted_to_member_id": "tm_member.id"
          },
          "columns": {
            "id": "bigint (PK)",
            "full_name": "varchar (required)",
            "phone": "varchar (nullable)",
            "face_encoding": "text (nullable)",
            "notes": "text (nullable)",
            "visit_count": "integer (required)",
            "first_visit": "date (nullable)",
            "last_visit": "date (nullable)",
            "converted_to_member_id": "bigint (nullable, FK -> tm_member.id)",
            "created_at": "timestamp with time zone (required)"
          }
        },
        "t_attendance": {
          "description": "Mencatat log kehadiran untuk anggota dan tamu menggunakan deteksi wajah",
          "primary_key": "id",
          "foreign_keys": {
            "guest_id": "t_guest.id",
            "member_id": "tm_member.id"
          },
          "columns": {
            "id": "bigint (PK)",
            "attendance_date": "date (required)",
            "check_in_time": "timestamp with time zone (required)",
            "confidence": "numeric (required)",
            "notes": "text (nullable)",
            "guest_id": "bigint (nullable, FK -> t_guest.id)",
            "member_id": "bigint (nullable, FK -> tm_member.id)",
            "facedetection_id": "bigint (required)",
            "created_at": "timestamp with time zone (required)"
          }
        },
        "t_summary_report": {
          "description": "Laporan ringkasan kehadiran harian teragregasi",
          "primary_key": "id",
          "columns": {
            "id": "bigint (PK)",
            "report_date": "date (required)",
            "total_members": "integer (required)",
            "total_guests": "integer (required)",
            "total_attendance": "integer (required)",
            "report_summary": "text (nullable)",
            "created_at": "timestamp with time zone (required)"
          }
        }
      }
    }
    """
    if not query or not query.strip():
        return "Query is required."
    if not _is_read_only_query(query):
        return "Only single-statement read-only SELECT/CTE queries are allowed."
    print(f"Executing query: {query}")
    try:
        engine = create_engine(get_ai_database_connection_string())
        with engine.connect() as conn:
            rows = conn.execute(text(query)).mappings().fetchmany(MAX_TOOL_ROWS)
        serialized_rows = [dict(row) for row in rows]
        return json.dumps(
            {"row_count": len(serialized_rows), "rows": serialized_rows},
            default=str,
        )
    except Exception as exc:
        return f"Database query failed: {exc}"


# ---------------------------------------------------------------------------
# Three-Agent Setup: Chat, Query, and Visualization
# ---------------------------------------------------------------------------

# 1. The Query Agent (Agent 2)
QUERY_SYSTEM_PROMPT = (
    "Anda adalah ahli database untuk sistem manajemen gereja. "
    "Anda memiliki akses ke tool query_postgres. Terjemahkan pertanyaan pengguna menjadi "
    "query PostgreSQL SELECT yang read-only, jalankan query tersebut, lalu kembalikan ringkasan hasil yang singkat. "
    "Jangan pernah mencoba INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, atau REVOKE."
)

query_llm = ChatOpenRouter(
    model="openrouter/auto",
    temperature=0.0,
    plugins=[{"id": "auto-router", "allowed_models": ["openai/*"]}],
).bind_tools([query_postgres])
# query_llm = ChatOpenRouter(
#     model="openrouter/free",
#     temperature=0.0,
# ).bind_tools([query_postgres])


@tool("ask_database")
def ask_database(question: str) -> str:
    """Ajukan pertanyaan tentang database gereja. Gunakan tool ini saat membutuhkan data."""
    messages = [
        SystemMessage(content=QUERY_SYSTEM_PROMPT),
        HumanMessage(content=question),
    ]
    for _ in range(MAX_TOOL_CALL_ROUNDS):
        response = query_llm.invoke(messages)
        messages.append(response)
        tool_calls = getattr(response, "tool_calls", [])

        if not tool_calls:
            return str(response.content)

        for tc in tool_calls:
            tool_name = tc.get("name")
            tool_args = tc.get("args", {})
            call_id = tc.get("id")

            try:
                if tool_name == "query_postgres":
                    output = query_postgres.invoke(tool_args)
                else:
                    output = f"Error: Unknown tool '{tool_name}'"
            except Exception as e:
                output = f"Error executing tool: {str(e)}"

            messages.append(ToolMessage(content=str(output), tool_call_id=call_id))

    final_response = query_llm.invoke(messages)
    return str(final_response.content)


# 2. The Visualization Agent (Agent 3)


@tool("generate_seaborn_plot")
def generate_seaborn_plot(
    data_json: str, chart_type: str, x_col: str, y_col: str, title: str
) -> str:
    """
    Membuat plot seaborn/matplotlib secara aman menggunakan parameter yang sudah ditentukan.
    - data_json: String JSON dari dataset (list of dicts).
    - chart_type: Jenis chart yang akan dibuat ('bar', 'line', 'scatter', 'pie').
    - x_col: Nama kolom untuk sumbu x.
    - y_col: Nama kolom untuk sumbu y.
    - title: Judul plot.
    """
    import os
    import uuid
    import pandas as pd
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns
    from django.conf import settings

    media_root = getattr(
        settings, "MEDIA_ROOT", os.path.join(settings.BASE_DIR, "media")
    )
    plots_dir = os.path.join(media_root, "ai_plots")
    os.makedirs(plots_dir, exist_ok=True)

    filename = f"plot_{uuid.uuid4().hex[:8]}.png"
    save_path = os.path.join(plots_dir, filename)

    try:
        data = json.loads(data_json)
        df = pd.DataFrame(data)

        plt.figure(figsize=(10, 6))

        if chart_type == "bar":
            sns.barplot(data=df, x=x_col, y=y_col)
        elif chart_type == "line":
            sns.lineplot(data=df, x=x_col, y=y_col)
        elif chart_type == "scatter":
            sns.scatterplot(data=df, x=x_col, y=y_col)
        elif chart_type == "pie":
            # For pie charts, x_col acts as labels and y_col acts as the values
            plt.pie(df[y_col], labels=df[x_col], autopct="%1.1f%%")
        else:
            plt.close("all")
            return f"Unsupported chart type: '{chart_type}'. Supported types: 'bar', 'line', 'scatter', 'pie'."

        plt.title(title)
        if chart_type != "pie":
            plt.xticks(rotation=45)

        plt.tight_layout()
        plt.savefig(save_path)
        plt.close("all")

        # Build media URL
        media_url = getattr(settings, "MEDIA_URL", "/media/")
        server_path = os.getenv("SERVER_PATH", "http://localhost:8000")

        full_image_url = (
            f"{server_path.rstrip('/')}{media_url.rstrip('/')}/ai_plots/{filename}"
        )

        return f"Plot successfully saved at URL: {full_image_url}"
    except Exception as e:
        plt.close("all")
        return f"Plot generation failed: {str(e)}"


VISUALIZATION_SYSTEM_PROMPT = (
    "Anda adalah ahli visualisasi data untuk sistem manajemen gereja. "
    "Anda memiliki akses ke `query_postgres` untuk mengambil data, dan `generate_seaborn_plot` untuk membuat grafik secara aman. "
    "Ketika diminta membuat grafik, pertama gunakan `query_postgres` untuk mengambil data. "
    "Lalu, ekstrak baris JSON mentah dan kirimkan ke `generate_seaborn_plot` "
    "beserta `chart_type` yang diinginkan ('bar', 'line', 'scatter', 'pie'), `x_col`, `y_col`, dan `title`. "
    "Kembalikan ringkasan singkat dan URL gambar final kepada pengguna."
)

visualization_llm = ChatOpenRouter(
    model="openrouter/auto",
    temperature=0.0,
    plugins=[{"id": "auto-router", "allowed_models": ["openai/*"]}],
).bind_tools([query_postgres, generate_seaborn_plot])


@tool("create_visualization")
def create_visualization(request: str) -> str:
    """Buat chart/grafik. Gunakan ini saat pengguna meminta visualisasi."""
    messages = [
        SystemMessage(content=VISUALIZATION_SYSTEM_PROMPT),
        HumanMessage(content=request),
    ]
    for _ in range(MAX_TOOL_CALL_ROUNDS):
        response = visualization_llm.invoke(messages)
        messages.append(response)
        tool_calls = getattr(response, "tool_calls", [])

        if not tool_calls:
            return str(response.content)

        for tc in tool_calls:
            tool_name = tc.get("name")
            tool_args = tc.get("args", {})
            call_id = tc.get("id")

            try:
                if tool_name == "query_postgres":
                    output = query_postgres.invoke(tool_args)
                elif tool_name == "generate_seaborn_plot":
                    output = generate_seaborn_plot.invoke(tool_args)
                else:
                    output = f"Error: Unknown tool '{tool_name}'"
            except Exception as e:
                output = f"Error executing tool: {str(e)}"

            messages.append(ToolMessage(content=str(output), tool_call_id=call_id))

    final_response = visualization_llm.invoke(messages)
    return str(final_response.content)


# 3. The Chat Agent (Agent 1)
SYSTEM_PROMPT = (
    "Anda adalah asisten yang membantu untuk sistem manajemen gereja. "
    "Anda memiliki akses ke tool ask_database (untuk pertanyaan data berbasis teks) dan tool create_visualization (untuk membuat chart/grafik). "
    "Tunggu respons dari tool tersebut, lalu gabungkan hasilnya dan jawab pengguna secara alami. Sertakan URL gambar dalam format markdown jika pengguna meminta plot."
)

# agent = ChatOpenRouter(
#     model="openrouter/auto",
#     temperature=0.7,
#     streaming=True,
# ).bind_tools([ask_database])
agent = ChatOpenRouter(
    model="openrouter/auto",
    temperature=0.7,
    streaming=True,
    plugins=[{"id": "auto-router", "allowed_models": ["openai/*"]}],
).bind_tools([ask_database, create_visualization])


# ---------------------------------------------------------------------------
# Message history / cache
# ---------------------------------------------------------------------------

chat_cache = TTLCache(maxsize=100, ttl=CHAT_CACHE_TTL_SECONDS)
history_cache = TTLCache(maxsize=100, ttl=CHAT_CACHE_TTL_SECONDS)


def get_message_history(session_id: str) -> SQLChatMessageHistory:
    history = history_cache.get(session_id)
    if history is None:
        history = SQLChatMessageHistory(
            connection=get_database_connection_string(),
            session_id=session_id,
            table_name="chat_history",
        )
        history_cache[session_id] = history
    return history


def get_cached_messages(session_id: str) -> list[BaseMessage]:
    cached = chat_cache.get(session_id)
    if cached is not None:
        return cached
    history = get_message_history(session_id)
    cached = list(history.messages)
    chat_cache[session_id] = cached
    return cached


def get_chat_history(session_id: str) -> list[dict[str, str]]:
    return [serialize_message(m) for m in get_cached_messages(session_id)]


def add_chat_turn(session_id: str, message: str, response: str) -> None:
    user_msg = HumanMessage(content=message)
    asst_msg = AIMessage(content=response)
    history = get_message_history(session_id)
    existing = get_cached_messages(session_id)
    chat_cache[session_id] = [*existing, user_msg, asst_msg]
    history.add_messages([user_msg, asst_msg])


def create_thread_id() -> str:
    return str(uuid.uuid4())


def serialize_message(message: BaseMessage) -> dict[str, str]:
    if isinstance(message, HumanMessage):
        role = "user"
    elif isinstance(message, AIMessage):
        role = "assistant"
    elif isinstance(message, SystemMessage):
        role = "system"
    elif isinstance(message, ToolMessage):
        role = "tool"
    else:
        role = message.__class__.__name__.lower()
    return {"role": role, "content": str(message.content)}


# ---------------------------------------------------------------------------
# Core agent runner (non-streaming, handles tool loops)
# ---------------------------------------------------------------------------


def _build_messages(
    prev_messages: list[BaseMessage], user_message: str
) -> list[BaseMessage]:
    return [
        SystemMessage(content=SYSTEM_PROMPT),
        *prev_messages,
        HumanMessage(content=user_message),
    ]


def run_agent(prev_messages: list[BaseMessage], user_message: str) -> str:
    """Non-streaming: invoke agent and resolve all tool calls, return final text."""
    working_messages = _build_messages(prev_messages, user_message)

    for _ in range(MAX_TOOL_CALL_ROUNDS):
        response = agent.invoke(working_messages)

        # Add the AI message to history so it knows it made the call
        working_messages.append(response)

        tool_calls = getattr(response, "tool_calls", [])

        # If the LLM didn't call a tool, we're done
        if not tool_calls:
            return str(response.content)

        # Resolve each tool call
        for tc in tool_calls:
            tool_name = tc.get("name")
            tool_args = tc.get("args", {})
            call_id = tc.get("id")

            try:
                if tool_name == "ask_database":
                    output = ask_database.invoke(tool_args)
                elif tool_name == "create_visualization":
                    output = create_visualization.invoke(tool_args)
                else:
                    output = f"Error: Unknown tool '{tool_name}'"
            except Exception as e:
                output = f"Error executing tool: {str(e)}"

            # Append the ToolMessage result
            working_messages.append(
                ToolMessage(content=str(output), tool_call_id=call_id)
            )

    # Final pass: If we exited the loop via MAX_TOOL_CALL_ROUNDS,
    # give the model one last chance to provide a summary.
    final_response = agent.invoke(working_messages)
    return str(final_response.content)


# ---------------------------------------------------------------------------
# Streaming agent runner
# ---------------------------------------------------------------------------


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=True)}\n\n"


def stream_agent(prev_messages: list[BaseMessage], user_message: str, thread_id: str):
    working_messages = _build_messages(prev_messages, user_message)
    final_text_parts: list[str] = []

    yield _sse_event({"type": "meta", "thread_id": thread_id})

    for round_num in range(MAX_TOOL_CALL_ROUNDS + 1):
        # 1. Use an aggregator to merge chunks
        full_response_message = None

        for chunk in agent.stream(working_messages):
            # The '+' operator on LangChain messages merges chunks correctly
            full_response_message = (
                chunk
                if full_response_message is None
                else full_response_message + chunk
            )

            if chunk.content:
                text = str(chunk.content)
                yield _sse_event({"type": "chunk", "text": text})

        # 2. Extract tool calls from the FULLY aggregated message
        tool_calls = getattr(full_response_message, "tool_calls", [])

        if not tool_calls:
            # Only add to final text if it was a text response, not a tool call
            if full_response_message.content:
                final_text_parts.append(full_response_message.content)
            break

        # 3. Add the complete AI message (containing the IDs) to history
        working_messages.append(full_response_message)

        for tc in tool_calls:
            tool_name = tc.get("name")
            yield _sse_event(
                {
                    "type": "status",
                    "text": TOOL_MESSAGES.get(
                        tool_name, "Memproses pemanggilan tool..."
                    ),
                }
            )
            tool_args = tc.get("args", {})
            call_id = tc.get("id")  # This will now be populated

            if tool_name == "ask_database":
                output = ask_database.invoke(tool_args)
            elif tool_name == "create_visualization":
                output = create_visualization.invoke(tool_args)
            else:
                output = f"Unknown tool: {tool_name}"

            working_messages.append(
                ToolMessage(content=str(output), tool_call_id=call_id)
            )

    response_text = "".join(final_text_parts)
    yield _sse_event({"type": "done"})
    add_chat_turn(thread_id, user_message, response_text)


# ---------------------------------------------------------------------------
# SSE renderer
# ---------------------------------------------------------------------------


class ServerSentEventRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "sse"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return ""
        if isinstance(data, str):
            return data
        return json.dumps(data, ensure_ascii=True)


# ---------------------------------------------------------------------------
# View
# ---------------------------------------------------------------------------


@api_view(["GET", "POST"])
@renderer_classes([JSONRenderer, ServerSentEventRenderer])
def chat(request, thread_id=None):
    """Handle chat messages and history retrieval."""
    tid = thread_id or request.query_params.get("thread_id")

    if not tid:
        if request.method == "GET":
            return Response(
                {"error": "thread_id is required for history"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tid = create_thread_id()
    else:
        tid = str(tid)

    if request.method == "GET":
        return Response(
            {"thread_id": tid, "messages": get_chat_history(tid)},
            status=status.HTTP_200_OK,
        )

    message = request.data.get("message")
    if not message:
        return Response(
            {"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST
        )

    prev_messages = get_cached_messages(tid)

    wants_stream = (
        request.query_params.get("stream") == "1"
        or "text/event-stream" in request.headers.get("accept", "").lower()
    )

    if wants_stream:
        response = StreamingHttpResponse(
            stream_agent(prev_messages, message, tid),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"

        return response

    # Non-streaming path
    response_text = run_agent(prev_messages, message)
    add_chat_turn(tid, message, response_text)
    return Response(
        {"thread_id": tid, "message": response_text},
        status=status.HTTP_200_OK,
    )
