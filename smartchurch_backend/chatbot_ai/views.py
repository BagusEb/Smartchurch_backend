import uuid
import json
import os
from urllib.parse import quote_plus
from typing import Annotated, Literal
from typing_extensions import TypedDict

from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from cachetools import TTLCache
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    BaseMessage,
    AIMessageChunk,
)
from langchain_core.tools import tool
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain_openrouter import ChatOpenRouter
from sqlalchemy import create_engine, text
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.types import Command


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CHAT_CACHE_TTL_SECONDS = 3600
MAX_TOOL_CALL_ROUNDS = 5
MAX_TOOL_ROWS = 100

TOOL_MESSAGES = {
    "query_postgres": "Mengambil data dari database...",
    "generate_seaborn_plot": "Membuat plot yang diminta...",
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
# Low-level tools
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
    import pandas as pd
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns

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

        media_url = getattr(settings, "MEDIA_URL", "/media/")
        server_path = os.getenv("SERVER_PATH", "http://localhost:8000")
        full_image_url = (
            f"{server_path.rstrip('/')}{media_url.rstrip('/')}/ai_plots/{filename}"
        )
        return f"Plot successfully saved at URL: {full_image_url}"
    except Exception as e:
        plt.close("all")
        return f"Plot generation failed: {str(e)}"


# ---------------------------------------------------------------------------
# LangGraph State
# ---------------------------------------------------------------------------


class GraphState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    # The user's original question, passed cleanly to sub-agents without
    # fishing through message history for a ToolMessage.
    task: str


# ---------------------------------------------------------------------------
# LLM instances
# ---------------------------------------------------------------------------

QUERY_SYSTEM_PROMPT = (
    "Anda adalah ahli database untuk sistem manajemen gereja. "
    "Anda memiliki akses ke tool query_postgres. Terjemahkan pertanyaan pengguna menjadi "
    "query PostgreSQL SELECT yang read-only, jalankan query tersebut, lalu kembalikan ringkasan hasil yang singkat. "
    "Jangan pernah mencoba INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, atau REVOKE."
)

VISUALIZATION_SYSTEM_PROMPT = (
    "Anda adalah ahli visualisasi data untuk sistem manajemen gereja. "
    "Anda memiliki akses ke `query_postgres` untuk mengambil data, dan `generate_seaborn_plot` untuk membuat grafik secara aman. "
    "Ketika diminta membuat grafik, pertama gunakan `query_postgres` untuk mengambil data. "
    "Lalu, ekstrak baris JSON mentah dan kirimkan ke `generate_seaborn_plot` "
    "beserta `chart_type` yang diinginkan ('bar', 'line', 'scatter', 'pie'), `x_col`, `y_col`, dan `title`. "
    "Kembalikan ringkasan singkat dan URL gambar final kepada pengguna."
)

# The supervisor no longer needs tool definitions — routing is done in Python,
# not by the LLM emitting tool calls. The LLM just decides which agent to use
# by responding with a simple JSON intent, keeping the message history clean.
SUPERVISOR_SYSTEM_PROMPT = (
    "Anda adalah supervisor untuk sistem manajemen gereja. "
    "Tentukan agen mana yang paling tepat untuk menangani permintaan pengguna:\n"
    "  • 'query_agent'    — untuk pertanyaan berbasis data/teks tentang database\n"
    "  • 'viz_agent'      — untuk membuat chart atau grafik\n"
    "  • 'general_agent'  — untuk percakapan santai, sapaan, atau jika tidak butuh data\n\n"
    "Balas HANYA dengan JSON berikut dan tidak ada yang lain:\n"
    '{"agent": "query_agent"} atau {"agent": "viz_agent"} atau {"agent": "general_agent"}\n\n'
    "Jangan tambahkan teks lain, penjelasan, atau markdown. Hanya JSON."
)

GENERAL_SYSTEM_PROMPT = (
    "Anda adalah AI Assistant yang ramah untuk sistem manajemen gereja. "
    "Jawab sapaan atau pertanyaan umum dengan sopan dan singkat. "
    "Bantu arahkan mereka jika mereka ingin bertanya tentang kehadiran, data jemaat, atau laporan."
)

general_llm = ChatOpenRouter(
    model="openrouter/auto",
    temperature=0.0,
    streaming=True,
    plugins=[{"id": "auto-router", "allowed_models": ["openai/*"]}],
)

query_llm = ChatOpenRouter(
    model="openrouter/auto",
    temperature=0.0,
    streaming=True,
    plugins=[{"id": "auto-router", "allowed_models": ["openai/*"]}],
).bind_tools([query_postgres])

visualization_llm = ChatOpenRouter(
    model="openrouter/auto",
    temperature=0.0,
    streaming=True,
    plugins=[{"id": "auto-router", "allowed_models": ["openai/*"]}],
).bind_tools([query_postgres, generate_seaborn_plot])

# Supervisor only classifies intent — no tools needed.
supervisor_llm = ChatOpenRouter(
    model="openrouter/auto",
    temperature=0.0,
    plugins=[{"id": "auto-router", "allowed_models": ["openai/*"]}],
)

# ---------------------------------------------------------------------------
# Graph node helpers
# ---------------------------------------------------------------------------

TOOL_REGISTRY = {
    "query_postgres": query_postgres,
    "generate_seaborn_plot": generate_seaborn_plot,
}


def _execute_tool_calls(tool_calls: list[dict]) -> list[ToolMessage]:
    """Execute a list of tool call dicts and return ToolMessages."""
    results: list[ToolMessage] = []
    for tc in tool_calls:
        fn = TOOL_REGISTRY.get(tc["name"])
        if fn is None:
            content = f"Error: Unknown tool '{tc['name']}'"
        else:
            try:
                content = fn.invoke(tc["args"])
            except Exception as exc:
                content = f"Error executing tool: {exc}"
        results.append(ToolMessage(content=str(content), tool_call_id=tc["id"]))
    return results


def _run_react_loop(
    llm,
    system_prompt: str,
    task: str,
    config: dict = None,
) -> str:
    """
    Generic ReAct loop: call the LLM, execute any tool calls it emits,
    feed results back, repeat until the LLM stops calling tools.
    Returns the final text content.
    """
    working: list[BaseMessage] = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=task),
    ]
    for _ in range(MAX_TOOL_CALL_ROUNDS):
        response = llm.invoke(working, config=config)
        working.append(response)
        tool_calls = getattr(response, "tool_calls", [])
        if not tool_calls:
            break
        working.extend(_execute_tool_calls(tool_calls))

    return str(working[-1].content) if working else "Tidak ada hasil."


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------


def supervisor_node(
    state: GraphState,
) -> Command[Literal["query_agent", "viz_agent", "general_agent"]]:
    """
    Classifies the user's intent and routes to the appropriate sub-agent
    using a LangGraph Command.

    Key improvements over the original:
    - No fake routing tools — the LLM just returns JSON, keeping the message
      history free of spurious ToolMessages.
    - The routing decision is made in Python, not inferred from tool call names.
    - `task` is set here once and passed cleanly to sub-agents via state,
      so they don't need to fish for it in the message history.
    """
    # The task is always the most recent human message.
    task = next(
        (m.content for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        "Tolong bantu saya.",
    )

    classification_response = supervisor_llm.invoke(
        [
            SystemMessage(content=SUPERVISOR_SYSTEM_PROMPT),
            HumanMessage(content=task),
        ]
    )

    try:
        raw = str(classification_response.content).strip()
        intent = json.loads(raw).get("agent", "general_agent")
    except (json.JSONDecodeError, AttributeError):
        # Default to general agent if classification fails.
        intent = "general_agent"

    if intent == "viz_agent":
        next_node: Literal["query_agent", "viz_agent", "general_agent"] = "viz_agent"
    elif intent == "query_agent":
        next_node = "query_agent"
    else:
        next_node = "general_agent"

    # Pass the task forward in state; no message is added to history here.
    return Command(goto=next_node, update={"task": task})


from langchain_core.runnables import RunnableConfig


def query_agent_node(
    state: GraphState, config: RunnableConfig
) -> Command[Literal[END]]:
    """
    Runs a ReAct loop with query_postgres and returns its answer directly
    as the final AIMessage — no synthesizer needed since the agent already
    produces clean prose.
    """
    result = _run_react_loop(query_llm, QUERY_SYSTEM_PROMPT, state["task"], config)
    return Command(goto=END, update={"messages": [AIMessage(content=result)]})


def viz_agent_node(state: GraphState, config: RunnableConfig) -> Command[Literal[END]]:
    """
    Runs a ReAct loop with query_postgres + generate_seaborn_plot and returns
    its answer directly as the final AIMessage.
    """
    result = _run_react_loop(
        visualization_llm, VISUALIZATION_SYSTEM_PROMPT, state["task"], config
    )
    return Command(goto=END, update={"messages": [AIMessage(content=result)]})


def general_agent_node(
    state: GraphState, config: RunnableConfig
) -> Command[Literal[END]]:
    """
    A simple node for chitchat without tools.
    """
    response = general_llm.invoke(
        [
            SystemMessage(content=GENERAL_SYSTEM_PROMPT),
            HumanMessage(content=state["task"]),
        ],
        config=config,
    )
    return Command(
        goto=END, update={"messages": [AIMessage(content=str(response.content))]}
    )


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------


def build_graph() -> StateGraph:
    builder = StateGraph(GraphState)

    builder.add_node("supervisor", supervisor_node)
    builder.add_node("query_agent", query_agent_node)
    builder.add_node("viz_agent", viz_agent_node)
    builder.add_node("general_agent", general_agent_node)

    # Entry → supervisor classifies and routes via Command.
    # Sub-agents route directly to END via Command — no extra edges needed.
    builder.add_edge(START, "supervisor")

    return builder.compile()


graph = build_graph()


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


def get_chat_history(session_id: str) -> list[dict]:
    return [_serialize_message(m) for m in get_cached_messages(session_id)]


def add_chat_turn(session_id: str, message: str, response: str) -> None:
    user_msg = HumanMessage(content=message)
    asst_msg = AIMessage(content=response)
    history = get_message_history(session_id)
    existing = get_cached_messages(session_id)
    chat_cache[session_id] = [*existing, user_msg, asst_msg]
    history.add_messages([user_msg, asst_msg])


def create_thread_id() -> str:
    return str(uuid.uuid4())


def _serialize_message(message: BaseMessage) -> dict:
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
# Runner helpers
# ---------------------------------------------------------------------------


def _initial_state(prev_messages: list[BaseMessage], user_message: str) -> GraphState:
    return {
        "messages": [*prev_messages, HumanMessage(content=user_message)],
        "task": user_message,
    }


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=True)}\n\n"


def stream_agent(prev_messages: list[BaseMessage], user_message: str, thread_id: str):
    """
    Streaming generator using graph.stream() with stream_mode="messages"
    to capture both tool calls and text generation chunks.
    """
    initial_state = _initial_state(prev_messages, user_message)

    yield _sse_event({"type": "meta", "thread_id": thread_id})
    final_text_parts: list[str] = []

    try:
        from langchain_core.messages import AIMessageChunk

        for chunk, metadata in graph.stream(initial_state, stream_mode="messages"):
            if metadata.get("langgraph_node") == "supervisor":
                continue

            # The chunk is a message object. If it has tool call chunks with names, it's starting a tool call.
            tool_call_chunks = getattr(chunk, "tool_call_chunks", [])
            for tc_chunk in tool_call_chunks:
                name = tc_chunk.get("name")
                if name:
                    status_label = TOOL_MESSAGES.get(name, f"Memanggil {name}...")
                    yield _sse_event({"type": "status", "text": status_label})

            if isinstance(chunk, AIMessageChunk) and chunk.content:
                text = str(chunk.content)
                final_text_parts.append(text)
                yield _sse_event({"type": "chunk", "text": text})

        full_text = "".join(final_text_parts)
        add_chat_turn(thread_id, user_message, full_text)
        yield _sse_event({"type": "done"})

    except Exception as e:
        print(f"Streaming error: {e}")
        yield _sse_event({"type": "chunk", "text": "Maaf, terjadi kesalahan internal."})
        yield _sse_event({"type": "done"})


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
    response = StreamingHttpResponse(
        stream_agent(prev_messages, message, tid),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
